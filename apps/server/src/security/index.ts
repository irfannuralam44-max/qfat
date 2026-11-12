import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'qfat_session';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SESSION_MAX_AGE_SECONDS = 1800;
export const FRONTEND_PORT = 5173;

export interface ParsedAuthority {
  host: string;
  port: number;
  isValid: boolean;
  error?: string;
}

export interface OriginValidationResult {
  isValid: boolean;
  error?: string;
  authority?: ParsedAuthority;
}

function parseAuthority(authority: string): ParsedAuthority {
  if (!authority || typeof authority !== 'string') {
    return { host: '', port: 0, isValid: false, error: 'Missing authority' };
  }

  const hostPortMatch = authority.match(/^\[([^\]]+)\](?::(\d+))?$|^([^:]+)(?::(\d+))?$/);
  if (!hostPortMatch) {
    return { host: '', port: 0, isValid: false, error: 'Malformed authority' };
  }

  const host = hostPortMatch[1] || hostPortMatch[3];
  const portStr = hostPortMatch[2] || hostPortMatch[4];

  if (!host) {
    return { host: '', port: 0, isValid: false, error: 'Missing host' };
  }

  const port = portStr ? parseInt(portStr, 10) : 80;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { host, port, isValid: false, error: `Invalid port: ${port}` };
  }

  return { host, port, isValid: true };
}

function isPrivateIPv4(ip: string): boolean {
  if (ip === '127.0.0.1' || ip.startsWith('127.')) {
    return true;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  if (a === 10) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

function isValidIPv4Literal(host: string): boolean {
  if (!host) return false;
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

export function validateOriginHeader(origin: string | null | undefined): OriginValidationResult {
  if (!origin || typeof origin !== 'string') {
    return { isValid: false, error: 'Missing Origin header' };
  }

  const origins = origin.split(',').map(o => o.trim());
  if (origins.length !== 1) {
    return { isValid: false, error: 'Multiple Origin values not allowed' };
  }

  const singleOrigin = origins[0];
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(singleOrigin);
  } catch {
    return { isValid: false, error: 'Invalid Origin URL' };
  }

  if (parsedUrl.protocol !== 'http:') {
    return { isValid: false, error: 'Only http scheme is allowed' };
  }

  const authority = parseAuthority(parsedUrl.host);
  if (!authority.isValid) {
    return { isValid: false, error: authority.error };
  }

  if (!isValidIPv4Literal(authority.host)) {
    return { isValid: false, error: 'Host must be a numeric IPv4 literal' };
  }

  if (!isPrivateIPv4(authority.host)) {
    return { isValid: false, error: 'Origin must be a private IPv4 address (loopback, RFC1918, or Tailscale CGNAT)' };
  }

  if (authority.port !== FRONTEND_PORT) {
    return { isValid: false, error: `Origin port must be ${FRONTEND_PORT}` };
  }

  return { isValid: true, authority };
}

export function validateHostHeader(host: string | null | undefined, expectedOriginAuthority: ParsedAuthority): OriginValidationResult {
  if (!host || typeof host !== 'string') {
    return { isValid: false, error: 'Missing Host header' };
  }

  const hosts = host.split(',').map(h => h.trim());
  if (hosts.length !== 1) {
    return { isValid: false, error: 'Multiple Host values not allowed' };
  }

  const authority = parseAuthority(hosts[0]);
  if (!authority.isValid) {
    return { isValid: false, error: authority.error };
  }

  if (authority.host !== expectedOriginAuthority.host) {
    return { isValid: false, error: 'Host header host does not match Origin host' };
  }

  if (authority.port !== expectedOriginAuthority.port) {
    return { isValid: false, error: 'Host header port does not match Origin port' };
  }

  return { isValid: true, authority };
}

export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = new Uint8Array(Buffer.from(a));
  const bufB = new Uint8Array(Buffer.from(b));
  return timingSafeEqual(bufA, bufB);
}

export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

export interface SessionData {
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}

export class SessionStore {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    this.cleanupInterval.unref();
  }

  create(csrfToken: string): { sessionId: string; hashedId: string; csrfToken: string; expiresAt: number } {
    const sessionId = generateSessionId();
    const hashedId = hashSessionId(sessionId);
    const now = Date.now();
    const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
    this.sessions.set(hashedId, { csrfToken, createdAt: now, expiresAt });
    return { sessionId, hashedId, csrfToken, expiresAt };
  }

  get(hashedId: string): SessionData | undefined {
    const session = this.sessions.get(hashedId);
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(hashedId);
      return undefined;
    }
    return session;
  }

  rotate(hashedId: string): { sessionId: string; hashedId: string; csrfToken: string; expiresAt: number } | null {
    const session = this.get(hashedId);
    if (!session) return null;

    this.sessions.delete(hashedId);
    const newCsrfToken = generateCsrfToken();
    return this.create(newCsrfToken);
  }

  destroy(hashedId: string): boolean {
    return this.sessions.delete(hashedId);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [hashedId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(hashedId);
      }
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}

export const sessionStore = new SessionStore();

export function createSessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function createClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function parseSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const value = cookie.slice(`${SESSION_COOKIE_NAME}=`.length);
      if (value && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}