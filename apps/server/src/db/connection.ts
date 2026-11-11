import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/**
 * SQLite connection configuration constants.
 * These are not user-configurable in this foundation task.
 */
export const SQLITE_PRAGMA_CONFIG = {
  /** Enable foreign key enforcement on every connection. */
  foreign_keys: 'ON' as const,
  /** WAL mode for file-backed databases (persists across connections). */
  journal_mode: 'WAL' as const,
  /** Bounded busy timeout in milliseconds. Not an exact wall-clock deadline. */
  busy_timeout: 5000,
} as const;

/**
 * Result of opening a database connection with verification.
 */
export interface DbOpenResult {
  /** The opened database instance. */
  db: Database.Database;
  /** The actual journal_mode after enabling WAL (should be 'wal'). */
  journalMode: string;
  /** The actual foreign_keys pragma value (should be 1). */
  foreignKeys: number;
  /** The actual busy_timeout value (should be 5000). */
  busyTimeout: number;
  /** SQLite version string. */
  sqliteVersion: string;
}

/**
 * Opens a SQLite database at the given path with safe defaults.
 *
 * @param dbPath - Path to the database file. Parent directory will be created if it doesn't exist.
 * @returns Database instance with verified PRAGMA settings.
 * @throws If the database cannot be opened or PRAGMA verification fails.
 */
export function openDatabase(dbPath: string): DbOpenResult {
  // Ensure parent directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Open the database
  const db = new Database(dbPath);

  // Apply PRAGMA settings
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Verify PRAGMA settings by reading them back
  const journalModeResult = db.pragma('journal_mode');
  const journalMode = Array.isArray(journalModeResult) && journalModeResult[0]
    ? journalModeResult[0].journal_mode
    : 'unknown';

  const foreignKeysResult = db.pragma('foreign_keys');
  const foreignKeys = Array.isArray(foreignKeysResult) && foreignKeysResult[0]
    ? foreignKeysResult[0].foreign_keys
    : 0;

  const busyTimeoutResult = db.pragma('busy_timeout');
  const busyTimeout = Array.isArray(busyTimeoutResult) && busyTimeoutResult[0]
    ? busyTimeoutResult[0].timeout
    : 0;

  // Verify critical settings
  if (journalMode.toLowerCase() !== 'wal') {
    db.close();
    throw new Error(`Failed to enable WAL mode. Got: ${journalMode}`);
  }

  if (foreignKeys !== 1) {
    db.close();
    throw new Error(`Failed to enable foreign key enforcement. Got: ${foreignKeys}`);
  }

  if (busyTimeout !== SQLITE_PRAGMA_CONFIG.busy_timeout) {
    db.close();
    throw new Error(`Failed to set busy_timeout. Expected ${SQLITE_PRAGMA_CONFIG.busy_timeout}, got ${busyTimeout}`);
  }

  return {
    db,
    journalMode,
    foreignKeys,
    busyTimeout,
    sqliteVersion: (db.prepare('SELECT sqlite_version() as v').get() as { v: string } | undefined)?.v ?? 'unknown',
  };
}

/**
 * Creates a temporary database file for testing.
 * The caller is responsible for cleanup.
 *
 * @param prefix - Optional prefix for the temporary file name.
 * @returns Path to the temporary database file.
 */
export function createTempDatabase(prefix = 'qfat-test'): string {
  const tmpDir = process.env.TMPDIR ?? process.env.TEMP ?? '/tmp';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return resolve(tmpDir, `${prefix}-${timestamp}-${random}.db`);
}

/**
 * Closes a database connection safely.
 *
 * @param db - The database instance to close.
 * @throws If the database is already closed or an error occurs.
 */
export function closeDatabase(db: Database.Database): void {
  if (db.open) {
    db.close();
  }
}

/**
 * Runs SQLite integrity_check on the database.
 *
 * @param db - Open database instance.
 * @returns 'ok' if the database passes integrity check.
 * @throws If the integrity check fails or returns an error.
 */
export function checkIntegrity(db: Database.Database): string {
  const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string } | undefined;
  if (!result || result.integrity_check !== 'ok') {
    throw new Error(`Integrity check failed: ${result?.integrity_check ?? 'unknown result'}`);
  }
  return result.integrity_check;
}

/**
 * Verifies that WAL mode is enabled on the database.
 *
 * @param db - Open database instance.
 * @returns true if WAL mode is active.
 */
export function isWalMode(db: Database.Database): boolean {
  const result = db.pragma('journal_mode');
  return Array.isArray(result) && result[0]?.journal_mode?.toLowerCase() === 'wal';
}

/**
 * Verifies that foreign key enforcement is enabled.
 *
 * @param db - Open database instance.
 * @returns true if foreign keys are enforced.
 */
export function areForeignKeysEnabled(db: Database.Database): boolean {
  const result = db.pragma('foreign_keys');
  return Array.isArray(result) && result[0]?.foreign_keys === 1;
}

/**
 * Gets the current busy_timeout value.
 *
 * @param db - Open database instance.
 * @returns The busy_timeout in milliseconds.
 */
export function getBusyTimeout(db: Database.Database): number {
  const result = db.pragma('busy_timeout');
  return (Array.isArray(result) && result[0]?.timeout) ?? 0;
}