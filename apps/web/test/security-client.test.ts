import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SecurityClient } from '../src/security/client.ts';

const validToken = 'T'.repeat(43);
const validBootstrap = () => new Response(JSON.stringify({
  csrfToken: validToken,
  expiresAt: Date.now() + 60_000,
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const originalFetch = globalThis.fetch;
const originalStorage = {
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage.localStorage });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: originalStorage.sessionStorage });
});

describe('SecurityClient', () => {
  it('keeps bootstrap CSRF proof in memory and does not access browser storage', async () => {
    const client = new SecurityClient();
    globalThis.fetch = async () => validBootstrap();

    await client.bootstrap();
    assert.equal(client.getCsrfToken(), validToken);
    assert.equal(client.hasValidToken(), true);

    const source = readFileSync(new URL('../src/security/client.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  });

  it('attaches CSRF only to state-changing requests', async () => {
    const client = new SecurityClient();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/security/bootstrap')) return validBootstrap();
      return new Response(JSON.stringify({ saved: true }), { status: 200 });
    };

    await client.requestWithCsrf<{ saved: boolean }>('/api/v1/example', {
      method: 'POST',
      body: JSON.stringify({ value: 1 }),
    });

    const mutation = calls.find((call) => call.url === '/api/v1/example');
    assert.ok(mutation);
    assert.equal(mutation.init?.credentials, 'include');
    assert.equal(new Headers(mutation.init?.headers).get('X-CSRF-Token'), validToken);
    assert.throws(() => client.requestWithCsrf('/api/v1/example', { method: 'GET' }), /state-changing/);
  });

  it('re-bootstrap retries an expired-session mutation exactly once', async () => {
    const client = new SecurityClient();
    let bootstrapCount = 0;
    let mutationCount = 0;

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/security/bootstrap')) {
        bootstrapCount += 1;
        return validBootstrap();
      }
      mutationCount += 1;
      return mutationCount === 1
        ? new Response(JSON.stringify({ error: 'expired' }), { status: 401 })
        : new Response(JSON.stringify({ saved: true }), { status: 200 });
    };

    const result = await client.requestWithCsrf<{ saved: boolean }>('/api/v1/example', { method: 'DELETE' });
    assert.deepEqual(result, { saved: true });
    assert.equal(bootstrapCount, 2);
    assert.equal(mutationCount, 2);
  });

  it('does not retry repeatedly when the second mutation is also unauthorized', async () => {
    const client = new SecurityClient();
    let bootstrapCount = 0;
    let mutationCount = 0;

    globalThis.fetch = async (input) => {
      if (String(input).endsWith('/security/bootstrap')) {
        bootstrapCount += 1;
        return validBootstrap();
      }
      mutationCount += 1;
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    };

    await assert.rejects(
      client.requestWithCsrf('/api/v1/example', { method: 'PATCH' }),
      /unauthorized/,
    );
    assert.equal(bootstrapCount, 2);
    assert.equal(mutationCount, 2);
  });

  it('surfaces a recoverable error and clears state when bootstrap fails', async () => {
    const client = new SecurityClient();
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Please try again.' }), { status: 503 });

    await assert.rejects(client.bootstrap(), /Please try again/);
    assert.equal(client.getCsrfToken(), null);
    assert.equal(client.hasValidToken(), false);
  });
});
