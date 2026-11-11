# QFAT-005 — Local Browser-to-Backend Security Design Report

- **Status:** PASS WITH FINDINGS
- **Task:** `tasks/QFAT-005-local-browser-security-design-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Baseline commit:** `deac0545fe5e526f421556376e815a2eb9f1a7d8`
- **Date:** 2026-11-11

> Current design statements are in sections 1–9 and the QFAT-005R2 correction below. The earlier QFAT-005R audit note in section 10 is retained as historical record; claims it records are superseded where they conflict with the current design. No security controls have been implemented.

## 1. Executive summary

This report proposes a security design for browser requests to QFAT's loopback backend. The PRD is authoritative: loopback only, no wildcard origins, CSRF protections, and no secrets exposed to browser storage or logs. This proposal is not owner-approved or implementation-ready. ADR-002 remains **PROPOSED**.

The proposal uses an opaque HttpOnly session cookie and a synchronizer token bound to that session in server-side state. Bootstrap returns only the CSRF proof (not the session identifier); the frontend keeps the proof in JavaScript memory and sends it on state-changing requests. Production uses one canonical loopback authority, `http://127.0.0.1:3001`. Development browser requests go to `http://localhost:5173` and Vite proxies them to `http://127.0.0.1:3001` under the explicit contract in §3. Neither `localhost` nor `127.0.0.1` is interchangeable with the other.

## 2. Constraints and evidence boundary

| Item | Current understanding |
|---|---|
| Backend | Fastify, planned loopback binding only; this report does not implement or verify runtime controls |
| Development browser origin | `http://localhost:5173`; API paths use this same origin and Vite proxies upstream |
| Production browser origin | `http://127.0.0.1:3001`; UI and API are same-origin |
| PRD requirements | Loopback only, no wildcard CORS, protect state changes, keep credentials out of frontend, validate browser origin and host context |
| Platform behavior | **UNVERIFIED**; no browser or platform checks are claimed |
| Application test scenarios | 18 specified below; **specified, not executed** by QFAT-005/QFAT-005R |

Loopback limits network reachability; it does not authenticate a local user or make browser requests inherently trusted.

## 3. Request topology and authority checks

### 3.1 Development

1. The browser opens `http://localhost:5173` and sends API requests to that exact origin, such as `POST http://localhost:5173/api/v1/jobs`. The browser's `Origin` on such a request is `http://localhost:5173`.
2. Vite proxies `/api` and `/events` to `http://127.0.0.1:3001`. With `changeOrigin: true`, Vite rewrites the upstream `Host` to `127.0.0.1:3001`. It does not change or prove the browser's original `Origin`, and the backend cannot infer the browser-facing `Host` from the rewritten upstream `Host`.
3. The explicit proxy contract proposed for later implementation is: bind Vite and backend to loopback; proxy only the named paths to the fixed backend URL; preserve the browser `Origin`; set `changeOrigin: true`; remove any client-supplied `Forwarded`, `X-Forwarded-Host`, and `X-Original-Host` headers; do not add or rely on forwarded/original-host metadata. The backend validates the preserved exact `Origin` and exact expected upstream `Host`. Proxy configuration and actual header behavior require implementation validation.
4. The browser associates a proxied `Set-Cookie` response with the browser-facing host, `localhost`. The session cookie is host-only (no `Domain`). It belongs to `localhost`, not `127.0.0.1`.

Because the proxy rewrites Host, the backend's Host check validates the proxy's upstream destination, not the browser-facing authority. The preserved, exact Origin check supplies the browser origin signal. If the proxy cannot guarantee this contract, do not accept forwarded values as a substitute; use a topology where the backend directly receives the browser-facing authority or redesign the proxy boundary before implementation.

### 3.2 Production

The backend serves the UI and API at the canonical URL `http://127.0.0.1:3001`. The browser sends same-origin requests with `Origin: http://127.0.0.1:3001` for state-changing fetches and `Host: 127.0.0.1:3001`. Use host-only cookies (omit `Domain`) associated with `127.0.0.1`. Do not also allow `localhost`, arbitrary names, ports, wildcard origins, LAN binding, or client-controlled forwarded-host values. If support for another authority is deliberately added, it needs its own explicit validation design; cookies for `localhost` and `127.0.0.1` are separate.

### 3.3 Validation limits

