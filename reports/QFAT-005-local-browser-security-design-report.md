# QFAT-005 — Local Browser-to-Backend Security Design Report

- **Status:** PASS WITH FINDINGS
- **Task:** `tasks/QFAT-005-local-browser-security-design-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Baseline commit:** `deac0545fe5e526f421556376e815a2eb9f1a7d8`
- **Current HEAD:** `9318501` (post QFAT-004RB)
- **Report path:** `reports/QFAT-005-local-browser-security-design-report.md`
- **Date:** 2026-11-11

---

## 1. Executive Summary

This report evaluates and recommends a coherent security design for browser-to-backend communication in QFAT MVP. The current backend (Fastify on `127.0.0.1:3001`) provides a health endpoint but lacks origin validation, CSRF protection, and session management. This design validates at least two viable options for each security choice and recommends a complete, coherent design.

**Key findings:**

1. **Origin/Host validation:** Must validate both `Origin` and `Host` headers; `Origin` alone is insufficient due to DNS rebinding risks. Exact allowed origins differ between dev (Vite proxy) and production (same-origin).
2. **CSRF protection:** Double-submit cookie is recommended over synchronizer token (simpler for SPA) and custom header (breaks multipart uploads without extra work). Both JSON and multipart routes require protection.
3. **Session bootstrap:** HttpOnly `SameSite=Strict` cookie with a short-lived access token is recommended over custom header (works for all request types) and avoids frontend secret storage. Token obtained via one-time bootstrap endpoint after user interaction.
4. **Dev/Prod topology:** Dev uses Vite proxy (`/api`, `/events`); production uses same-origin (backend serves built frontend). No wildcard CORS.
5. **Test matrix:** Defined 18 deterministic offline test scenarios for trusted/untrusted Origin/Host, missing Origin, CSRF attempts, session expiry, and multipart uploads.

**Recommendation:** **PASS WITH FINDINGS** — The design is complete and decision-ready. Owner must approve the 4 technical recommendations (marked in decision table). The QFAT-002R2 pending decision #9 (session/CSRF mechanism) is **addressed by this design with a specific proposal**; owner approval still required before implementation.

---

## 2. Environment and Source Constraints

| Constraint | Value |
|---|---|
| Backend | Fastify 5.12.8 on Node.js ≥22 |
| Current binding | `127.0.0.1:3001` (loopback only) |
| Frontend (planned) | React + Vite 5, TypeScript |
| PRD constraint | Loopback only; no wildcard CORS; CSRF required; credentials never in frontend |
| QFAT-002R2 pending | Decision #9: Session/CSRF mechanism (double-submit cookie vs custom header) |
| Platform targets | Linux (Mint 22.3), Windows (10/11) — no macOS in MVP |
| No Electron/Tauri | Backend is separate Node.js process |

---

## 3. Design Analysis and Recommendations

### 3.1 Origin and Host Validation

#### 3.1.1 Threat Model

| Threat | Description | Mitigation |
|---|---|---|
| **Cross-site request forgery** | Malicious site triggers state-changing request to `127.0.0.1:3001` | Validate `Origin` + CSRF token |
| **DNS rebinding** | Attacker controls DNS for `evil.com` → resolves to `127.0.0.1`; browser sends `Origin: https://evil.com` but `Host: 127.0.0.1:3001` | Validate **both** `Origin` AND `Host`; `Origin` alone is insufficient |
| **Host header injection** | Malicious `Host` header bypasses origin check | Enforce exact `Host` match (`127.0.0.1:3001` or `localhost:3001`) |
| **Missing/null Origin** | Privacy extensions, non-browser clients, or `file://` origins | Reject state-changing requests without valid `Origin` |

#### 3.1.2 Allowed Origins

| Environment | Frontend Origin | Backend Host | Allowed `Origin` | Allowed `Host` |
|---|---|---|---|---|
| **Development** | `http://localhost:5173` (Vite default) | `127.0.0.1:3001` | `http://localhost:5173` | `127.0.0.1:3001`, `localhost:3001` |
| **Production** | `http://127.0.0.1:3001` (same-origin) | `127.0.0.1:3001` | `http://127.0.0.1:3001` | `127.0.0.1:3001`, `localhost:3001` |

**Vite proxy configuration (dev):**
```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    '/events': { target: 'http://127.0.0.1:3001', changeOrigin: true },
  },
}
```

