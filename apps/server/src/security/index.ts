import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'qfat_session';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SESSION_MAX_AGE_SECONDS = 1800;
export const FRONTEND_PORT = 5173;
export const MAX_SESSION_COUNT = 10_000;

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

  const match = authority.match(/^\[([^\]]+)\](?::(\d+))?$|^([^:]+)(?::(\d+))?$/);
  if (!match) {
    return { host: '', port: 0, isValid: false, error: 'Malformed authority' };
  }

  const host = match[1] || match[3];
  const portText = match[2] || match[4];
  if (!host) {
    return { host: '', port: 0, isValid: false, error: 'Missing host' };
  }

  if (portText !== undefined && (!/^[1-9]\d*$/.test(portText) || String(Number(portText)) !== portText)) {
    return { host, port: 0, isValid: false, error: 'Malformed port' };
  }

  const port = portText === undefined ? 80 : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { host, port, isValid: false, error: `Invalid port: ${port}` };
  }

  return { host, port, isValid: true };
}

function parseIPv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return -1;
    const value = Number(part);
    return value <= 255 ? value : -1;
  });

  if (octets.some((value) => value < 0)) return null;
  return octets as [number, number, number, number];
}

function isAllowedIPv4(ip: string): boolean {
  const octets = parseIPv4(ip);
  if (!octets) return false;

  const [a, b] = octets;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export function validateOriginHeader(origin: string | null | undefined): OriginValidationResult {
  if (!origin || typeof origin !== 'string') {
    return { isValid: false, error: 'Missing Origin header' };
  }

  if (origin === 'null' || origin.includes(',')) {
    return { isValid: false, error: 'Null or multiple Origin values not allowed' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(origin);
  } catch {
    return { isValid: false, error: 'Invalid Origin URL' };
  }

  if (parsedUrl.protocol !== 'http:') {
    return { isValid: false, error: 'Only http scheme is allowed' };
  }

  // A browser Origin header is a serialized origin, not a URL with credentials,
  // a path, query, fragment, or a non-canonical authority representation.
  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash ||
    origin !== parsedUrl.origin
  ) {
    return { isValid: false, error: 'Origin must be a canonical origin without path or credentials' };
  }

  const authority = parseAuthority(parsedUrl.host);
  if (!authority.isValid) {
    return { isValid: false, error: authority.error };
  }

  if (parseIPv4(authority.host) === null) {
    return { isValid: false, error: 'Host must be a numeric IPv4 literal' };
  }

  if (!isAllowedIPv4(authority.host)) {
    return { isValid: false, error: 'Origin must use loopback, RFC1918, or Tailscale CGNAT IPv4' };
  }

  if (authority.port !== FRONTEND_PORT) {
    return { isValid: false, error: `Origin port must be ${FRONTEND_PORT}` };
  }

  return { isValid: true, authority };
}

export function validateHostHeader(host: string | null | undefined, expected: ParsedAuthority): OriginValidationResult {
  if (!host || typeof host !== 'string') {
    return { isValid: false, error: 'Missing Host header' };
  }

  if (host.includes(',')) {
    return { isValid: false, error: 'Multiple Host values not allowed' };
  }

  const authority = parseAuthority(host);
  if (!authority.isValid) {
    return { isValid: false, error: authority.error };
  }

  if (authority.host !== expected.host || authority.port !== expected.port) {
    return { isValid: false, error: 'Host header does not match Origin authority' };
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
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
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
  private readonly sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly maxSessions = MAX_SESSION_COUNT) {
    if (!Number.isInteger(maxSessions) || maxSessions < 1) {
      throw new Error('maxSessions must be a positive integer');
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref();
  }

  create(csrfToken: string): { sessionId: string; hashedId: string; csrfToken: string; expiresAt: number } {
    this.cleanup();
    if (this.sessions.size >= this.maxSessions) {
      throw new Error('Session capacity reached');
    }

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
    if (Date.now() >= session.expiresAt) {
      this.sessions.delete(hashedId);
      return undefined;
    }
    return session;
  }

  rotate(hashedId: string): { sessionId: string; hashedId: string; csrfToken: string; expiresAt: number } | null {
    const session = this.get(hashedId);
    if (!session) return null;

    this.sessions.delete(hashedId);
    return this.create(generateCsrfToken());
  }

  destroy(hashedId: string): boolean {
    return this.sessions.delete(hashedId);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [hashedId, session] of this.sessions.entries()) {
      if (now >= session.expiresAt) this.sessions.delete(hashedId);
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

  const sessionParts = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part === SESSION_COOKIE_NAME || part.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (sessionParts.length !== 1 || !sessionParts[0].startsWith(`${SESSION_COOKIE_NAME}=`)) {
    return null;
  }

  const value = sessionParts[0].slice(SESSION_COOKIE_NAME.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
