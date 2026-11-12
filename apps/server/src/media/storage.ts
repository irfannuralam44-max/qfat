import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, unlink, stat } from 'node:fs/promises';
import { realpathSync, lstatSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Database } from 'better-sqlite3';

export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024; // 512 MiB

export interface StoredMedia {
  id: string;
  originalFilename: string;
  mediaType: 'video' | 'image';
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  sha256: string;
  createdAt: Date;
}

export function ensureMediaRoot(mediaDir: string): void {
  mkdirSync(mediaDir, { recursive: true });
  const st = lstatSync(mediaDir);
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw new Error('Media root must be a real directory');
  }
}

export function ensureRealDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const st = lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw new Error('Directory must be a real directory');
  }
}

export function resolveMediaPath(mediaDir: string, storageKey: string): string {
  const root = resolve(mediaDir);
  const target = resolve(root, storageKey);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error('Storage key escapes media root');
  }
  // Guard against symlink escape when paths already exist.
  try {
    const realRoot = realpathSync(root);
    let realTarget: string;
    try {
      realTarget = realpathSync(target);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
      // For not-yet-created files, validate the parent directory.
      realTarget = realpathSync(resolve(target, '..'));
      if (realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) {
        throw new Error('Storage path escapes media root');
      }
      return target;
    }
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) {
      throw new Error('Storage path escapes media root');
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }
  return target;
}

export function sanitizeFilename(raw: string | null | undefined): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
  // Remove control characters and path separators; keep a readable subset.
  let cleaned = base.replace(/[^\w.\- ()[\]]+/g, '_').trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '..') {
    cleaned = 'upload';
  }
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200);
  }
  return cleaned;
}

export function isQuarantineNameFor(storageKey: string, name: string): boolean {
  if (name === storageKey) return true;
  if (!name.startsWith(`${storageKey}.`)) return false;
  const suffix = name.slice(storageKey.length + 1);
  return /^[1-9]\d*$/.test(suffix);
}

function detectMime(firstBytes: Buffer): { mediaType: 'video' | 'image'; mimeType: string } | null {
  if (firstBytes.length >= 3 && firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff) {
    return { mediaType: 'image', mimeType: 'image/jpeg' };
  }
  if (
    firstBytes.length >= 8 &&
    firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4e && firstBytes[3] === 0x47 &&
    firstBytes[4] === 0x0d && firstBytes[5] === 0x0a && firstBytes[6] === 0x1a && firstBytes[7] === 0x0a
  ) {
    return { mediaType: 'image', mimeType: 'image/png' };
  }
  if (
    firstBytes.length >= 12 &&
    firstBytes.toString('ascii', 0, 4) === 'RIFF' &&
    firstBytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mediaType: 'image', mimeType: 'image/webp' };
  }
  if (firstBytes.length >= 8 && firstBytes.toString('ascii', 4, 8) === 'ftyp') {
    const brand = firstBytes.toString('ascii', 8, 12);
    if (brand.startsWith('qt')) {
      return { mediaType: 'video', mimeType: 'video/quicktime' };
    }
    return { mediaType: 'video', mimeType: 'video/mp4' };
  }
  if (firstBytes.length >= 4 && firstBytes[0] === 0x1a && firstBytes[1] === 0x45 && firstBytes[2] === 0xdf && firstBytes[3] === 0xa3) {
    return { mediaType: 'video', mimeType: 'video/webm' };
  }
  return null;
}

