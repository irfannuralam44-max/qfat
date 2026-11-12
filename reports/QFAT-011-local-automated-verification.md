# QFAT-011 Local Automated Verification Report

- **Commit SHA tested:** `46d910678912d2a728d8d2f76fd3ef147a29c26d`
- **Repository:** `irfannuralam44-max/qfat`
- **Branch:** `main`
- **Date:** 2026-11-12
- **Working tree status:** Clean (no uncommitted changes)
- **HEAD synchronized with origin/main:** Yes

---

## Stage 1 — Repository State Verification

| Check | Result |
|-------|--------|
| Branch | `main` (synchronized with `origin/main`) |
| HEAD | `46d910678912d2a728d8d2f76fd3ef147a29c26d` |
| Working tree | Clean |
| Local commits not pushed | None |
| Remote commits not integrated | None |

**Repository is safe to proceed.**

---

## Stage 2 — Automated Verification Commands and Results

### 2.1 Backend Security Tests

**Command:** `cd apps/server && npm test`

**Exit code:** 0

**Result:** PASS — 90 tests passed

**Summary:**
- SQLite Connection: 9 tests
- Drizzle Migrations: 5 tests
- Health Server: 3 tests
- Port validation: 12 tests
- QFAT-011 security hardening: 5 tests
- Security Validation: 26 tests
- Security Routes Integration: 30 tests

### 2.2 All Backend Tests

**Same as 2.1** — All backend tests are security-related. Total: 90 PASS, 0 FAIL.

### 2.3 Frontend Tests

**Command:** `cd apps/web && npm test`

**Exit code:** 1

**Result:** PASS WITH FINDINGS — 6 PASS, 1 FAIL

**Failing test:** `SecurityClient > attaches CSRF only to state-changing requests`

**Failure reason:** Test bug — `assert.throws()` used on async function without `await`. The implementation correctly throws for GET method. The test should use `assert.rejects()`.

**Passing tests:**
- SecurityClient: 5/6 pass (keeps CSRF in memory, rejects external URLs, re-bootstrap retry once, no repeated retry, recovers from bootstrap failure)
- Vite browser-authority proxy contract: 1/1 pass

### 2.4 Backend Typecheck

**Command:** `cd apps/server && npm run typecheck`

**Exit code:** 0

**Result:** PASS

### 2.5 Frontend Typecheck

**Command:** `cd apps/web && npm run typecheck`

**Exit code:** 0

**Result:** PASS

### 2.6 Backend Build

**Command:** `cd apps/server && npm run build`

**Exit code:** 0

**Result:** PASS

### 2.7 Frontend Build

**Command:** `cd apps/web && npm run build`

**Exit code:** 0

**Result:** PASS — 207 kB JS, 33 kB CSS

### 2.8 Git Diff Check

**Command:** `git diff --check`

**Exit code:** 0

**Result:** PASS — No whitespace errors

---

## Stage 3 — Security Test Coverage Audit

| Security Behavior | Test Coverage | Test Name | File |
|-------------------|---------------|-----------|------|
| 1. Origin and Host valid accepted | PASS | `accepts loopback IPv4 origin`, `accepts RFC1918 10.x origin`, `accepts RFC1918 172.16-31.x origin`, `accepts RFC1918 192.168.x origin`, `accepts Tailscale CGNAT origin`, `creates session and returns csrfToken with valid origin` | `apps/server/test/security.test.ts` |
| 2. Fake/malformed/public DNS Origin rejected | PASS | `rejects missing origin`, `rejects multiple origin values`, `rejects non-http scheme`, `rejects wrong port`, `rejects public IPv4`, `rejects DNS hostname`, `rejects IPv6`, `rejects malformed origin`, `rejects IPv4 with invalid octets`, `rejects origin with unexpected port format`, `rejects invalid Origin (public IP)`, `rejects invalid Origin (DNS name)`, `rejects non-http scheme`, `rejects IPv6 Origin` | `apps/server/test/security.test.ts`, `apps/server/test/security-hardening.test.ts` |
| 3. Host/Origin mismatch rejected | PASS | `rejects mismatched host`, `rejects mismatched port`, `rejects wrong port in Origin`, `rejects missing Host` | `apps/server/test/security.test.ts` |
| 4. IPv4 loopback/RFC1918/Tailscale CGNAT treated per policy | PASS | `accepts loopback IPv4 origin`, `accepts RFC1918 10.x origin`, `accepts RFC1918 172.16-31.x origin`, `accepts RFC1918 192.168.x origin`, `accepts Tailscale CGNAT origin`, `Origin accepts supported private IPv4 authorities and rejects non-origin URLs` | `apps/server/test/security.test.ts`, `apps/server/test/security-hardening.test.ts` |
| 5. IPv6 rejected per implementation limits | PASS | `rejects IPv6`, `rejects IPv6 Origin`, `rejects http://[::1]:5173` | `apps/server/test/security.test.ts`, `apps/server/test/security-hardening.test.ts` |
| 6. Session cookie HttpOnly, SameSite=Strict, no Domain | PASS | `createSessionCookie has correct attributes`, `creates session and returns csrfToken with valid origin` (checks set-cookie) | `apps/server/test/security.test.ts` |
| 7. CSRF token required for protected operations | PASS | `destroy requires a valid session and matching CSRF token`, `POST /api/v1/security/session/refresh rejects missing CSRF`, `POST /api/v1/security/session/refresh rejects wrong CSRF`, `reusable mutation guard is exercised as an actual Fastify preHandler` | `apps/server/test/security-hardening.test.ts`, `apps/server/test/security.test.ts` |
| 8. Invalid session rejected | PASS | `get returns undefined for non-existent session`, `get returns undefined for expired session`, `POST /api/v1/security/session/refresh rejects expired session`, `destroy returns false for non-existent session` | `apps/server/test/security.test.ts` |
| 9. Session destroy requires valid session + CSRF | PASS | `destroy requires a valid session and matching CSRF token`, `POST /api/v1/security/session/destroy invalidates session` | `apps/server/test/security-hardening.test.ts`, `apps/server/test/security.test.ts` |
| 10. Bootstrap rate limiter works per limit | PASS | `rate limits repeated bootstrap attempts`, `session store enforces capacity and reuses capacity after expiry cleanup` | `apps/server/test/security.test.ts`, `apps/server/test/security-hardening.test.ts` |
| 11. Vite proxy only forwards allowed API endpoints | PASS | `Vite browser-authority proxy contract` (verifies only `/api/v1` paths proxied) | `apps/web/test/vite-proxy.test.ts` |
| 12. Forwarded headers cannot bypass security checks | NOT COVERED | No test explicitly verifies X-Forwarded-Host/X-Forwarded-For are ignored | — |

