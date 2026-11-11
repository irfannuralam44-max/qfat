# ADR-002: Local Browser-to-Backend Security Design

- **Status:** PROPOSED
- **Date:** 2026-11-11
- **Related:** QFAT-005, QFAT-005R2, QFAT-002R2 decision #9
- **Supersedes:** None

> This ADR is a proposal, not an approved decision. No security controls described here are implemented or validated. Explicit owner approval is required before any implementation task begins.

## Context

The PRD defines QFAT as a local-first browser UI with a separate backend. It requires loopback-only binding, no wildcard CORS, CSRF protection for state-changing requests, Origin/Host validation, and no exposure of platform credentials or session secrets to frontend storage or logs. Loopback is not an authentication boundary.

The proposed development browser origin is `http://localhost:5173`; Vite proxies same-origin browser API requests to `http://127.0.0.1:3001`. Production uses the canonical same-origin URL `http://127.0.0.1:3001`. `localhost` and `127.0.0.1` are distinct cookie hosts.

## Proposed design

### 1. Request topology and validation

- Development browser requests target `http://localhost:5173/api/...`; the browser sends `Origin: http://localhost:5173`. Vite proxies to the fixed upstream `http://127.0.0.1:3001`.
- With `changeOrigin: true`, Vite rewrites the upstream `Host` to `127.0.0.1:3001`. It does not prove the browser Origin, and the backend cannot infer the original browser-facing Host from this rewritten Host.
- Proxy contract for implementation: Vite and backend bind only to loopback; proxy only the named API/event paths to the fixed backend URL; preserve the browser Origin; strip client-supplied `Forwarded`, `X-Forwarded-Host`, and `X-Original-Host`; do not rely on forwarded/original-host headers. Validate exact Origin and expected upstream Host. Verify the actual behavior when implemented.
- Production uses the single canonical authority `http://127.0.0.1:3001`; allow only its exact Origin and Host. Do not casually allow `localhost`, arbitrary names/ports, wildcard origins, LAN binding, or arbitrary forwarded-host values.
- Reject missing, `null`, malformed, multiple, or unexpected Origin values on bootstrap and all state-changing requests; reject missing/unexpected Host and unexpected ports. Origin indicates the browser's claimed initiating origin, not user identity. Host identifies the authority received at the current server/proxy boundary; behind Vite it is the rewritten upstream target. Neither check alone defeats DNS rebinding.
- If the proxy cannot preserve this contract, do not trust forwarded values as a workaround; redesign to a topology that exposes the browser-facing authority to the backend or otherwise establishes a verifiable trusted proxy boundary.

### 2. Session and CSRF

Propose an opaque server-side session and synchronizer token:

- The backend creates unpredictable session and CSRF values and stores the CSRF proof bound to the session record.
- The browser receives only the session identifier in a host-only `HttpOnly` cookie; the identifier is never returned in JSON.
- Bootstrap returns the separate CSRF proof and expiry metadata. The SPA retains the proof only in JavaScript memory and sends `X-CSRF-Token` on state-changing requests.
- The backend validates the session and compares the submitted proof to the proof bound to that session, using constant-time comparison where applicable. Do not issue a CSRF cookie or use unbound cookie/header equality.
- Bootstrap must pass exact Origin and proxy checks and be rate-limited. Refresh and destroy require the current session-bound proof and exact Origin; successful refresh rotates session/proof, and destroy invalidates session and clears its cookie.
- Apply the proof to JSON and multipart mutations. Safe read methods must not mutate state; sensitive reads remain session-authorized.
- A JavaScript-memory proof is accessible to same-origin script and is not an XSS defense. HttpOnly protects direct access to the session cookie but does not prevent active XSS from using the session.

A synchronizer token is preferred because server-side session binding clearly defeats the naive cookie-tossing weakness. Naive double-submit compares values that an attacker may inject or toss; `SameSite=Strict` does not universally prevent cookie injection. A signed/session-bound double-submit design is a possible alternative but adds key and validation complexity without a clear advantage for this SPA.

### 3. Cookie attributes and transport

The MVP proposal uses HTTP loopback; HTTPS is not designed or implemented. The `Set-Cookie` header must omit the `Secure` attribute entirely; `Secure=false` is not a valid cookie attribute. Use one host-only session cookie (omit `Domain`) with `HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`. In development, the browser receives the cookie for `localhost`; in production, for `127.0.0.1`. Do not assume the hosts share cookies or are the same site.

`SameSite` is evaluated using the browser-facing request context. In development, the browser talks to its own Vite origin; the upstream proxy address is not the browser-facing site. Omitting `Secure` is a narrow HTTP-loopback MVP trade-off, not a general production-safe cookie configuration. Keep loopback binding and the other checks; revisit cookie transport before any non-loopback deployment. Browser acceptance and behavior are **UNVERIFIED**.

### 4. Multipart and CORS

A custom header does not inherently break multipart requests. It can trigger CORS preflight for cross-origin browser requests. Here, development browser requests are same-origin with Vite, which proxies upstream, and production is same-origin, so browser-to-backend CORS preflight is avoided. The browser/client library must generate the multipart boundary; do not manually set an incomplete multipart Content-Type. Multipart state changes require the same session, Origin, and CSRF validation.

## Alternatives considered

| Alternative | Assessment |
|---|---|
| Naive double-submit cookie | Not recommended: unbound equality can be vulnerable to cookie tossing/injection; SameSite alone is insufficient |
| Signed/session-bound double-submit | Viable with careful MAC/session binding and key lifecycle; more complexity than synchronizer state |
| Synchronizer token bound to session | Recommended proposal: clear server-side binding; session ID stays HttpOnly; proof remains memory-only in SPA |
| Bearer token in localStorage | Rejected: persistent browser storage exposes reusable authentication material to XSS and conflicts with PRD intent |
| Origin-only or Host-only validation | Rejected as insufficient alone; checks cover different, limited facts and must be used with fixed loopback/proxy trust rules |
| Wildcard CORS or arbitrary forwarded-host trust | Rejected by PRD/security boundary |

## Consequences and unresolved decisions

- Session lifetime, CSRF rotation/grace policy, bootstrap rate limits, response codes, and safe-read Origin policy need owner approval or implementation validation.
- Vite/Fastify header preservation, cookie forwarding, and browser behavior are **UNVERIFIED**; no Linux or Windows browser testing is claimed.
- HTTP loopback does not encrypt traffic or authenticate the local user.
- A same-origin script compromise can use the active session even though it cannot directly read the HttpOnly cookie.
- QFAT-002R2 decision #9 has a **proposed resolution pending explicit owner approval**; it is not resolved or approved.

## Verification boundary

The 18 application scenarios in the design report are **specified, not executed** by QFAT-005 or QFAT-005R. No application, browser, platform, or runtime security validation is claimed. `git diff --check` is a documentation whitespace check only. Implementation acceptance must come from a later explicitly authorized task and its evidence.

## Owner approval gate

ADR-002 stays **PROPOSED**. Do not implement sessions, cookies, CSRF, proxy, Origin/Host, or DNS-rebinding controls until the owner explicitly approves this proposal and any outstanding parameters are resolved. This ADR does not authorize QFAT-006 or UI implementation.

## Post-publication audit correction — 2026-11-11 (historical)

The earlier QFAT-005R correction record is retained below as history. Its double-submit-cookie recommendation and claims that SameSite prevents cookie injection or that browsers were verified are superseded by the QFAT-005R2 correction above. They are not current design guidance.

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

## QFAT-005R2 post-audit correction — 2026-11-11

Corrected the Vite browser-facing/upstream authority model and defined a proxy trust contract; replaced naive double-submit with a session-bound synchronizer-token proposal; made cookie attributes, HTTP loopback scope, SameSite context, multipart behavior, and Origin/Host limits consistent; recalculated the report's decision categories to eight technical recommendations, three implementation parameters, two grouped PRD entries, two unverified assumptions, and one optional evaluation; and removed unsupported execution/verification claims. ADR-002 remains **PROPOSED**. Explicit owner approval is required before implementation.


## QFAT-005R3 post-audit correction — 2026-11-11

Corrected the cookie attribute notation: the HTTP-loopback proposal omits the `Secure` attribute entirely; `Secure=false` is not written into a `Set-Cookie` header. ADR-002 remains **PROPOSED**. No implementation or browser validation is claimed; explicit owner approval is still required.
