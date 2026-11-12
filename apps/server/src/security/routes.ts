import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  SESSION_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_MAX_AGE_SECONDS,
  FRONTEND_PORT,
  sessionStore,
  validateOriginHeader,
  validateHostHeader,
  parseSessionCookie,
  createSessionCookie,
  createClearSessionCookie,
  constantTimeEqual,
  SessionData,
} from './index.js';

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

const bootstrapAttempts = new Map<string, { count: number; windowStart: number }>();

export function resetRateLimit(): void {
  bootstrapAttempts.clear();
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = bootstrapAttempts.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    bootstrapAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getClientIp(request: FastifyRequest): string {
  return request.ip || getHeaderValue(request.headers, 'x-forwarded-for') || 'unknown';
}

export interface SecurityBootstrapResponse {
  csrfToken: string;
  expiresAt: number;
}

export interface SecurityRefreshResponse {
  csrfToken: string;
  expiresAt: number;
}

export interface SecurityErrorResponse {
  error: string;
}

async function validateRequestOriginAndHost(request: FastifyRequest): Promise<{ isValid: boolean; error?: string; authority?: { host: string; port: number } }> {
  const origin = getHeaderValue(request.headers, 'origin');
  const originValidation = validateOriginHeader(origin);
  if (!originValidation.isValid || !originValidation.authority) {
    return { isValid: false, error: originValidation.error };
  }

  const host = getHeaderValue(request.headers, 'host');
  const hostValidation = validateHostHeader(host, originValidation.authority);
  if (!hostValidation.isValid) {
    return { isValid: false, error: hostValidation.error };
  }

  return { isValid: true, authority: originValidation.authority };
}

async function validateSessionAndCsrf(
  request: FastifyRequest,
  requireCsrf: boolean = true
): Promise<{ isValid: boolean; error?: string; session?: SessionData; hashedId?: string }> {
  const cookieHeader = request.headers.cookie;
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    return { isValid: false, error: 'Missing authentication cookie' };
  }

  const hashedId = (await import('node:crypto')).createHash('sha256').update(sessionId).digest('hex');
  const session = sessionStore.get(hashedId);

  if (!session) {
    return { isValid: false, error: 'Invalid or expired authentication' };
  }

  if (requireCsrf) {
    const csrfToken = getHeaderValue(request.headers, CSRF_HEADER_NAME);
    if (!csrfToken || typeof csrfToken !== 'string') {
      return { isValid: false, error: 'Missing CSRF token' };
    }

    if (!constantTimeEqual(csrfToken, session.csrfToken)) {
      return { isValid: false, error: 'Invalid CSRF token' };
    }
  }

  return { isValid: true, session, hashedId };
}

export async function registerSecurityRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Reply: SecurityBootstrapResponse | SecurityErrorResponse;
  }>('/api/v1/security/bootstrap', async (request, reply) => {
    const clientIp = getClientIp(request);

    if (!checkRateLimit(clientIp)) {
      return reply.status(429).send({ error: 'Too many bootstrap attempts. Please wait.' });
    }

    const validation = await validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      return reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
    }

    const csrfToken = (await import('./index.js')).generateCsrfToken();
    const { sessionId, hashedId, expiresAt } = sessionStore.create(csrfToken);

    const cookie = createSessionCookie(sessionId);

    reply.header('Set-Cookie', cookie);

    return reply.send({ csrfToken, expiresAt });
  });

  app.post<{
    Reply: SecurityRefreshResponse | SecurityErrorResponse;
  }>('/api/v1/security/session/refresh', async (request, reply) => {
    const validation = await validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      return reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
    }

    const sessionValidation = await validateSessionAndCsrf(request, true);
    if (!sessionValidation.isValid || !sessionValidation.session || !sessionValidation.hashedId) {
      const cookie = createClearSessionCookie();
      reply.header('Set-Cookie', cookie);
      return reply.status(401).send({ error: sessionValidation.error || 'Invalid session' });
    }

    const rotated = sessionStore.rotate(sessionValidation.hashedId);
    if (!rotated) {
      const cookie = createClearSessionCookie();
      reply.header('Set-Cookie', cookie);
      return reply.status(401).send({ error: 'Failed to rotate session' });
    }

    const cookie = createSessionCookie(rotated.sessionId);
    reply.header('Set-Cookie', cookie);

    return reply.send({ csrfToken: rotated.csrfToken, expiresAt: rotated.expiresAt });
  });

  app.post<{
    Reply: { success: boolean } | SecurityErrorResponse;
  }>('/api/v1/security/session/destroy', async (request, reply) => {
    const validation = await validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      return reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
    }

    const sessionValidation = await validateSessionAndCsrf(request, true);
    if (sessionValidation.isValid && sessionValidation.hashedId) {
      sessionStore.destroy(sessionValidation.hashedId);
    }

    const cookie = createClearSessionCookie();
    reply.header('Set-Cookie', cookie);

    return reply.send({ success: true });
  });
}

export function createMutationGuard() {
  return async function mutationGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validation = await validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
      return;
    }

    const sessionValidation = await validateSessionAndCsrf(request, true);
    if (!sessionValidation.isValid) {
      if (sessionValidation.error === 'Invalid or expired session' || sessionValidation.error === 'Missing session cookie') {
        const cookie = createClearSessionCookie();
        reply.header('Set-Cookie', cookie);
      }
      reply.status(401).send({ error: sessionValidation.error || 'Authentication required' });
      return;
    }

    (request as any).securitySession = sessionValidation.session;
    (request as any).securityHashedId = sessionValidation.hashedId;
  };
}

export { validateRequestOriginAndHost, validateSessionAndCsrf };