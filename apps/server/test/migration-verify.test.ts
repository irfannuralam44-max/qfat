import { runMigrationsWithVerification } from '../src/db/migrate.js';
import { createTempDatabase } from '../src/db/connection.js';
import { existsSync, unlinkSync } from 'node:fs';
import Database from 'better-sqlite3';

async function test() {
  const path = createTempDatabase('migrate-test');
  try {
    console.log('Test 1: Fresh database migration');
    const result1 = await runMigrationsWithVerification(path);
    console.log('Applied:', result1.appliedCount, 'Tables:', result1.tables);
    
    console.log('Test 2: Re-run migrations (should be idempotent)');
    const result2 = await runMigrationsWithVerification(path);
    console.log('Applied:', result2.appliedCount, 'Tables:', result2.tables);
    
    console.log('Test 3: Verify schema');
    const db = new Database(path);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_%'").all();
    console.log('Tables:', tables.map(t => t.name));
    
    const columns = db.prepare('PRAGMA table_info(app_meta)').all();
    console.log('Columns:', columns.map(c => c.name));
    
    const migrations = db.prepare('SELECT * FROM __drizzle_migrations').all();
    console.log('Migrations:', migrations);
    
    db.close();
    console.log('All migration tests passed!');
  } finally {
    if (existsSync(path)) unlinkSync(path);
    if (existsSync(path + '-wal')) unlinkSync(path + '-wal');
    if (existsSync(path + '-shm')) unlinkSync(path + '-shm');
  }
}

test().catch(e => { console.error(e); process.exit(1); });