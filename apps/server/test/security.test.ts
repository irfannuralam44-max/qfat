import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer, resetRateLimit } from '../src/index.js';
import {
  validateOriginHeader,
  validateHostHeader,
  generateSessionId,
  generateCsrfToken,
  constantTimeEqual,
  hashSessionId,
  sessionStore,
  createSessionCookie,
  createClearSessionCookie,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_MAX_AGE_SECONDS,
  FRONTEND_PORT,
  type ParsedAuthority,
} from '../src/security/index.js';

describe('Security Validation', () => {
  describe('validateOriginHeader', () => {
    test('accepts loopback IPv4 origin', () => {
      const result = validateOriginHeader('http://127.0.0.1:5173');
      assert.equal(result.isValid, true);
      assert.ok(result.authority);
      assert.equal(result.authority!.host, '127.0.0.1');
      assert.equal(result.authority!.port, 5173);
    });

    test('accepts RFC1918 10.x origin', () => {
      const result = validateOriginHeader('http://10.0.0.5:5173');
      assert.equal(result.isValid, true);
    });

    test('accepts RFC1918 172.16-31.x origin', () => {
      const result = validateOriginHeader('http://172.20.0.1:5173');
      assert.equal(result.isValid, true);
    });

    test('accepts RFC1918 192.168.x origin', () => {
      const result = validateOriginHeader('http://192.168.1.100:5173');
      assert.equal(result.isValid, true);
    });

    test('accepts Tailscale CGNAT origin', () => {
      const result = validateOriginHeader('http://100.100.100.100:5173');
      assert.equal(result.isValid, true);
    });

    test('rejects missing origin', () => {
      const result = validateOriginHeader(null);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('Missing Origin'));
    });

    test('rejects multiple origin values', () => {
      const result = validateOriginHeader('http://127.0.0.1:5173, http://10.0.0.1:5173');
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('Multiple Origin'));
    });

    test('rejects non-http scheme', () => {
      const result = validateOriginHeader('https://127.0.0.1:5173');
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('http scheme'));
    });

    test('rejects wrong port', () => {
      const result = validateOriginHeader('http://127.0.0.1:3000');
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('port must be 5173'));
    });

    test('rejects public IPv4', () => {
      const result = validateOriginHeader('http://8.8.8.8:5173');
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('private IPv4'));
    });

    test('rejects DNS hostname', () => {
      const result = validateOriginHeader('http://localhost:5173');
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('numeric IPv4 literal'));
    });

    test('rejects IPv6', () => {
      const result = validateOriginHeader('http://[::1]:5173');
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('numeric IPv4 literal'));
    });

    test('rejects malformed origin', () => {
      const result = validateOriginHeader('not-a-url');
      assert.equal(result.isValid, false);
    });

    test('rejects IPv4 with invalid octets', () => {
      const result = validateOriginHeader('http://999.999.999.999:5173');
      assert.equal(result.isValid, false);
    });

    test('rejects origin with unexpected port format', () => {
      const result = validateOriginHeader('http://127.0.0.1:abc');
      assert.equal(result.isValid, false);
    });
  });

  describe('validateHostHeader', () => {
    test('accepts matching host', () => {
      const originAuth: ParsedAuthority = { host: '127.0.0.1', port: 5173, isValid: true };
      const result = validateHostHeader('127.0.0.1:5173', originAuth);
      assert.equal(result.isValid, true);
    });

    test('rejects mismatched host', () => {
      const originAuth: ParsedAuthority = { host: '127.0.0.1', port: 5173, isValid: true };
      const result = validateHostHeader('10.0.0.1:5173', originAuth);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('does not match'));
    });

    test('rejects mismatched port', () => {
      const originAuth: ParsedAuthority = { host: '127.0.0.1', port: 5173, isValid: true };
      const result = validateHostHeader('127.0.0.1:3000', originAuth);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes('port does not match'));
    });

    test('rejects multiple host values', () => {
      const originAuth: ParsedAuthority = { host: '127.0.0.1', port: 5173, isValid: true };
      const result = validateHostHeader('127.0.0.1:5173, 10.0.0.1:5173', originAuth);
      assert.equal(result.isValid, false);
    });

    test('rejects missing host', () => {
      const originAuth: ParsedAuthority = { host: '127.0.0.1', port: 5173, isValid: true };
      const result = validateHostHeader(null, originAuth);
      assert.equal(result.isValid, false);
    });
  });

  describe('Crypto utilities', () => {
    test('generateSessionId produces base64url string', () => {
      const id = generateSessionId();
      assert.ok(typeof id === 'string');
      assert.ok(id.length > 0);
      assert.ok(!id.includes('+'));
      assert.ok(!id.includes('/'));
    });

    test('generateCsrfToken produces base64url string', () => {
      const token = generateCsrfToken();
      assert.ok(typeof token === 'string');
      assert.ok(token.length > 0);
    });

    test('constantTimeEqual returns true for equal strings', () => {
      assert.equal(constantTimeEqual('abc', 'abc'), true);
    });

    test('constantTimeEqual returns false for different strings', () => {
      assert.equal(constantTimeEqual('abc', 'abd'), false);
    });

    test('constantTimeEqual returns false for different lengths', () => {
      assert.equal(constantTimeEqual('abc', 'abcd'), false);
    });

    test('hashSessionId produces hex string', () => {
      const hash = hashSessionId('test-session-id');
      assert.ok(typeof hash === 'string');
      assert.equal(hash.length, 64);
      assert.ok(/^[0-9a-f]+$/.test(hash));
    });
  });

  describe('SessionStore', () => {
    before(() => {
      sessionStore.cleanup();
    });

    after(() => {
      sessionStore.shutdown();
    });

    test('creates session with csrfToken and expiry', () => {
      const csrfToken = generateCsrfToken();
      const { sessionId, hashedId, expiresAt } = sessionStore.create(csrfToken);

      assert.ok(sessionId);
      assert.ok(hashedId);
      assert.equal(expiresAt > Date.now(), true);
      assert.equal(expiresAt - Date.now() <= SESSION_MAX_AGE_SECONDS * 1000 + 100, true);
    });

    test('get returns session data', () => {
      const csrfToken = generateCsrfToken();
      const { hashedId } = sessionStore.create(csrfToken);
      const session = sessionStore.get(hashedId);

      assert.ok(session);
      assert.equal(session.csrfToken, csrfToken);
      assert.ok(session.createdAt > 0);
      assert.ok(session.expiresAt > Date.now());
    });

    test('get returns undefined for non-existent session', () => {
      const session = sessionStore.get('non-existent-hash');
      assert.equal(session, undefined);
    });

    test('get returns undefined for expired session', () => {
      const csrfToken = generateCsrfToken();
      const { hashedId } = sessionStore.create(csrfToken);

      const session = sessionStore.get(hashedId);
      assert.ok(session);

      session.expiresAt = Date.now() - 1000;
      const expiredSession = sessionStore.get(hashedId);
      assert.equal(expiredSession, undefined);
    });

    test('rotate creates new session and invalidates old', () => {
      const csrfToken = generateCsrfToken();
      const { hashedId } = sessionStore.create(csrfToken);

      const rotated = sessionStore.rotate(hashedId);
      assert.ok(rotated);
      assert.ok(rotated.sessionId !== rotated.hashedId);
      assert.ok(rotated.csrfToken !== csrfToken);
      assert.ok(rotated.expiresAt > Date.now());

      const oldSession = sessionStore.get(hashedId);
      assert.equal(oldSession, undefined);

      const newSession = sessionStore.get(rotated.hashedId);
      assert.ok(newSession);
      assert.equal(newSession.csrfToken, rotated.csrfToken);
    });

    test('rotate returns null for non-existent session', () => {
      const rotated = sessionStore.rotate('non-existent');
      assert.equal(rotated, null);
    });

    test('destroy removes session', () => {
      const csrfToken = generateCsrfToken();
      const { hashedId } = sessionStore.create(csrfToken);

      const destroyed = sessionStore.destroy(hashedId);
      assert.equal(destroyed, true);

      const session = sessionStore.get(hashedId);
      assert.equal(session, undefined);
    });

    test('destroy returns false for non-existent session', () => {
      const destroyed = sessionStore.destroy('non-existent');
      assert.equal(destroyed, false);
    });

    test('cleanup removes expired sessions', () => {
      const csrfToken = generateCsrfToken();
      const { hashedId } = sessionStore.create(csrfToken);

      sessionStore.get(hashedId)!.expiresAt = Date.now() - 1000;
      sessionStore.cleanup();

      const session = sessionStore.get(hashedId);
      assert.equal(session, undefined);
    });
  });

  describe('Cookie utilities', () => {
    test('createSessionCookie has correct attributes', () => {
      const cookie = createSessionCookie('test-session-id');
      assert.ok(cookie.includes('qfat_session=test-session-id'));
      assert.ok(cookie.includes('HttpOnly'));
      assert.ok(cookie.includes('SameSite=Strict'));
      assert.ok(cookie.includes('Path=/'));
      assert.ok(cookie.includes(`Max-Age=${SESSION_MAX_AGE_SECONDS}`));
      assert.ok(!cookie.includes('Secure'));
      assert.ok(!cookie.includes('Domain'));
    });

    test('createClearSessionCookie has correct attributes', () => {
      const cookie = createClearSessionCookie();
      assert.ok(cookie.includes('qfat_session='));
      assert.ok(cookie.includes('Max-Age=0'));
      assert.ok(cookie.includes('HttpOnly'));
      assert.ok(cookie.includes('SameSite=Strict'));
    });

    test('parseSessionCookie extracts session id', () => {
      const cookie = 'qfat_session=abc123; other=value';
      const sessionId = parseSessionCookie(cookie);
      assert.equal(sessionId, 'abc123');
    });

    test('parseSessionCookie returns null for missing cookie', () => {
      const sessionId = parseSessionCookie('other=value');
      assert.equal(sessionId, null);
    });

    test('parseSessionCookie returns null for empty cookie', () => {
      const sessionId = parseSessionCookie('');
      assert.equal(sessionId, null);
    });
  });
});

