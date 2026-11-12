export {
  CredentialStorageError,
  type CredentialStorageErrorCode,
} from './errors.js';
export {
  CREDENTIAL_ENVELOPE_VERSION,
  CREDENTIAL_KEY_BYTES,
  CREDENTIAL_NONCE_BYTES,
  CREDENTIAL_TAG_BYTES,
  credentialAad,
  decryptCredential,
  encryptCredential,
  validateCredentialContext,
  validateCredentialEnvelope,
  type CredentialContext,
  type CredentialEnvelope,
} from './envelope.js';
export {
  assertCredentialKeyPlatform,
  loadOrCreateCredentialKey,
  type KeyFileOptions,
} from './key-file.js';
export {
  KeyFileCredentialProvider,
  createKeyFileCredentialProvider,
  type CredentialProvider,
  type KeyFileCredentialProviderOptions,
} from './provider.js';