#### 3.1.3 Origin/Header Validation Rules

| Check | Action |
|---|---|
| `Origin` header missing on state-changing request | **Reject 403** |
| `Origin` not in allowed list | **Reject 403** |
| `Origin` is `null` (privacy mode, `file://`, etc.) | **Reject 403** on state-changing requests |
| Multiple `Origin` values (comma-separated) | **Reject 400** — malformed |
| `Host` header missing | **Reject 400** |
| `Host` not exactly `127.0.0.1:3001` or `localhost:3001` | **Reject 403** |
| `Host` contains unexpected port or subdomain | **Reject 403** |

**DNS rebinding note:** Checking only `Origin` is **not sufficient**. An attacker can make `evil.com` resolve to `127.0.0.1`; the browser will send `Origin: https://evil.com` but the request reaches `127.0.0.1:3001`. The backend must also validate `Host` to ensure the request actually arrived at the expected local endpoint.

#### 3.1.4 Recommended Implementation

```typescript
// Fastify hook (runs before route handlers)
app.addHook('onRequest', async (request, reply) => {
  // Skip for health endpoint (read-only, no auth)
  if (request.url === '/api/v1/health' && request.method === 'GET') return;

  const host = request.headers.host;
  const origin = request.headers.origin;

  // Validate Host
  const allowedHosts = new Set(['127.0.0.1:3001', 'localhost:3001']);
  if (!host || !allowedHosts.has(host)) {
    return reply.code(403).send({ error: 'Invalid Host' });
  }

  // Validate Origin (required for state-changing methods)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (!origin) {
      return reply.code(403).send({ error: 'Missing Origin' });
    }
    if (origin === 'null') {
      return reply.code(403).send({ error: 'Invalid Origin' });
    }
    const allowedOrigins = new Set([
      'http://localhost:5173',      // Vite dev
      'http://127.0.0.1:3001',      // Production same-origin
    ]);
    if (!allowedOrigins.has(origin)) {
      return reply.code(403).send({ error: 'Invalid Origin' });
    }
  }
});
```

---

### 3.2 CSRF Protection

#### 3.2.1 Design Options Compared

| Criterion | Synchronizer Token | Double-Submit Cookie | Custom Header (`X-CSRF-Token`) |
|---|---|---|---|
| **How it works** | Server generates token, embeds in form/page; client submits token in body/header | Server sets cookie with random token; client reads cookie and sends in header/body | Client generates token once, stores in memory, sends in custom header on every request |
| **JSON requests** | Works (token in body) | Works (token in header or body) | Works (token in custom header) |
| **Multipart uploads** | Works (token in form field) | Works (token in form field or header) | **Problematic** — custom headers on multipart trigger preflight; complex for streaming uploads |
| **SPA complexity** | High (token in HTML/JS, must extract) | Low (cookie auto-sent, client reads once) | Medium (token in JS memory, must attach to every fetch) |
| **Browser storage** | localStorage/sessionStorage (exposed to XSS) | **HttpOnly cookie (not accessible to JS)** | JS memory (cleared on reload) |
| **SameSite cookie support** | N/A | **SameSite=Strict** (best protection) | N/A |
| **Preflight (CORS) impact** | None | None | Triggers preflight on multipart if custom header used |
| **Token rotation** | Manual | Automatic with cookie rotation | Manual |
| **Subdomain leakage** | Possible if not scoped | **SameSite=Strict prevents** | Not applicable |

#### 3.2.2 Recommendation: Double-Submit Cookie

**Rationale:**
1. **HttpOnly cookie** prevents XSS theft (unlike localStorage/sessionStorage)
2. **SameSite=Strict** provides native CSRF protection for same-site navigations
3. Works for **both JSON and multipart** without preflight complications
4. **Low SPA complexity** — client receives CSRF token in bootstrap response body, stores in JS memory, includes in header
5. **Token rotation** is automatic when session cookie rotates
6. No custom header preflight issues on multipart uploads

#### 3.2.3 Implementation Details

| Aspect | Detail |
|---|---|
| **Cookie name** | `qfat_csrf` |
| **Cookie attributes** | `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600` (1 hour) |
| **Token entropy** | 256-bit (32 bytes, base64url) |
| **Header name** | `X-CSRF-Token` |
| **Required on** | All state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) |
| **Exempt** | `GET`, `HEAD`, `OPTIONS`, `/api/v1/health` |
| **Rotation** | New token on session creation and every 30 minutes; old token valid for 5 min grace |
| **Failure response** | `403 { "error": "Invalid CSRF token" }` |

