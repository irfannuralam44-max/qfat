# QFAT-003 — Backend SQLite Foundation

- **Task ID:** QFAT-003
- **Status:** READY FOR EXECUTION — first implementation task
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Owner approval:** SQLite stack accepted with mitigation in ADR-001 on 2026-11-11
- **Related decisions:** `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`
- **Related product docs:** `docs/PRD-QFAT-MVP.md`, `docs/ARCHITECTURE-QFAT-MVP.md`
- **Expected report:** `reports/QFAT-003-backend-sqlite-foundation.md`
- **Execution mode:** One agent, serial

---

## 1. Objective

Implement the first isolated backend foundation for QFAT using the owner-approved SQLite stack:

- `better-sqlite3@13.0.3`
- `drizzle-orm@0.45.4`
- `drizzle-kit@0.31.11`
- `tsx@4.23.15`
- `typescript@7.0.2`

Create a separately runnable Node.js TypeScript backend package under `apps/server/`, with a working SQLite connection layer, safe connection pragmas, Drizzle schema/migration configuration, a migration runner, and automated tests using temporary databases.

This task establishes database infrastructure only. It must not invent the final QFAT business schema or prematurely select an HTTP framework.

## 2. Mandatory safe synchronization

At the very start:

1. Verify repository identity, `origin` URL, current branch, HEAD, and working-tree status.
2. Preserve all pre-existing local changes. Never reset, clean, stash, overwrite, or discard user work.
3. Fetch and safely synchronize with `origin/main`. If clean and fast-forward is safe, use `git pull --ff-only origin main`.
4. If dirty, diverged, wrong remote, or unsafe, stop and report BLOCKED.
5. Verify local HEAD equals `origin/main`.
6. Read this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `README.md`, `CLAUDE.md`, PRD, architecture proposal, and ADR-001.
7. Inspect the current repository tree, root `package.json`, lockfile, TypeScript configuration, license/attribution files, and existing CI workflows before editing.

After synchronization, proceed with the assigned implementation. Do not create a sync-only task.

## 3. Scope

### 3.1 Isolated backend package

Create a self-contained package under `apps/server/`. Keep the imported root Spoolcast CLI intact; do not move or rewrite its source.

The backend package must:

- Be ESM TypeScript.
- Declare Node.js engine minimum `>=22`.
- Use the exact approved package versions listed above.
- Keep `drizzle-kit`, `tsx`, and `typescript` in `devDependencies`.
- Keep `better-sqlite3` and `drizzle-orm` in runtime `dependencies`.
- Include an app-local lockfile so backend dependency installation is independently reproducible.
- Provide clear scripts for typecheck, tests, migration generation, and migration execution.
- Avoid changing the root package dependency graph or breaking existing Spoolcast CLI scripts.

Do not introduce npm workspaces in this task unless repository inspection proves they are strictly required; if they appear necessary, stop and report the reason rather than expanding scope.

### 3.2 SQLite connection module

Implement a small database module with explicit lifecycle:

- Open a database at a caller-supplied path; do not hardcode a user-specific absolute path.
- Ensure the parent directory exists where appropriate, without deleting or replacing existing files.
- Support a temporary file database for tests.
- Do not use an in-memory database as the only verification path.
- Enable and verify foreign-key enforcement on the connection.
- Enable WAL mode for file-backed databases and verify the returned mode.
- Set a bounded busy timeout (use 5000 ms unless existing repository evidence requires otherwise) and document that SQLite timeout behavior is not an exact wall-clock deadline.
- Use prepared statements through the approved driver/Drizzle integration where appropriate.
- Expose a controlled close operation.
- Do not silently delete, recreate, or overwrite a database when opening fails.
- Do not perform network, media, or long-running work inside database transactions.

Keep connection setup in one module; do not scatter PRAGMA configuration across repositories.

### 3.3 Drizzle schema and migrations

Set up Drizzle ORM with the approved `better-sqlite3` adapter and Drizzle Kit.

