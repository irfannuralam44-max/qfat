import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Minimal infrastructure schema for the QFAT backend foundation.
 * This is NOT the final business schema — it exists only to prove
 * that Drizzle schema definitions, migration generation, and runtime
 * migration execution work end-to-end.
 *
 * Business tables (accounts, media, jobs, destinations, etc.) will be
 * added in subsequent implementation tasks.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Schema registry for Drizzle.
 * Add new tables here as they are created in future tasks.
 */
export const schema = {
  appMeta,
};

export type AppMeta = typeof appMeta.$inferSelect;
export type NewAppMeta = typeof appMeta.$inferInsert;