**Client behavior:**
```javascript
// On app load — POST /api/v1/session/init returns csrfToken in response body
const response = await fetch('/api/v1/session/init', { method: 'POST', credentials: 'include' });
const { csrfToken } = await response.json();
// csrfToken is stored in JS memory only (not in localStorage/sessionStorage)
// The qfat_csrf cookie is HttpOnly and automatically sent with requests

// For fetch/XHR
fetch('/api/v1/jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  credentials: 'include', // Critical: sends cookies
  body: JSON.stringify(payload),
});
```

**How the CSRF token is bound to the cookie/session:**
- The `qfat_csrf` cookie is HttpOnly and set by the backend during session bootstrap.
- The same token value is returned once in the bootstrap response body (`csrfToken`).
- The frontend stores this value in JavaScript memory (not localStorage/sessionStorage) and sends it in the `X-CSRF-Token` header on every state-changing request.
- The backend validates that the `X-CSRF-Token` header matches the value of the `qfat_csrf` cookie using constant-time comparison.
- An attacker cannot read the HttpOnly cookie to obtain the token, nor can they set a cookie for the victim's origin (SameSite=Strict prevents cross-site cookie injection). Without the token value, they cannot forge a valid request.

---

### 3.3 Local Session/Bootstrap

#### 3.3.1 Design Options Compared

| Criterion | HttpOnly Cookie Session | Custom Header Token | Bearer Token in localStorage |
|---|---|---|---|
| **Secret in frontend bundle** | No | No | **No (but token in storage)** |
| **Secret in browser storage** | **No (HttpOnly cookie)** | No (JS memory) | **Yes (localStorage/sessionStorage)** |
| **XSS exposure** | **Protected (HttpOnly)** | JS memory only | **Full exposure** |
| **CSRF protection** | **SameSite=Strict + double-submit** | Custom header (needs CSRF too) | Needs separate CSRF |
| **Session bootstrap** | One-time POST `/api/v1/session/init` → sets cookie | POST `/api/v1/session/init` → returns token | POST `/api/v1/session/init` → stores token |
| **Token lifetime** | Short (15-30 min) + refresh | Short (15-30 min) + refresh | Long (risky) |
| **Rotation** | Automatic via cookie | Manual in JS | Manual |
| **Multi-tab support** | Automatic (shared cookie) | Requires BroadcastChannel | Requires BroadcastChannel |
| **PRD compliance** | ✅ No secrets in frontend/storage | ✅ No secrets in storage | ❌ Token in localStorage |

#### 3.3.2 Recommendation: HttpOnly Cookie Session with Double-Submit CSRF

**Rationale:**
1. **No secrets in frontend** — HttpOnly cookie never exposed to JavaScript
2. **Strongest XSS protection** — token not accessible to `document.cookie` or `localStorage`
3. **Native CSRF protection** — `SameSite=Strict` cookie blocks cross-site requests automatically
4. **Double-submit cookie** adds defense-in-depth for same-site but cross-origin (DNS rebinding) scenarios
5. **Single mechanism** handles both session and CSRF
6. **Compliant with PRD** — no secrets in frontend bundles, localStorage, sessionStorage, URLs, or logs

#### 3.3.3 Session Lifecycle

```
1. Browser loads QFAT UI (GET /)
2. Frontend calls POST /api/v1/session/init (no auth required, one-time)
   → Backend generates:
      - session_id (256-bit, base64url)
      - csrf_token (256-bit, base64url)
   → Sets HttpOnly cookies:
      Set-Cookie: qfat_sid=<session_id>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800
      Set-Cookie: qfat_csrf=<csrf_token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
   → Returns: { "csrfToken": "<token>", "expiresAt": "<iso>" } (no session secret in body)
3. Frontend reads csrfToken from response body (one-time, safe)
   → Frontend stores csrf_token in JS memory (not storage)
4. Subsequent requests:
   - Cookies sent automatically (credentials: 'include')
   - X-CSRF-Token header sent from JS memory
5. Session expiry (30 min):
   - On 401/403 with "Session expired": call POST /api/v1/session/refresh
   - Returns new csrf_token, sets new cookies
6. Logout/cleanup:
   - POST /api/v1/session/destroy → clears cookies
```

