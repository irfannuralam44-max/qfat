import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildServer, resetRateLimit } from '../src/index.js';
import { createTempDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { resolveMediaPath, ensureMediaRoot, isQuarantineNameFor, deleteMedia, storeUploadedImageOrVideo } from '../src/media/storage.js';
import { symlinkSync, writeFileSync, mkdirSync, chmodSync, readdirSync, renameSync } from 'node:fs';
import Database from 'better-sqlite3';

const origin = 'http://127.0.0.1:5173';

describe('Media intake', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;
  let mediaDir: string;
  let cleanupDb: () => void;
  let sessionCookie: string;
  let csrfToken: string;

  before(async () => {
    const tmpDb = createTempDatabase('qfat-media');
    dbPath = tmpDb;
    cleanupDb = () => {
      try { rmSync(dbPath, { force: true }); } catch {}
      try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
      try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
    };
    mediaDir = mkdtempSync(join(tmpdir(), 'qfat-media-dir-'));
    resetRateLimit();
    app = await buildServer({ dbPath, mediaDir });
    await app.ready();

    const bootstrap = await app.inject({
      method: 'POST',
      url: '/api/v1/security/bootstrap',
      headers: { origin, host: origin.replace('http://', '') },
    });
    assert.equal(bootstrap.statusCode, 200);
    const body = bootstrap.json<{ csrfToken: string }>();
    csrfToken = body.csrfToken;
    sessionCookie = String(bootstrap.headers['set-cookie']).split(';', 1)[0];
  });

  after(async () => {
    await app.close();
    cleanupDb();
    try { rmSync(mediaDir, { recursive: true, force: true }); } catch {}
  });

  test('rejects request without session', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      headers: { origin, host: origin.replace('http://', ''), 'content-type': 'application/octet-stream', 'x-file-name': 'a.png' },
      payload: png,
    });
    assert.equal(res.statusCode, 401);
  });

  test('rejects request without CSRF', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie, 'content-type': 'application/octet-stream', 'x-file-name': 'a.png' },
      payload: png,
    });
    assert.equal(res.statusCode, 401);
  });

  test('uploads a valid image and creates a record', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      headers: {
        origin,
        host: origin.replace('http://', ''),
        cookie: sessionCookie,
        'x-csrf-token': csrfToken,
        'content-type': 'application/octet-stream',
        'x-file-name': '../evil/t.png',
      },
      payload: png,
    });
    assert.equal(res.statusCode, 201);
    const body = res.json<{ id: string; originalFilename: string; mediaType: string; mimeType: string; sizeBytes: number }>();
    assert.equal(body.mediaType, 'image');
    assert.equal(body.mimeType, 'image/png');
    assert.equal(body.sizeBytes, png.length);
    // sanitized filename, no path
    assert.ok(!body.originalFilename.includes('/') && !body.originalFilename.includes('\\'));

    // list
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/media',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
    });
    assert.equal(list.statusCode, 200);
    const items = list.json<{ items: any[] }>().items;
    assert.equal(items.length, 1);

    // detail
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${body.id}`,
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
    });
    assert.equal(detail.statusCode, 200);
    assert.ok(!JSON.stringify(detail.json()).includes(mediaDir));

    // delete
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/media/${body.id}`,
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    assert.equal(del.statusCode, 204);

    const list2 = await app.inject({
      method: 'GET',
      url: '/api/v1/media',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
    });
    assert.equal(list2.json<{ items: any[] }>().items.length, 0);
  });

  test('rejects empty file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      headers: {
        origin,
        host: origin.replace('http://', ''),
        cookie: sessionCookie,
        'x-csrf-token': csrfToken,
        'content-type': 'application/octet-stream',
        'x-file-name': 'empty.png',
      },
      payload: Buffer.alloc(0),
    });
    assert.equal(res.statusCode, 415);
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/media',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
    });
    assert.equal(list.json<{ items: any[] }>().items.length, 0);
  });

  test('rejects content mismatch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      headers: {
        origin,
        host: origin.replace('http://', ''),
        cookie: sessionCookie,
        'x-csrf-token': csrfToken,
        'content-type': 'application/octet-stream',
        'x-file-name': 'fake.png',
      },
      payload: Buffer.from('not an image'),
    });
    assert.equal(res.statusCode, 415);
  });

  test('rejects delete of unknown id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/media/does-not-exist',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie, 'x-csrf-token': csrfToken },
    });
    assert.equal(res.statusCode, 404);
  });

  test('read endpoint rejects invalid origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/media',
      headers: { origin: 'http://8.8.8.8:5173', host: '8.8.8.8:5173', cookie: sessionCookie },
    });
    assert.equal(res.statusCode, 403);
  });

  test('list supports pagination parameters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/media?limit=1&offset=0',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json<{ items: any[]; limit: number; offset: number }>();
    assert.equal(body.limit, 1);
    assert.equal(body.offset, 0);
  });

  test('list rejects invalid pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/media?limit=0',
      headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('Media persistence across restart', () => {
  test('records survive backend restart', async () => {
    const dbPath = createTempDatabase('qfat-media-restart');
    const mediaDir = mkdtempSync(join(tmpdir(), 'qfat-media-restart-dir-'));
    const cleanup = () => {
      try { rmSync(dbPath, { force: true }); } catch {}
      try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
      try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
      try { rmSync(mediaDir, { recursive: true, force: true }); } catch {}
    };
    try {
      resetRateLimit();
      let app = await buildServer({ dbPath, mediaDir });
      await app.ready();
      const bootstrap = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      const csrfToken = bootstrap.json<{ csrfToken: string }>().csrfToken;
      const sessionCookie = String(bootstrap.headers['set-cookie']).split(';', 1)[0];
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
      await app.inject({
        method: 'POST',
        url: '/api/v1/media',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: sessionCookie,
          'x-csrf-token': csrfToken,
          'content-type': 'application/octet-stream',
          'x-file-name': 'p.png',
        },
        payload: png,
      });
      await app.close();

      // restart
      resetRateLimit();
      app = await buildServer({ dbPath, mediaDir });
      await app.ready();
      const bootstrap2 = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      const sessionCookie2 = String(bootstrap2.headers['set-cookie']).split(';', 1)[0];
      const list = await app.inject({
        method: 'GET',
        url: '/api/v1/media',
        headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie2 },
      });
      assert.equal(list.statusCode, 200);
      assert.equal(list.json<{ items: any[] }>().items.length, 1);
      await app.close();
    } finally {
      cleanup();
    }
  });
});

