import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildServer } from '../src/index.js';
import { createTempDatabase } from '../src/db/connection.js';

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