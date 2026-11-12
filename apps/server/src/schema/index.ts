import { sqliteTable, text, integer, primaryKey, uniqueIndex, blob } from 'drizzle-orm/sqlite-core';

/**
 * Minimal infrastructure schema for the QFAT backend foundation.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  description: text('description'),
});

/**
 * Persisted media records for the QFAT Media Library.
 * Files are stored in an application-managed directory; only metadata
 * and a managed storage key are kept here.
 */
export const mediaItems = sqliteTable('media_items', {
  id: text('id').primaryKey(),
  originalFilename: text('original_filename').notNull(),
  mediaType: text('media_type').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageKey: text('storage_key').notNull(),
  sha256: text('sha256'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  storageKeyUnique: uniqueIndex('media_items_storage_key_unique').on(table.storageKey),
}));

/**
 * Encrypted credential payloads for the temporary local key-file provider.
 *
 * Only authenticated ciphertext and non-secret envelope metadata live here.
 * The encryption key is stored separately in the QFAT key directory.
 */
export const credentialRecords = sqliteTable('credential_records', {
  id: text('id').primaryKey(),
  purpose: text('purpose').notNull(),
  provider: text('provider').notNull(),
  envelopeVersion: integer('envelope_version').notNull(),
  nonce: blob('nonce', { mode: 'buffer' }).notNull(),
  authTag: blob('auth_tag', { mode: 'buffer' }).notNull(),
  ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Schema registry for Drizzle.
 */
export const schema = {
  appMeta,
  mediaItems,
  credentialRecords,
};

export type AppMeta = typeof appMeta.$inferSelect;
export type NewAppMeta = typeof appMeta.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
export type CredentialRecord = typeof credentialRecords.$inferSelect;
export type NewCredentialRecord = typeof credentialRecords.$inferInsert;