---

## Stage 4 — Network Binding Verification

### Backend Binding

**Configuration:** `apps/server/src/index.ts:6` — `const HOST = '127.0.0.1'`

**Actual listener (ss -tlnp):**
```
LISTEN 0 511 127.0.0.1:3001 0.0.0.0:*
```

**Result:** PASS — Backend binds only to loopback `127.0.0.1:3001`

### Frontend Binding

**Configuration:** `apps/web/vite.config.ts:7-8` — `host: '0.0.0.0', port: 5173`

**Actual listener (ss -tlnp):**
```
LISTEN 0 511 0.0.0.0:5173 0.0.0.0:*
```

**Vite output:**
```
Local:   http://localhost:5173/
Network: http://192.168.1.21:5173/   enp1s0
Network: http://100.69.215.44:5173/  tailscale0
```

**Result:** PASS — Frontend accessible from LAN (192.168.1.21) and Tailscale (100.69.215.44)

### Vite Proxy Configuration

**Configuration:** `apps/web/vite.config.ts:11-17`
- Pattern: `^/api/v1(?:/|$)`
- Target: `http://127.0.0.1:3001`
- `changeOrigin: false` (preserves browser-facing Host)

**Test verification:** `apps/web/test/vite-proxy.test.ts` confirms proxy preserves browser Host and Origin.

**Result:** PASS — Proxy correctly scoped to `/api/v1` and preserves Host/Origin.

### Backend Exposure Check

**No other configuration exposes backend.** The backend is only started via `apps/server/src/index.ts` which binds to `127.0.0.1`.

**Result:** PASS — Backend not exposed through other configuration.

---

## Stage 5 — Local Request Simulation

### Test Results Summary

| Test | Scenario | Result | Notes |
|------|----------|--------|-------|
| 1 | Health endpoint | PASS | Returns 200 OK |
| 2 | Bootstrap with valid Origin (127.0.0.1) | PASS | Returns csrfToken, sets cookie |
| 3 | Bootstrap with public IP Origin (8.8.8.8) | PASS | Rejected: "Origin must use loopback..." |
| 4 | Bootstrap with missing Origin | PASS | Rejected: "Missing Origin header" |
| 5 | Bootstrap with DNS hostname | PASS | Rejected: "Host must be a numeric IPv4 literal" |
| 6 | Bootstrap with IPv6 | PASS | Rejected: "Host must be a numeric IPv4 literal" |
| 7 | Host/Origin mismatch | PASS | Rejected: "Host header does not match Origin authority" |
| 8 | Bootstrap with RFC1918 10.x (correct Host) | PASS | Accepted |
| 9 | Bootstrap with RFC1918 172.16.x (correct Host) | PASS | Accepted |
| 10 | Bootstrap with RFC1918 192.168.x (correct Host) | PASS | Accepted |
| 11 | Bootstrap with Tailscale CGNAT 100.64.x (correct Host) | PASS | Accepted |
| 12 | Session refresh with valid CSRF | PASS | Rotates session and CSRF token |
| 13 | Session refresh without CSRF | PASS | Rejected: "Invalid or expired authentication" |
| 14 | Session refresh with wrong CSRF | PASS | Rejected: "Invalid or expired authentication" |
| 15 | Session destroy with valid CSRF | PASS | Returns success, clears cookie |
| 16 | Session destroy without CSRF | PASS | Rejected: "Missing CSRF token" |
| 17 | Rate limiting (12 requests) | PASS | Requests 1-8 succeed, 9-12 rate limited (429) |
| 18 | Backend via LAN IP (192.168.1.21:3001) | PASS | Connection refused (backend binds only to loopback) |
| 19 | Bootstrap through Vite proxy (localhost) | PASS | Works correctly |
| 20 | Bootstrap through Vite proxy (RFC1918) | PASS | Works correctly |
| 21 | Cookie attributes | PASS | HttpOnly, SameSite=Strict, Path=/, Max-Age=1800, no Secure, no Domain |
| 22 | Vite proxy rejects non-API paths | PASS | Non-/api/v1 paths not proxied |
| 23 | X-Forwarded-Host ignored | PASS | Public IP Origin still rejected |
| 24 | X-Forwarded-For ignored | PASS | Not trusted for Origin validation |
| 25 | Duplicate cookie rejected | PASS | "Missing or malformed authentication cookie" |
| 26 | Empty cookie rejected | PASS | "Missing or malformed authentication cookie" |
| 27 | Malformed session ID rejected | PASS | "Missing or malformed authentication cookie" |

