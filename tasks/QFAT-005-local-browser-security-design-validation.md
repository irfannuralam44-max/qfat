# Task QFAT-005 — Local Browser-to-Backend Security Design Validation

- **Status:** READY FOR OWNER REVIEW
- **Task type:** Design validation and documentation only
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only (design/source inspection; no Windows execution)
- **Baseline commit:** `deac0545fe5e526f421556376e815a2eb9f1a7d8`
- **Previous implementation stage:** QFAT-004 local Fastify health server
- **Report path:** `reports/QFAT-005-local-browser-security-design-report.md`

## 1. Objective

Define and validate a concrete security design for requests from the local browser UI to the QFAT backend before adding account, media, or publishing API routes.

QFAT is local-first, but loopback binding alone is not a complete security boundary. The design must address browser-origin abuse, DNS rebinding/Host confusion, cross-site request forgery, and safe creation/use of a local browser session without exposing secrets to frontend storage or logs.

This task is **design-only**. It must produce a recommendation and decision-ready trade-offs. It does not authorize implementation or changes to runtime behavior.

## 2. Authoritative constraints

Read and follow:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `reports/QFAT-002R2-final-audit-correction.md` (canonical pending-decision list)
- `apps/server/src/index.ts`
- `apps/server/package.json`

Product/security constraints:
- Backend binds to `127.0.0.1` only; never `0.0.0.0`.
- No platform credentials, session secrets, OAuth codes, or bearer tokens in frontend bundles, localStorage, sessionStorage, URLs, SQLite, ordinary JSON files, or logs.
- No wildcard CORS.
- State-changing requests must be protected against cross-site request forgery.
- Validate Host and Origin; account for DNS rebinding and browser behavior.
- Do not expose arbitrary filesystem paths or shell/process execution.
- Fail closed when required security checks or secret/session initialization cannot be completed.
- Linux and Windows are MVP targets; macOS is out of scope.
- Do not introduce Electron/Tauri or a hosted service.
- Do not relax any PRD requirement to simplify implementation.

## 3. Required analysis

Evaluate at least two viable designs for each relevant choice and recommend one coherent design:

1. **Origin and Host validation**
   - Exact allowed origins in development (Vite) and local production.
   - Expected Host values and handling of unexpected Host headers.
   - Behavior for missing, `null`, malformed, or multiple Origin values.
   - DNS-rebinding considerations and whether checking only `Origin` is sufficient.

2. **CSRF protection**
   - Compare synchronizer token, double-submit cookie, and custom-header approaches.
   - Explain protection for JSON and multipart media-upload requests.
   - Specify which methods/routes require protection and how safe read-only requests are handled.

3. **Local session/bootstrap**
   - Compare HttpOnly SameSite cookie-based session with a narrowly scoped custom-header token approach.
   - Explain how the browser obtains the initial session proof without embedding a reusable secret in the frontend bundle or URL.
   - Define token entropy, lifetime/rotation, scope, storage, and invalidation.
   - State clearly what browser storage is and is not permitted.
   - Avoid inventing a claim that loopback itself authenticates the local user.

4. **Development and production topology**
   - Development: Vite frontend and backend on separate loopback ports with a narrowly configured proxy.
   - Production: backend-served frontend or another same-origin arrangement.
   - Define allowed origins/ports without allowing LAN access or arbitrary origins.

5. **Operational behavior and tests**
   - Startup behavior if secure session initialization fails.
   - Safe logging/redaction requirements.
   - Test matrix for trusted/untrusted Origin and Host, missing/null Origin, CSRF attempts, session expiry/rotation, and multipart upload.
   - Identify tests that can be deterministic and offline.

## 4. Deliverables

1. New report: `reports/QFAT-005-local-browser-security-design-report.md`.
2. A proposed ADR draft under `docs/decisions/` only if the report contains a complete recommendation. Use the next available ADR number after checking the directory; do not overwrite ADR-001.
3. A decision table separating:
   - Existing PRD requirements (already decided; not reopened),
   - Technical recommendation,
   - Owner decision required,
   - Unverified assumptions or platform-specific risks.
4. A concrete proposed request-security flow, preferably a Mermaid sequence diagram or numbered request lifecycle.
5. A test matrix with expected outcomes and no live account/API dependency.

The report must explicitly identify the pending QFAT-002R2 decision about session/CSRF design and state whether this task resolves it or still requires owner approval.

## 5. Explicit exclusions

- No source-code changes.
- No package/dependency changes or installs.
- No database schema or migration changes.
- No OAuth/account connection implementation.
- No media upload endpoint or file handling.
- No publishing/job/queue/SSE implementation.
- No real credentials, live platform API calls, or uploads.
- No frontend implementation.
- No Windows execution or claims of Windows validation.
- No CI/GitHub Actions creation or execution.
- Do not perform `npm ci`, `npm install`, tests, builds, audits, or server commands.
- Do not modify the PRD or architecture proposal in this task.
- Do not begin QFAT-006 or any implementation task.

## 6. Safe repository procedure

1. Verify repository identity and `origin` is `https://github.com/irfannuralam44-max/qfat.git`.
2. Verify branch `main`, HEAD, and working-tree status.
3. Read the authoritative files listed in §2 and inspect the current backend entry point and package configuration.
4. Confirm baseline `deac0545fe5e526f421556376e815a2eb9f1a7d8` is reachable and working tree is clean.
5. If clean and safe, run `git pull --ff-only origin main` before editing. Stop if dirty, wrong branch/remote, or fast-forward is not possible.
6. Use one OpenCode main agent serially; no parallel agents.
7. Keep all changes within the documentation deliverables in §4.

## 7. Verification and completion gate

- Run only `git diff --check`.
- Review complete diff, staged paths, and working-tree status.
- Ensure no source, package, lockfile, test, PRD, or architecture file changed.
- Commit and push to `main` only after scope review.
- Verify the commit and report/ADR files on GitHub.
- Clearly distinguish documented upstream/provider facts, source inspection, recommendations, and unverified assumptions.
- No code implementation is authorized by this task.

## 8. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Agent completion is not owner approval. GPT will independently audit the report and proposed design; implementation begins only after the owner approves the security decision.
