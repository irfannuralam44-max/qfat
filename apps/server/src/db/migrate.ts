import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { openDatabase, closeDatabase, DbOpenResult } from './connection.js';

/**
 * Runtime migration runner using Drizzle's migrator.
 *
 * Applies all pending migrations from the migrations directory to the
 * target database. Safe to run multiple times — Drizzle tracks applied
 * migrations in the __drizzle_migrations table and skips already-applied ones.
 *
 * Uses the shared connection module to ensure consistent PRAGMA configuration.
 *
 * @param dbPath - Path to the SQLite database file.
 * @param migrationsFolder - Path to the migrations directory (default: './migrations' relative to this file).
 * @throws If migration fails.
 */
export async function runMigrations(
  dbPath: string,
  migrationsFolder?: string
): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const migrationDir = migrationsFolder ?? resolve(__dirname, '../../migrations');

  if (!existsSync(migrationDir)) {
    throw new Error(`Migrations directory not found: ${migrationDir}`);
  }

  // Use shared connection module for consistent PRAGMA setup
  const conn = openDatabase(dbPath);

  try {
    const drizzleDb = drizzle(conn.db);

    // Apply migrations
    await migrate(drizzleDb, { migrationsFolder: migrationDir });
  } finally {
    closeDatabase(conn.db);
  }
}

/**
 * Runs migrations and verifies the result.
 *
 * @param dbPath - Path to the SQLite database file.
 * @param migrationsFolder - Optional custom migrations folder.
 * @returns Object with migration result details.
 */
export async function runMigrationsWithVerification(
  dbPath: string,
  migrationsFolder?: string
): Promise<{
  appliedCount: number;
  tables: string[];
}> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const migrationDir = migrationsFolder ?? resolve(__dirname, '../../migrations');

  if (!existsSync(migrationDir)) {
    throw new Error(`Migrations directory not found: ${migrationDir}`);
  }

  // Use shared connection module for consistent PRAGMA setup
  const conn = openDatabase(dbPath);
  const db = conn.db;

  try {
    const drizzleDb = drizzle(db);

    // Get migration count before
    let beforeCount = 0;
    try {
      const rows = db.prepare('SELECT COUNT(*) as c FROM __drizzle_migrations').get() as { c: number } | undefined;
      beforeCount = rows?.c ?? 0;
    } catch {
      // Table doesn't exist yet
    }

    // Apply migrations
    await migrate(drizzleDb, { migrationsFolder: migrationDir });

    // Get migration count after
    const afterRows = db.prepare('SELECT COUNT(*) as c FROM __drizzle_migrations').get() as { c: number } | undefined;
    const afterCount = afterRows?.c ?? 0;

    // List tables
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_%'"
    ).all() as { name: string }[];

    return {
      appliedCount: afterCount - beforeCount,
      tables: tables.map(t => t.name),
    };
  } finally {
    closeDatabase(db);
  }
}