describe('Media path safety', () => {
  test('resolveMediaPath rejects traversal and absolute escape', () => {
    assert.throws(() => resolveMediaPath('/tmp/qfat-root', '../outside'), /escapes media root/);
    assert.throws(() => resolveMediaPath('/tmp/qfat-root', '/etc/passwd'), /escapes media root/);
  });

  test('resolveMediaPath rejects symlink escape when target exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'qfat-symroot-'));
    const outside = mkdtempSync(join(tmpdir(), 'qfat-outside-'));
    const outsideFile = join(outside, 'secret.txt');
    writeFileSync(outsideFile, 'secret');
    const linkPath = join(root, 'evil');
    symlinkSync(outsideFile, linkPath);
    try {
      assert.throws(() => resolveMediaPath(root, 'evil'), /escapes media root/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test('ensureMediaRoot rejects symlinked root', () => {
    const real = mkdtempSync(join(tmpdir(), 'qfat-real-'));
    const link = join(tmpdir(), `qfat-link-${Date.now()}`);
    symlinkSync(real, link);
    try {
      assert.throws(() => ensureMediaRoot(link), /real directory/);
    } finally {
      rmSync(link, { force: true });
      rmSync(real, { recursive: true, force: true });
    }
  });
});

describe('Media pagination', () => {
  test('returns distinct pages with correct counts', async () => {
    const dbPath = createTempDatabase('qfat-media-page');
    const mediaDir = mkdtempSync(join(tmpdir(), 'qfat-media-page-dir-'));
    const cleanup = () => {
      try { rmSync(dbPath, { force: true }); } catch {}
      try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
      try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
      try { rmSync(mediaDir, { recursive: true, force: true }); } catch {}
    };
    try {
      resetRateLimit();
      const app = await buildServer({ dbPath, mediaDir });
      await app.ready();
      const bootstrap = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      const csrfToken = bootstrap.json<{ csrfToken: string }>().csrfToken;
      const sessionCookie = String(bootstrap.headers['set-cookie']).split(';', 1)[0];
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/media',
          headers: {
            origin,
            host: origin.replace('http://', ''),
            cookie: sessionCookie,
            'x-csrf-token': csrfToken,
            'content-type': 'application/octet-stream',
            'x-file-name': `p${i}.png`,
          },
          payload: png,
        });
      }

      const page1 = await app.inject({
        method: 'GET',
        url: '/api/v1/media?limit=2&offset=0',
        headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
      });
      assert.equal(page1.statusCode, 200);
      const body1 = page1.json<{ items: any[] }>();
      assert.equal(body1.items.length, 2);

      const page2 = await app.inject({
        method: 'GET',
        url: '/api/v1/media?limit=2&offset=2',
        headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
      });
      assert.equal(page2.statusCode, 200);
      const body2 = page2.json<{ items: any[] }>();
      assert.equal(body2.items.length, 1);

      // distinct ids
      const ids1 = body1.items.map((x: any) => x.id);
      const ids2 = body2.items.map((x: any) => x.id);
      assert.ok(!ids2.some((id: string) => ids1.includes(id)));

      // max limit enforced
      const big = await app.inject({
        method: 'GET',
        url: '/api/v1/media?limit=1000',
        headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
      });
      assert.equal(big.json<{ limit: number }>().limit, 500);

      await app.close();
    } finally {
      cleanup();
    }
  });
});