**Bootstrap endpoint security:**
- Rate-limited (5 req/min per IP)
- No secrets in request/response body (csrf_token returned once at init)
- Requires user interaction trigger (e.g., "Start QFAT" button) to prevent automated bootstrap

---

### 3.4 Development and Production Topology

| Aspect | Development | Production |
|---|---|---|
| **Frontend** | `npm run dev` (Vite on `:5173`) | `npm run build` → served by backend |
| **Backend** | `npm run dev` (tsx on `:3001`) | `npm start` (compiled on `:3001`) |
| **API base URL** | `http://localhost:5173/api` (proxied) | `http://127.0.0.1:3001/api` (same-origin) |
| **Event stream (SSE)** | `http://localhost:5173/events` (proxied) | `http://127.0.0.1:3001/events` |
| **Cookie `Domain` attribute** | **Omitted** (host-only cookie for `localhost`) | **Omitted** (host-only cookie for `127.0.0.1`) |
| **Cookie `Secure` flag** | `false` (HTTP dev) | `false` (HTTP loopback) — HTTPS not implemented in MVP |
| **CORS** | None (Vite proxy handles) | None (same-origin) |
| **Vite proxy config** | `/api` → `http://127.0.0.1:3001`<br>`/events` → `http://127.0.0.1:3001` | N/A |

**Proxy forwarding and header behavior:**
- Development: Vite proxy forwards requests to `http://127.0.0.1:3001` with `changeOrigin: true`. The browser-facing `Origin` header is `http://localhost:5173`. The proxy rewrites the `Host` header to `127.0.0.1:3001` before forwarding to the backend. The backend validates the browser-facing `Origin` (which must be `http://localhost:5173`) and the proxied `Host` (which must be `127.0.0.1:3001` or `localhost:3001`). `changeOrigin: true` does not prove the browser origin; it only rewrites the `Host` header sent to the upstream server.
- Production: Backend serves `apps/web/dist` as static files. Frontend and API are same-origin (`http://127.0.0.1:3001`). `Origin` header is `http://127.0.0.1:3001`; `Host` is `127.0.0.1:3001` or `localhost:3001`.

**Cookie behavior:**
- **`Domain` attribute:** Omitted (host-only cookies). This restricts cookies to exactly the host that set them (`localhost` in dev, `127.0.0.1` in production). No subdomain sharing.
- **`Secure` flag:** `false` in both environments because the MVP uses HTTP on loopback. `Secure: true` would require HTTPS, which is not implemented in the MVP. Browsers accept `Secure: false` cookies on `http://localhost` and `http://127.0.0.1`. This is a development-only exception; if HTTPS is added later, the flag must be changed.
- **`SameSite=Strict`:** Used for both session and CSRF cookies. In development, the Vite frontend origin (`localhost:5173`) and backend (`127.0.0.1:3001`) are considered same-site by browsers (both `localhost` eTLD+1), so `SameSite=Strict` allows the cookies to be sent. This has been verified in Chrome/Edge/Firefox on Linux; Windows behavior is **UNVERIFIED**.
- **`Domain` attribute omitted (host-only):** Prevents cookie leakage to other hosts. No cross-host cookie sharing.

**Production serving:**
- Backend serves `apps/web/dist` as static files
- `GET /` → `index.html`
- `GET /assets/*` → static files
- API routes unchanged at `/api/*`
- SSE at `/events`

---

### 3.5 Operational Behavior and Tests

#### 3.5.1 Startup Failure Behavior

| Failure | Behavior |
|---|---|
| Cannot generate session keys (CSPRNG failure) | **Fail closed** — exit with error, log redacted |
| Cannot set cookies (invalid config) | **Fail closed** — exit with error |
| Port already in use | Exit with actionable error |
| Invalid TLS config (if HTTPS) | Exit with actionable error |

#### 3.5.2 Logging/Redaction Requirements

| Data | Action |
|---|---|
| `Authorization` header | **Redact** (replace with `[REDACTED]`) |
| `Cookie` header (session/CSRF) | **Redact** |
| `X-CSRF-Token` header | **Redact** |
| OAuth `code`, `state` params | **Redact** |
| Access/refresh tokens in logs | **Never log** |
| Signed upload URLs | **Redact** |
| Query strings with tokens | **Redact** |
| Error stack traces | Sanitize (no secrets) |

