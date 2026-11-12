# Implementation and Remediation Report — QFAT-011

- **Status:** REMEDIATION COMMITTED — OWNER VALIDATION PENDING
- **Task specification:** `tasks/QFAT-011-browser-session-csrf-security.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Original implementation:** `b3a1ad686afc54d0dea8f0816ba73a2ed16a9153`
- **Remediation source commits:** see Git Publication below

## Summary

QFAT-011's original implementation was independently reviewed after publication. The review found gaps in bounded resource use, duplicate-cookie handling, destroy-route enforcement, strict Origin parsing, mutation-guard evidence, frontend client behavior, and proxy-path matching.

Those source and test gaps have now been corrected directly on `main`. This report intentionally does **not** mark QFAT-011 accepted: the newly added tests and builds have not yet been executed in the owner's local environment, and the physical LAN/Tailscale checks remain outstanding.

## Remediation applied

### Backend session and authority handling

1. **Bounded session store**
   - Added a hard capacity of 10,000 active sessions.
   - Expired sessions are cleaned before allocation and by the existing periodic cleanup.
   - A full store rejects new bootstrap with HTTP 503 rather than growing without bound or evicting a live session.
   - Session rotation frees the previous slot before allocating the replacement.

2. **Strict Origin and Host parsing**
   - Accepts only canonical serialized HTTP origins with no credentials, path, query, or fragment.
   - Requires numeric IPv4 literals in loopback, RFC1918, or Tailscale CGNAT ranges and port 5173.
   - Rejects non-canonical IPv4 forms, malformed/leading-zero ports, public IPs, DNS names, IPv6, null/multiple Origin values, and Host mismatches.
   - Header access fails closed when a header is represented as multiple values.
   - No forwarded-host or forwarded-client-IP header is trusted.

3. **Cookie handling**
   - Session cookie parser requires exactly one `qfat_session` cookie.
   - Duplicate, empty, and malformed session values are rejected.
   - The expected generated 32-byte base64url session identifier format is enforced.

4. **Destroy and mutation guard**
   - Destroy now requires a valid session and matching CSRF token. Missing/invalid session or CSRF returns HTTP 401 and does not report success.
   - The reusable mutation guard uses the same strict validation path and reports consistent authentication failures.
   - Added an integration test that mounts the guard as an actual Fastify `preHandler`.

5. **Bounded bootstrap rate limiter**
   - Replaced the attacker-growable per-key map with a single fixed-window process-local counter (10 valid bootstrap attempts per minute).
   - This is deliberately process-wide because the backend only sees the local Vite proxy as its TCP peer. The implementation does not trust spoofable forwarded client-IP headers.
   - Origin validation runs before consuming an attempt.

### Frontend client and proxy

1. **Frontend CSRF client**
   - Validates bootstrap response shape before storing the CSRF proof.
   - Keeps the proof in module memory only.
   - Uses the standard `Headers` API so caller-supplied header forms are handled safely.
   - Restricts the CSRF helper to state-changing methods (POST, PUT, PATCH, DELETE); GET uses a read-only helper and does not attach CSRF.
   - A 401 causes at most one fresh bootstrap and one retry. A second failure is returned to the caller.
   - Bootstrap failure clears in-memory state and surfaces a recoverable error.

2. **Vite proxy**
   - API proxy now matches only `/api/v1` and its path descendants using `^/api/v1(?:/|$)`.
   - `changeOrigin: false` preserves the browser-facing Host; no forwarded header is used as a substitute.
   - Upstream remains fixed at `127.0.0.1:3001`; frontend remains bound to `0.0.0.0:5173`.

## Added regression tests

- **Backend:** `apps/server/test/security-hardening.test.ts`
  - canonical Origin acceptance/rejection;
  - duplicate and malformed cookie rejection;
  - bounded session capacity and expiry cleanup;
  - destroy rejection for missing/wrong CSRF and duplicate cookies, plus valid destroy;
  - real Fastify mutation-guard preHandler acceptance/rejection.
- **Frontend:** `apps/web/test/security-client.test.ts`
  - in-memory-only token handling and static no-storage check;
  - CSRF header on mutations and rejection of GET by mutation helper;
  - exactly one re-bootstrap retry;
  - no repeated retry after second 401;
  - recoverable bootstrap failure and state clearing.
- **Proxy:** `apps/web/test/vite-proxy.test.ts`
  - boots the configured Vite proxy against a local echo server and verifies the backend receives the original browser-facing Host and Origin.
- Added `npm test` to `apps/web/package.json` using Node's built-in test runner and the supported Node 22.12+ TypeScript strip-types flag.
- Updated the existing cookie parser fixture to use a correctly generated session identifier.

## Verification status

| Check | Status | Notes |
|---|---|---|
| Source-level review of remediation | COMPLETE | Changes inspected through GitHub source |
| Backend regression tests | ADDED — NOT RUN HERE | Run `npm test` in `apps/server` |
| Frontend client and Vite proxy tests | ADDED — NOT RUN HERE | Run `npm test` in `apps/web` |
| Server typecheck/build | NOT RUN HERE | Run `npm run typecheck` and `npm run build` in `apps/server` |
| Web typecheck/build | NOT RUN HERE | Run `npm run typecheck` and `npm run build` in `apps/web` |
| Dependency audits | NOT RE-RUN | Existing report findings remain: 4 moderate dev-only esbuild findings in server toolchain and 2 moderate React Router findings in web |
| `git diff --check` | NOT RUN HERE | GitHub file updates were used; run locally after syncing |
| Physical LAN/Tailscale browser checks | NOT RUN | Requires owner's second device/network |
| Backend direct port 3001 from second device | NOT RUN | Must remain refused |

Do not treat added tests as passing until they have been executed. Existing advisory findings are unchanged and were not expanded into unrelated dependency upgrades.

## Known limitations

- IPv6 remains unsupported by this task.
- HTTP on a normal LAN is unencrypted; the cookie intentionally omits `Secure` for the HTTP MVP. Tailscale encrypts traffic within its tunnel.
- Origin/Host and CSRF checks are not user authentication and do not protect against same-origin XSS, a malicious local process, or an on-path LAN observer.
- Sessions remain in memory and are invalidated by backend restart.
- Bootstrap rate limiting is process-wide because the proxy hides the true remote TCP peer; no forwarded client identity is trusted.
- Browser access via LAN/Tailscale remains distinct from PWA/HTTPS support.

## Git publication

All remediation updates were committed directly to `main` through sequential GitHub contents commits. Relevant commits:

- `777226ce7a3e5f6e28b35052450d4afb74715ae0` — bound sessions and hardened Origin/cookie parsing.
- `fbaa2d3fbcb6941c425b0b464bb603d3ae9768e6` — enforced session/CSRF on destroy and bounded rate limiting.
- `b0cf94881bb62218a460fc2598934790c7e7b2c6` — hardened frontend in-memory CSRF client and one-retry behavior.
- `26fe6079b66f42f8adc33b2416c80f175c283fbd` — backend security regression tests.
- `debedec0a5fcee0947a8b882e5a0104632f94543` — exported bounded session store for tests.
- `997d799e46769db10ab8f4d9ea14c8769bac841d` — frontend client tests.
- `5af6bda6f171cce2db6196d7de37afcc4174bf94` — frontend test script.
- `c3e3d9457fc80b39ecc34223bf8ff5744e9d25be` — secure session-cookie test fixture.
- `a1fc4c7561ab0cf481053be8eea70155d3e613f7` — narrowly scoped proxy path and Host preservation.
- `c238853d4dcaca8ca5dae5a1ec79351b7614d30f` — Vite proxy integration test.

**Current source/report state:** remediation is published on `main`; this report update is the final documentation change in this remediation pass. Owner execution and physical checks are still required before QFAT-011 can be accepted.

## Handoff

QFAT-011 is **not yet owner-accepted**. Sync `main`, execute the listed test/typecheck/build commands, then perform the available LAN and Tailscale browser checks. Report any failures for a focused follow-up; do not start QFAT-012 until QFAT-011 is accepted.
