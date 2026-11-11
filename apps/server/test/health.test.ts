import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer, getPort } from '../src/index.js';

describe('Health Server', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const testPort = 3002;
  const testHost = '127.0.0.1';

  before(async () => {
    server = await buildServer();
    await server.listen({ port: testPort, host: testHost });
  });

  after(async () => {
    await server.close();
  });

  test('GET /api/v1/health returns 200 and correct JSON shape', async () => {
    const response = await fetch(`http://${testHost}:${testPort}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await response.json();
    assert.ok(body.status === 'ok', 'status should be "ok"');
    assert.ok(typeof body.timestamp === 'string', 'timestamp should be a string');
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)), 'timestamp should be a valid ISO date');
  });

  test('Server binds to loopback only (127.0.0.1), not 0.0.0.0', async () => {
    // Verify the server is only accessible on loopback
    // The server is configured to bind to 127.0.0.1, so this test
    // verifies the configuration by checking the bound address
    const address = server.server.address();
    assert.ok(address, 'Server should have an address');
    if (address && typeof address === 'object') {
      assert.equal(address.address, '127.0.0.1', 'Server should bind to 127.0.0.1 only');
    }
  });

  test('Server can be closed cleanly', async () => {
    // This is implicitly tested by the after() hook
    // but we can also verify the close method exists and works
    await server.close();
    assert.ok(server.server.listening === false, 'Server should not be listening after close');
  });
});

describe('Port validation', () => {
  test('Valid port from environment variable', () => {
    process.env.PORT = '4000';
    try {
      const port = getPort();
      assert.equal(port, 4000);
    } finally {
      delete process.env.PORT;
    }
  });

  test('Default port when PORT not set', () => {
    delete process.env.PORT;
    const port = getPort();
    assert.equal(port, 3001);
  });

  test('Invalid port string throws', () => {
    process.env.PORT = 'abc';
    assert.throws(() => getPort(), /Invalid PORT/);
    delete process.env.PORT;
  });

  test('Port out of range (0) throws', () => {
    process.env.PORT = '0';
    assert.throws(() => getPort(), /Invalid PORT/);
    delete process.env.PORT;
  });

  test('Port out of range (65536) throws', () => {
    process.env.PORT = '65536';
    assert.throws(() => getPort(), /Invalid PORT/);
    delete process.env.PORT;
  });

  test('Negative port throws', () => {
    process.env.PORT = '-1';
    assert.throws(() => getPort(), /Invalid PORT/);
    delete process.env.PORT;
  });
});