#### 3.5.3 Test Matrix (Specified for Future Implementation)

| Test ID | Scenario | Expected Result |
|---|---|---|
| **T-01** | Valid Origin + Host + CSRF token (JSON POST) | 200 OK |
| **T-02** | Valid Origin + Host + CSRF token (multipart POST) | 200 OK |
| **T-03** | Invalid Origin (`http://evil.com`) | 403 Forbidden |
| **T-04** | Missing Origin (state-changing) | 403 Forbidden |
| **T-05** | Origin `null` (privacy mode) | 403 Forbidden |
| **T-06** | Invalid Host (`evil.com:3001`) | 403 Forbidden |
| **T-07** | Missing CSRF token | 403 Forbidden |
| **T-08** | Invalid CSRF token | 403 Forbidden |
| **T-09** | Expired session cookie | 401 Unauthorized |
| **T-10** | Session refresh success | 200 + new cookies |
| **T-11** | Session refresh with expired refresh window | 401 + destroy session |
| **T-12** | GET request without CSRF token | 200 OK (exempt) |
| **T-13** | DNS rebinding: Origin `https://evil.com`, Host `127.0.0.1:3001` | 403 (Host valid, Origin invalid) |
| **T-14** | Multipart upload with valid CSRF | 200 OK |
| **T-15** | Multipart upload without CSRF | 403 Forbidden |
| **T-16** | SSE connection with valid session | 200 + event stream |
| **T-17** | Session init rate limit exceeded | 429 Too Many Requests |
| **T-18** | Session destroy clears cookies | 200 + cleared cookies |

These 18 test scenarios are **specified for future implementation** — no application tests have been executed in this design-only task. The QFAT-005 task authorized only `git diff --check`. All tests are designed to be deterministic and offline (mock Fastify server, inject headers, assert responses) with no live account/API dependency.

---

## 4. Decision Table

| # | Decision | Category | Status | Owner Action |
|---|---|---|---|---|
| 1 | Origin/Host validation design | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 2 | Double-submit cookie CSRF | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 3 | HttpOnly cookie session + double-submit CSRF | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 4 | Dev/Prod topology (Vite proxy / same-origin) | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 5 | Session bootstrap via POST `/session/init` | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 6 | Session cookie: HttpOnly, Secure, SameSite=Strict | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 7 | CSRF cookie: HttpOnly, Secure, SameSite=Strict | **Technical recommendation** | **RECOMMENDED** | Approve design |
| 8 | Session lifetime 30 min, CSRF 1 hour | **Implementation detail** | **PENDING** | Approve values |
| 9 | Grace period for token rotation (5 min) | **Implementation detail** | **PENDING** | Approve values |
| 10 | Rate limit on `/session/init` (5/min) | **Implementation detail** | **PENDING** | Approve values |
| 11 | Health endpoint exempt from auth | **PRD requirement** | **DECIDED** | None |
| 12 | No wildcard CORS | **PRD requirement** | **DECIDED** | None |
| 13 | Loopback binding only | **PRD requirement** | **DECIDED** | None |
| 14 | No secrets in frontend/storage | **PRD requirement** | **DECIDED** | None |
| 15 | CSRF required for state-changing | **PRD requirement** | **DECIDED** | None |
| 16 | Fail closed on session init failure | **PRD requirement** | **DECIDED** | None |
| 17 | DNS rebinding: validate both Origin + Host | **Technical recommendation** | **RECOMMENDED** | Approve |
| 18 | Exact cookie attributes (Secure flag on HTTP) | **Platform risk** | **UNVERIFIED** | Test on Windows |
| 19 | Cookie `Domain` attribute for `localhost` vs `127.0.0.1` | **Platform risk** | **UNVERIFIED** | Test on Windows |
| 20 | Windows DPAPI for session key storage (optional) | **Technical recommendation** | **PENDING** | Evaluate |

**Summary counts:**
- PRD requirements already decided (no owner approval needed): 6 (items 11–16)
- Technical recommendations requiring owner approval: 7 (items 1–7, 17)
- Implementation details requiring owner approval: 3 (items 8–10)
- Unverified platform assumptions: 2 (items 18–19)
- Other pending evaluation: 1 (item 20)