async function createMediaFixture(prefix: string) {
  const dbPath = createTempDatabase(prefix);
  const mediaDir = mkdtempSync(join(tmpdir(), `${prefix}-dir-`));
  resetRateLimit();
  const app = await buildServer({ dbPath, mediaDir });
  await app.ready();
  const bootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/security/bootstrap',
    headers: { origin, host: origin.replace('http://', '') },
  });
  const csrfToken = bootstrap.json<{ csrfToken: string }>().csrfToken;
  const sessionCookie = String(bootstrap.headers['set-cookie']).split(';', 1)[0];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

  const upload = async (name = 'p.png') => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      headers: {
        origin,
        host: origin.replace('http://', ''),
        cookie: sessionCookie,
        'x-csrf-token': csrfToken,
        'content-type': 'application/octet-stream',
        'x-file-name': name,
      },
      payload: png,
    });
    assert.equal(res.statusCode, 201);
    return res.json<{ id: string }>();
  };

  const deleteItem = (id: string) => app.inject({
    method: 'DELETE',
    url: `/api/v1/media/${id}`,
    headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie, 'x-csrf-token': csrfToken },
  });

  const list = () => app.inject({
    method: 'GET',
    url: '/api/v1/media?limit=100',
    headers: { origin, host: origin.replace('http://', ''), cookie: sessionCookie },
  });

  const cleanup = async () => {
    try { await app.close(); } catch { /* ignore */ }
    try { rmSync(dbPath, { force: true }); } catch {}
    try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
    try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
    try { rmSync(mediaDir, { recursive: true, force: true }); } catch {}
  };

  return { app, dbPath, mediaDir, csrfToken, sessionCookie, upload, deleteItem, list, cleanup };
}

