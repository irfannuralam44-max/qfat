# Task QFAT-002 — Validate Local Web MVP Architecture

- **Status:** READY FOR READ-ONLY TECHNICAL VALIDATION
- **Task type:** Architecture validation / decision report only
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Product requirements:** `docs/PRD-QFAT-MVP.md`
- **Architecture proposal:** `docs/ARCHITECTURE-QFAT-MVP.md`
- **Expected report:** `reports/QFAT-002-architecture-validation.md`

## 1. Objective

Validate the proposed local-first web architecture for the QFAT MVP against the actual repository baseline, supported Linux and Windows environments, current provider requirements, and maintainability constraints. Produce a decision report with recommended technical choices and any blockers.

This is a read-only architecture task. Do not implement the web application, install dependencies, refactor source, create a database, add credentials, authorize accounts, or perform live uploads.

## 2. Product decisions already made

Treat the following as approved product direction; do not reopen them as unresolved product choices:

- MVP is a local-first web application, not Electron, Tauri, or hosted SaaS.
- Frontend foundation: React + Vite + TypeScript + Tailwind CSS 3.4 + React Router 6, based on FATTECH 2.0.
- QFAT has its own product identity; do not copy FATTECH branding wholesale.
- Backend is a separate Node.js >=20 + TypeScript process.
- SQLite is the intended local persistence technology.
- Publishing is immediate after explicit user confirmation; scheduling is out of MVP.
- Support multiple YouTube channels and Facebook Pages without arbitrary account limits.
- Support YouTube video/Shorts, Facebook Page video/Reels, and Facebook single-image posts.
- Facebook albums are post-MVP.
- CSV import and AI metadata generation are out of MVP scope.
- Use Spoolcast as an adapter/protocol baseline, not as the final UI or application architecture.
- Preserve upstream MIT license and attribution.
- No live upload is permitted in this task.

If repository guidance conflicts with these decisions, document the exact conflict and recommend a scoped documentation correction; do not silently change project files beyond the assigned report.

## 3. Required inspection

1. Synchronize safely with `main` following `docs/AI-DEVELOPMENT-WORKFLOW.md`.
2. Read this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `README.md`, `CLAUDE.md`, `UPSTREAM.md`, the PRD, and architecture proposal.
3. Inspect the repository tree and relevant source modules, package metadata, TypeScript config, ignore rules, and existing scripts/tests.
4. Identify existing Spoolcast modules that can be reused/adapted and those requiring redesign.
5. Do not assume the PRD or architecture proposal is already implemented.

## 4. Required technical investigations

### A. Backend HTTP framework and process model
- Compare Fastify with Node built-in HTTP for the MVP's API, multipart streaming, SSE, validation, and security needs.
- Recommend one and justify dependency/maintenance impact.
- Define development and local-production process startup and shutdown behavior.

### B. SQLite and migrations
- Compare practical Node SQLite options for Linux and Windows, including native addon/prebuilt binary implications, Node version compatibility, durability, and migration support.
- Recommend a minimal library and migration approach.
- No installation or benchmark is required.

### C. Credential storage
- Evaluate secure credential storage for Linux and Windows with current package maintenance and native dependency implications.
- Address Linux environments without Secret Service/keyring daemon.
- Define fail-closed behavior; plaintext JSON/SQLite fallback is prohibited unless separately approved by the owner.
- Do not read, create, or request real credentials.

### D. Local browser/API security
- Propose loopback binding, Host/Origin validation, CSRF/session bootstrap, CORS policy, DNS rebinding mitigation, OAuth callback/state handling, and safe file upload boundaries.
- Distinguish browser-facing API security from platform OAuth credential security.

### E. Upload/media intake and persistence
- Propose a bounded-memory browser-to-backend media intake approach.
- Define staging, atomic completion, partial-upload cleanup, media retention, and disk-space error handling.
- Define job/destination entities, idempotency keys, checkpoints, transaction boundaries, cancellation, and needs-reconciliation behavior.
- Account for YouTube optional post-upload actions and Facebook Reels bounded-memory transfer.

### F. API and progress contracts
- Recommend route grouping, API versioning, error envelope, SSE event schema, reconnect/replay strategy, and frontend query invalidation.
- Progress must be truthful; do not invent percentages when the provider offers no measurable progress.

### G. Facebook single-image post
- Verify the appropriate current Meta Page photo publishing endpoint, permissions, supported request form, and relevant constraints using authoritative official documentation.
- State any Meta app review/access requirements and uncertainties.
- Do not make authenticated requests or publish content.

### H. Test and cross-platform strategy
- Recommend a minimal test runner and mocked Google/Meta adapter strategy.
- Define Linux and Windows verification matrix, including native SQLite/keyring dependencies and path/permission behavior.
- Identify which checks cannot be established without the owner's actual machines or Meta app setup.

### I. Repository migration plan
- Recommend a low-risk path from current CLI baseline to proposed `apps/web`, `apps/server`, and shared packages.
- Decide whether npm workspaces are sufficient.
- Preserve CLI behavior until a separately approved task explicitly retires it.
- Preserve upstream attribution and license.

## 5. Deliverable

Create `reports/QFAT-002-architecture-validation.md` containing:

1. Executive recommendation and overall status (READY / READY WITH CONDITIONS / BLOCKED).
2. Baseline evidence and current repository structure.
3. Decision table for every investigation in §4, with selected option, alternatives, rationale, and confidence.
4. Credential-store Linux/Windows coverage and fail-closed behavior.
5. Local browser/API threat model and mitigations.
6. Job model/state machine and retry/reconciliation proposal.
7. Facebook single-image API evidence with official URLs and access date.
8. Cross-platform dependency and test plan.
9. Repository migration sequence with small follow-up implementation tasks.
10. Explicit unresolved owner decisions and blockers.
11. Exact checks performed and not performed.

Do not modify `docs/ARCHITECTURE-QFAT-MVP.md` during this task. If changes are recommended, list them in the report for GPT/owner review.

## 6. Exclusions

- No source-code, package, lockfile, configuration, or documentation edits except the required report.
- No dependency installation or upgrades.
- No branch creation or switching.
- No credentials, OAuth authorization, or real API writes.
- No live uploads, test posts, or Meta app changes.
- No frontend mockups or implementation.
- No database schema implementation.
- No claim that Linux/Windows compatibility is proven without running on those operating systems.

## 7. Verification and publication

- This is a read-only assessment. Do not install dependencies or run mutating commands.
- Read-only commands and static inspection are permitted.
- If any command is run, record its exact invocation and result.
- Confirm only the report is changed.
- Commit and push the report to `main` after reviewing the diff and git status.
- Verify the remote commit and report on GitHub.
- Stop after publication and provide the minimal handoff required by `docs/AI-DEVELOPMENT-WORKFLOW.md`.

## 8. Completion gate

The task is complete only when the report is published and remotely verified. Agent completion is not owner acceptance. GPT/owner will audit the report and decide whether to approve or revise the architecture before authorizing implementation.