describe('Security Routes Integration', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;

  before(async () => {
    server = await buildServer();
    await server.ready();
  });

  after(async () => {
    await server.close();
  });

  async function injectRequest(
    method: string,
    path: string,
    options: { headers?: Record<string, string>; body?: string; cookies?: Record<string, string> } = {}
  ) {
    const headers = { ...options.headers };
    const hasJsonContentType = headers['Content-Type'] === 'application/json';
    const body = options.body || (hasJsonContentType ? '{}' : undefined);
    return server.inject({
      method,
      url: path,
      headers,
      body,
      cookies: options.cookies,
    });
  }

  async function bootstrapSession(origin: string = `http://127.0.0.1:${FRONTEND_PORT}`) {
    return injectRequest('POST', '/api/v1/security/bootstrap', {
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin,
        'Host': `127.0.0.1:${FRONTEND_PORT}`,
      },
    });
  }

  describe('POST /api/v1/security/bootstrap', () => {
    test('creates session and returns csrfToken with valid origin', async () => {
      const response = await bootstrapSession();
      assert.equal(response.statusCode, 200);

      const body = JSON.parse(response.payload);
      assert.ok(body.csrfToken);
      assert.ok(typeof body.csrfToken === 'string');
      assert.ok(body.expiresAt);
      assert.ok(body.expiresAt > Date.now());

      const setCookie = response.headers['set-cookie'];
      assert.ok(setCookie);
      assert.ok(setCookie.includes('qfat_session='));
      assert.ok(setCookie.includes('HttpOnly'));
      assert.ok(setCookie.includes('SameSite=Strict'));
      assert.ok(setCookie.includes('Max-Age=1800'));
      assert.ok(!setCookie.includes('Secure'));
    });

    test('rejects missing Origin', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
      });
      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('Missing Origin'));
    });

    test('rejects invalid Origin (public IP)', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://8.8.8.8:5173',
          'Host': '8.8.8.8:5173',
        },
      });
      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.payload);
      assert.ok(body.error);
    });

    test('rejects invalid Origin (DNS name)', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:5173',
          'Host': 'localhost:5173',
        },
      });
      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('numeric IPv4 literal'));
    });

    test('rejects wrong port in Origin', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://127.0.0.1:3000',
          'Host': '127.0.0.1:3000',
        },
      });
      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('port must be 5173'));
    });

    test('rejects non-http scheme', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': `https://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
      });
      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('http scheme'));
    });

    test('rejects IPv6 Origin', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': `http://[::1]:${FRONTEND_PORT}`,
          'Host': `[::1]:${FRONTEND_PORT}`,
        },
      });
      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('numeric IPv4 literal'));
    });

    test('rate limits repeated bootstrap attempts', async () => {
      for (let i = 0; i < 10; i++) {
        await bootstrapSession();
      }
      const response = await bootstrapSession();
      assert.equal(response.statusCode, 429);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('Too many bootstrap attempts'));
    });
  });

  describe('Session lifecycle', () => {
    let csrfToken: string;
    let sessionCookie: Record<string, string>;

    before(async () => {
      resetRateLimit();
      const response = await bootstrapSession();
      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.payload);
      csrfToken = body.csrfToken;
      assert.ok(csrfToken, 'csrfToken should be defined');
      const setCookie = response.headers['set-cookie'] || '';
      const match = setCookie.match(/qfat_session=([^;]+)/);
      sessionCookie = match ? { qfat_session: match[1] } : {};
    });

    test('GET /api/v1/health still works and does not create session', async () => {
      const response = await injectRequest('GET', '/api/v1/health');
      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.payload);
      assert.equal(body.status, 'ok');
      assert.ok(!response.headers['set-cookie']?.includes('qfat_session'));
    });

    test('POST /api/v1/security/session/refresh rotates session and CSRF', async () => {
      const response = await injectRequest('POST', '/api/v1/security/session/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
        cookies: sessionCookie,
      });
      assert.equal(response.statusCode, 200);

      const body = JSON.parse(response.payload);
      assert.ok(body.csrfToken);
      assert.notEqual(body.csrfToken, csrfToken);
      assert.ok(body.expiresAt);

      const setCookie = response.headers['set-cookie'];
      assert.ok(setCookie);
      assert.ok(setCookie.includes('qfat_session='));

      const oldCsrfToken = csrfToken;
      csrfToken = body.csrfToken;
      const match = setCookie.match(/qfat_session=([^;]+)/);
      sessionCookie = match ? { qfat_session: match[1] } : {};
    });

    test('POST /api/v1/security/session/refresh rejects missing CSRF', async () => {
      const response = await injectRequest('POST', '/api/v1/security/session/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
        cookies: sessionCookie,
      });
      assert.equal(response.statusCode, 401);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('Missing CSRF token'));
    });

    test('POST /api/v1/security/session/refresh rejects wrong CSRF', async () => {
      const response = await injectRequest('POST', '/api/v1/security/session/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'wrong-token',
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
        cookies: sessionCookie,
      });
      assert.equal(response.statusCode, 401);
      const body = JSON.parse(response.payload);
      assert.ok(body.error?.includes('Invalid CSRF token'));
    });

    test('POST /api/v1/security/session/refresh rejects expired session', async () => {
      const oldCsrfToken = csrfToken;
      const oldSessionCookie = sessionCookie;

      const response = await injectRequest('POST', '/api/v1/security/session/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': oldCsrfToken,
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
        cookies: { qfat_session: 'expired-session-id' },
      });
      assert.equal(response.statusCode, 401);
    });

    test('POST /api/v1/security/session/destroy invalidates session', async () => {
      const response = await injectRequest('POST', '/api/v1/security/session/destroy', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
        cookies: sessionCookie,
      });
      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.payload);
      assert.equal(body.success, true);

      const setCookie = response.headers['set-cookie'];
      assert.ok(setCookie);
      assert.ok(setCookie.includes('Max-Age=0'));

      const refreshResponse = await injectRequest('POST', '/api/v1/security/session/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
        cookies: sessionCookie,
      });
      assert.equal(refreshResponse.statusCode, 401);
    });
  });

  describe('Error responses do not leak sensitive data', () => {
    test('bootstrap error does not contain token', async () => {
      const response = await injectRequest('POST', '/api/v1/security/bootstrap', {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://8.8.8.8:5173',
          'Host': '8.8.8.8:5173',
        },
      });
      const body = JSON.parse(response.payload);
      assert.ok(!JSON.stringify(body).includes('csrfToken'));
      assert.ok(!JSON.stringify(body).includes('session'));
    });

    test('refresh error does not contain token', async () => {
      const response = await injectRequest('POST', '/api/v1/security/session/refresh', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'wrong',
          'Origin': `http://127.0.0.1:${FRONTEND_PORT}`,
          'Host': `127.0.0.1:${FRONTEND_PORT}`,
        },
      });
      const body = JSON.parse(response.payload);
      assert.ok(!JSON.stringify(body).includes('csrfToken'));
      assert.ok(!JSON.stringify(body).includes('session'));
    });
  });
});