# Task QFAT-004 — Minimal Local Backend Health Server

- **Status:** READY FOR OWNER REVIEW
- **Task type:** Narrow backend implementation
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Preferred runtime:** Node.js 24 LTS (the accepted Linux Node.js 22 installation caveat is not part of this task)
- **Related requirements:** `docs/PRD-QFAT-MVP.md`, `docs/ARCHITECTURE-QFAT-MVP.md`
- **Related workflow:** `docs/AI-DEVELOPMENT-WORKFLOW.md`
- **Related database foundation:** `apps/server/` and `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`
- **Expected report:** `reports/QFAT-004-local-backend-health-server-report.md`

## 1. Objective

Add the smallest useful running backend to QFAT: a local HTTP server with one health-check endpoint. This gives the future browser interface a simple way to confirm that the QFAT backend is running.

This task is deliberately limited. It does not build the frontend, account management, OAuth, media handling, uploads, publishing jobs, or additional API routes.

## 2. Approved product boundaries

- QFAT remains a local-first application.
- The backend must listen on loopback only: `127.0.0.1`, never `0.0.0.0`.
- Keep the existing SQLite foundation and its accepted dependency versions unchanged.
- Preserve the imported Spoolcast CLI and its behavior.
- Do not add credentials or connect to Google, YouTube, Meta, or Facebook.
- Tests run locally only. GitHub Actions/CI remain deferred by the owner.

## 3. Required implementation

1. Inspect the current repository and existing `apps/server` setup before editing. Do not assume paths or scripts from older reports are still current.
2. Add a minimal HTTP server under `apps/server/src/`.
3. Use Fastify as the HTTP framework, consistent with the architecture validation recommendation. Add only the runtime package(s) strictly needed for this one server. Do not add optional Fastify plugins in this task.
4. Add exactly one application route:
   - `GET /api/v1/health`
   - Return HTTP 200 and a small JSON response indicating the backend is healthy.
   - The response must not include secrets, environment variables, filesystem paths, account details, or unnecessary machine information.
5. Bind to `127.0.0.1` only. Use a safe, documented default port and allow a simple environment-variable override for local development. Validate the port rather than silently accepting invalid values.
6. Support graceful shutdown on `SIGINT` and `SIGTERM`: stop accepting new requests and close the server cleanly. Do not add a process manager or background service.
7. Add the smallest practical start/build scripts needed for this server, following the existing TypeScript/ESM conventions.
8. Add focused automated tests for:
   - health route returns HTTP 200 and the documented JSON shape;
   - server binds to loopback, not all network interfaces;
   - invalid port configuration is rejected;
   - server can be closed cleanly.
9. Keep tests isolated and deterministic. Do not use the owner's real application database or modify real user data.
10. Update only the minimal relevant README/developer instructions needed to explain how to start the backend and check its health.

## 4. Explicit exclusions

Do NOT implement or add:

- React, Vite, Tailwind, browser UI, dashboard, or frontend scaffolding.
- Account management, Google/Meta OAuth, token storage, keyring integration, or credential migration.
- Media library, file picker, multipart upload, image/video validation, or staging folders.
- YouTube/Facebook API clients, upload protocols, publishing, retries, scheduling, or job queues.
- SQLite business tables, repositories, or schema migrations.
- SSE, WebSockets, CORS plugins, authentication/session systems, CSRF middleware, or extra routes.
- Docker, Electron, Tauri, installers, auto-start services, or process supervisors.
- CI/GitHub Actions or remote test execution.
- Dependency upgrades unrelated to this task.
- Refactors or moving existing Spoolcast files/packages.

If a prerequisite or security concern appears to require work outside this list, stop and report it instead of expanding scope.

## 5. Safe repository procedure

Before any work:

1. Verify repository identity and `origin` points to `irfannuralam44-max/qfat`.
2. Verify current branch is `main`, record HEAD, and inspect working-tree status.
3. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, the PRD, the architecture proposal, and ADR-001.
4. Preserve any existing local changes. If the working tree is dirty, the branch is wrong, or local history has diverged, stop and report; do not reset, clean, stash, rebase, force-push, or discard changes.
5. If clean and safe, synchronize using the workflow's fast-forward-only procedure.

Use one agent serially. Do not start parallel agents.

## 6. Local verification

On the Linux PC only:

- Record OS, architecture, Node.js, and npm versions.
- Use Node.js 24 LTS for this task.
- Install from the committed lockfile using the standard clean-install command.
- Run the server typecheck/build and focused test suite.
- Start the server locally and verify the health endpoint over loopback.
- Verify it is not listening on a LAN/public interface.
- Verify clean shutdown.
- Do not run live platform requests or upload tests.
- Do not run or create GitHub Actions/CI.

Report exact commands and outcomes. Distinguish tests actually run from source-level inspection. Do not claim Windows validation; that will be a separate narrowly scoped task if needed.

## 7. Change control and deliverable

- Keep the diff limited to the minimal server implementation, required package manifest/lockfile changes, focused tests, and concise startup instructions.
- Do not modify PRD or architecture decisions.
- Create `reports/QFAT-004-local-backend-health-server-report.md` with:
  - baseline branch and full base SHA;
  - exact changed paths;
  - implementation summary;
  - runtime/OS details;
  - exact verification commands and results;
  - known limitations and anything not tested;
  - final commit SHA only after the commit exists.
- Review the complete diff and working-tree status before committing.
- Commit and push to `main` only if all required checks pass and the diff remains in scope.
- Verify the pushed commit and report on GitHub.
- Stop after the handoff. Do not begin another task.

## 8. Completion gate

The task is complete when the minimal health server works and all required local checks pass, the scoped report is committed and remotely verified, and no excluded feature or unrelated refactor has been added.

Agent PASS is not owner acceptance. GPT will independently review the report and GitHub diff before asking the owner to accept the result.

## 9. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:
