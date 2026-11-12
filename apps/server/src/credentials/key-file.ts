import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { CredentialStorageError } from './errors.js';
import { CREDENTIAL_KEY_BYTES } from './envelope.js';

const KEY_DIR_MODE = 0o700;
const KEY_FILE_MODE = 0o600;
const DATA_DIR_MODE = 0o700;
const SUPPORTED_PLATFORM: NodeJS.Platform = 'linux';

export interface KeyFileOptions {
  /** Test seam for platform-specific fail-closed behavior. */
  platform?: NodeJS.Platform;
  /** Test seam for directory synchronization after key publication. */
  fsyncDirectory?: (directoryPath: string) => void;
}

function fail(code: ConstructorParameters<typeof CredentialStorageError>[0], message: string): never {
  throw new CredentialStorageError(code, message);
}

export function assertCredentialKeyPlatform(platform: NodeJS.Platform): void {
  assertSupportedPlatform(platform);
}

function assertSupportedPlatform(platform: NodeJS.Platform): void {
  if (platform === 'win32') {
    fail(
      'WINDOWS_ACL_UNVERIFIED',
      'Windows ACL verification is not available in this build; credential key-file storage is disabled on Windows.',
    );
  }
  if (platform !== SUPPORTED_PLATFORM) {
    fail(
      'UNSUPPORTED_PLATFORM',
      'Credential key-file storage is supported only on Linux with verified POSIX permissions in this build.',
    );
  }
}

function assertOwnerAndMode(
  stat: { uid: number; mode: number; isFile: () => boolean; isDirectory: () => boolean },
  kind: 'file' | 'directory',
): void {
  const uid = process.getuid?.();
  if (uid !== undefined && stat.uid !== uid) {
    fail('KEY_OWNERSHIP_UNSAFE', `Credential key ${kind} is not owned by the current OS user.`);
  }

  if (kind === 'directory') {
    if ((stat.mode & 0o077) !== 0 || (stat.mode & 0o700) !== 0o700) {
      fail('KEY_PERMISSIONS_UNSAFE', 'Credential key directory must be owner-only (0700).');
    }
    return;
  }

  if ((stat.mode & 0o777) !== KEY_FILE_MODE) {
    fail('KEY_PERMISSIONS_UNSAFE', 'Credential key file must be owner read/write only (0600).');
  }
}

function validateDataDirectory(dataDir: string, platform: NodeJS.Platform): void {
  assertSupportedPlatform(platform);

  try {
    const existing = lstatSync(dataDir);
    if (existing.isSymbolicLink()) {
      fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data directory must not be a symbolic link.');
    }
    if (!existing.isDirectory()) {
      fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data path is not a directory.');
    }
  } catch (err) {
    if (err instanceof CredentialStorageError) throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data directory could not be inspected.');
    }
    try {
      mkdirSync(dataDir, { recursive: true, mode: DATA_DIR_MODE });
    } catch {
      fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data directory could not be created.');
    }
  }

  const stat = lstatSync(dataDir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data path is not a real directory.');
  }

  const uid = process.getuid?.();
  if (uid !== undefined && stat.uid !== uid) {
    fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data directory is not owned by the current OS user.');
  }

  // The trust boundary is the QFAT data-directory leaf itself. Only reject
  // group/world writability here; unrelated ancestors such as / or /home are
  // intentionally not validated.
  if ((stat.mode & 0o022) !== 0) {
    fail('KEY_DATA_DIRECTORY_UNSAFE', 'QFAT data directory must not be writable by group or other users.');
  }
}

function ensurePrivateKeyDirectory(keyDir: string, platform: NodeJS.Platform): void {
  assertSupportedPlatform(platform);

  // Validate the QFAT data-directory leaf before trusting or creating the keys
  // directory inside it.
  validateDataDirectory(dirname(keyDir), platform);

  try {
    const existing = lstatSync(keyDir);
    if (existing.isSymbolicLink()) {
      fail('KEY_DIRECTORY_UNSAFE', 'Credential key directory must not be a symbolic link.');
    }
    if (!existing.isDirectory()) {
      fail('KEY_DIRECTORY_UNSAFE', 'Credential key path parent is not a directory.');
    }
  } catch (err) {
    if (err instanceof CredentialStorageError) throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      fail('KEY_DIRECTORY_UNSAFE', 'Credential key directory could not be inspected.');
    }
    try {
      mkdirSync(keyDir, { recursive: true, mode: KEY_DIR_MODE });
    } catch {
      fail('KEY_DIRECTORY_UNSAFE', 'Credential key directory could not be created.');
    }
  }

  const stat = lstatSync(keyDir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail('KEY_DIRECTORY_UNSAFE', 'Credential key directory is not a real directory.');
  }
  assertOwnerAndMode(stat, 'directory');
}

function readKeyFile(keyPath: string, platform: NodeJS.Platform): Buffer | null {
  assertSupportedPlatform(platform);
  ensurePrivateKeyDirectory(dirname(keyPath), platform);

  let linkStat;
  try {
    linkStat = lstatSync(keyPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    fail('KEY_INVALID', 'Credential key file could not be inspected.');
  }

  if (linkStat.isSymbolicLink()) {
    fail('KEY_NOT_REGULAR', 'Credential key file must not be a symbolic link.');
  }
  if (!linkStat.isFile()) {
    fail('KEY_NOT_REGULAR', 'Credential key path must be a regular file.');
  }
  assertOwnerAndMode(linkStat, 'file');
  if (linkStat.size !== CREDENTIAL_KEY_BYTES) {
    fail('KEY_INVALID', 'Credential key file must contain exactly 32 bytes.');
  }

  let fd: number | null = null;
  try {
    const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
    fd = openSync(keyPath, constants.O_RDONLY | noFollow);
    const opened = fstatSync(fd);
    if (!opened.isFile()) {
      fail('KEY_NOT_REGULAR', 'Credential key path must be a regular file.');
    }
    assertOwnerAndMode(opened, 'file');
    if (opened.size !== CREDENTIAL_KEY_BYTES) {
      fail('KEY_INVALID', 'Credential key file must contain exactly 32 bytes.');
    }

    const key = Buffer.alloc(CREDENTIAL_KEY_BYTES);
    const bytesRead = readSync(fd, key as any, 0, CREDENTIAL_KEY_BYTES, 0);
    if (bytesRead !== CREDENTIAL_KEY_BYTES) {
      fail('KEY_INVALID', 'Credential key file could not be read completely.');
    }
    return key;
  } catch (err) {
    if (err instanceof CredentialStorageError) throw err;
    throw new CredentialStorageError('KEY_INVALID', 'Credential key file could not be read.');
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function defaultFsyncDirectory(directoryPath: string): void {
  let fd: number | null = null;
  try {
    const directoryFlag = typeof constants.O_DIRECTORY === 'number' ? constants.O_DIRECTORY : 0;
    fd = openSync(directoryPath, constants.O_RDONLY | directoryFlag);
    fsyncSync(fd);
  } catch {
    throw new CredentialStorageError(
      'KEY_DIRECTORY_SYNC_FAILED',
      'Credential key directory could not be durably synchronized.',
    );
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

function createKeyFile(
  keyPath: string,
  platform: NodeJS.Platform,
  fsyncDirectory: (directoryPath: string) => void = defaultFsyncDirectory,
): Buffer {
  assertSupportedPlatform(platform);
  const keyDir = dirname(keyPath);
  ensurePrivateKeyDirectory(keyDir, platform);

  const key = randomBytes(CREDENTIAL_KEY_BYTES);
  const tempPath = `${keyPath}.${process.pid}.${randomUUID()}.tmp`;
  let fd: number | null = null;

  try {
    fd = openSync(tempPath, 'wx', KEY_FILE_MODE);
    const written = writeSync(fd, key as any, 0, key.length);
    if (written !== key.length) {
      fail('KEY_INVALID', 'Credential key file could not be written completely.');
    }
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    chmodSync(tempPath, KEY_FILE_MODE);

    try {
      // link() is atomic and fails with EEXIST instead of replacing an
      // existing key. A concurrent first-time start therefore either wins or
      // loads the winner's key.
      linkSync(tempPath, keyPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') {
        const existing = readKeyFile(keyPath, platform);
        if (!existing) {
          fail('KEY_INVALID', 'Credential key file disappeared during creation.');
        }
        return existing;
      }
      fail('KEY_INVALID', 'Credential key file could not be created safely.');
    }

    // The final key path is now published. Durably synchronize the containing
    // directory before returning the key. A sync failure fails closed; the
    // published key is intentionally not deleted, so a later call can inspect
    // and use or fail on it through normal validation.
    try {
      fsyncDirectory(dirname(keyPath));
    } catch (err) {
      if (err instanceof CredentialStorageError) throw err;
      throw new CredentialStorageError(
        'KEY_DIRECTORY_SYNC_FAILED',
        'Credential key directory could not be durably synchronized.',
      );
    }

    const created = readKeyFile(keyPath, platform);
    if (!created) {
      fail('KEY_INVALID', 'Credential key file could not be verified after creation.');
    }
    return created;
  } catch (err) {
    if (err instanceof CredentialStorageError) throw err;
    throw new CredentialStorageError('KEY_INVALID', 'Credential key file could not be created safely.');
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
    try { unlinkSync(tempPath); } catch { /* ignore */ }
  }
}

/**
 * Load the existing key or create the first key when no encrypted records
 * exist. A missing key with existing records is never replaced.
 */
export function loadOrCreateCredentialKey(
  keyPath: string,
  options: KeyFileOptions & { hasEncryptedRecords: boolean },
): Buffer {
  const platform = options.platform ?? process.platform;
  const existing = readKeyFile(keyPath, platform);
  if (existing) return existing;

  if (options.hasEncryptedRecords) {
    fail(
      'KEY_MISSING_WITH_RECORDS',
      'Credential key file is missing while encrypted credential records exist. Restore the key from backup; it cannot be regenerated.',
    );
  }

  return createKeyFile(keyPath, platform, options.fsyncDirectory);
}
