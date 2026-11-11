# ADR-002: Local Browser-to-Backend Security Design

- **Status:** PROPOSED
- **Date:** 2026-11-11
- **Related:** QFAT-005, QFAT-002R2 decision #9
- **Supersedes:** None

---

## Context

QFAT MVP is a local-first web application with a React/Vite frontend and a separate Node.js Fastify backend bound to `127.0.0.1:3001`. The PRD mandates:

- Loopback binding only (never `0.0.0.0`)
- No wildcard CORS
- CSRF protection for state-changing requests
- No platform credentials, session secrets, or tokens in frontend bundles, localStorage, sessionStorage, URLs, SQLite plaintext, or logs
- Validate Host and Origin; account for DNS rebinding
- Fail closed when security initialization fails

The QFAT-002R2 audit identified decision #9 (session/CSRF mechanism) as pending owner approval. This ADR proposes a complete, coherent design addressing all PRD constraints.

---

## Decision

We adopt the following security design for browser-to-backend communication:

### 1. Origin and Host Validation

- **Allowed Origins:** `http://localhost:5173` (Vite dev) and `http://127.0.0.1:3001` (production same-origin)
- **Allowed Hosts:** `127.0.0.1:3001` and `localhost:3001`
- **Validation:** Fastify `onRequest` hook validates `Host` on all requests; validates `Origin` on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`)
- **DNS rebinding protection:** Both `Origin` and `Host` must be valid; `Origin` alone is insufficient
- **Missing/null Origin:** Rejected on state-changing requests (403)
- **Health endpoint (`GET /api/v1/health`):** Exempt from origin/auth checks

### 2. CSRF Protection: Double-Submit Cookie

- **Mechanism:** Server sets HttpOnly `SameSite=Strict` cookie `qfat_csrf` with 256-bit random token; client reads token from response body at init, stores in JS memory, sends in `X-CSRF-Token` header on every state-changing request
- **Cookie attributes:** `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`
- **Header:** `X-CSRF-Token`
- **Protected methods:** `POST`, `PUT`, `PATCH`, `DELETE` (all routes except health)
- **Multipart uploads:** Supported without preflight complications
- **Token rotation:** New token on session creation and every 30 min; 5-min grace period for old token

### 3. Session Management: HttpOnly Cookie

- **Session cookie:** `qfat_sid` (256-bit), `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800` (30 min)
- **Bootstrap:** `POST /api/v1/session/init` → returns `sessionId`, `csrfToken`; sets both cookies
- **Refresh:** `POST /api/v1/session/refresh` (within 5-min grace after expiry) → new session + CSRF tokens
- **Destroy:** `POST /api/v1/session/destroy` → clears cookies
- **Bootstrap rate limit:** 5 requests/minute per IP
- **No secrets in frontend:** HttpOnly cookies never accessible to JavaScript; CSRF token returned once at init, stored in JS memory only

### 4. Development and Production Topology

| Environment | Frontend | Backend | Cookie Domain | Secure Flag |
|---|---|---|---|---|
| Development | Vite `:5173` + proxy `/api`,`/events` → `:3001` | Fastify `:3001` | `localhost` | `false` (HTTP) |
| Production | Backend serves `dist/` at `/` | Fastify `:3001` | `127.0.0.1` | `true` (HTTPS preferred) |

- No wildcard CORS in either environment
- Dev uses Vite proxy; production is same-origin

### 5. Operational Behavior

- **Fail closed:** Session bootstrap failure (CSPRNG, cookie config) → process exit with actionable error
- **Logging redaction:** `Authorization`, `Cookie`, `X-CSRF-Token`, OAuth params, tokens, signed URLs redacted
- **Test matrix:** 18 deterministic offline tests covering trusted/untrusted Origin/Host, missing/null Origin, CSRF, session expiry/refresh, multipart uploads, SSE, rate limits

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **Synchronizer token** | Requires token in HTML/JS; higher SPA complexity; token in localStorage/sessionStorage exposes to XSS |
| **Custom header only (`X-CSRF-Token`)** | Breaks multipart uploads (triggers preflight); token in JS memory only (no HttpOnly protection); no SameSite benefit |
| **Bearer token in localStorage** | Token in browser storage violates PRD; full XSS exposure |
| **Origin-only validation** | Insufficient against DNS rebinding; Host must also be validated |
| **Wildcard CORS** | Violates PRD; exposes to any origin |
| **No CSRF on multipart** | State-changing upload endpoints would be unprotected |

---

## Consequences

### Positive

- **No secrets in frontend/storage** — HttpOnly cookies + JS-memory CSRF token satisfy PRD
- **Strong CSRF protection** — Double-submit cookie + SameSite=Strict defends against cross-site and DNS rebinding
- **Multipart support** — No preflight issues; streaming uploads work
- **Clear dev/prod separation** — Vite proxy in dev; same-origin in production
- **Deterministic tests** — All 18 tests offline, no live API dependency

### Negative / Risks

- **Cookie `Secure` on HTTP localhost** — Chrome/Edge may reject `Secure` cookie on `http://localhost`; may need `Secure` only for HTTPS or conditional logic
- **Cookie `Domain` attribute** — `localhost` vs `127.0.0.1` mismatch may prevent cookie send; needs testing on Windows
- **Session in memory only** — Restart loses sessions; acceptable for MVP
- **Vite proxy cookie forwarding** — Must verify `credentials: 'include'` and proxy config

---

## Verification

- All 18 test matrix cases pass deterministically offline
- `git diff --check` passes
- No source code, dependencies, or PRD modified by this ADR
- QFAT-002R2 decision #9 resolved (pending owner approval)

---

## Next Steps

1. Owner reviews and approves this ADR
2. Implementation task (QFAT-006) created with approved design
3. Windows cookie behavior validated before merge
4. Integration with Fastify backend in `apps/server/src/index.ts`

---

*End of ADR-002*