export async function storeUploadedImageOrVideo(
  db: Database,
  mediaDir: string,
  stream: AsyncIterable<Buffer | string>,
  originalFilename: string | null,
  abortSignal?: AbortSignal,
): Promise<StoredMedia> {
  ensureMediaRoot(mediaDir);
  const tmpDir = resolve(mediaDir, '.tmp');
  await mkdir(tmpDir, { recursive: true });
  // Ensure temp dir is also a real directory, not a symlink escape.
  const tmpStat = lstatSync(tmpDir);
  if (!tmpStat.isDirectory() || tmpStat.isSymbolicLink()) {
    throw new Error('Temporary media directory is invalid');
  }

  const id = randomUUID();
  const storageKey = id;
  const tempPath = resolve(tmpDir, `${id}.part`);
  const finalPath = resolveMediaPath(mediaDir, storageKey);

  const hash = createHash('sha256');
  let size = 0;
  const firstBytes = Buffer.alloc(32);
  let firstLen = 0;

  const ws = createWriteStream(tempPath, { flags: 'wx' });

  const cleanupTemp = async () => {
    try { await unlink(tempPath); } catch { /* ignore */ }
  };

  try {
    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        throw new Error('Upload aborted');
      }
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      size += buf.length;
      if (size > MAX_UPLOAD_BYTES) {
        throw new Error(`File exceeds maximum upload size of ${MAX_UPLOAD_BYTES} bytes`);
      }
      hash.update(buf as any);
      if (firstLen < 32) {
        const take = Math.min(32 - firstLen, buf.length);
        (buf as any).copy(firstBytes, firstLen, 0, take);
        firstLen += take;
      }
      if (!ws.write(buf)) {
        await new Promise<void>((resolveDrain, rejectDrain) => {
          ws.once('drain', resolveDrain);
          ws.once('error', rejectDrain);
        });
      }
    }
    if (abortSignal?.aborted) {
      throw new Error('Upload aborted');
    }
    await new Promise<void>((resolveFinish, rejectFinish) => {
      ws.end(() => resolveFinish());
      ws.once('error', rejectFinish);
    });

    if (size === 0) {
      throw new Error('Empty file is not allowed');
    }

    const detected = detectMime(firstBytes.subarray(0, firstLen));
    if (!detected) {
      throw new Error('Unsupported or unrecognized file content');
    }

    // Move temp -> final using rename (atomic on same filesystem)
    await rename(tempPath, finalPath);

    const record: StoredMedia = {
      id,
      originalFilename: sanitizeFilename(originalFilename),
      mediaType: detected.mediaType,
      mimeType: detected.mimeType,
      sizeBytes: size,
      storageKey,
      sha256: hash.digest('hex'),
      createdAt: new Date(),
    };

    // Persist metadata; compensate file on DB failure
    try {
      const { drizzle } = await import('drizzle-orm/better-sqlite3');
      const { mediaItems } = await import('../schema/index.js');
      const drizzleDb = drizzle(db);
      drizzleDb.insert(mediaItems).values({
        id: record.id,
        originalFilename: record.originalFilename,
        mediaType: record.mediaType,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        storageKey: record.storageKey,
        sha256: record.sha256,
        createdAt: record.createdAt,
      }).run();
    } catch (dbErr) {
      try { await unlink(finalPath); } catch { /* ignore */ }
      throw dbErr;
    }

    return record;
  } catch (err) {
    await cleanupTemp();
    // If file was moved, attempt cleanup of final on error after rename? handled above
    throw err;
  }
}

