# QFAT-011 — Browser Session, CSRF, and Dynamic Private-Network Origin Protection

- **Status:** GPT-AUTHORED TASK — READY FOR OWNER AUTHORIZATION
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Prerequisite:** Owner-approved design direction in `docs/decisions/ADR-002-local-browser-security-design.md` (2026-11-12)
- **Scope:** Backend browser-session/CSRF foundation and the minimum frontend proxy contract required to validate dynamic LAN/Tailscale origins.
- **Report:** `reports/QFAT-011-browser-session-csrf-security-report.md`

## 1. Objective

Implement and verify the first security foundation for QFAT's private-network web workflow before any media intake or other mutating application API is added.

QFAT must continue to work when a browser opens the frontend using a changing private IPv4 address:

- LAN examples: `http://192.168.0.15:5173`, `http://192.168.100.20:5173`.
- Tailscale example: `http://100.x.y.z:5173` (within `100.64.0.0/10`).
- Same-PC development: `http://127.0.0.1:5173` or `http://localhost:5173` only if the proxy/Host contract explicitly supports it.

Do not hardcode a particular IP or router subnet. Do not add Tailscale SDK/API/CLI/Serve/Funnel integration. Keep the backend bound to `127.0.0.1:3001`; the frontend remains the only network-facing application entrypoint.

## 2. Required reading and current implementation

Read in full:

- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/decisions/ADR-002-local-browser-security-design.md`
- `apps/server/README.md`
- `apps/server/src/index.ts`
- `apps/server/test/health.test.ts`
- `apps/web/vite.config.ts`
- Relevant frontend health/API call sites and existing tests.

Current baseline:

- Fastify backend is in `apps/server`, bound to `127.0.0.1:3001`.
- Vite frontend is in `apps/web`, bound to `0.0.0.0:5173`.
- The current Vite proxy only maps `/api/v1/health` and sets `changeOrigin: true`.
- There are currently no session, cookie, CSRF, or mutating application APIs.

If source differs from this snapshot, report the difference and follow source plus the current ADR; do not guess.

## 3. In scope

### 3.1 Dynamic browser-facing authority validation

Implement a shared, testable validator for the current HTTP private-network MVP:

- Require exactly one valid `Origin` for bootstrap and every state-changing request.
- Require `Host` and verify it represents the same browser-facing authority as `Origin`.
- Require scheme `http` and frontend port `5173`.
- Accept numeric IPv4 literals only for this task:
  - Loopback `127.0.0.0/8` for same-PC access.
  - RFC1918 private ranges `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16` for LAN.
  - Tailscale CGNAT range `100.64.0.0/10`.
- Reject arbitrary DNS names, public IPv4 addresses, malformed/ambiguous authorities, unexpected ports, unexpected schemes, missing or `null` Origin, multiple Origin values, and Origin/Host mismatch.
- Parse and validate IPs/ranges structurally. Do not use fragile string-prefix checks (for example, accepting every address beginning with `100.`).
- IPv6 support is not part of this task. Reject IPv6 authorities explicitly and record this limitation; do not accidentally accept them through a permissive parser.
- Do not trust client-supplied `Forwarded`, `X-Forwarded-Host`, `X-Original-Host`, or custom proxy headers.
- Inspect Vite's actual proxy behavior. Configure it so the backend can validate the original browser-facing Host (likely by preserving Host rather than rewriting it), while still targeting the fixed upstream `http://127.0.0.1:3001`. Verify with an integration test that the backend receives the expected Host and Origin for LAN/Tailscale-style IP literals.
- Keep proxy routing restricted to the intended `/api/v1` API path(s); do not create a general-purpose proxy.

Health endpoint behavior may remain read-only and available for the existing health check. Do not make health checks create sessions.

### 3.2 Server-side session and synchronizer CSRF token

Implement:

- An unpredictable opaque session identifier generated with Node's cryptographic random APIs.
- An unpredictable CSRF token generated independently and bound to that session in server-side memory.
- A host-only cookie; omit the `Domain` attribute.
- Cookie attributes: `HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`.
- Omit the `Secure` attribute because the current LAN/Tailscale MVP uses HTTP. Do not write `Secure=false`.
- Do not return the session ID in JSON, expose it to frontend JavaScript, persist it in localStorage/sessionStorage/IndexedDB, or log it.
- Bootstrap returns only the CSRF token and expiry metadata.
- The frontend keeps the CSRF token in memory only and sends `X-CSRF-Token` on state-changing requests.
- Validate session existence, expiry, and session-bound CSRF token. Use constant-time comparison after safely validating equal-length buffers.
- Expired sessions must be rejected and removed. Session refresh rotates both session ID and CSRF token; session destroy invalidates the server-side session and clears the cookie.
- Use a bounded in-memory session store with expiry cleanup. Process restart may invalidate all sessions; do not add SQLite persistence for sessions.
- Reject duplicate or malformed session-cookie values.
- Do not introduce a generic authenticated API that exposes application data. The only production routes in this task are the security bootstrap/refresh/destroy endpoints and the existing health endpoint.

Suggested route contract (exact method/path may be refined if documented and consistent):

- `POST /api/v1/security/bootstrap`: validate Origin/Host, create session, set cookie, return `csrfToken` and `expiresAt`.
- `POST /api/v1/security/session/refresh`: require current session + CSRF + valid Origin/Host; rotate session and CSRF.
- `POST /api/v1/security/session/destroy`: require current session + CSRF + valid Origin/Host; invalidate session and clear cookie.

Bootstrap is the one endpoint that cannot require an existing CSRF token; it must require strict Origin/Host validation and conservative rate limiting. Do not claim bootstrap is protected by a token that does not yet exist.

### 3.3 Reusable mutation guard

Provide a reusable Fastify preHandler/helper for future mutating API routes:

- Require valid session.
- Require exact dynamic Origin/Host validation.
- Require session-bound `X-CSRF-Token`.
- Fail closed with consistent non-sensitive error responses.
- Do not yet attach it to a fake media route or create placeholder application endpoints. Exercise it through focused unit/integration tests and the real session refresh/destroy routes.

Safe read methods must not mutate state. Document which future routes must use the guard.

### 3.4 Frontend bootstrap client

Add the minimum frontend security client needed to:

- Bootstrap a session when the app starts or when no in-memory CSRF token exists.
- Keep CSRF proof only in module/application memory.
- Attach the proof to state-changing requests through one reusable API helper.
- Handle session expiry/401 by obtaining a fresh bootstrap session once, without an infinite retry loop.
- Never put session IDs or CSRF tokens in browser storage, URL parameters, logs, analytics, or error text.
- Avoid adding a login/account UI; this is a local browser session, not user identity or authentication.

If the existing UI has no mutation workflow yet, the client can be a small tested utility with bootstrap integration only; do not invent visible product flows.

## 4. Explicitly out of scope

- Media upload, multipart media intake, file staging, media library, or SQLite media metadata.
- OAuth, YouTube/Meta credentials, account management, publishing, jobs, queue, SSE, or platform API calls.
- User login, passwords, roles, multi-user authentication, or public hosting.
- HTTPS certificates, TLS termination, router port forwarding, public DNS, or Tailscale integration.
- IPv6 support.
- PWA installation or service-worker changes.
- New telemetry, external network calls, CI/GitHub Actions, or live platform tests.
- Broad refactors or dependency upgrades unrelated to this task.

## 5. Security constraints and known limitations

- Backend must continue listening only on `127.0.0.1:3001`.
- Frontend listens on `0.0.0.0:5173`; this does not mean the backend is exposed.
- No firewall automation and no router port forwarding.
- HTTP on a normal LAN is not encrypted. HttpOnly/CSRF do not protect cookies from an on-path network observer. Tailscale encrypts traffic within its tunnel. Record this limitation clearly; do not claim protection against LAN sniffing.
- Origin/Host checks are not user authentication and do not defend against a malicious process already running on the owner PC.
- A same-origin XSS can use an active session; CSRF is not an XSS defense.
- Browser origin changes between LAN IP and Tailscale IP create separate host-only cookie/session scopes. Do not attempt to transfer sessions between IPs.
- Do not use broad CORS, wildcard origins, arbitrary hostnames, or arbitrary forwarded-host trust.

