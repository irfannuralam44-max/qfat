import Fastify from 'fastify';
import { registerSecurityRoutes } from './security/routes.js';
import { sessionStore } from './security/index.js';

const DEFAULT_PORT = 3001;
const HOST = '127.0.0.1';

function getPort(): number {
  const envPort = process.env.PORT;
  if (envPort === undefined) {
    return DEFAULT_PORT;
  }
  if (envPort === '') {
    throw new Error('Invalid PORT: empty string. Must be an integer between 1 and 65535.');
  }
  // Strict validation: only complete decimal integer representation
  if (!/^[0-9]+$/.test(envPort)) {
    throw new Error(`Invalid PORT: "${envPort}". Must be a complete decimal integer between 1 and 65535.`);
  }
  const parsed = Number.parseInt(envPort, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: "${envPort}". Must be an integer between 1 and 65535.`);
  }
  return parsed;
}

async function buildServer() {
  const app = Fastify({
    logger: false,
  });

  app.get('/api/v1/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await registerSecurityRoutes(app);

  return app;
}

async function start() {
  const port = getPort();
  const app = await buildServer();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  let isShuttingDown = false;

  for (const signal of signals) {
    process.on(signal, async () => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      console.log(`Received ${signal}, shutting down gracefully...`);
      sessionStore.shutdown();
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port, host: HOST });
    console.log(`Server listening on http://${HOST}:${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer, start, getPort, HOST, DEFAULT_PORT };
export { registerSecurityRoutes, createMutationGuard, resetRateLimit } from './security/routes.js';
export {
  SESSION_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_MAX_AGE_SECONDS,
  FRONTEND_PORT,
  sessionStore,
  validateOriginHeader,
  validateHostHeader,
  generateSessionId,
  generateCsrfToken,
  constantTimeEqual,
  hashSessionId,
  SessionStore,
  type SessionData,
  MAX_SESSION_COUNT,
  type ParsedAuthority,
  type OriginValidationResult,
  createSessionCookie,
  createClearSessionCookie,
  parseSessionCookie,
} from './security/index.js';