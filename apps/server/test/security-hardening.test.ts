import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServer,
  createMutationGuard,
  resetRateLimit,
  SessionStore,
  validateOriginHeader,
  parseSessionCookie,
  FRONTEND_PORT,
} from '../src/index.js';

const origin = `http://127.0.0.1:${FRONTEND_PORT}`;

describe('QFAT-011 security hardening', () => {
  test('Origin accepts supported private IPv4 authorities and rejects non-origin URLs', () => {
    for (const address of [
      '127.0.0.1',
      '127.255.255.254',
      '10.0.0.2',
      '172.31.255.1',
      '192.168.1.20',
      '100.64.0.1',
      '100.127.255.254',
    ]) {
      assert.equal(validateOriginHeader(`http://${address}:5173`).isValid, true, address);
    }

    for (const value of [
      'null',
      'http://8.8.8.8:5173',
      'http://localhost:5173',
      'http://127.1:5173',
      'http://127.0.0.1:05173',
      'http://127.0.0.1:5173/path',
      'http://127.0.0.1:5173/?x=1',
      'http://user@127.0.0.1:5173',
      'http://[::1]:5173',
      'http://100.128.0.1:5173',
      'http://127.0.0.1:5173, http://10.0.0.1:5173',
    ]) {
      assert.equal(validateOriginHeader(value).isValid, false, value);
    }
  });

  test('session cookie parser rejects duplicates, empty values, and malformed tokens', () => {
    const valid = 'A'.repeat(43);
    assert.equal(parseSessionCookie(`qfat_session=${valid}; theme=dark`), valid);
    assert.equal(parseSessionCookie(`qfat_session=${valid}; qfat_session=${valid}`), null);
    assert.equal(parseSessionCookie(`qfat_session=${valid}; qfat_session`), null);
    assert.equal(parseSessionCookie('qfat_session=; theme=dark'), null);
    assert.equal(parseSessionCookie('qfat_session=not-a-session-id'), null);
    assert.equal(parseSessionCookie('theme=dark'), null);
  });

  test('session store enforces capacity and reuses capacity after expiry cleanup', () => {
    const store = new SessionStore(1);
    try {
      const first = store.create('csrf-token');
      assert.throws(() => store.create('another-token'), /capacity/i);
      const session = store.get(first.hashedId);
      assert.ok(session);
      session.expiresAt = Date.now() - 1;
      const second = store.create('next-token');
      assert.ok(second.sessionId);
      assert.equal(store.get(first.hashedId), undefined);
    } finally {
      store.shutdown();
    }
  });

  test('destroy requires a valid session and matching CSRF token', async () => {
    resetRateLimit();
    const app = await buildServer();
    try {
      await app.ready();
      const bootstrap = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      assert.equal(bootstrap.statusCode, 200);
      const body = bootstrap.json<{ csrfToken: string }>();
      const cookieHeader = bootstrap.headers['set-cookie'];
      assert.equal(typeof cookieHeader, 'string');
      const sessionCookie = String(cookieHeader).split(';', 1)[0];

      const missingCsrf = await app.inject({
        method: 'POST',
        url: '/api/v1/security/session/destroy',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: sessionCookie,
        },
      });
      assert.equal(missingCsrf.statusCode, 401);

      const wrongCsrf = await app.inject({
        method: 'POST',
        url: '/api/v1/security/session/destroy',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: sessionCookie,
          'x-csrf-token': 'wrong-token',
        },
      });
      assert.equal(wrongCsrf.statusCode, 401);

      const duplicateCookie = await app.inject({
        method: 'POST',
        url: '/api/v1/security/session/destroy',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: `${sessionCookie}; ${sessionCookie}`,
          'x-csrf-token': body.csrfToken,
        },
      });
      assert.equal(duplicateCookie.statusCode, 401);

      const validDestroy = await app.inject({
        method: 'POST',
        url: '/api/v1/security/session/destroy',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: sessionCookie,
          'x-csrf-token': body.csrfToken,
        },
      });
      assert.equal(validDestroy.statusCode, 200);
      assert.equal(validDestroy.json<{ success: boolean }>().success, true);
      assert.match(String(validDestroy.headers['set-cookie']), /Max-Age=0/);
    } finally {
      await app.close();
    }
  });

  test('reusable mutation guard is exercised as an actual Fastify preHandler', async () => {
    resetRateLimit();
    const app = await buildServer();
    try {
      app.post('/api/v1/test/mutation', { preHandler: createMutationGuard() }, async () => ({ ok: true }));
      await app.ready();

      const bootstrap = await app.inject({
        method: 'POST',
        url: '/api/v1/security/bootstrap',
        headers: { origin, host: origin.replace('http://', '') },
      });
      assert.equal(bootstrap.statusCode, 200);
      const body = bootstrap.json<{ csrfToken: string }>();
      const cookieHeader = String(bootstrap.headers['set-cookie']);
      const sessionCookie = cookieHeader.split(';', 1)[0];

      const rejected = await app.inject({
        method: 'POST',
        url: '/api/v1/test/mutation',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: sessionCookie,
        },
      });
      assert.equal(rejected.statusCode, 401);

      const accepted = await app.inject({
        method: 'POST',
        url: '/api/v1/test/mutation',
        headers: {
          origin,
          host: origin.replace('http://', ''),
          cookie: sessionCookie,
          'x-csrf-token': body.csrfToken,
        },
      });
      assert.equal(accepted.statusCode, 200);
      assert.deepEqual(accepted.json(), { ok: true });
    } finally {
      await app.close();
    }
  });
});