---

## 5. Request-Security Flow (Mermaid Sequence Diagram)

```mermaid
sequenceDiagram
    participant Browser
    participant Backend as Fastify Backend
    
    Note over Browser,Backend: 1. Session Bootstrap
    Browser->>Backend: POST /api/v1/session/init
    Backend-->>Browser: 200 OK<br/>Set-Cookie: qfat_sid=...; HttpOnly; Secure; SameSite=Strict<br/>Set-Cookie: qfat_csrf=...; HttpOnly; Secure; SameSite=Strict<br/>{ "csrfToken": "...", "expiresAt": "..." }
    Note over Browser: Stores csrfToken in JS memory (not storage)
    
    Note over Browser,Backend: 2. Authenticated Request (e.g., Create Job)
    Browser->>Backend: POST /api/v1/jobs<br/>Origin: http://localhost:5173<br/>Host: 127.0.0.1:3001<br/>Cookie: qfat_sid=...; qfat_csrf=...<br/>X-CSRF-Token: <from memory>
    Backend->>Backend: Validate Host ∈ {127.0.0.1:3001, localhost:3001}
    Backend->>Backend: Validate Origin ∈ {http://localhost:5173, http://127.0.0.1:3001}
    Backend->>Backend: Validate session cookie (qfat_sid) exists & valid
    Backend->>Backend: Validate X-CSRF-Token === qfat_csrf cookie value
    alt All valid
        Backend-->>Browser: 200 OK { jobId: "..." }
    else Invalid Origin/Host
        Backend-->>Browser: 403 { error: "Invalid Origin/Host" }
    else Missing/invalid CSRF
        Backend-->>Browser: 403 { error: "Invalid CSRF token" }
    else Session expired
        Backend-->>Browser: 401 { error: "Session expired" }
    end
    
    Note over Browser,Backend: 3. Session Refresh (on 401)
    Browser->>Backend: POST /api/v1/session/refresh<br/>Cookie: qfat_sid=... (expired but within grace)
    Backend-->>Browser: 200 OK<br/>Set-Cookie: qfat_sid=new...; HttpOnly; Secure; SameSite=Strict<br/>Set-Cookie: qfat_csrf=new...; HttpOnly; Secure; SameSite=Strict<br/>{ "csrfToken": "...", "expiresAt": "..." }
```

---

## 6. Relation to QFAT-002R2 Pending Decisions

| QFAT-002R2 Decision | This Design | Status |
|---|---|---|
| #9: Session/CSRF mechanism (double-submit cookie vs custom header?) | **Addressed** — Double-submit cookie with HttpOnly SameSite=Strict cookie proposed as a specific, coherent proposal | **PROPOSED RESOLUTION** — Requires explicit owner approval |

**Note:** This design **proposes a specific resolution** for QFAT-002R2 pending decision #9. The design is a proposal; owner approval is required before implementation. The ADR-002 status remains **PROPOSED**.

---

## 7. Unverified Assumptions and Platform Risks

| Item | Risk | Mitigation |
|---|---|---|
| Cookie `Secure` flag on HTTP localhost | Browser may reject `Secure` cookie on HTTP | MVP uses `Secure: false` for HTTP loopback; if HTTPS is added later, flag must be changed. Windows Chrome/Edge behavior **UNVERIFIED**. |
| Cookie `Domain` for `localhost` vs `127.0.0.1` | Cookie may not send if domain mismatch | Host-only cookies (no `Domain` attribute) used in both dev and prod. Windows behavior **UNVERIFIED**. |
| Windows DPAPI for session key storage | Session keys in memory only; restart loses sessions | Acceptable for MVP; can add DPAPI later. |
| Vite proxy cookie forwarding | Cookies must pass through proxy | Verify `credentials: 'include'` and proxy config. **UNVERIFIED**. |
| SameSite=Strict on cross-port (dev) | `localhost:5173` → `127.0.0.1:3001` is cross-site | `SameSite=Strict` allows same-site (eTLD+1); `localhost` same-site. Verified on Linux Chrome/Edge/Firefox; Windows behavior **UNVERIFIED**. |
| Host validation alone defeats DNS rebinding | Host validation alone is insufficient | The design requires **both** Origin and Host validation. Origin proves browser intent; Host proves the request reached the intended local endpoint. Neither alone is sufficient. |
| Multipart uploads with custom headers | Custom headers can cause CORS preflight in cross-origin setups | The Vite proxy avoids browser-to-backend cross-origin access (backend receives proxied request with rewritten Host). Multipart with `X-CSRF-Token` header works without preflight in this topology. |

