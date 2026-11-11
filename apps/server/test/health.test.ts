import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer, getPort } from '../src/index.js';

describe('Health Server', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  let boundPort: number;
  const testHost = '127.0.0.1';

  before(async () => {
    server = await buildServer();
    // Use ephemeral port (0) - OS assigns available port
    await server.listen({ port: 0, host: testHost });
    const address = server.server.address();
    if (address && typeof address === 'object') {
      boundPort = address.port;
    } else {
      throw new Error('Failed to determine bound port');
    }
  });

  after(async () => {
    await server.close();
  });

  test('GET /api/v1/health returns 200 and correct JSON shape', async () => {
    const response = await fetch(`http://${testHost}:${boundPort}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.ok(body.status === 'ok', 'status should be "ok"');
    assert.ok(typeof body.timestamp === 'string', 'timestamp should be a string');
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)), 'timestamp should be a valid ISO date');
  });

  test('Server binds to loopback only (127.0.0.1), not 0.0.0.0', async () => {
    const address = server.server.address();
    assert.ok(address, 'Server should have an address');
    if (address && typeof address === 'object') {
      assert.equal(address.address, '127.0.0.1', 'Server should bind to 127.0.0.1 only');
    }
  });

  test('Server can be closed cleanly', async () => {
    await server.close();
    assert.ok(server.server.listening === false, 'Server should not be listening after close');
  });
});

describe('Port validation', () => {
  // Helper to safely test environment variable changes
  function withEnv(key: string, value: string | undefined, fn: () => void) {
    const original = process.env[key];
    try {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
      fn();
    } finally {
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  }

  test('Valid port from environment variable', () => {
    withEnv('PORT', '4000', () => {
      const port = getPort();
      assert.equal(port, 4000);
    });
  });

  test('Default port when PORT not set', () => {
    withEnv('PORT', undefined, () => {
      const port = getPort();
      assert.equal(port, 3001);
    });
  });

  test('Empty PORT string throws', () => {
    withEnv('PORT', '', () => {
      assert.throws(() => getPort(), /Invalid PORT: empty string/);
    });
  });

  test('Alphabetic input throws', () => {
    withEnv('PORT', 'abc', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Numeric suffix (partial) throws', () => {
    withEnv('PORT', '3001abc', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Decimal input throws', () => {
    withEnv('PORT', '3001.5', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Port out of range (0) throws', () => {
    withEnv('PORT', '0', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Port out of range (65536) throws', () => {
    withEnv('PORT', '65536', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Negative port throws', () => {
    withEnv('PORT', '-1', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Leading zeros allowed (parsed as integer)', () => {
    withEnv('PORT', '03001', () => {
      const port = getPort();
      assert.equal(port, 3001);
    });
  });

  test('Whitespace not allowed', () => {
    withEnv('PORT', ' 3001', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });

  test('Trailing whitespace not allowed', () => {
    withEnv('PORT', '3001 ', () => {
      assert.throws(() => getPort(), /Invalid PORT/);
    });
  });
});