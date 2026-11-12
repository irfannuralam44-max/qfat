import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CredentialStorageError } from './errors.js';

export const CREDENTIAL_ENVELOPE_VERSION = 1;
export const CREDENTIAL_KEY_BYTES = 32;
export const CREDENTIAL_NONCE_BYTES = 12;
export const CREDENTIAL_TAG_BYTES = 16;

const MAX_CONTEXT_FIELD_BYTES = 256;
const CIPHER = 'aes-256-gcm';

/**
 * Stable, non-secret context bound to an encrypted credential envelope.
 * The identifier is the internal record ID, not a platform account ID.
 */
export interface CredentialContext {
  id: string;
  purpose: string;
  provider: string;
}

export interface CredentialEnvelope {
  version: number;
  nonce: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

function invalidContext(message: string): never {
  throw new CredentialStorageError('CONTEXT_INVALID', message);
}

function validateContextField(name: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    invalidContext(`Credential context ${name} must be a non-empty string.`);
  }
  if (value.includes('\0')) {
    invalidContext(`Credential context ${name} must not contain NUL bytes.`);
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_CONTEXT_FIELD_BYTES) {
    invalidContext(`Credential context ${name} is too long.`);
  }
}

export function validateCredentialContext(context: CredentialContext): void {
  if (!context || typeof context !== 'object') {
    invalidContext('Credential context is required.');
  }
  validateContextField('id', context.id);
  validateContextField('purpose', context.purpose);
  validateContextField('provider', context.provider);
}

/**
 * Canonical authenticated additional data for an envelope.
 *
 * The length-free NUL-delimited fields are safe because every field rejects
 * NUL bytes. The envelope version is included so a version downgrade cannot
 * be silently accepted.
 */
export function credentialAad(context: CredentialContext): Buffer {
  validateCredentialContext(context);
  return Buffer.from(
    `qfat-credential-envelope-v${CREDENTIAL_ENVELOPE_VERSION}\0${context.id}\0${context.purpose}\0${context.provider}`,
    'utf8',
  );
}

function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== CREDENTIAL_KEY_BYTES) {
    throw new CredentialStorageError('KEY_INVALID', 'Credential key material must be exactly 32 bytes.');
  }
}

export function validateCredentialEnvelope(envelope: CredentialEnvelope): void {
  if (!envelope || typeof envelope !== 'object') {
    throw new CredentialStorageError('ENVELOPE_INVALID', 'Credential envelope is missing.');
  }
  if (envelope.version !== CREDENTIAL_ENVELOPE_VERSION) {
    throw new CredentialStorageError('ENVELOPE_INVALID', 'Unsupported credential envelope version.');
  }
  if (!Buffer.isBuffer(envelope.nonce) || envelope.nonce.length !== CREDENTIAL_NONCE_BYTES) {
    throw new CredentialStorageError('ENVELOPE_INVALID', 'Credential envelope nonce has an invalid length.');
  }
  if (!Buffer.isBuffer(envelope.authTag) || envelope.authTag.length !== CREDENTIAL_TAG_BYTES) {
    throw new CredentialStorageError('ENVELOPE_INVALID', 'Credential envelope authentication tag has an invalid length.');
  }
  if (!Buffer.isBuffer(envelope.ciphertext)) {
    throw new CredentialStorageError('ENVELOPE_INVALID', 'Credential envelope ciphertext is invalid.');
  }
}

export function encryptCredential(
  key: Buffer,
  context: CredentialContext,
  plaintext: Buffer,
): CredentialEnvelope {
  validateKey(key);
  validateCredentialContext(context);
  if (!Buffer.isBuffer(plaintext)) {
    throw new CredentialStorageError('PAYLOAD_INVALID', 'Credential payload must be a Buffer.');
  }

  const nonce = randomBytes(CREDENTIAL_NONCE_BYTES);
  const cipher = createCipheriv(CIPHER, key as any, nonce as any);
  cipher.setAAD(credentialAad(context) as any);
  const ciphertext = Buffer.concat([cipher.update(plaintext as any), cipher.final()] as any);
  const authTag = cipher.getAuthTag();

  return {
    version: CREDENTIAL_ENVELOPE_VERSION,
    nonce,
    authTag,
    ciphertext,
  };
}

export function decryptCredential(
  key: Buffer,
  context: CredentialContext,
  envelope: CredentialEnvelope,
): Buffer {
  validateKey(key);
  validateCredentialContext(context);
  validateCredentialEnvelope(envelope);

  try {
    const decipher = createDecipheriv(CIPHER, key as any, envelope.nonce as any);
    decipher.setAAD(credentialAad(context) as any);
    decipher.setAuthTag(envelope.authTag as any);
    return Buffer.concat([decipher.update(envelope.ciphertext as any), decipher.final()] as any);
  } catch {
    // Do not return or include partial plaintext, key bytes, ciphertext, or
    // authentication details in the error.
    throw new CredentialStorageError(
      'DECRYPT_FAILED',
      'Credential authentication failed; the key, context, or encrypted data is invalid.',
    );
  }
}