describe('Media delete resilience', () => {
  test('database delete failure rolls back the quarantined file and keeps the record', async () => {
    const f = await createMediaFixture('qfat-del-db');
    try {
      const record = await f.upload('db-fail.png');
      const db = new Database(f.dbPath);
      db.exec("CREATE TRIGGER fail_media_delete BEFORE DELETE ON media_items BEGIN SELECT RAISE(ABORT, 'forced'); END;");
      try {
        const res = await f.deleteItem(record.id);
        assert.equal(res.statusCode, 500);
      } finally {
        db.exec('DROP TRIGGER fail_media_delete');
        db.close();
      }
      const list = await f.list();
      assert.equal(list.json<{ items: any[] }>().items.length, 1);
      assert.equal(existsSync(join(f.mediaDir, record.id)), true);
      assert.equal(readdirSync(join(f.mediaDir, '.trash')).length, 0);
    } finally {
      await f.cleanup();
    }
  });

  test('filesystem move failure leaves the record and file intact', async () => {
    const f = await createMediaFixture('qfat-del-move');
    try {
      const record = await f.upload('move-fail.png');
      chmodSync(join(f.mediaDir, '.trash'), 0o500);
      try {
        const res = await f.deleteItem(record.id);
        assert.equal(res.statusCode, 500);
      } finally {
        chmodSync(join(f.mediaDir, '.trash'), 0o700);
      }
      const list = await f.list();
      assert.equal(list.json<{ items: any[] }>().items.length, 1);
      assert.equal(existsSync(join(f.mediaDir, record.id)), true);
    } finally {
      await f.cleanup();
    }
  });

  test('filesystem unlink failure leaves a quarantined regular file and does not throw', async () => {
    const f = await createMediaFixture('qfat-del-unlink');
    try {
      const record = await f.upload('unlink-fail.png');
      const fs = await import('node:fs');
      const fsp = await import('node:fs/promises');
      const db = new Database(f.dbPath);
      try {
        const result = await deleteMedia(db, f.mediaDir, record.id, {
          rename: fsp.rename,
          unlink: async () => { throw new Error('forced unlink failure'); },
          lstatSync: fs.lstatSync,
          existsSync: fs.existsSync,
        });
        assert.equal(result, true);
      } finally {
        db.close();
      }
      const list = await f.list();
      assert.equal(list.json<{ items: any[] }>().items.length, 0);
      const trashPath = join(f.mediaDir, '.trash', record.id);
      assert.equal(existsSync(trashPath), true);
      assert.equal(fs.lstatSync(trashPath).isFile(), true);
    } finally {
      await f.cleanup();
    }
  });

  test('delete rejects a directory or non-regular managed object without quarantining it', async () => {
    const f = await createMediaFixture('qfat-del-dir');
    try {
      const record = await f.upload('dir.png');
      rmSync(join(f.mediaDir, record.id), { force: true });
      mkdirSync(join(f.mediaDir, record.id));
      const res = await f.deleteItem(record.id);
      assert.equal(res.statusCode, 409);
      const list = await f.list();
      assert.equal(list.json<{ items: any[] }>().items.length, 1);
      assert.equal(existsSync(join(f.mediaDir, record.id)), true);
      assert.equal(readdirSync(join(f.mediaDir, '.trash')).length, 0);
    } finally {
      await f.cleanup();
    }
  });

  test('crash after quarantine restores the exact file for the correct record', async () => {
    const f = await createMediaFixture('qfat-del-crash');
    let app2: Awaited<ReturnType<typeof buildServer>> | null = null;
    try {
      const a = await f.upload('a.png');
      const b = await f.upload('b.png');
      const trash = join(f.mediaDir, '.trash');
      mkdirSync(trash, { recursive: true });
      // Simulate crash after moving A to trash but before deleting its DB row.
      renameSync(join(f.mediaDir, a.id), join(trash, a.id));
      await f.app.close();

      app2 = await buildServer({ dbPath: f.dbPath, mediaDir: f.mediaDir });
      await app2.ready();
      assert.equal(existsSync(join(f.mediaDir, a.id)), true);
      assert.equal(existsSync(join(f.mediaDir, b.id)), true);
      assert.equal(existsSync(join(trash, a.id)), false);
      assert.equal(existsSync(join(trash, b.id)), false);
    } finally {
      if (app2) await app2.close();
      await f.cleanup();
    }
  });

  test('startup recovery removes orphan quarantine files with no active record', async () => {
    const f = await createMediaFixture('qfat-del-orphan');
    let app2: Awaited<ReturnType<typeof buildServer>> | null = null;
    try {
      const record = await f.upload('orphan.png');
      const trash = join(f.mediaDir, '.trash');
      mkdirSync(trash, { recursive: true });
      renameSync(join(f.mediaDir, record.id), join(trash, record.id));
      const db = new Database(f.dbPath);
      db.prepare('DELETE FROM media_items WHERE id = ?').run(record.id);
      db.close();
      await f.app.close();

      app2 = await buildServer({ dbPath: f.dbPath, mediaDir: f.mediaDir });
      await app2.ready();
      assert.equal(existsSync(join(trash, record.id)), false);
      assert.equal(readdirSync(trash).length, 0);
    } finally {
      if (app2) await app2.close();
      await f.cleanup();
    }
  });

  test('quarantine name matcher only accepts the exact storage key and numeric suffixes', () => {
    const key = '11111111-1111-1111-1111-111111111111';
    assert.equal(isQuarantineNameFor(key, key), true);
    assert.equal(isQuarantineNameFor(key, `${key}.1`), true);
    assert.equal(isQuarantineNameFor(key, `${key}.12`), true);
    assert.equal(isQuarantineNameFor(key, `${key}.0`), false);
    assert.equal(isQuarantineNameFor(key, `${key}.abc`), false);
    assert.equal(isQuarantineNameFor(key, `${key}-other`), false);
    assert.equal(isQuarantineNameFor(key, '22222222-2222-2222-2222-222222222222'), false);
  });
});

