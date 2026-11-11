# Task QFAT-005R2 — Security Design Documentation Final Corrections

- **Status:** READY FOR EXECUTION
- **Task type:** Documentation-only correction
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only; do not use Windows
- **Baseline commit:** `037f07c2f8e17388e3563fc9cfa241a2c1eb3cad`
- **Related tasks:** QFAT-005, QFAT-005R
- **Files to correct:**
  - `reports/QFAT-005-local-browser-security-design-report.md`
  - `docs/decisions/ADR-002-local-browser-security-design.md`

## 1. Objective

Resolve the remaining factual, security-model, and consistency issues identified in the independent audit of QFAT-005R. Update the two existing documents in place, preserve their history, and leave ADR-002 **PROPOSED**.

This task is documentation-only. It does not approve the design, implement security controls, or authorize QFAT-006.

## 2. Mandatory source reading

Read:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `tasks/QFAT-005-local-browser-security-design-validation.md`
- `tasks/QFAT-005R-local-browser-security-design-documentation-corrections.md`
- `reports/QFAT-005-local-browser-security-design-report.md`
- `docs/decisions/ADR-002-local-browser-security-design.md`
- `reports/QFAT-002R2-final-audit-correction.md`

The PRD is authoritative. Do not weaken its security requirements. If a source file is unavailable, stop and report it rather than guessing.

## 3. Required corrections

### 3.1 Correct the browser-facing host, cookie, and Vite proxy model

The current documents conflate the browser-facing URL with the upstream backend address.

Document the actual request topology precisely:

- In development, the browser opens the Vite origin `http://localhost:5173` and sends API requests to that same origin (for example, `/api/...`). Vite proxies those requests to `http://127.0.0.1:3001`.
- A `Set-Cookie` response passing through the Vite proxy is associated by the browser with the browser-facing host, `localhost`, not with the upstream backend IP. A host-only cookie therefore belongs to `localhost` in this development topology.
- Explain separately what the browser sends as `Origin`, what `Host` the upstream Fastify server receives, and exactly what Vite's `changeOrigin` setting changes. Do not claim that the backend can infer the original browser Host from a rewritten upstream Host.
- Define a trusted-proxy boundary: the backend may rely on forwarded/original-host metadata only if the proxy strips untrusted incoming copies and sets its own trusted values. If this is not yet designed, do not depend on forwarded headers; specify an explicit, verifiable dev proxy contract and mark implementation details for later validation.
- In production, browser UI and API are same-origin at the exact configured loopback URL. Prefer one canonical host consistently (for example, `127.0.0.1`) and do not casually allow interchangeable hostnames unless the application deliberately supports and validates both.
- Do not treat `localhost` and `127.0.0.1` as the same host or assume their cookies are shared. They are distinct cookie hosts and must be described separately.
- Do not allow LAN binding, arbitrary hostnames, wildcard origins, or arbitrary forwarded-host values.

### 3.2 Make cookie attributes internally consistent and accurate

- The MVP topology is HTTP loopback; HTTPS is not implemented.
- If the proposed MVP uses `Secure=false`, show that consistently in every cookie table, attribute list, pseudocode, response example, and sequence diagram. Do not leave a bare `Secure` attribute in examples.
- Explain the security trade-off of HTTP loopback and the exact scope of the exception. Do not call it a general production-safe cookie configuration.
- Use host-only cookies (omit `Domain`) and identify the exact browser-facing host in each environment.
- Explain `SameSite` based on the browser-facing site/origin, not the upstream proxy target. Do not assert that `localhost` and `127.0.0.1` are the same site.
- Mark all browser/platform behavior not actually tested as **UNVERIFIED**. Do not claim Linux or Windows browser verification unless the referenced task/report contains evidence that it was actually performed.

### 3.3 Reassess CSRF design and cookie-injection resistance

The existing explanation is not sufficient: `SameSite=Strict` does not universally prevent cookie injection, and a naive double-submit cookie can be vulnerable to cookie-tossing/injection scenarios.

- Explicitly compare a synchronizer token bound to the server-side session with double-submit cookie variants.
- Prefer a well-established synchronizer-token design if it is the clearer safe choice for this local SPA: session identifier remains only in an HttpOnly cookie; a CSRF proof is returned to the frontend at bootstrap, held only in JavaScript memory, and validated against server-side session state. Do not put the session identifier in JSON or browser storage.
- If retaining double-submit, use and explain a robust session-bound/signed construction, not merely an unbound equality comparison. Explain the threat model, token binding, cookie injection limits, and validation requirements. Do not claim SameSite alone prevents cookie injection.
- Correct the design comparison table, recommendation rationale, lifecycle, client/server examples, threat analysis, sequence diagram, alternatives, consequences, and decision table to match the selected mechanism exactly.
- Explain that JavaScript-memory CSRF proof is accessible to same-origin script and therefore is not an XSS defense; HttpOnly protects the session cookie, not the entire browser session from XSS.
- Ensure bootstrap, refresh, and destroy flows have coherent CSRF handling. Do not exempt state-changing bootstrap/refresh/destroy requests from appropriate origin/CSRF protections without a justified design.
- Do not claim the proposed controls have been implemented or tested.