## 6. Required tests and verification

### Backend automated tests

Cover at minimum:

- Accepted loopback, RFC1918, and Tailscale CGNAT IPv4 origins.
- Rejection of public IPv4, arbitrary DNS names, IPv6, invalid octets, malformed ports, non-HTTP schemes, null/missing/multiple Origin, and Origin/Host mismatch.
- Vite proxy integration preserves the expected browser-facing Host and Origin at the backend.
- Bootstrap sets the exact cookie attributes and returns no session ID.
- Bootstrap rejects invalid origins and rate-limits repeated attempts.
- Valid session + CSRF succeeds on refresh/destroy.
- Missing, wrong, expired, malformed, and duplicate session cookies fail closed.
- Wrong/missing CSRF token fails closed.
- Refresh rotates both session and CSRF values; old credentials no longer work.
- Destroy invalidates the session and clears the cookie.
- Session expiry and process-local store behavior.
- Health endpoint remains read-only and does not create a session.
- Error responses do not disclose tokens, session identifiers, secrets, or internal details.

### Frontend tests

Cover:

- Bootstrap stores CSRF only in memory.
- Mutation helper attaches `X-CSRF-Token`.
- No use of localStorage/sessionStorage/IndexedDB for security values.
- Session-expiry handling performs at most one re-bootstrap retry.
- Failed bootstrap produces a recoverable, non-secret error state.

### Commands and manual verification

- `npm ci` in `apps/server` and `apps/web`.
- `npm test`, `npm run typecheck`, `npm run build` in both workspaces as applicable.
- `npm audit` and `npm audit --omit=dev` in both workspaces; report existing advisories accurately and do not expand scope to unrelated upgrades.
- `git diff --check`.
- Browser manual checks from at least:
  - localhost/127.0.0.1 on the host PC;
  - one LAN IPv4 authority in an RFC1918 range;
  - a Tailscale IPv4 authority in `100.64.0.0/10`, if owner environment is available.
- Confirm backend direct access from a second device remains refused.
- Confirm browser refresh preserves the session while the cookie is valid, and opening another IP origin starts a separate session.
- Record unavailable physical-device checks as NOT RUN; do not claim them from unit tests.

## 7. Acceptance criteria

1. Dynamic LAN and Tailscale IPv4 origins work without hardcoded IPs or router subnets.
2. Arbitrary DNS names, public IPs, malformed origins, and unexpected ports are rejected.
3. Backend remains loopback-only and frontend proxy is narrowly scoped.
4. Session ID exists only in an HttpOnly host-only cookie and server memory.
5. CSRF token is session-bound, returned only at bootstrap, held in frontend memory, and required on mutations.
6. Refresh rotates session and CSRF; destroy invalidates session.
7. Reusable mutation guard is available and tested.
8. Health route remains read-only and unchanged in purpose.
9. No media intake or unrelated product feature is implemented.
10. Required tests/build/typecheck/audits are recorded truthfully.
11. Report is committed and pushed to `main`; agent stops for GPT/owner audit.

## 8. Git and reporting

- Use the mandatory safe synchronization procedure from `docs/AI-DEVELOPMENT-WORKFLOW.md`.
- Preserve local changes; do not reset, clean, stash, rebase, force-push, or overwrite user work.
- Do not create/switch branches.
- Do not create or run CI/GitHub Actions.
- Commit implementation and report on `main`.
- Report path: `reports/QFAT-011-browser-session-csrf-security-report.md`.
- Chat handoff must contain exactly four lines:
  - Branch:
  - Commit message:
  - Full SHA:
  - Report path:
- Stop after publication. GPT performs the independent audit; agent PASS is not owner acceptance.