describe('Media upload abort', () => {
  test('abort signal stops ingestion, removes .part, and creates no record', async () => {
    const dbPath = createTempDatabase('qfat-upload-abort-signal');
    const mediaDir = mkdtempSync(join(tmpdir(), 'qfat-upload-abort-signal-dir-'));
    await runMigrations(dbPath);
    const db = new Database(dbPath);
    try {
      const controller = new AbortController();
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
      async function* source() {
        yield png;
        controller.abort();
        yield png;
      }
      await assert.rejects(
        () => storeUploadedImageOrVideo(db, mediaDir, source(), 'aborted.png', controller.signal),
        /Upload aborted/,
      );
      assert.equal(readdirSync(join(mediaDir, '.tmp')).length, 0);
      const count = db.prepare('SELECT COUNT(*) AS n FROM media_items').get() as { n: number };
      assert.equal(count.n, 0);
    } finally {
      db.close();
      rmSync(mediaDir, { recursive: true, force: true });
      try { rmSync(dbPath, { force: true }); } catch {}
      try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
      try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
    }
  });

  test('aborted upload stops the stream, removes .part, and creates no record', async () => {
    const f = await createMediaFixture('qfat-upload-abort');
    try {
      const { Readable } = await import('node:stream');
      let sent = false;
      const stream = new Readable({
        read() {
          if (!sent) {
            sent = true;
            this.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]));
            setImmediate(() => this.destroy(new Error('client aborted')));
            return;
          }
          // Never provide more data; the destroyed stream ends the upload.
        },
      });
      stream.on('error', () => { /* expected abort error */ });
      let statusCode = 0;
      try {
        const res = await f.app.inject({
          method: 'POST',
          url: '/api/v1/media',
          headers: {
            origin,
            host: origin.replace('http://', ''),
            cookie: f.sessionCookie,
            'x-csrf-token': f.csrfToken,
            'content-type': 'application/octet-stream',
            'x-file-name': 'aborted.png',
          },
          payload: stream,
        });
        statusCode = res.statusCode;
      } catch {
        // The injected request may surface the stream error directly.
        statusCode = 400;
      }
      assert.equal(statusCode, 400);
      // Cleanup runs in the request handler; allow the aborted handler to
      // finish before asserting that the temp file is gone.
      const tmpDir = join(f.mediaDir, '.tmp');
      const deadline = Date.now() + 2000;
      while (readdirSync(tmpDir).length > 0 && Date.now() < deadline) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 20));
      }
      assert.deepEqual(readdirSync(tmpDir), []);
      const list = await f.list();
      assert.equal(list.json<{ items: any[] }>().items.length, 0);
    } finally {
      await f.cleanup();
    }
  });
});

