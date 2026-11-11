# Task QFAT-004R — Health Server Audit Corrections

- **Status:** READY FOR OWNER REVIEW
- **Task type:** Narrow correction to QFAT-004; implementation and report accuracy
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Preferred runtime:** Node.js 24 LTS
- **Baseline commit:** `269ffc8e68283b97ea6b8d8a39b7cfa5a0961812`
- **Parent implementation:** `9354b61c730f6260d0f4bc43505b26e74f072c61`
- **Audit findings:** Section 12 of `reports/QFAT-004-local-backend-health-server-report.md`
- **Expected report:** `reports/QFAT-004R-health-server-audit-corrections-report.md`

## 1. Objective

Correct only the five findings recorded in the independent source audit of QFAT-004. Preserve the minimal local Fastify health server and its existing product boundaries. This is not authorization to start the next feature or broaden the backend.

## 2. Required corrections

1. **Strict port validation**
   - Replace permissive parsing that accepts partial numeric strings (for example `3001abc`) or decimal strings (for example `3001.5`).
   - Accept only a complete decimal integer representation whose numeric value is within 1–65535.
   - Keep the default port 3001 when `PORT` is absent.
   - Decide and document the behavior for an explicitly empty `PORT`; safest is to reject it as invalid.
   - Add focused regression tests for valid values, absent value, empty value, alphabetic input, numeric suffix, decimal input, zero, negative, and 65536. Restore environment state safely in every test.

2. **No fixed test port**
   - Remove the hard-coded test port 3002.
   - Let the OS assign an available ephemeral port (port 0) when starting the test server.
   - Read the actual bound port from the server address and use it for HTTP requests.
   - Keep the loopback host assertion for 127.0.0.1 and verify clean close without depending on a shared port.

3. **Minimal startup instructions**
   - Add a concise `apps/server/README.md` (or another narrowly scoped server-specific developer note) explaining:
     - prerequisites (Node.js 24 preferred);
     - install from the lockfile from `apps/server/`;
     - development start and production build/start commands;
     - default loopback address and port;
     - how to call `GET /api/v1/health` and what a healthy response looks like.
   - Do not rewrite the imported Spoolcast root README or unrelated documentation.

4. **Correct the existing QFAT-004 report**
   - Update `reports/QFAT-004-local-backend-health-server-report.md` in place, preserving its original content and the existing independent audit section.
   - Record the full baseline SHA `05c0840ceb51364fd14937c935e14b26c16c7d35`.
   - Record the full implementation commit SHA `9354b61c730f6260d0f4bc43505b26e74f072c61` as the implementation commit (do not claim this correction commit is the original implementation commit).
   - Clearly distinguish four implementation paths from five total paths in the original implementation commit (the fifth is the report itself).
   - Replace the stale “Push verification: To be completed” placeholder with the verified GitHub publication details for the original implementation commit.
   - Correct the duplicate/misnumbered acceptance criterion IDs so every row has a unique, consistent ID. Do not claim criteria that were not tested.
   - Keep the independent audit record; append a dated correction note identifying what this task fixed.

5. **New correction report**
   - Create `reports/QFAT-004R-health-server-audit-corrections-report.md`.
   - Include baseline branch/full SHA, parent implementation SHA, changed paths, exact implementation details, Linux OS/architecture/Node/npm versions, exact commands and outcomes, test count, and limitations.
   - Distinguish locally executed tests from source inspection. Do not claim GPT executed Linux commands.
   - Record final commit SHA only after the commit exists.
   - Explicitly state Windows validation NOT RUN and CI/GitHub Actions remain DEFERRED BY OWNER.

## 3. Explicit exclusions

Do NOT add routes or features. Do NOT change the health response contract, host binding, default port, database, migrations, SQLite dependency versions, Fastify version, unrelated packages, Spoolcast CLI, or root README. Do NOT add frontend, OAuth, credentials, keyring, media, uploads, publishing, scheduling, authentication, CORS, SSE, WebSockets, Docker, Electron, Tauri, CI, or GitHub Actions. Do not perform unrelated refactoring or dependency upgrades.

If any correction appears to require work outside this scope, stop and report the blocker.

## 4. Safe repository procedure

Before editing:
1. Verify repository identity and `origin` points to `irfannuralam44-max/qfat`.
2. Verify branch is `main`; record HEAD and working-tree status.
3. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, the QFAT-004 task, PRD, architecture proposal, and ADR-001.
4. Confirm baseline is reachable and the working tree is clean. If dirty, wrong branch/remote, or diverged, stop and report. Preserve changes; never reset, clean, stash, rebase, force-push, or discard.
5. If clean and safe, synchronize by fast-forward only.
6. Use one agent serially; no parallel agents.

## 5. Local verification

On the Linux PC only, using Node.js 24:
- Install using the standard lockfile clean-install command from `apps/server/`.
- Run server typecheck, build, and the complete existing test suite.
- Verify all new port-validation cases and ephemeral-port tests pass.
- Start the server using the documented development or production command.
- Verify `GET /api/v1/health` over `127.0.0.1`, verify it does not bind to LAN/public interfaces, and verify graceful shutdown.
- Run production dependency audit; record full audit outcome separately in light of the existing ADR-001 dev-only advisory.
- Run `git diff --check`.
- Do not create/run CI or GitHub Actions. Do not perform Windows validation or live platform requests.

Report exact commands and actual outcomes. If a check fails, do not mark PASS or push as complete; report the blocker.

## 6. Change control and completion gate

Expected changes are limited to:
- `apps/server/src/index.ts` only if needed for strict port validation;
- `apps/server/test/health.test.ts`;
- new `apps/server/README.md`;
- `reports/QFAT-004-local-backend-health-server-report.md`;
- new correction report.

Do not modify package manifests/lockfiles unless an unavoidable, explicitly reported prerequisite is discovered; stop for owner review instead.

Review the complete diff and working-tree status. Commit and push to `main` only if all required local checks pass and every changed path is in scope. Verify the pushed commit and both reports on GitHub. Stop after handoff; do not begin another task.

Agent PASS is not owner acceptance. GPT will independently audit the new commit, source, and reports.

## 7. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:
