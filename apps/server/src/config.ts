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