Parse and compare exact configured origins and authorities; reject malformed or multiple Origin values, `Origin: null`, missing Origin on state-changing browser requests, unexpected ports, missing or unexpected Host, and arbitrary hostnames. The origin allowlist must be environment-specific. Apply the Origin check to bootstrap, refresh, destroy, and all other state-changing requests; apply the session-bound CSRF proof to refresh, destroy, and all authenticated state-changing routes. A bootstrap creates only a local session and does not perform a user action, but still requires the exact trusted Origin and proxy contract plus rate limiting; it is not an Origin/Host exemption.

Origin validation shows which origin a conforming browser says initiated the request; it is not proof of user identity and can be absent or forged by non-browser clients. Host validation checks the authority received at the server/proxy boundary; behind Vite it identifies the rewritten upstream destination, not the original browser authority. Neither check alone defeats DNS rebinding. Combined strict Origin validation, the fixed loopback bind/destination, and a narrowly trusted proxy boundary reduce the browser attack surface; this proposal makes no claim of universal DNS-rebinding prevention.

Never trust attacker-provided `Host`, `Forwarded`, `X-Forwarded-Host`, or `X-Original-Host`. Only a proxy that strips untrusted copies and sets its own values could establish a trusted forwarded-header boundary; this proposal does not need or rely on one.

## 4. Cookies, session, and CSRF proposal

### 4.1 HTTP loopback cookie scope

The MVP topology is HTTP loopback; HTTPS is not designed or implemented. Proposed cookies therefore use `Secure=false` consistently, with `HttpOnly; SameSite=Strict; Path=/` and no `Domain`. This is a narrowly scoped HTTP-loopback exception, not a generally production-safe cookie configuration. HTTP does not provide transport encryption, and local processes or browser vulnerabilities may observe or interfere with traffic. Keep the listener on loopback, require exact origin/proxy checks and session-bound CSRF proof, and revisit cookie transport before any non-loopback or HTTPS deployment. Do not claim browsers accept or send these cookies identically; behavior is **UNVERIFIED**.

`SameSite` is evaluated in the browser-facing context, not by comparing the Vite upstream address. In development, the browser-facing UI and API both use `http://localhost:5173`, so requests are same-origin there; the proxy hop to `127.0.0.1` is server-side. In production they both use `http://127.0.0.1:3001`. `localhost` and `127.0.0.1` are distinct hosts and must not be described as sharing cookies or necessarily being the same site.

| Cookie | Proposed attributes (every environment) | Browser-facing host |
|---|---|---|
| `qfat_sid` | `HttpOnly; Secure=false; SameSite=Strict; Path=/; Max-Age=1800`; omit `Domain` | `localhost` in dev; `127.0.0.1` in production |

### 4.2 CSRF approaches compared

| Design | Strengths | Risks / trade-offs |
|---|---|---|
| Synchronizer token bound to server-side session | Established pattern; session ID stays in HttpOnly cookie; server compares proof with state bound to that session; no CSRF cookie to inject | Requires server-side token/session state and bootstrap/rotation lifecycle; proof is readable to same-origin JavaScript |
| Naive double-submit cookie | Stateless and simple | Equality of a request token and a cookie is not session binding; cookie tossing/injection can make attacker-chosen values match; SameSite is not a universal cookie-injection defense |
| Signed/session-bound double-submit | Can bind proof to session with a server-verified MAC or equivalent | More cryptographic/key lifecycle complexity; still requires careful cookie scope and validation; no demonstrated benefit over synchronizer state for this local SPA |

**Recommendation:** use the synchronizer-token design. At session creation, generate an unpredictable CSRF proof and bind it to the new server-side session record. Keep the opaque session identifier only in the HttpOnly cookie. Return the CSRF proof and expiry metadata in the bootstrap JSON; retain the proof only in JavaScript memory and send it in `X-CSRF-Token` on state-changing requests. The server resolves the cookie session and compares the supplied proof with the proof bound to that session using constant-time comparison where applicable. Do not issue a CSRF cookie. Cookie injection cannot substitute an attacker-chosen proof because the proof is checked against server-side session state; exact host-only scope and Origin checks are additional controls, not the binding mechanism.

The in-memory proof is accessible to same-origin script. It is not an XSS defense: an XSS payload could use the active session and issue requests. HttpOnly limits direct reading of the session cookie; it does not protect the entire browser session from XSS.

### 4.3 Lifecycle and request protection

