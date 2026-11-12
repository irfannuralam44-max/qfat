# ADR-002: Local Browser-to-Backend Security Design

- **Status:** OWNER-APPROVED DESIGN DIRECTION — IMPLEMENTATION DETAILS REQUIRE VALIDATION
- **Date:** 2026-11-11
- **Updated:** 2026-11-12
- **Related:** QFAT-005, QFAT-005R2, QFAT-006, QFAT-002R2 decision #9
- **Supersedes:** The original loopback-only browser-origin assumptions in this ADR; historical proposal text is retained below.

> The owner approved the security direction for QFAT's LAN/Tailscale browser workflow on 2026-11-12: dynamic browser-facing IPs, same-origin requests, a loopback-only backend behind the frontend proxy, an HttpOnly session cookie, and a session-bound CSRF synchronizer token. This approval does not claim that the controls are implemented or validated, and does not by itself authorize an implementation task. The concrete proxy/header behavior, IP validation, cookie transport limitations, and browser tests must be resolved in a bounded implementation task before security-sensitive endpoints are exposed.

## Context and approved operating model

QFAT is a local-first web application. The owner's PC runs the frontend, backend, and SQLite database. Other devices use an ordinary browser:

- At home or at another local network, a device opens the frontend using the PC's current LAN IP, for example `http://192.168.0.15:5173` or `http://192.168.100.20:5173`.
- Away from home, the device connects to the owner's private network through Tailscale and opens the frontend using the PC's current Tailscale IP, for example `http://100.x.y.z:5173`.
- The LAN and Tailscale addresses can change. QFAT must not hardcode a specific IP, router subnet, or Tailscale address, and must not require a security configuration edit whenever the address changes.
- The frontend listens on `0.0.0.0:5173`; the backend remains bound to `127.0.0.1:3001`. Browser API calls use relative same-origin paths and are proxied by the frontend to the fixed loopback backend.
- QFAT does not integrate with the Tailscale SDK/API/CLI, Serve, or Funnel. Tailscale is a network path, not an application authentication mechanism.
- This is private-network access, not public internet hosting. No router port forwarding or public backend binding is permitted.

The browser's origin is therefore dynamic. It is the exact origin used to open the frontend, not a preconfigured list of one or two IP addresses. A browser switching from a LAN IP to a Tailscale IP uses a different origin and does not carry the host-only session cookie across; the user obtains a separate session on that origin.

## Approved security design direction

### 1. Request topology and dynamic Origin/Host validation