export async function deleteMedia(db: Database, mediaDir: string, id: string): Promise<boolean> {
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const { mediaItems } = await import('../schema/index.js');
  const { eq } = await import('drizzle-orm');
  const drizzleDb = drizzle(db);

  const rows = drizzleDb.select().from(mediaItems).where(eq(mediaItems.id, id)).all() as Array<{
    id: string; storageKey: string;
  }>;
  if (rows.length === 0) return false;
  const row = rows[0];

  ensureMediaRoot(mediaDir);
  const trashDir = resolve(mediaDir, '.trash');
  ensureRealDirectory(trashDir);

  // Validate path containment before any mutation.
  const filePath = resolveMediaPath(mediaDir, row.storageKey);
  const fileStat = (() => {
    try {
      return lstatSync(filePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      throw err;
    }
  })();
  if (fileStat && fileStat.isSymbolicLink()) {
    throw new Error('Refusing to delete symlinked media file');
  }

  // Move the managed file into a quarantine/trash directory before touching
  // the database. This is atomic on the same filesystem and leaves a
  // recoverable copy if the database deletion fails.
  let trashPath: string | null = null;
  let moved = false;
  if (fileStat) {
    trashPath = resolve(trashDir, row.storageKey);
    let candidate = trashPath;
    let suffix = 0;
    while (existsSync(candidate)) {
      suffix += 1;
      candidate = `${trashPath}.${suffix}`;
    }
    trashPath = candidate;
    await rename(filePath, trashPath);
    moved = true;
  }

  // Delete the database row only after the file is safely quarantined.
  try {
    drizzleDb.delete(mediaItems).where(eq(mediaItems.id, id)).run();
  } catch (err) {
    // Roll back the quarantine move so the original file is restored.
    if (moved && trashPath) {
      try {
        await rename(trashPath, filePath);
      } catch {
        // Leave the quarantined file for recovery; do not hide the DB error.
      }
    }
    throw err;
  }

  // Remove the quarantined file. A failure here leaves a recoverable copy
  // in trash while the database record is already gone.
  if (moved && trashPath) {
    try {
      await unlink(trashPath);
    } catch {
      // Intentionally not fatal: the library record is gone and the copy is
      // quarantined for later cleanup/recovery.
    }
  }
  return true;
}

export async function recoverMediaStorage(db: Database, mediaDir: string): Promise<void> {
  ensureMediaRoot(mediaDir);
  const trashDir = resolve(mediaDir, '.trash');
  try {
    ensureRealDirectory(trashDir);
  } catch {
    return;
  }

  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const { mediaItems } = await import('../schema/index.js');
  const drizzleDb = drizzle(db);
  const rows = drizzleDb.select().from(mediaItems).all() as Array<{ id: string; storageKey: string }>;
  const activeKeys = new Set(rows.map((row) => row.storageKey));

  // Restore quarantined files only for records whose managed file is missing.
  for (const row of rows) {
    let originalPath: string;
    try {
      originalPath = resolveMediaPath(mediaDir, row.storageKey);
    } catch {
      continue;
    }
    if (existsSync(originalPath)) continue;

    // Pick only names that belong to this record's exact storage key.
    const candidates = readdirSync(trashDir)
      .filter((name) => isQuarantineNameFor(row.storageKey, name))
      .sort((a, b) => {
        if (a === row.storageKey) return -1;
        if (b === row.storageKey) return 1;
        return a.localeCompare(b);
      });

    for (const name of candidates) {
      const candidate = resolve(trashDir, name);
      try {
        const st = lstatSync(candidate);
        if (st.isSymbolicLink() || !st.isFile()) continue;
        if (!existsSync(originalPath)) {
          await rename(candidate, originalPath);
        }
        break;
      } catch {
        // Leave recovery best-effort; do not crash startup.
      }
    }
  }

  // Remove orphaned quarantine files whose records no longer exist. Never
  // remove a file that still belongs to an active record.
  for (const name of readdirSync(trashDir)) {
    const candidate = resolve(trashDir, name);
    let st;
    try {
      st = lstatSync(candidate);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) {
      try { await unlink(candidate); } catch { /* ignore */ }
      continue;
    }
    if (!st.isFile()) continue;
    const owned = [...activeKeys].some((key) => isQuarantineNameFor(key, name));
    if (!owned) {
      try { await unlink(candidate); } catch { /* ignore */ }
    }
  }
}

export async function getMediaRecord(db: Database, id: string) {
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const { mediaItems } = await import('../schema/index.js');
  const { eq } = await import('drizzle-orm');
  const drizzleDb = drizzle(db);
  const rows = drizzleDb.select().from(mediaItems).where(eq(mediaItems.id, id)).all();
  return rows[0] ?? null;
}

export async function listMediaRecords(db: Database, limit = 100, offset = 0) {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), 500);
  const safeOffset = Math.max(0, Math.trunc(offset));
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const { mediaItems } = await import('../schema/index.js');
  const { desc } = await import('drizzle-orm');
  const drizzleDb = drizzle(db);
  return drizzleDb.select().from(mediaItems)
    .orderBy(desc(mediaItems.createdAt), desc(mediaItems.id))
    .limit(safeLimit)
    .offset(safeOffset)
    .all();
}