describe('Media symlink hardening', () => {
  test('upload rejects a symlinked .tmp directory', async () => {
    const dbPath = createTempDatabase('qfat-sym-tmp');
    const mediaDir = mkdtempSync(join(tmpdir(), 'qfat-sym-tmp-dir-'));
    const outside = mkdtempSync(join(tmpdir(), 'qfat-sym-tmp-out-'));
    symlinkSync(outside, join(mediaDir, '.tmp'));
    try {
      resetRateLimit();
      const app = await buildServer({ dbPath, mediaDir });
      await app.ready();
      const bootstrap = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      const csrfToken = bootstrap.json<{ csrfToken: string }>().csrfToken;
      const cookie = String(bootstrap.headers['set-cookie']).split(';', 1)[0];
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie,
          'x-csrf-token': csrfToken,
          'content-type': 'application/octet-stream',
          'x-file-name': 'p.png',
        },
        payload: png,
      });
      assert.equal(res.statusCode, 500);
      assert.equal(readdirSync(outside).length, 0);
      await app.close();
    } finally {
      rmSync(mediaDir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
      try { rmSync(dbPath, { force: true }); } catch {}
      try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
      try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
    }
  });

  test('delete rejects a symlinked .trash directory', async () => {
    const dbPath = createTempDatabase('qfat-sym-trash');
    const mediaDir = mkdtempSync(join(tmpdir(), 'qfat-sym-trash-dir-'));
    const outside = mkdtempSync(join(tmpdir(), 'qfat-sym-trash-out-'));
    symlinkSync(outside, join(mediaDir, '.trash'));
    try {
      resetRateLimit();
      const app = await buildServer({ dbPath, mediaDir });
      await app.ready();
      const bootstrap = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      const csrfToken = bootstrap.json<{ csrfToken: string }>().csrfToken;
      const cookie = String(bootstrap.headers['set-cookie']).split(';', 1)[0];
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const upload = await app.inject({
        method: 'POST',
        url: '/api/v1/media',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie,
          'x-csrf-token': csrfToken,
          'content-type': 'application/octet-stream',
          'x-file-name': 'p.png',
        },
        payload: png,
      });
      assert.equal(upload.statusCode, 201);
      const id = upload.json<{ id: string }>().id;
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/media/${id}`,
        headers: { origin, host: origin.replace('http://', ''), cookie, 'x-csrf-token': csrfToken },
      });
      assert.equal(res.statusCode, 500);
      assert.equal(existsSync(join(mediaDir, id)), true);
      await app.close();
    } finally {
      rmSync(mediaDir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
      try { rmSync(dbPath, { force: true }); } catch {}
      try { rmSync(`${dbPath}-wal`, { force: true }); } catch {}
      try { rmSync(`${dbPath}-shm`, { force: true }); } catch {}
    }
  });

  test('delete rejects a symlinked target file', async () => {
    const f = await createMediaFixture('qfat-sym-target');
    const outside = mkdtempSync(join(tmpdir(), 'qfat-sym-target-out-'));
    try {
      const record = await f.upload('target.png');
      rmSync(join(f.mediaDir, record.id), { force: true });
      const outsideFile = join(outside, 'outside.png');
      writeFileSync(outsideFile, 'outside');
      symlinkSync(outsideFile, join(f.mediaDir, record.id));
      const res = await f.deleteItem(record.id);
      assert.equal(res.statusCode, 500);
      assert.equal(existsSync(outsideFile), true);
      const list = await f.list();
      assert.equal(list.json<{ items: any[] }>().items.length, 1);
    } finally {
      rmSync(outside, { recursive: true, force: true });
      await f.cleanup();
    }
  });
});

describe('Media pagination stability', () => {
  test('orders deterministically by createdAt then id', async () => {
    const f = await createMediaFixture('qfat-page-stable');
    try {
      const db = new Database(f.dbPath);
      const sameTime = Math.floor(Date.now() / 1000);
      const insert = db.prepare(`INSERT INTO media_items
        (id, original_filename, media_type, mime_type, size_bytes, storage_key, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const id of ['cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']) {
        insert.run(id, `${id}.png`, 'image', 'image/png', 1, id, 'hash', sameTime);
      }
      db.close();

      const page1 = await f.app.inject({
        method: 'GET',
        url: '/api/v1/media?limit=2&offset=0',
        headers: { origin, host: origin.replace('http://', ''), cookie: f.sessionCookie },
      });
      const page2 = await f.app.inject({
        method: 'GET',
        url: '/api/v1/media?limit=2&offset=2',
        headers: { origin, host: origin.replace('http://', ''), cookie: f.sessionCookie },
      });
      const ids1 = page1.json<{ items: any[] }>().items.map((x: any) => x.id);
      const ids2 = page2.json<{ items: any[] }>().items.map((x: any) => x.id);
      assert.deepEqual(ids1, ['cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']);
      assert.deepEqual(ids2, ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
    } finally {
      await f.cleanup();
    }
  });
});