- Browser API calls target the same origin from which the QFAT frontend was opened. The frontend proxy forwards only explicitly configured API/event paths to `http://127.0.0.1:3001`.
- The backend must validate the browser-facing authority dynamically, without a hardcoded LAN/Tailscale IP or router subnet.
- The request's `Origin` must be a single, well-formed origin and must exactly match the authority represented by the request's validated `Host` (including the expected frontend port). Reject missing, `null`, malformed, multiple, unexpected-scheme, and mismatched values on bootstrap and every state-changing request.
- The current private-network HTTP MVP expects the frontend authority on port `5173`. The accepted host forms must be deliberately constrained to numeric IP literals appropriate for this deployment: loopback for same-PC development, RFC1918 private IPv4 for LAN, Tailscale CGNAT IPv4 (`100.64.0.0/10)), and, if IPv6 access is supported by the frontend, explicitly validated IPv6 loopback/ULA/link-local forms. Do not accept arbitrary DNS hostnames, arbitrary ports, wildcard origins, or public internet authorities by default. The exact parser and address-range implementation must be tested; do not implement this with a fragile string-prefix check.
- Do not hardcode a particular address such as `192.168.1.21`, `192.168.0.x`, `192.168.100.x`, or an individual `100.x` Tailscale IP. Address changes within the supported address classes must not require configuration changes.
- The existing QFAT-006 Vite proxy uses a fixed upstream backend. Its current `changeOrigin`/Host behavior must be inspected and tested before security middleware is implemented. The implementation must establish a verifiable contract for the browser-facing Host at the backend. Prefer preserving the original Host through the trusted same-origin proxy if the framework supports it safely; if a trusted proxy marker is required, the proxy must remove any client-supplied copy and set its own value. Never trust arbitrary client-supplied `Forwarded`, `X-Forwarded-Host`, `X-Original-Host`, or similarly named headers.
- Backend binding to loopback and frontend proxying are mandatory network boundaries. Direct access to port `3001` from another device must remain impossible. Proxy routing must be limited to explicitly named API/event paths.
- Origin/Host checks protect browser request context; they do not authenticate a user, encrypt HTTP, or defend against a malicious process already running on the owner PC. The firewall and private network remain part of the deployment boundary. Do not claim that a valid Origin proves user identity.
- DNS-rebinding resistance must come from rejecting arbitrary DNS hostnames and validating the exact authority/address class, in addition to Origin checks. Origin-only or Host-only validation is insufficient.

### 2. Session and CSRF

Use an opaque server-side session and a synchronizer token:

- The backend creates unpredictable session and CSRF values and stores the CSRF proof bound to the session record.
- The browser receives only the session identifier in a host-only `HttpOnly` cookie; the identifier is never returned in JSON and no `Domain` attribute is set.
- Bootstrap returns the separate CSRF proof and expiry metadata. The SPA retains the proof only in JavaScript memory and sends `X-CSRF-Token` on state-changing requests.
- The backend validates the session and compares the submitted proof to the proof bound to that session, using constant-time comparison where applicable. Do not issue a CSRF cookie or use unbound cookie/header equality.
- Bootstrap must pass exact Origin/Host validation and be rate-limited. Refresh and destroy require the current session-bound proof and exact Origin; successful refresh rotates session/proof, and destroy invalidates the session and clears its cookie.
- Apply the proof to JSON and multipart mutations. Safe read methods must not mutate state; sensitive reads remain session-authorized.
- A JavaScript-memory proof is accessible to same-origin script and is not an XSS defense. HttpOnly protects direct access to the session cookie but does not prevent active XSS from using the session.
- Session lifetime, rotation behavior, bootstrap rate limits, response codes, and safe-read Origin policy must be specified in the implementation task and tested.

A synchronizer token is preferred because server-side session binding avoids the cookie-tossing weakness of naive double-submit. A signed/session-bound double-submit design is possible but adds key and validation complexity without a clear advantage for this SPA.

### 3. Cookie attributes and transport limitations

- Use one host-only session cookie (omit `Domain`) with `HttpOnly; SameSite=Strict; Path=/; Max-Age=1800` as the initial MVP policy.
- The current LAN/Tailscale browser entrypoint uses HTTP. The `Secure` attribute must therefore be omitted for this HTTP-only MVP; `Secure=false` is not a valid cookie attribute. This is a deliberate transport limitation, not a general production-safe cookie configuration.
- HTTP on a LAN does not encrypt browser-to-PC traffic. Tailscale encrypts traffic inside its network tunnel, but ordinary LAN HTTP does not provide equivalent end-to-end transport protection. Do not claim that HttpOnly or CSRF protects session cookies from an on-path network observer. A future HTTPS design requires separate certificate/trust and origin planning; it is not silently included in this ADR.
- Cookies are host-only. Opening QFAT through a different LAN or Tailscale IP creates a distinct browser cookie scope/session. No IP migration or cookie sharing is promised.
- Browser cookie acceptance, SameSite behavior, and session lifecycle across supported browsers are unverified until tested.

### 4. Multipart and CORS

A custom header does not inherently break multipart requests. It can trigger CORS preflight for cross-origin browser requests. QFAT's intended browser flow is same-origin with the frontend; the frontend proxies the request to the backend, so browser-to-backend CORS is avoided. The browser/client library must generate the multipart boundary; do not manually set an incomplete multipart Content-Type. Multipart mutations require the same session, Origin/Host, and CSRF validation.

## Alternatives considered

| Alternative | Assessment |
|---|---|
| Hardcoded single LAN/Tailscale IP | Rejected: addresses change across routers and networks |
| Allow every private subnet or arbitrary hostname without validation | Rejected: overly broad and weakens DNS-rebinding resistance |
| Naive double-submit cookie | Not recommended: unbound equality can be vulnerable to cookie tossing/injection; SameSite alone is insufficient |
| Signed/session-bound double-submit | Viable but more complex than synchronizer state |
| Synchronizer token bound to session | Approved direction: clear server-side binding; session ID stays HttpOnly; proof remains memory-only in SPA |
| Bearer token in localStorage | Rejected: persistent browser storage exposes reusable authentication material to XSS |
| Wildcard CORS or arbitrary forwarded-host trust | Rejected by PRD/security boundary |
| Public hosting / router port forwarding | Out of MVP scope and not authorized |

## Consequences, limitations, and implementation gates

- QFAT remains a local-first web app accessible on the local network or through the owner's Tailscale network. The PC must remain on and the relevant frontend process running.
- No Tailscale-specific integration is required. The application must not assume one router subnet or one fixed address.
- HTTP LAN traffic is not encrypted. This is a known MVP limitation and must be visible in security documentation; it must not be described as secure against on-path LAN attackers.
- A same-origin script compromise can use the active session even though it cannot directly read the HttpOnly cookie.
- A malicious local process is outside the protection provided by browser Origin/CSRF controls. Loopback binding is a network exposure control, not local-user authentication.
- The QFAT-002R2 decision #9 direction is accepted at the design level; implementation details and runtime verification remain open.
- Vite/Fastify Host preservation, proxy path restrictions, cookie forwarding, Origin parsing, address-range validation, and browser behavior are **UNVERIFIED**. No Linux/Windows browser security validation is claimed.

## Verification boundary

The 18 application scenarios in the design report remain **specified, not executed** by QFAT-005 or QFAT-005R. This ADR update is a documentation decision only. No application, browser, platform, or runtime security validation is claimed. Implementation acceptance requires a later explicitly authorized task and recorded evidence.

## Owner approval and implementation boundary

The owner approved the design direction described above on 2026-11-12. This ADR update does not authorize a broad backend/media implementation. The next task must be narrowly scoped to implementing and verifying the browser session, CSRF, dynamic Origin/Host, and trusted-proxy boundary before those controls are relied on by media intake or other mutating APIs. Any unresolved security behavior discovered during implementation must stop the task for review rather than be guessed.

---

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
