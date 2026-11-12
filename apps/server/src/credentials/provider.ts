import type { Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { credentialRecords } from '../schema/index.js';
import { getCredentialKeyPath } from '../config.js';
import { CredentialStorageError } from './errors.js';
import {
  decryptCredential,
  encryptCredential,
  validateCredentialContext,
  type CredentialContext,
  type CredentialEnvelope,
} from './envelope.js';
import {
  assertCredentialKeyPlatform,
  loadOrCreateCredentialKey,
  type KeyFileOptions,
} from './key-file.js';

/**
 * Opaque credential payload contract. Callers receive only decrypted payloads
 * and never the key material or envelope internals.
 */
export interface CredentialProvider {
  store(context: CredentialContext, payload: Buffer): Promise<void>;
  retrieve(context: CredentialContext): Promise<Buffer | null>;
  delete(context: CredentialContext): Promise<boolean>;
}

export interface KeyFileCredentialProviderOptions extends KeyFileOptions {
  keyPath?: string;
}

/**
 * Temporary ADR-004 provider: AES-256-GCM encrypted SQLite rows plus a
 * separate, owner-only key file.
 */
export class KeyFileCredentialProvider implements CredentialProvider {
  private readonly db: Database;
  private readonly keyPath: string;
  private readonly platform: NodeJS.Platform;
  private readonly fsyncDirectory?: (directoryPath: string) => void;
  private readonly linkFile?: KeyFileOptions['linkFile'];
  private keyCache: Buffer | null = null;

  constructor(db: Database, options: KeyFileCredentialProviderOptions = {}) {
    this.db = db;
    this.keyPath = options.keyPath ?? getCredentialKeyPath();
    this.platform = options.platform ?? process.platform;
    this.fsyncDirectory = options.fsyncDirectory;
    this.linkFile = options.linkFile;
    // Fail at provider construction so account-management startup cannot
    // proceed on a platform whose ACL guarantees are unverified.
    assertCredentialKeyPlatform(this.platform);
  }

  async store(context: CredentialContext, payload: Buffer): Promise<void> {
    validateCredentialContext(context);
    if (!Buffer.isBuffer(payload)) {
      throw new CredentialStorageError('PAYLOAD_INVALID', 'Credential payload must be a Buffer.');
    }

    const key = this.loadKey();
    const envelope = encryptCredential(key, context, payload);
    const now = new Date();
    const drizzleDb = drizzle(this.db);

    this.db.transaction(() => {
      const existing = drizzleDb
        .select()
        .from(credentialRecords)
        .where(eq(credentialRecords.id, context.id))
        .all()[0];

      if (existing && (existing.purpose !== context.purpose || existing.provider !== context.provider)) {
        throw new CredentialStorageError(
          'CONTEXT_MISMATCH',
          'Credential record ID is already bound to a different purpose or provider.',
        );
      }

      if (existing) {
        drizzleDb
          .update(credentialRecords)
          .set({
            envelopeVersion: envelope.version,
            nonce: envelope.nonce,
            authTag: envelope.authTag,
            ciphertext: envelope.ciphertext,
            updatedAt: now,
          })
          .where(eq(credentialRecords.id, context.id))
          .run();
      } else {
        drizzleDb.insert(credentialRecords).values({
          id: context.id,
          purpose: context.purpose,
          provider: context.provider,
          envelopeVersion: envelope.version,
          nonce: envelope.nonce,
          authTag: envelope.authTag,
          ciphertext: envelope.ciphertext,
          createdAt: now,
          updatedAt: now,
        }).run();
      }
    })();
  }

  async retrieve(context: CredentialContext): Promise<Buffer | null> {
    validateCredentialContext(context);
    const drizzleDb = drizzle(this.db);
    const row = drizzleDb
      .select()
      .from(credentialRecords)
      .where(eq(credentialRecords.id, context.id))
      .all()[0];

    if (!row) return null;

    if (row.purpose !== context.purpose || row.provider !== context.provider) {
      throw new CredentialStorageError(
        'CONTEXT_MISMATCH',
        'Credential record context does not match the requested purpose or provider.',
      );
    }

    const key = this.loadKey();
    const envelope: CredentialEnvelope = {
      version: row.envelopeVersion,
      nonce: row.nonce,
      authTag: row.authTag,
      ciphertext: row.ciphertext,
    };
    return decryptCredential(key, context, envelope);
  }

  async delete(context: CredentialContext): Promise<boolean> {
    validateCredentialContext(context);
    const drizzleDb = drizzle(this.db);
    let deleted = false;

    this.db.transaction(() => {
      const existing = drizzleDb
        .select()
        .from(credentialRecords)
        .where(eq(credentialRecords.id, context.id))
        .all()[0];

      if (!existing) return;
      if (existing.purpose !== context.purpose || existing.provider !== context.provider) {
        throw new CredentialStorageError(
          'CONTEXT_MISMATCH',
          'Credential record context does not match the requested purpose or provider.',
        );
      }

      deleted = drizzleDb
        .delete(credentialRecords)
        .where(eq(credentialRecords.id, context.id))
        .run().changes > 0;
    })();

    return deleted;
  }

  private loadKey(): Buffer {
    if (this.keyCache) return this.keyCache;

    let hasEncryptedRecords: boolean;
    try {
      const row = this.db
        .prepare('SELECT COUNT(*) AS count FROM credential_records')
        .get() as { count: number } | undefined;
      hasEncryptedRecords = (row?.count ?? 0) > 0;
    } catch {
      throw new CredentialStorageError(
        'DATABASE_ERROR',
        'Credential records could not be read from the database.',
      );
    }

    this.keyCache = loadOrCreateCredentialKey(this.keyPath, {
      platform: this.platform,
      hasEncryptedRecords,
      fsyncDirectory: this.fsyncDirectory,
      linkFile: this.linkFile,
    });
    return this.keyCache;
  }
}

export function createKeyFileCredentialProvider(
  db: Database,
  options: KeyFileCredentialProviderOptions = {},
): CredentialProvider {
  return new KeyFileCredentialProvider(db, options);
}
