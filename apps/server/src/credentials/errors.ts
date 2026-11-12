/**
 * Typed errors for the temporary local credential provider.
 *
 * Messages are intentionally actionable but never include key bytes,
 * plaintext credentials, ciphertext, or absolute filesystem paths.
 */
export type CredentialStorageErrorCode =
  | 'KEY_MISSING_WITH_RECORDS'
  | 'KEY_INVALID'
  | 'KEY_NOT_REGULAR'
  | 'KEY_PERMISSIONS_UNSAFE'
  | 'KEY_OWNERSHIP_UNSAFE'
  | 'KEY_DIRECTORY_UNSAFE'
  | 'WINDOWS_ACL_UNVERIFIED'
  | 'UNSUPPORTED_PLATFORM'
  | 'ENVELOPE_INVALID'
  | 'CONTEXT_INVALID'
  | 'CONTEXT_MISMATCH'
  | 'PAYLOAD_INVALID'
  | 'DECRYPT_FAILED'
  | 'DATABASE_ERROR';

export class CredentialStorageError extends Error {
  readonly code: CredentialStorageErrorCode;

  constructor(code: CredentialStorageErrorCode, message: string) {
    super(message);
    this.name = 'CredentialStorageError';
    this.code = code;
  }
}