For this foundation task, do not invent account, media, job, destination, credential, or publishing-history business tables. Create only the smallest infrastructure-owned schema needed to prove migrations, such as a minimal `app_meta` table if Drizzle's migration ledger alone is insufficient for a useful smoke test.

Requirements:

- Store typed schema definitions in a clear backend source location.
- Configure Drizzle Kit to generate SQL migrations into an app-local migrations directory.
- Commit the generated initial SQL migration and required Drizzle migration metadata/snapshot files.
- Implement a runtime migration runner using Drizzle's migrator; do not use `drizzle-kit push`.
- Ensure the migration runner can apply migrations to a fresh temporary database.
- Running the migration runner again must be safe and must not duplicate or damage schema/data.
- Keep migration history append-only; do not rewrite generated historical migrations after they are committed.

If Drizzle Kit 0.31.11's generated output or package API differs from assumptions in this task, inspect the installed package/docs and adapt without changing the approved version.

### 3.4 Database path policy

Do not silently settle the final product data-directory policy in this task.

- The connection API must accept an explicit database path.
- Tests must always use unique temporary paths outside tracked source.
- A development-only command may accept an explicit path through an environment variable or CLI argument.
- Do not create a real user database in the repository, home directory, or a guessed application-data folder.
- Record the remaining decision for the later app-runtime/bootstrap task: final Linux and Windows per-user application-data directory and backup/restore behavior.

### 3.5 Dependency audit mitigation

The accepted ADR requires:

1. `drizzle-kit`, `tsx`, and `typescript` remain development dependencies.
2. Add a backend-package script that runs `npm audit --omit=dev`.
3. Add or update CI so the production-scope audit gate runs for changes affecting `apps/server/` and fails on any production-scope finding.
4. Do not hide or suppress the full-scope `GHSA-67mh-4wv8-2f99` advisory. Record it as a dated development-tooling exception in an appropriate dependency/security note or CI documentation, with a re-evaluation condition.
5. Do not apply the exploratory npm override from QFAT-002V.
6. Do not run `npm audit fix --force` or downgrade Drizzle Kit to 0.18.1.

Capture the actual full-scope audit output and exit code in the report. A non-zero full-scope audit caused solely by the documented advisory is an expected finding, not a reason to conceal or bypass it.

### 3.6 Tests

Use Node's built-in test runner with `tsx --test` unless inspection identifies a concrete incompatibility. Do not add a new test framework.

Tests must use isolated temporary file databases and clean up only their own temporary fixtures. Cover at minimum:

- Connection opens and closes cleanly.
- Foreign keys are enabled and enforced (invalid child insert is rejected).
- WAL mode is enabled and verified for file-backed DB.
- Busy timeout configuration is applied and readable.
- Prepared statement / Drizzle basic read-write operation works.
- Initial migration applies to a fresh DB.
- Re-running migrations is safe.
- A transaction rollback leaves no partial data.
- Database closes and reopens with data preserved.
- SQLite `integrity_check` returns `ok`.

Do not test against or modify a real QFAT user database.

## 4. Explicit exclusions

This task does NOT authorize:

- Fastify, Express, a Node HTTP server, API routes, CORS, SSE, browser session/CSRF logic.
- React/Vite frontend, UI, Tailwind, routing, or design-system work.
- YouTube or Facebook API calls, OAuth, credential storage, or account connections.
- Media intake, file uploads, media directories, transcoding, or image/video handling.
- Job orchestration, queue workers, retry/reconciliation state machines, or publishing domain tables.
- Tauri/Electron packaging.
- Root Spoolcast CLI refactors, dependency upgrades, or behavior changes.
- Real account authorization, live uploads, or use of platform credentials.
- npm overrides or suppression of the known development-tooling advisory.

If an excluded decision blocks the database-only task, stop and report BLOCKED with evidence; do not make the decision unilaterally.

## 5. Security and data-safety requirements