### 3.4 Correct multipart and CORS explanations

- A custom request header does not inherently break multipart upload.
- A non-simple custom header can trigger CORS preflight for cross-origin browser requests.
- With same-origin browser requests through Vite's proxy, browser-to-backend CORS preflight is avoided; the proxy forwards the request upstream.
- Explain that multipart boundaries should be generated by the browser/client library; do not manually set an incorrect `Content-Type: multipart/form-data` boundary.
- Ensure the CSRF mechanism applies to state-changing multipart requests too.

### 3.5 Correct Origin, Host, and DNS rebinding claims

- Do not claim that Host validation alone defeats DNS rebinding.
- Do not claim that Origin validation alone is sufficient.
- Explain what each check proves and does not prove in the chosen direct/proxy topology.
- Account for the fact that proxying changes the upstream Host header.
- Specify strict allowlists and reject malformed, missing, null, unexpected-port, and arbitrary-host cases where appropriate.
- If the design cannot reliably validate the original browser-facing authority through the proxy, state the limitation and define the trusted proxy contract or recommend a safer topology.
- Do not treat an attacker-controlled `Host` or `X-Forwarded-Host` as trusted evidence.

### 3.6 Reconcile all counts and decision statuses

Audit every occurrence of recommendation counts and status summaries in both documents.

The current report lists technical recommendations at items 1–7 and 17: that is **8**, not 7. Recalculate all totals from the actual decision table rather than patching one sentence.

Clearly separate:
- PRD requirements already decided,
- Technical recommendations requiring explicit owner approval,
- Implementation parameters requiring owner approval or later implementation validation,
- Unverified platform assumptions,
- Optional items requiring evaluation.

Ensure every summary, conclusion, ADR, and audit note agrees. QFAT-002R2 decision #9 remains a **proposed resolution pending explicit owner approval**. ADR-002 status remains **PROPOSED**.

### 3.7 Correct unsupported verification and conclusion claims

- The prior QFAT-005/QFAT-005R tasks did not execute the 18 application test scenarios.
- Keep all 18 explicitly labelled **specified, not executed**.
- Do not claim Linux browser verification, Windows verification, implementation behavior, or successful runtime security behavior without evidence in the repository.
- Distinguish source/document inspection, design recommendations, `git diff --check`, proposed future tests, and unverified behavior.
- Replace claims such as “all PRD requirements are satisfied” or “design is fully decision-ready” if unresolved approval gates, implementation details, or platform validations remain.
- The report status may remain **PASS WITH FINDINGS** only if the conclusion clearly states the unresolved owner approval and validation gates. Do not represent this documentation correction as security implementation acceptance.

## 4. Deliverables

Update in place only:
1. `reports/QFAT-005-local-browser-security-design-report.md`
2. `docs/decisions/ADR-002-local-browser-security-design.md`

Add a dated post-audit correction section for QFAT-005R2 in both documents, recording the substantive corrections. Preserve earlier audit history; do not erase prior correction notes.

Keep ADR-002 **PROPOSED** and make the owner-approval gate explicit before any implementation.

## 5. Explicit exclusions

- No source-code changes.
- No test, test-matrix, browser, or platform execution.
- No `npm ci`, `npm install`, build, audit, or server commands.
- No Windows execution or claims of Windows validation.
- No CI/GitHub Actions creation or execution.
- No PRD, architecture, task-file, package, or lockfile changes.
- No implementation of session, CSRF, cookies, proxy, Origin/Host, or DNS-rebinding controls.
- Do not create QFAT-006.
- Do not approve ADR-002 on the owner's behalf.
- Do not start UI implementation or any unrelated task.

## 6. Safe repository procedure

1. Verify repository identity and origin is `https://github.com/irfannuralam44-max/qfat.git`.
2. Verify branch is `main`; inspect HEAD and working-tree status.
3. Preserve all existing local changes.
4. Confirm baseline `037f07c2f8e17388e3563fc9cfa241a2c1eb3cad` is reachable.
5. If and only if the working tree is clean and repository state is safe, run `git pull --ff-only origin main`.
6. Stop if dirty, wrong repository/branch/remote, or fast-forward is not possible. Never reset, clean, stash, rebase, or force-push.
7. Use one OpenCode agent serially.
8. Change only the two deliverable documents listed in §4.

## 7. Verification and completion gate

- Run only `git diff --check`.
- Review the complete diff and changed-file list.
- Confirm exactly the two permitted documents changed.
- Confirm no source, test, package, lockfile, PRD, architecture, or task file changed.
- Verify all examples, tables, diagrams, cookie attributes, origins, hosts, and decision counts agree.
- Verify the selected CSRF mechanism is consistently described and does not rely on the false claim that SameSite alone prevents cookie injection.
- Commit and push to `main` only if every scope check passes.
- Do not claim application tests or browser/platform behavior was executed.

## 8. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Agent completion is not owner approval. GPT will independently audit the new commit, report, ADR, and diff from GitHub. The proposed security design remains unapproved until the owner explicitly approves it.
