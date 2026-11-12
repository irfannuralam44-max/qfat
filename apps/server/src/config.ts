import { homedir } from 'node:os';
import { resolve } from 'node:path';

export function getDataDir(): string {
  const env = process.env.QFAT_DATA_DIR;
  if (env && env.trim() !== '') {
    return resolve(env.trim());
  }
  return resolve(homedir(), '.qfat');
}

export function getDbPath(): string {
  return resolve(getDataDir(), 'qfat.db');
}

export function getMediaDir(): string {
  return resolve(getDataDir(), 'media');
}

/**
 * Local key-file directory for the temporary credential provider.
 *
 * It is deliberately a separate directory from the SQLite database file so a
 * copied database does not include the key. The parent follows the existing
 * QFAT data-directory convention (`QFAT_DATA_DIR`, default `~/.qfat`).
 */
export function getKeyDir(): string {
  return resolve(getDataDir(), 'keys');
}

export function getCredentialKeyPath(): string {
  return resolve(getKeyDir(), 'credential.key');
}