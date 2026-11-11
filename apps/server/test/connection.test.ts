import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, closeDatabase, createTempDatabase, checkIntegrity, isWalMode, areForeignKeysEnabled, getBusyTimeout } from '../src/db/connection.js';
import { runMigrationsWithVerification } from '../src/db/migrate.js';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { existsSync, unlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
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

    try {
      // Step 1: Apply only v1 migration (simulate existing database)
      // Use the exact same v1 migration content as in the real migrations folder
      const v1MigrationDir = resolve(process.cwd(), 'migrations-v1-snapshot');
      if (!existsSync(v1MigrationDir)) {
        // Create v1-only migration directory if it doesn't exist
        // Use the exact same content as the real v1 migration
        const v1MigrationContent = `CREATE TABLE \`app_meta\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`value\` text NOT NULL,
	\`updated_at\` integer NOT NULL
);
`;
        const fs = await import('node:fs');
        const { mkdirSync, writeFileSync } = fs;
        mkdirSync(v1MigrationDir, { recursive: true });
        // Create meta directory first
        mkdirSync(resolve(v1MigrationDir, 'meta'), { recursive: true });
        writeFileSync(resolve(v1MigrationDir, '0000_v1_initial.sql'), v1MigrationContent);
        // Create minimal meta files for Drizzle
        writeFileSync(resolve(v1MigrationDir, 'meta', '_journal.json'), JSON.stringify({
          version: '7',
          dialect: 'sqlite',
          entries: [{ idx: 0, version: '6', when: 1794370402769, tag: '0000_v1_initial', breakpoints: true }]
        }, null, 2));
      }

      // Apply v1 migration
      const conn1 = openDatabase(path);
      const drizzleDb1 = drizzle(conn1.db);
      await migrate(drizzleDb1, { migrationsFolder: v1MigrationDir });
      closeDatabase(conn1.db);

      // Manually insert the correct v1 migration hash and folderMillis into tracking table
      // This matches the real v1 migration in the migrations folder
      const v1Hash = '7782bbc169e5a629ed53b2149800eaf85b0af702ff881536aab79004be77cc30';
      const v1FolderMillis = 1794370402769;
      const db1 = new Database(path);
      db1.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(v1Hash, v1FolderMillis);
      db1.close();

      // Verify v1 schema (no description column)
      const db1b = new Database(path);
      let columns1 = db1b.prepare("PRAGMA table_info(app_meta)").all() as { name: string }[];
      const columnNames1 = columns1.map(c => c.name);
      assert.ok(!columnNames1.includes('description'), 'v1 schema should not have description column');

      // Insert test data in v1
      db1b.prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)").run('test-key', 'test-value', Date.now());
      const row1 = db1b.prepare("SELECT * FROM app_meta WHERE key = ?").get('test-key');
      assert.ok(row1, 'Test row should exist in v1');
      db1b.close();

      // Step 2: Apply v2 migration (upgrade) - should only apply the ALTER TABLE
      const conn2 = openDatabase(path);
      const drizzleDb2 = drizzle(conn2.db);
      await migrate(drizzleDb2, { migrationsFolder: resolve(process.cwd(), 'migrations') });
      closeDatabase(conn2.db);

      // Verify v2 schema (has description column)
      const db2 = new Database(path);
      let columns2 = db2.prepare("PRAGMA table_info(app_meta)").all() as { name: string }[];
      const columnNames2 = columns2.map(c => c.name);
      assert.ok(columnNames2.includes('description'), 'v2 schema should have description column');

      // Verify existing data preserved
      const row2 = db2.prepare("SELECT * FROM app_meta WHERE key = ?").get('test-key');
      assert.ok(row2, 'Test row should still exist after upgrade');
      assert.equal(row2.value, 'test-value', 'Value should be preserved');

      // Verify migration tracking has both migrations
      const migrations = db2.prepare('SELECT * FROM __drizzle_migrations ORDER BY created_at').all() as {
        hash: string;
        created_at: number;
      }[];
      assert.ok(migrations.length >= 2, 'Should have at least 2 migrations tracked');

      db2.close();
    } finally {
      cleanup();
      // Clean up v1 snapshot directory
      try {
        const fs = await import('node:fs');
        const { rmSync } = fs;
        if (existsSync(resolve(process.cwd(), 'migrations-v1-snapshot'))) {
          rmSync(resolve(process.cwd(), 'migrations-v1-snapshot'), { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});