- **Bootstrap:** browser sends `POST /api/v1/session/init` with exact allowed Origin. In development, Vite preserves Origin and applies the proxy contract in §3.1. Backend rate-limits bootstrap, creates a server-side session plus bound CSRF proof, sets only `qfat_sid`, and returns `{ "csrfToken": "…", "expiresAt": "…" }`. It never returns the session identifier. The CSRF proof authorizes no application action by itself.
- **Authenticated state change:** browser sends its host-only session cookie automatically and `X-CSRF-Token` from memory. Backend requires valid session, exact Origin, expected Host/proxy contract, and a matching session-bound proof. This includes JSON and multipart upload requests.
- **Refresh:** require the existing valid session, exact Origin, and current CSRF proof. On success rotate session/proof and set the new `qfat_sid`; return only the new CSRF proof and expiry. Exact lifetime and rotation policy remain pending.
- **Destroy:** require exact Origin and the current session-bound CSRF proof; invalidate server-side session and clear `qfat_sid` with matching host-only scope and cookie attributes.
- **Safe reads:** `GET`/`HEAD` do not mutate state and do not require a CSRF proof, but sensitive reads remain session-authorized and origin/host policy must be defined at implementation. Do not use state-changing semantics with safe methods.
- Never store session identifiers or CSRF proofs in localStorage, sessionStorage, URLs, or persistent frontend state.

## 5. Multipart and CORS

A custom `X-CSRF-Token` header does not inherently break multipart encoding. A non-simple custom header can cause CORS preflight for a cross-origin browser request. In the development topology, the browser sends to its same-origin Vite server, so browser-to-backend CORS and preflight are avoided; Vite forwards the request upstream. Production is also same-origin. The backend/proxy must still handle the header and stream correctly. Let the browser/client library generate the multipart boundary; do not manually set `Content-Type: multipart/form-data` without the matching boundary. Apply the same session, Origin, and CSRF checks to state-changing multipart requests.

## 6. Decision table and counts

| # | Decision | Category | Status / action |
|---|---|---|---|
| 1 | Exact browser Origin allowlists by environment | Technical recommendation | Proposed; owner approval |
| 2 | Expected Host checks and explicit trusted-proxy boundary | Technical recommendation | Proposed; owner approval |
| 3 | Session-bound synchronizer CSRF proof | Technical recommendation | Proposed; owner approval |
| 4 | HttpOnly host-only loopback session cookie | Technical recommendation | Proposed; owner approval |
| 5 | Vite same-origin browser requests with fixed proxy contract | Technical recommendation | Proposed; owner approval |
| 6 | Same-origin production at canonical `127.0.0.1` authority | Technical recommendation | Proposed; owner approval |
| 7 | Bootstrap/refresh/destroy lifecycle and rate limit | Technical recommendation | Proposed; owner approval |
| 8 | Apply CSRF proof to JSON and multipart mutations | Technical recommendation | Proposed; owner approval |
| 9 | Session lifetime, proof rotation, grace behavior, rate-limit values | Implementation parameters | Pending owner approval or implementation validation |
| 10 | Trusted proxy header stripping/preservation behavior | Implementation parameter | Pending implementation validation |
| 11 | Error codes/messages and safe-read origin policy | Implementation parameters | Pending implementation validation |
| 12 | Loopback only, no wildcard CORS, protect state changes, keep secrets out of browser | PRD requirements | Decided by PRD |
| 13 | Validate Origin/Host context and fail closed on required security initialization | PRD requirements | Decided by PRD |
| 14 | Browser cookie/SameSite behavior on target platforms | Platform assumptions | **UNVERIFIED** |
| 15 | Actual Vite/Fastify proxy header and cookie behavior | Platform/runtime assumptions | **UNVERIFIED** until implementation validation |
| 16 | Alternative signed double-submit construction | Optional evaluation | Evaluate only if synchronizer state proves unsuitable |

**Canonical counts:** PRD requirements already decided: **2 grouped entries** (items 12–13); technical recommendations requiring owner approval: **8** (items 1–8); implementation parameters requiring approval/validation: **3** (items 9–11); unverified platform/runtime assumptions: **2** (items 14–15); optional evaluation: **1** (item 16). Total decision-table entries: **16**. These are categories of entries, not a claim that every underlying PRD clause is one requirement.

QFAT-002R2 decision #9 is a **proposed resolution pending explicit owner approval**, not resolved or approved. ADR-002 remains **PROPOSED**.

## 7. Threat analysis and boundaries

