import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  CSRF_HEADER_NAME,
  sessionStore,
  validateOriginHeader,
  validateHostHeader,
  parseSessionCookie,
  createSessionCookie,
  createClearSessionCookie,
  constantTimeEqual,
  generateCsrfToken,
  hashSessionId,
  SessionData,
} from './index.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

// The backend only receives traffic from the local Vite proxy. Do not trust
// forwarded client-IP headers; use one bounded process-wide bootstrap window.
let bootstrapWindowStart = 0;
let bootstrapAttemptCount = 0;

export function resetRateLimit(): void {
  bootstrapWindowStart = 0;
  bootstrapAttemptCount = 0;
}

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - bootstrapWindowStart >= RATE_LIMIT_WINDOW_MS || now < bootstrapWindowStart) {
    bootstrapWindowStart = now;
    bootstrapAttemptCount = 0;
  }

  if (bootstrapAttemptCount >= RATE_LIMIT_MAX_ATTEMPTS) return false;
  bootstrapAttemptCount += 1;
  return true;
}

function getSingleHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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

export function validateRequestOriginAndHost(request: FastifyRequest): {
  isValid: boolean;
  error?: string;
  authority?: { host: string; port: number };
} {
  const origin = getSingleHeader(request.headers, 'origin');
  const originValidation = validateOriginHeader(origin);
  if (!originValidation.isValid || !originValidation.authority) {
    return { isValid: false, error: originValidation.error };
  }

  const host = getSingleHeader(request.headers, 'host');
  const hostValidation = validateHostHeader(host, originValidation.authority);
  if (!hostValidation.isValid) {
    return { isValid: false, error: hostValidation.error };
  }

  return { isValid: true, authority: originValidation.authority };
}

export function validateSessionAndCsrf(
  request: FastifyRequest,
): { isValid: boolean; error?: string; session?: SessionData; hashedId?: string } {
  const cookieHeader = getSingleHeader(request.headers, 'cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) {
    return { isValid: false, error: 'Missing or malformed authentication cookie' };
  }

  const hashedId = hashSessionId(sessionId);
  const session = sessionStore.get(hashedId);
  if (!session) {
    return { isValid: false, error: 'Invalid or expired authentication' };
  }

  const csrfToken = getSingleHeader(request.headers, CSRF_HEADER_NAME);
  if (!csrfToken) {
    return { isValid: false, error: 'Missing CSRF token' };
  }

  if (!constantTimeEqual(csrfToken, session.csrfToken)) {
    return { isValid: false, error: 'Invalid CSRF token' };
  }

  return { isValid: true, session, hashedId };
}

export async function registerSecurityRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Reply: SecurityBootstrapResponse | SecurityErrorResponse;
  }>('/api/v1/security/bootstrap', async (request, reply) => {
    const validation = validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      return reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
    }

    if (!checkRateLimit()) {
      return reply.status(429).send({ error: 'Too many bootstrap attempts. Please wait.' });
    }

    const csrfToken = generateCsrfToken();
    try {
      const { sessionId, expiresAt } = sessionStore.create(csrfToken);
      reply.header('Set-Cookie', createSessionCookie(sessionId));
      return reply.send({ csrfToken, expiresAt });
    } catch {
      return reply.status(503).send({ error: 'Session capacity reached. Try again later.' });
    }
  });

  app.post<{
    Reply: SecurityRefreshResponse | SecurityErrorResponse;
  }>('/api/v1/security/session/refresh', async (request, reply) => {
    const validation = validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      return reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
    }

    const sessionValidation = validateSessionAndCsrf(request);
    if (!sessionValidation.isValid || !sessionValidation.hashedId) {
      if (
        sessionValidation.error === 'Invalid or expired authentication' ||
        sessionValidation.error === 'Missing or malformed authentication cookie'
      ) {
        reply.header('Set-Cookie', createClearSessionCookie());
      }
      return reply.status(401).send({ error: sessionValidation.error || 'Invalid session' });
    }

    const rotated = sessionStore.rotate(sessionValidation.hashedId);
    if (!rotated) {
      reply.header('Set-Cookie', createClearSessionCookie());
      return reply.status(401).send({ error: 'Invalid or expired authentication' });
    }

    reply.header('Set-Cookie', createSessionCookie(rotated.sessionId));
    return reply.send({ csrfToken: rotated.csrfToken, expiresAt: rotated.expiresAt });
  });

  app.post<{
    Reply: { success: boolean } | SecurityErrorResponse;
  }>('/api/v1/security/session/destroy', async (request, reply) => {
    const validation = validateRequestOriginAndHost(request);
    if (!validation.isValid) {
      return reply.status(403).send({ error: validation.error || 'Invalid Origin/Host' });
    }

    const sessionValidation = validateSessionAndCsrf(request);
    if (!sessionValidation.isValid || !sessionValidation.hashedId) {
      if (
        sessionValidation.error === 'Invalid or expired authentication' ||
        sessionValidation.error === 'Missing or malformed authentication cookie'
      ) {
        reply.header('Set-Cookie', createClearSessionCookie());
      }
      return reply.status(401).send({ error: sessionValidation.error || 'Invalid session' });
    }

    sessionStore.destroy(sessionValidation.hashedId);
    reply.header('Set-Cookie', createClearSessionCookie());
    return reply.send({ success: true });
  });
}

export function createMutationGuard() {
  return async function mutationGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const originValidation = validateRequestOriginAndHost(request);
    if (!originValidation.isValid) {
      reply.status(403).send({ error: originValidation.error || 'Invalid Origin/Host' });
      return;
    }

    const sessionValidation = validateSessionAndCsrf(request);
    if (!sessionValidation.isValid) {
      if (
        sessionValidation.error === 'Invalid or expired authentication' ||
        sessionValidation.error === 'Missing or malformed authentication cookie'
      ) {
        reply.header('Set-Cookie', createClearSessionCookie());
      }
      reply.status(401).send({ error: sessionValidation.error || 'Authentication required' });
      return;
    }

    (request as FastifyRequest & {
      securitySession?: SessionData;
      securityHashedId?: string;
    }).securitySession = sessionValidation.session;
    (request as FastifyRequest & {
      securityHashedId?: string;
    }).securityHashedId = sessionValidation.hashedId;
  };
}