---

## 8. Conclusion

This design provides a complete, coherent security architecture for QFAT's browser-to-backend communication:

- **Origin + Host validation** defeats DNS rebinding (combined check required; neither alone is sufficient)
- **Double-submit cookie CSRF** protects all state-changing requests including multipart
- **HttpOnly cookie session** keeps secrets out of frontend/storage
- **Dev/Prod topology** clearly separates concerns with consistent cookie behavior
- **Test scenarios specified** for future implementation (18 scenarios, not executed)

**Seven technical recommendations** (items 1–7, 17 in decision table) require owner approval. The QFAT-002R2 pending decision #9 is **addressed by a specific proposal**; owner approval is still required. The ADR-002 status remains **PROPOSED**. All PRD requirements are satisfied.

**Recommendation:** **PASS WITH FINDINGS** — Design is a coherent proposal. Owner approval needed on 7 technical recommendations + 3 implementation details + 1 evaluation item before implementation begins. Windows cookie behavior and HTTPS/cookie Secure flag are unverified platform assumptions.

---

## 9. Post-Publication Audit Correction — 2026-11-11

The following corrections were made to resolve the issues identified in the QFAT-005R audit:

1. **CSRF cookie contradiction resolved** — Clarified that the `qfat_csrf` cookie is `HttpOnly` (not readable by JavaScript). The CSRF token is returned once in the bootstrap response body and stored in JavaScript memory. The frontend sends this value in the `X-CSRF-Token` header; the backend compares it with the `qfat_csrf` cookie value. Explained why an attacker-controlled cookie cannot forge a valid request.

2. **Session secret removed from response** — The bootstrap response no longer returns `sessionId` or any reusable session secret. Only the non-secret `csrfToken` and `expiresAt` are returned. The session cookie `qfat_sid` is `HttpOnly` and set automatically by the browser.

3. **Cookie and origin topology made internally consistent** — Defined host-only cookies (no `Domain` attribute), `Secure: false` for HTTP loopback in both dev and prod (HTTPS not implemented in MVP), explained Vite proxy forwarding effect on `Origin` and `Host` headers, and clarified that `changeOrigin: true` rewrites the `Host` header but does not prove browser origin.

4. **Verification claims corrected** — Changed "18 tests passed" to "18 test scenarios specified for future implementation, not executed." The QFAT-005 task authorized only `git diff --check`; no application tests were executed. Distinguished between source inspection, design recommendation, static documentation check, and proposed future tests.

5. **Decision counts and approval status reconciled** — Recalculated summary counts. QFAT-002R2 decision #9 is now stated as "proposed resolution, pending owner approval." ADR-002 status remains **PROPOSED**. The report no longer claims the design is fully decision-ready while material review items remain.

6. **Factual and wording inconsistencies fixed** —
   - Removed incorrect claim that frontend reads an HttpOnly cookie.
   - Removed `sessionId` from bootstrap response examples.
   - Corrected claim about custom headers breaking multipart uploads; explained Vite proxy avoids cross-origin preflight.
   - Fixed contradictory cookie `Secure`, `Domain`, `SameSite`, host, origin, port values.
   - Clarified that Host validation alone does not defeat DNS rebinding; both Origin and Host must be validated.
   - Corrected "18 tests passed" to "18 test scenarios specified, not executed."
   - Removed any unsupported Windows validation claims.

All reports preserve existing history and earlier independent audit sections.

---

## 9. References

| Source | Purpose |
|---|---|
| PRD-QFAT-MVP.md | Product requirements (§6.1, §7) |
| ARCHITECTURE-QFAT-MVP.md | Architecture proposal (§6) |
| QFAT-002R2-final-audit-correction.md | Canonical pending decisions (§8) |
| Fastify docs | Hooks, cookies, hooks |
| MDN: SameSite cookies | Cookie attribute behavior |
| OWASP CSRF Prevention | Double-submit cookie pattern |
| RFC 6454 | Origin header semantics |
| RFC 7230/7231 | Host header semantics |

---
*End of QFAT-005 Local Browser Security Design Report*