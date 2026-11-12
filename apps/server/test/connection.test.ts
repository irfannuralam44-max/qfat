import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, closeDatabase, createTempDatabase, checkIntegrity, isWalMode, areForeignKeysEnabled, getBusyTimeout } from '../src/db/connection.js';
import { runMigrationsWithVerification } from '../src/db/migrate.js';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { existsSync, unlinkSync, rmSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import * as schema from '../src/schema/index.js';

/**
 * Test fixture: creates a temporary database file and returns its path
 * with a cleanup function.
 */
function createTestDb(): { path: string; cleanup: () => void } {
  const path = createTempDatabase('qfat-test');
  const cleanup = () => {
    try {
      if (existsSync(path)) unlinkSync(path);
      // Also clean up WAL/SHM sidecars if they exist
      if (existsSync(`${path}-wal`)) unlinkSync(`${path}-wal`);
      if (existsSync(`${path}-shm`)) unlinkSync(`${path}-shm`);
    } catch {
      // Ignore cleanup errors
    }
  };
  return { path, cleanup };
}

describe('SQLite Connection', () => {
  let dbPath: string;
  let cleanup: () => void;

  before(() => {
    const fixture = createTestDb();
    dbPath = fixture.path;
    cleanup = fixture.cleanup;
  });

  after(() => {
    cleanup();
  });

  test('opens file-backed database and verifies PRAGMAs', () => {
    const result = openDatabase(dbPath);

    assert.ok(result.db.open, 'Database should be open');
    assert.equal(result.journalMode.toLowerCase(), 'wal', 'WAL mode should be enabled');
    assert.equal(result.foreignKeys, 1, 'Foreign keys should be enforced');
    assert.equal(result.busyTimeout, 5000, 'Busy timeout should be 5000ms');
    assert.ok(result.sqliteVersion, 'SQLite version should be available');

    closeDatabase(result.db);
  });

  test('enables and verifies foreign key enforcement', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    // Create parent and child tables with FK
    db.exec(`
      CREATE TABLE parent (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT, name TEXT, FOREIGN KEY(parent_id) REFERENCES parent(id) ON DELETE CASCADE);
    `);

    // Valid FK insert should succeed
    db.prepare('INSERT INTO parent (id, name) VALUES (?, ?)').run('p1', 'Parent 1');
    db.prepare('INSERT INTO child (id, parent_id, name) VALUES (?, ?, ?)').run('c1', 'p1', 'Child 1');

    // Invalid FK insert should fail
    assert.throws(
      () => {
        db.prepare('INSERT INTO child (id, parent_id, name) VALUES (?, ?, ?)').run('c2', 'non-existent', 'Child 2');
      },
      /FOREIGN KEY constraint failed/
    );

    // FK cascade delete
    db.prepare('DELETE FROM parent WHERE id = ?').run('p1');
    const children = db.prepare('SELECT * FROM child WHERE parent_id = ?').all('p1');
    assert.equal(children.length, 0, 'Cascade delete should remove child rows');

    closeDatabase(db);
  });

  test('transaction commit persists data', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_commit (id TEXT PRIMARY KEY, value TEXT);
    `);

    const tx = db.transaction(() => {
      db.prepare('INSERT INTO test_commit (id, value) VALUES (?, ?)').run('tx1', 'committed');
      db.prepare('INSERT INTO test_commit (id, value) VALUES (?, ?)').run('tx2', 'also committed');
    });

    tx();

    const rows = db.prepare('SELECT * FROM test_commit ORDER BY id').all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].value, 'committed');
    assert.equal(rows[1].value, 'also committed');

    closeDatabase(db);
  });

  test('transaction rollback leaves no partial data', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_rollback (id TEXT PRIMARY KEY, value TEXT);
    `);

    // Insert baseline
    db.prepare('INSERT INTO test_rollback (id, value) VALUES (?, ?)').run('base', 'baseline');

    assert.throws(() => {
      const tx = db.transaction(() => {
        db.prepare('INSERT INTO test_rollback (id, value) VALUES (?, ?)').run('tx1', 'rolled back');
        db.prepare('INSERT INTO test_rollback (id, value) VALUES (?, ?)').run('tx2', 'also rolled back');
        throw new Error('Intentional rollback');
      });
      tx();
    }, /Intentional rollback/);

    const rows = db.prepare('SELECT * FROM test_rollback').all();
    assert.equal(rows.length, 1, 'Only baseline row should remain');
    assert.equal(rows[0].id, 'base');

    closeDatabase(db);
  });

  test('WAL mode is enabled and verified', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    assert.ok(isWalMode(db), 'isWalMode should return true');

    // Verify sidecar files would be created on write
    db.exec('CREATE TABLE wal_test (id INTEGER PRIMARY KEY)');
    db.prepare('INSERT INTO wal_test (id) VALUES (?)').run(1);

    closeDatabase(db);
  });

  test('busy timeout is applied and readable', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    const timeout = getBusyTimeout(db);
    assert.equal(timeout, 5000, 'Busy timeout should be 5000ms');

    closeDatabase(db);
  });

  test('prepared statement insert/select works', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS prep_test (id TEXT PRIMARY KEY, data TEXT);
    `);

    const insert = db.prepare('INSERT INTO prep_test (id, data) VALUES (?, ?)');
    const select = db.prepare('SELECT * FROM prep_test WHERE id = ?');

    insert.run('prep-1', 'test data');
    const row = select.get('prep-1');

    assert.ok(row, 'Row should be found');
    assert.equal(row.data, 'test data');

    closeDatabase(db);
  });

  test('close and reopen preserves data', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS persist_test (id TEXT PRIMARY KEY, value TEXT);
    `);
    db.prepare('INSERT INTO persist_test (id, value) VALUES (?, ?)').run('persist-1', 'persisted value');

    closeDatabase(db);

    // Reopen
    const result2 = openDatabase(dbPath);
    const row = result2.db.prepare('SELECT * FROM persist_test WHERE id = ?').get('persist-1');

    assert.ok(row, 'Row should persist after reopen');
    assert.equal(row.value, 'persisted value');

    closeDatabase(result2.db);
  });

  test('integrity_check returns ok', () => {
    const result = openDatabase(dbPath);
    const db = result.db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS integrity_test (id INTEGER PRIMARY KEY, data TEXT);
    `);
    db.prepare('INSERT INTO integrity_test (data) VALUES (?)').run('test');

    const integrity = checkIntegrity(db);
    assert.equal(integrity, 'ok', 'Integrity check should return ok');

    closeDatabase(db);
  });
});

describe('Drizzle Migrations', () => {
  test('applies initial migration to fresh database', async () => {
    const fixture = createTestDb();
    const { path, cleanup } = fixture;

    try {
      const result = await runMigrationsWithVerification(path);

      assert.ok(result.appliedCount >= 1, 'At least one migration should be applied');
      assert.ok(result.tables.includes('app_meta'), 'app_meta table should exist');

      // Verify schema
      const db = new Database(path);
      const columns = db.prepare("PRAGMA table_info(app_meta)").all() as { name: string }[];
      const columnNames = columns.map(c => c.name);
      assert.ok(columnNames.includes('key'), 'key column should exist');
      assert.ok(columnNames.includes('value'), 'value column should exist');
      assert.ok(columnNames.includes('updatedAt') || columnNames.includes('updated_at'), 'updatedAt column should exist');
      db.close();
    } finally {
      cleanup();
    }
  });

  test('re-running migrations is safe and idempotent', async () => {
    const fixture = createTestDb();
    const { path, cleanup } = fixture;

    try {
      // First run
      const result1 = await runMigrationsWithVerification(path);
      const firstCount = result1.appliedCount;

      // Second run
      const result2 = await runMigrationsWithVerification(path);
      const secondCount = result2.appliedCount;

      assert.equal(secondCount, 0, 'Second run should apply zero new migrations');
      assert.ok(result2.tables.includes('app_meta'), 'app_meta table should still exist');
    } finally {
      cleanup();
    }
  });

  test('migration tracking table records applied migrations', async () => {
    const fixture = createTestDb();
    const { path, cleanup } = fixture;

    try {
      await runMigrationsWithVerification(path);

      const db = new Database(path);
      const migrations = db.prepare('SELECT * FROM __drizzle_migrations ORDER BY created_at').all() as {
        hash: string;
        created_at: number;
      }[];

      assert.ok(migrations.length >= 1, 'At least one migration should be tracked');
      assert.ok(migrations[0].hash, 'Migration should have a hash');
      assert.ok(migrations[0].created_at > 0, 'Migration should have a timestamp');

      db.close();
    } finally {
      cleanup();
    }
  });

  test('Drizzle basic read-write operation works', async () => {
    const fixture = createTestDb();
    const { path, cleanup } = fixture;

    try {
      await runMigrationsWithVerification(path);

      const db = new Database(path);
      const drizzleDb = drizzle(db);

      // Insert using Drizzle
      await drizzleDb.insert(schema.appMeta).values({
        key: 'test_key',
        value: 'test_value',
        updatedAt: new Date(),
      });

      // Select using Drizzle
      const rows = await drizzleDb.select().from(schema.appMeta).where(eq(schema.appMeta.key, 'test_key'));

      assert.equal(rows.length, 1);
      assert.equal(rows[0].key, 'test_key');
      assert.equal(rows[0].value, 'test_value');

      db.close();
    } finally {
      cleanup();
    }
  });

  test('migration upgrade v1 to v2 preserves existing data', async () => {
    const fixture = createTestDb();
    const { path, cleanup } = fixture;

    // Initialize temp directory path as undefined
    let v1FixtureDir: string | undefined;

    try {
      // Step 0: Create the temporary directory for the v1-only migration fixture
      // This is now inside the try block so cleanup() runs even if mkdtempSync throws
      v1FixtureDir = mkdtempSync(resolve(tmpdir(), 'qfat-v1-fixture-'));

      // Step 1: Read committed migration artifacts
      const journalPath = resolve(process.cwd(), 'migrations', 'meta', '_journal.json');
      const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));

      // Verify journal has the expected number of entries with expected tags
      assert.equal(journal.entries.length, 3, 'Journal should have exactly three entries');
      const v1Entry = journal.entries[0];
      const v2Entry = journal.entries[1];
      const v3Entry = journal.entries[2];
      assert.ok(v1Entry.tag && v2Entry.tag && v3Entry.tag, 'All entries should have tags');
      assert.notEqual(v1Entry.tag, v2Entry.tag, 'Entry tags should be distinct');
      assert.notEqual(v2Entry.tag, v3Entry.tag, 'Entry tags should be distinct');
      assert.ok(v1Entry.when && v2Entry.when && v3Entry.when, 'All entries should have timestamps');

      // Dynamically compute expected hashes from committed SQL files
      const v1SqlPath = resolve(process.cwd(), 'migrations', `${v1Entry.tag}.sql`);
      const v2SqlPath = resolve(process.cwd(), 'migrations', `${v2Entry.tag}.sql`);
      const v1SqlContent = readFileSync(v1SqlPath, 'utf-8');
      const v2SqlContent = readFileSync(v2SqlPath, 'utf-8');

      const v1ExpectedHash = createHash('sha256').update(v1SqlContent).digest('hex');
      const v2ExpectedHash = createHash('sha256').update(v2SqlContent).digest('hex');
      const v1ExpectedTimestamp = v1Entry.when;
      const v2ExpectedTimestamp = v2Entry.when;

      const v3SqlPath = resolve(process.cwd(), 'migrations', `${v3Entry.tag}.sql`);
      const v3SqlContent = readFileSync(v3SqlPath, 'utf-8');
      const v3ExpectedHash = createHash('sha256').update(v3SqlContent).digest('hex');
      const v3ExpectedTimestamp = v3Entry.when;

      // Step 2: Build v1-only migration fixture from committed artifacts
      const v1MetaDir = resolve(v1FixtureDir, 'meta');
      mkdirSync(v1MetaDir, { recursive: true });
      writeFileSync(resolve(v1FixtureDir, `${v1Entry.tag}.sql`), v1SqlContent);
      const v1Journal = {
        version: journal.version,
        dialect: journal.dialect,
        entries: [v1Entry]
      };
      writeFileSync(resolve(v1FixtureDir, 'meta', '_journal.json'), JSON.stringify(v1Journal, null, 2));

      // Step 3: Apply v1 migration using Drizzle migrator (lets Drizzle create the ledger entry)
      let conn1: ReturnType<typeof openDatabase> | undefined;
      try {
        conn1 = openDatabase(path);
        const drizzleDb1 = drizzle(conn1.db);
        await migrate(drizzleDb1, { migrationsFolder: v1FixtureDir });
      } finally {
        if (conn1) closeDatabase(conn1.db);
      }

      // Step 4: Verify v1 schema and insert test data
      let db1: Database.Database | undefined;
      try {
        db1 = new Database(path);
        const columns1 = db1.prepare("PRAGMA table_info(app_meta)").all() as { name: string }[];
        const columnNames1 = columns1.map(c => c.name);
        assert.ok(!columnNames1.includes('description'), 'v1 schema should not have description column');

        // Insert test data in v1
        db1.prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)").run('test-key', 'test-value', Date.now());
        const row1 = db1.prepare("SELECT * FROM app_meta WHERE key = ?").get('test-key');
        assert.ok(row1, 'Test row should exist in v1');
      } finally {
        if (db1) db1.close();
      }

      // Step 5: Apply full migrations (v1 + v2) - Drizzle should skip v1 and apply only v2
      let conn2: ReturnType<typeof openDatabase> | undefined;
      try {
        conn2 = openDatabase(path);
        const drizzleDb2 = drizzle(conn2.db);
        await migrate(drizzleDb2, { migrationsFolder: resolve(process.cwd(), 'migrations') });
      } finally {
        if (conn2) closeDatabase(conn2.db);
      }

      // Step 6: Verify v2 schema, data preserved, and migration tracking
      let db2: Database.Database | undefined;
      try {
        db2 = new Database(path);
        const columns2 = db2.prepare("PRAGMA table_info(app_meta)").all() as { name: string }[];
        const columnNames2 = columns2.map(c => c.name);
        assert.ok(columnNames2.includes('description'), 'v2 schema should have description column');

        // Verify existing data preserved
        const row2 = db2.prepare("SELECT * FROM app_meta WHERE key = ?").get('test-key');
        assert.ok(row2, 'Test row should still exist after upgrade');
        assert.equal(row2.value, 'test-value', 'Value should be preserved');

        // Verify migration tracking has exactly two entries with correct hashes/timestamps
        const migrations = db2.prepare('SELECT * FROM __drizzle_migrations ORDER BY created_at').all() as {
          hash: string;
          created_at: number;
        }[];
        assert.equal(migrations.length, 3, 'Should have exactly 3 migrations tracked');

        // Verify v1 migration hash and timestamp match dynamically derived values
        assert.equal(migrations[0].hash, v1ExpectedHash, 'v1 migration hash should match dynamically derived hash');
        assert.equal(migrations[0].created_at, v1ExpectedTimestamp, 'v1 migration timestamp should match journal');

        // Verify v2 migration hash and timestamp match dynamically derived values
        assert.equal(migrations[1].hash, v2ExpectedHash, 'v2 migration hash should match dynamically derived hash');
        assert.equal(migrations[1].created_at, v2ExpectedTimestamp, 'v2 migration timestamp should match journal');

        // Verify v3 migration hash and timestamp match dynamically derived values
        assert.equal(migrations[2].hash, v3ExpectedHash, 'v3 migration hash should match dynamically derived hash');
        assert.equal(migrations[2].created_at, v3ExpectedTimestamp, 'v3 migration timestamp should match journal');
      } finally {
        if (db2) db2.close();
      }
    } finally {
      // Clean up the migration temp directory only if it was created
      if (v1FixtureDir) {
        try {
          rmSync(v1FixtureDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      // Database fixture cleanup always runs
      cleanup();
    }
  });
});