- Never store OAuth tokens, Page tokens, app secrets, passwords, or credential material in SQLite.
- Never log database contents or secrets.
- Do not add telemetry or external network calls.
- Do not create database files in tracked paths.
- Use parameterized statements; do not interpolate untrusted values into SQL.
- Do not delete or replace any pre-existing database file.
- Keep transaction scopes short.
- Preserve upstream MIT license and attribution notices.
- Do not commit temporary database files, WAL/SHM sidecars, local environment files, or secrets.

## 6. Required verification

Run and record exact commands, runtime versions, and exit results:

1. Install backend dependencies from the new app-local lockfile using a clean install.
2. `npm run typecheck` in `apps/server/`.
3. `npm test` in `apps/server/`.
4. Generate migration using the documented migration-generation script (verify it does not produce unintended diffs on a second run).
5. Apply migrations to a fresh temporary file database.
6. Run migration twice and verify schema/data integrity.
7. `npm audit --omit=dev` — must exit 0.
8. Full `npm audit` — capture output/exit code; document the known advisory if it remains.
9. Root `npm run typecheck` to prove the imported CLI still typechecks.
10. Root `npm run build` if root build configuration is unaffected and runnable; otherwise record NOT RUN with reason.
11. Inspect `git diff --check`, `git status`, and staged file list before commit.

Where feasible, run the backend test suite on the available Windows machine. Do not claim Linux/Windows parity unless both environments actually ran this task's checks. If only one environment is available, report the other as NOT RUN and leave cross-platform verification for a follow-up task.

## 7. Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| AC-01 | Backend exists as an isolated `apps/server/` package and root CLI remains intact | Tree, package manifests, root checks |
| AC-02 | Exact approved dependencies and Node >=22 engine are declared correctly | Manifest and installed tree |
| AC-03 | SQLite connection applies and verifies FK, WAL, and busy-timeout settings | Executed tests |
| AC-04 | Drizzle schema/config and generated SQL migration are committed | Source/config/migration files |
| AC-05 | Runtime migrator works on fresh DB and is safely repeatable | Executed migration tests |
| AC-06 | Transaction rollback, close/reopen, and integrity checks pass | Executed tests |
| AC-07 | Dependency audit mitigations are implemented without hiding the known advisory | CI/config, audit commands, exception note |
| AC-08 | No business schema, HTTP framework, OAuth, frontend, upload, or unrelated CLI changes are introduced | Diff review |
| AC-09 | Root CLI compatibility is preserved | Root typecheck/build results |
| AC-10 | Report records truthful environment, commands, exit codes, findings, and publication state | Report review |

## 8. Report and publication

Create `reports/QFAT-003-backend-sqlite-foundation.md`.

The report must include:

- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Task path, repository, target branch, commit message, and full commit SHA.
- Exact Node/npm/OS/architecture versions.
- Package tree and exact direct dependency placement (runtime vs dev).
- Files changed and why.
- SQLite PRAGMA values actually read back.
- Migration generation/application evidence, including repeat run.
- Test names/results and exact commands/exit codes.
- Full and production-scope npm audit result, including the known advisory status.
- Root CLI compatibility checks.
- Platform coverage and anything NOT RUN.
- Git publication and remote verification.
- Handoff ready for GPT/owner audit; do not claim final acceptance.

Commit message:

`feat(server): establish SQLite backend foundation`

Target branch: `main`.

Add only task-scoped implementation/configuration/tests/CI/docs and this report. Do not include unrelated cleanup.

## 9. Handoff

After push and independent remote verification, chat handoff must contain only:

- Branch
- Commit message
- Full SHA
- Report path

Stop after publishing the report. Do not begin the next task or add HTTP/API functionality without GPT/owner audit and a separate task.

---

**Decision boundary:** The owner has accepted the database technology stack and its dependency mitigations. This task authorizes only the SQLite backend foundation described above. It does not approve Fastify or any other HTTP framework and does not authorize platform credentials, OAuth, or live publishing.
