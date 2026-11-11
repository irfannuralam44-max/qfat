# Task QFAT-005R — Local Browser Security Design Documentation Corrections

- **Status:** READY FOR EXECUTION
- **Task type:** Documentation-only correction
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only; do not use Windows
- **Baseline commit:** `4fa4deb45387fa097769b205ede58e0e8d84f072`
- **Related task:** QFAT-005
- **Files to correct:**
  - `reports/QFAT-005-local-browser-security-design-report.md`
  - `docs/decisions/ADR-002-local-browser-security-design.md`

## 1. Objective

Correct the security-design inconsistencies and unsupported verification claims found during the independent audit of QFAT-005. Preserve the original report and ADR history through normal Git commits; update the two existing documents in place. This task does not authorize implementation or owner approval of the proposed security design.

## 2. Mandatory source reading

Read:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `tasks/QFAT-005-local-browser-security-design-validation.md`
- `reports/QFAT-005-local-browser-security-design-report.md`
- `docs/decisions/ADR-002-local-browser-security-design.md`
- `reports/QFAT-002R2-final-audit-correction.md`

The PRD is authoritative. Do not weaken or reinterpret its security requirements.

## 3. Required corrections

### 3.1 Resolve the CSRF cookie contradiction

The current documents incorrectly describe an `HttpOnly` CSRF cookie as readable by frontend JavaScript.

Choose and document one technically coherent approach. The proposed approach may use:
- An `HttpOnly` CSRF cookie set by the backend.
- A separate CSRF token value returned by the bootstrap response and retained only in JavaScript memory.
- The frontend sends that value in `X-CSRF-Token` for every state-changing request.
- The backend compares the header value with the CSRF cookie value using a constant-time comparison where applicable.

Explain precisely how the response token is bound to the cookie/session and why an attacker-controlled cookie cannot be used to forge a valid request. If this cannot be justified safely, compare and recommend a better established CSRF pattern instead. Do not claim that HttpOnly cookies are readable by JavaScript.

### 3.2 Keep the session secret out of the response

The session identifier is an authentication secret. Do not return `sessionId`, the raw session identifier, or any equivalent reusable session secret in JSON or frontend-visible data.

The backend should set the session cookie with `HttpOnly`; the browser sends it automatically. The frontend must not read or store the session identifier. The bootstrap response may return non-secret metadata and the separately designed CSRF proof only.

### 3.3 Make cookie and origin topology internally consistent

Define one consistent development and production model:
- Development frontend uses the Vite proxy; browser-facing API calls use the Vite origin.
- The backend validates the browser-facing `Origin` and the actual backend `Host` according to the proxy topology. Explain how proxy forwarding affects these headers and avoid assuming `changeOrigin` proves the browser origin.
- Production frontend and API are same-origin through the local backend.
- Specify cookie `Domain` behavior. Prefer host-only cookies (omit the `Domain` attribute) unless there is a demonstrated need otherwise.
- Specify `Secure` behavior accurately for the actual HTTP loopback deployment. Do not state that production is HTTPS unless HTTPS is actually designed and implemented. Explain the development-only exception and the risk/mitigation.
- Do not allow LAN binding or arbitrary hostnames/origins.

Mark browser-specific behavior, especially Windows Chrome/Edge behavior, as unverified until actually tested. Do not invent test results.

### 3.4 Correct verification claims

The QFAT-005 task authorized only `git diff --check`. It did not authorize running the proposed 18 application tests.

Every claim that all 18 tests passed must be corrected to say that 18 test scenarios were **specified but not executed**. Likewise distinguish:
- Source inspection,
- Design recommendation,
- Static documentation check actually reported by the agent,
- Tests proposed for a future implementation task,
- Platform behavior not verified.

Do not claim that the CSRF/session implementation works; no implementation exists in this task.

### 3.5 Reconcile decision counts and approval status

Recalculate every summary, table, and conclusion so counts agree. Clearly distinguish:
- PRD requirements already decided (not awaiting owner approval),
- Proposed technical design choices requiring owner approval,
- Numeric/operational implementation parameters requiring owner approval or later implementation validation,
- Unverified platform assumptions.

Do not say that QFAT-002R2 decision #9 is fully resolved or approved. State that QFAT-005 provides a proposed resolution, pending explicit owner approval. Keep ADR-002 status **PROPOSED**.

The report must not label the design fully decision-ready while material contradictions remain.

### 3.6 Fix other factual and wording inconsistencies

Review both documents for:
- Incorrect statement that the frontend reads an HttpOnly cookie.
- Session ID or other reusable secret appearing in response examples.
- Incorrect claim that custom headers inherently break multipart uploads. A custom header can cause CORS preflight in cross-origin setups; explain that the Vite proxy avoids browser-to-backend cross-origin access, and assess multipart handling accurately.
- Incorrect claim that an HttpOnly double-submit cookie is directly readable by the SPA.
- Incorrect or contradictory cookie `Secure`, `Domain`, SameSite, host, origin, or port values.
- Unsupported assertions that Host validation alone defeats DNS rebinding. Explain the combined trust checks and limits.
- Incorrectly treating a list of test cases as executed tests.
- Any unsupported assertion of Windows validation.

## 4. Deliverables

Update in place:
1. `reports/QFAT-005-local-browser-security-design-report.md`
2. `docs/decisions/ADR-002-local-browser-security-design.md`

Add a dated post-audit correction section to the report that briefly records the issues corrected. Keep the ADR's status as **PROPOSED** and include an explicit owner-approval gate before any implementation.

Do not create a new ADR number and do not modify the PRD or architecture document.

## 5. Explicit exclusions

- No source-code changes.
- No package, dependency, or lockfile changes.
- No test or test-matrix execution.
- No `npm ci`, `npm install`, build, audit, or server commands.
- No Windows execution or claims of Windows validation.
- No CI/GitHub Actions creation or execution.
- No credentials, OAuth, account connection, media upload, publishing, database, or frontend implementation.
- Do not create QFAT-006.
- Do not approve ADR-002 on the owner's behalf.
- Do not modify the PRD or architecture.

## 6. Safe repository procedure

1. Verify repository identity and origin is `https://github.com/irfannuralam44-max/qfat.git`.
2. Verify branch is `main`; inspect HEAD and working-tree status.
3. Preserve all existing local changes.
4. Confirm baseline `4fa4deb45387fa097769b205ede58e0e8d84f072` is reachable.
5. If and only if working tree is clean and repository state is safe, run `git pull --ff-only origin main`.
6. Stop if dirty, wrong repository/branch/remote, or fast-forward is not possible. Never reset, clean, stash, rebase, or force-push.
7. Use one OpenCode agent serially.
8. Change only the two deliverable documents listed in §4.

## 7. Verification and completion gate

- Run only `git diff --check`.
- Review the complete diff and changed-file list.
- Confirm exactly the two permitted documents changed.
- Confirm no source, test, package, lockfile, PRD, architecture, or task file changed.
- Check all decision counts and approval statements for consistency.
- Commit and push to `main` only if every scope check passes.
- Do not claim application tests or browser/platform behavior was executed.

## 8. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Agent completion is not owner approval. GPT will independently audit the new commit, report, ADR, and diff from GitHub. The proposed security design remains unapproved until the owner explicitly approves it.