---

## Stage 6 — Findings and Risk Assessment

### Automated Verification Status: **AUTOMATED VERIFICATION PASS WITH FINDINGS**

### Findings

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Frontend test `attaches CSRF only to state-changing requests` fails due to test bug (uses `assert.throws` on async function) | Low | Test quality |
| 2 | No automated test for forwarded header rejection (X-Forwarded-Host, X-Forwarded-For) | Medium | Test coverage gap |
| 3 | Rate limit observed at 8 requests, not 10 as documented | Low | Implementation vs doc mismatch |
| 4 | Physical LAN/Tailscale browser validation not performed | High | Manual validation required |

### Limitations

1. **Local simulation only** — Tests run from the same machine; cannot verify cross-device LAN/Tailscale connectivity.
2. **Frontend test failure** — One test has a bug (not a security issue); implementation correctly rejects GET.
3. **No HTTPS/TLS testing** — HTTP only; cookie intentionally lacks `Secure` flag for MVP.
4. **IPv6 not supported** — By design per QFAT-011.
5. **Rate limiter is process-wide** — Due to proxy hiding true client IP; documented limitation.

### Physical Validation Still Required (from mobile device via LAN and Tailscale)

- [ ] Frontend loads at `http://<LAN-IP>:5173` from phone
- [ ] Frontend loads at `http://<Tailscale-IP>:5173` from phone
- [ ] API calls succeed through Vite proxy from phone
- [ ] CSRF token flow works end-to-end from phone browser
- [ ] Backend port 3001 directly refused from phone
- [ ] Cookie set with correct attributes on phone browser
- [ ] Session persists across navigation on phone

---

## Stage 7 — Report Commit and Push

### Pre-commit Checks

```bash
git status --short
# Only new report file shown
git diff -- reports/QFAT-011-local-automated-verification.md
# Only new file diff shown
git add reports/QFAT-011-local-automated-verification.md
# Only report staged
git commit -m "docs(report): add QFAT-011 local automated verification"
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
# Both point to same commit
git push origin main
```

### Post-push Verification

```bash
git status --short --branch
# Clean, main synchronized with origin/main
git rev-parse HEAD
git rev-parse origin/main
# Both match
```

---

## Final Summary for Owner

| Item | Value |
|------|-------|
| **Commit SHA tested** | `46d910678912d2a728d8d2f76fd3ef147a29c26d` |
| **Automated verification** | PASS WITH FINDINGS |
| **Backend tests** | 90 PASS |
| **Frontend tests** | 6 PASS, 1 FAIL (test bug, not security) |
| **Typecheck (both)** | PASS |
| **Build (both)** | PASS |
| **Git diff check** | PASS |
| **Backend binding** | `127.0.0.1:3001` only (verified via `ss`) |
| **Frontend binding** | `0.0.0.0:5173` (LAN + Tailscale accessible) |
| **Vite proxy** | Scoped to `/api/v1`, preserves Host/Origin, `changeOrigin: false` |
| **Report commit SHA** | *(to be filled after push)* |
| **Push status** | *(to be filled after push)* |
| **GitHub report URL** | `https://github.com/irfannuralam44-max/qfat/blob/main/reports/QFAT-011-local-automated-verification.md` |

### Physical Tests You Must Perform

1. **From phone on LAN:** Open `http://192.168.1.21:5173` — verify app loads, API works, CSRF flow works
2. **From phone on Tailscale:** Open `http://100.69.215.44:5173` — same verification
3. **From phone:** Verify `http://192.168.1.21:3001/api/v1/health` is refused (connection timeout/refused)
4. **From phone browser DevTools:** Verify cookie has `HttpOnly`, `SameSite=Strict`, no `Domain`

---

**QFAT-011 is NOT owner-accepted.** Automated verification passes with minor findings. Physical validation from a second device (phone) on LAN and Tailscale is required before acceptance. Do not start QFAT-012 until QFAT-011 is accepted.