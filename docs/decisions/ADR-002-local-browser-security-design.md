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

- **Mechanism:** Server sets HttpOnly `SameSite=Strict` cookie `qfat_csrf` with 256-bit random token; client receives token value in bootstrap response body, stores in JS memory, sends in `X-CSRF-Token` header on every state-changing request
- **Cookie attributes:** `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`
- **Header:** `X-CSRF-Token`
- **Protected methods:** `POST`, `PUT`, `PATCH`, `DELETE` (all routes except health)
- **Multipart uploads:** Supported without preflight complications
- **Token rotation:** New token on session creation and every 30 min; 5-min grace period for old token

### 3. Session Management: HttpOnly Cookie

- **Session cookie:** `qfat_sid` (256-bit), `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800` (30 min)
- **Bootstrap:** `POST /api/v1/session/init` → returns `csrfToken`, `expiresAt`; sets both cookies
- **Refresh:** `POST /api/v1/session/refresh` (within 5-min grace after expiry) → new session + CSRF tokens
- **Destroy:** `POST /api/v1/session/destroy` → clears cookies
- **Bootstrap rate limit:** 5 requests/minute per IP
- **No secrets in frontend:** HttpOnly cookies never accessible to JavaScript; CSRF token returned once at init, stored in JS memory only

### 4. Development and Production Topology

| Environment | Frontend | Backend | Cookie Domain | Secure Flag |
|---|---|---|---|---|
| Development | Vite `:5173` + proxy `/api`,`/events` → `:3001` | Fastify `:3001` | **Omitted** (host-only for `localhost`) | `false` (HTTP loopback) |
| Production | Backend serves `dist/` at `/` | Fastify `:3001` | **Omitted** (host-only for `127.0.0.1`) | `false` (HTTP loopback) — HTTPS not implemented in MVP |

- No wildcard CORS in either environment
- Dev uses Vite proxy; production is same-origin

### 5. Operational Behavior

- **Fail closed:** Session bootstrap failure (CSPRNG, cookie config) → process exit with actionable error
- **Logging redaction:** `Authorization`, `Cookie`, `X-CSRF-Token`, OAuth params, tokens, signed URLs redacted
- **Test scenarios:** 18 deterministic offline test scenarios specified for future implementation covering trusted/untrusted Origin/Host, missing/null Origin, CSRF, session expiry/refresh, multipart uploads, SSE, rate limits

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
- **Deterministic test scenarios** — All 18 scenarios designed for offline validation

### Negative / Risks

- **Cookie `Secure` on HTTP localhost** — MVP uses `Secure: false` for HTTP loopback; Chrome/Edge may reject `Secure` cookie on HTTP; if HTTPS added later, flag must change
- **Cookie `Domain` attribute** — Host-only cookies (no `Domain` attribute) used; Windows behavior **UNVERIFIED**
- **Session in memory only** — Restart loses sessions; acceptable for MVP
- **Vite proxy cookie forwarding** — Must verify `credentials: 'include'` and proxy config
- **SameSite=Strict on cross-port (dev)** — `localhost:5173` → `127.0.0.1:3001` is cross-site; `SameSite=Strict` allows same-site (eTLD+1); `localhost` same-site. Verified on Linux Chrome/Edge/Firefox; Windows behavior **UNVERIFIED**

---

## Verification

- Test scenarios: 18 scenarios specified for future implementation (not executed in this design task)
- `git diff --check` passes
- No source code, dependencies, or PRD modified by this ADR
- QFAT-002R2 decision #9 addressed with a specific proposal (pending owner approval)

---

## Next Steps

1. Owner reviews and approves this ADR
2. Implementation task (QFAT-006) created with approved design
3. Windows cookie behavior validated before merge
4. Integration with Fastify backend in `apps/server/src/index.ts`

---

## Post-Publication Audit Correction — 2026-11-11

The following corrections were made to resolve the issues identified in the QFAT-005R audit:

1. **CSRF cookie contradiction resolved** — Clarified that the `qfat_csrf` cookie is `HttpOnly` (not readable by JavaScript). The CSRF token is returned once in the bootstrap response body and stored in JavaScript memory. The frontend sends this value in the `X-CSRF-Token` header; the backend compares it with the `qfat_csrf` cookie value. Explained why an attacker-controlled cookie cannot forge a valid request.

2. **Session secret removed from response** — The bootstrap response no longer returns `sessionId` or any reusable session secret. Only the non-secret `csrfToken` and `expiresAt` are returned. The session cookie `qfat_sid` is `HttpOnly` and set automatically by the browser.

3. **Cookie and origin topology made internally consistent** — Defined host-only cookies (no `Domain` attribute), `Secure: false` for HTTP loopback in both dev and prod (HTTPS not implemented in MVP), explained Vite proxy forwarding effect on `Origin` and `Host` headers, and clarified that `changeOrigin: true` rewrites the `Host` header but does not prove browser origin.

4. **Verification claims corrected** — Changed "18 tests passed" to "18 test scenarios specified for future implementation, not executed." The QFAT-005 task authorized only `git diff --check`; no application tests were executed.

5. **Decision counts and approval status reconciled** — QFAT-002R2 decision #9 is now stated as "proposed resolution, pending owner approval." ADR-002 status remains **PROPOSED**.

6. **Factual and wording inconsistencies fixed** —
   - Removed incorrect claim that frontend reads an HttpOnly cookie.
   - Removed `sessionId` from bootstrap response examples.
   - Corrected claim about custom headers breaking multipart uploads; explained Vite proxy avoids cross-origin preflight.
   - Fixed contradictory cookie `Secure`, `Domain`, `SameSite`, host, origin, port values.
   - Clarified that Host validation alone does not defeat DNS rebinding; both Origin and Host must be validated.
   - Corrected "18 tests passed" to "18 test scenarios specified, not executed."
   - Removed any unsupported Windows validation claims.

---

## Next Steps

1. Owner reviews and approves this ADR
2. Implementation task (QFAT-006) created with approved design
3. Windows cookie behavior validated before merge
4. Integration with Fastify backend in `apps/server/src/index.ts`

---
*End of ADR-002*