import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer, request as httpRequest, type Server } from 'node:http';
import { createServer as createViteServer } from 'vite';
import viteConfig from '../vite.config.ts';

let backend: Server;
let backendPort: number;
let vite: Awaited<ReturnType<typeof createViteServer>>;
let vitePort: number;

function getJson(urlPort: number): Promise<{ host?: string; origin?: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port: urlPort,
      path: '/api/v1/proxy-contract-test',
      method: 'GET',
      headers: {
        Host: '192.168.1.21:5173',
        Origin: 'http://192.168.1.21:5173',
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Proxy returned HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve(JSON.parse(body));
      });
    });
    request.on('error', reject);
    request.end();
  });
}

describe('Vite browser-authority proxy contract', () => {
  before(async () => {
    backend = createHttpServer((request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        host: request.headers.host,
        origin: request.headers.origin,
      }));
    });
    await new Promise<void>((resolve) => backend.listen(0, '127.0.0.1', resolve));
    backendPort = (backend.address() as { port: number }).port;

    const proxyKey = '^/api/v1(?:/|$)';
    const proxy = viteConfig.server?.proxy?.[proxyKey];
    assert.ok(proxy, 'the production Vite config must define the scoped API proxy');

    vite = await createViteServer({
      ...viteConfig,
      configFile: false,
      server: {
        ...viteConfig.server,
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        proxy: {
          [proxyKey]: {
            ...proxy,
            target: `http://127.0.0.1:${backendPort}`,
          },
        },
      },
    });
    await vite.listen();
    vitePort = (vite.httpServer?.address() as { port: number }).port;
  });

  after(async () => {
    await vite?.close();
    await new Promise<void>((resolve, reject) => {
      if (!backend?.listening) return resolve();
      backend.close((error) => error ? reject(error) : resolve());
    });
  });

  it('preserves the browser-facing Host and Origin at the backend proxy target', async () => {
    const received = await getJson(vitePort);
    assert.equal(received.host, '192.168.1.21:5173');
    assert.equal(received.origin, 'http://192.168.1.21:5173');
  });
});