| Threat | Proposed response | Limit |
|---|---|---|
| Cross-site state-changing request | Exact Origin, session-bound CSRF proof, restrictive SameSite cookie | SameSite alone is not the CSRF mechanism; non-browser clients can forge headers |
| Cookie tossing/injection | No double-submit equality; proof checked against server-side session state; host-only cookie | Same-origin compromise/XSS can use the active session |
| DNS rebinding / Host confusion | Exact Origin allowlist, expected backend Host, fixed loopback binding and explicit proxy contract | Proxy-rewritten Host does not recover browser authority; neither Origin nor Host alone is sufficient |
| Arbitrary forwarded host | Strip incoming forwarded/original-host fields; do not rely on them | A future trusted proxy must establish and validate its own boundary |
| Session theft | HttpOnly session cookie, loopback-only listener, redaction | HTTP loopback is not encrypted and local compromise remains in scope |
| XSS | HttpOnly prevents direct session-cookie reads | CSRF proof exists in JS memory; active XSS can act as the user |

## 8. Test scenarios specified, not executed

The prior QFAT-005/QFAT-005R tasks did not execute these 18 application scenarios. They are future offline test specifications only.

| ID | Scenario | Expected result |
|---|---|---|
| T-01 | Valid development Origin, upstream Host, session and proof; JSON mutation | Accepted |
| T-02 | Valid production Origin/Host, session and proof; JSON mutation | Accepted |
| T-03 | Unlisted Origin | Rejected |
| T-04 | Missing Origin on bootstrap or mutation | Rejected |
| T-05 | `Origin: null` | Rejected |
| T-06 | Malformed or multiple Origin values | Rejected |
| T-07 | Missing or unexpected Host/port | Rejected |
| T-08 | Arbitrary Host or hostname | Rejected |
| T-09 | Client-supplied forwarded-host values | Ignored/stripped at proxy; never trusted |
| T-10 | Missing CSRF proof on mutation | Rejected |
| T-11 | Incorrect proof for valid session | Rejected |
| T-12 | Proof from another session | Rejected |
| T-13 | Expired/invalid session | Rejected |
| T-14 | Refresh without valid Origin or proof | Rejected |
| T-15 | Destroy without valid Origin or proof | Rejected |
| T-16 | Multipart mutation with valid session/proof and browser-generated boundary | Accepted |
| T-17 | Multipart mutation without proof | Rejected |
| T-18 | Bootstrap rate limit and cookie clearing/session invalidation | Rate limited / session invalidated as specified |

Acceptance expectations and exact status codes require implementation design. No application, browser, platform, or runtime test was run for this report.

## 9. Verification, findings, and conclusion

QFAT-005 and QFAT-005R authorized `git diff --check` only; the prior report records that static documentation check, not runtime validation. For QFAT-005R2, `git diff --check` was executed on the Linux PC and passed. The complete diff and changed-file list were reviewed; exactly the two authorized documents changed. No application tests, browser checks, platform checks, builds, npm commands, or server commands are represented as run here. The 18 scenarios remain **specified, not executed**.

The report status is **PASS WITH FINDINGS** as a documentation correction/design proposal only. Owner approval is still required for the eight technical recommendations. Implementation parameters, proxy behavior, and browser/platform behavior require validation. The proposal does not establish that PRD security requirements are implemented or satisfied at runtime, and it is not security implementation acceptance. ADR-002 must remain **PROPOSED** until explicit owner approval. The synchronizer-token recommendation replaces the prior double-submit proposal; the previous proposal must not be implemented as written.

### QFAT-005R2 post-audit correction — 2026-11-11

Corrected browser-facing versus upstream Host/Origin/cookie topology; specified a trusted Vite proxy contract without trusting forwarded host metadata; selected a server-side session-bound synchronizer token after comparing double-submit variants; corrected cookie attributes and SameSite/HTTP loopback limitations; corrected multipart/preflight and boundary guidance; narrowed Origin/Host/DNS-rebinding claims; recalculated the decision table to 8 technical recommendations, 3 implementation parameters, 2 grouped PRD entries, 2 unverified assumptions, and 1 optional evaluation; and marked all application scenarios and browser/platform behavior as unexecuted or unverified. ADR-002 remains **PROPOSED** and requires explicit owner approval before implementation.

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



## References

| Source | Purpose |
|---|---|
| `docs/PRD-QFAT-MVP.md` | Authoritative product/security requirements |
| `docs/ARCHITECTURE-QFAT-MVP.md` | Proposed local browser/backend topology |
| `reports/QFAT-002R2-final-audit-correction.md` | Pending decision #9 and decision categorization |
| QFAT-005 and QFAT-005R task files | Original design and correction scope; neither ran application scenarios |
