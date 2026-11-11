# QFAT-002S — SQLite Driver and Migration Strategy Validation

- **Task ID:** QFAT-002S
- **Status:** READY FOR EXECUTION — validation only
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Owner-approved runtime constraint:** QFAT backend Node.js >=22; Node.js 24 LTS preferred for development/CI
- **Related documents:**
  - `docs/PRD-QFAT-MVP.md`
  - `docs/ARCHITECTURE-QFAT-MVP.md`
  - `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`
- **Expected report:** `reports/QFAT-002S-sqlite-driver-validation.md`
- **Execution mode:** One agent, serial; no parallel agents required

---

## 1. Objective

Validate the proposed SQLite stack — `better-sqlite3`, Drizzle ORM, and Drizzle Kit generated SQL migrations — against QFAT's owner-approved Node.js >=22 runtime and Linux/Windows target environments.

This task is strictly a technical spike. It must produce evidence and a recommendation. It does not authorize adopting the dependencies in the QFAT application or beginning product implementation.

## 2. Owner decisions and constraints

The owner has approved raising the QFAT backend minimum from Node.js >=20 to Node.js >=22.

- Node.js >=22 is the QFAT runtime floor.
- Node.js 24 LTS is preferred for development and CI.
- Do not change these decisions.
- The owner has **not yet approved** `better-sqlite3` or Drizzle as the final database stack.
- The imported upstream package may continue to declare its historical Node.js engine until a separate implementation task updates the relevant package metadata. Do not make unrelated package changes in this validation task.

## 3. Scope

### In scope

1. Inspect current official/package metadata for:
   - `better-sqlite3` supported Node.js versions and ABI/prebuilt binary availability.
   - Linux and Windows OS/architecture support.
   - Drizzle ORM `better-sqlite3` adapter compatibility.
   - Drizzle Kit migration generation and runtime migrator behavior.
2. Record the exact environment available to the agent:
   - OS and version
   - CPU architecture
   - Node.js and npm versions
3. In an isolated temporary directory (not inside the tracked QFAT source tree), validate:
   - Clean install of the candidate dependencies.
   - Opening and closing a temporary SQLite database.
   - Prepared statement insert/select.
   - Foreign key enforcement.
   - Transaction commit and rollback.
   - WAL mode and bounded busy timeout behavior.
   - Fresh database migration.
   - Upgrade migration from schema version 1 to schema version 2.
4. Verify that migration SQL is generated as reviewable files and applied through the documented runtime migrator.
5. Record install/build friction, prebuilt binary selection, warnings, and any native toolchain requirement.
6. Compare against `node:sqlite` and `@napi-rs/sqlite` only to the extent needed to validate the ADR's stated reasons; do not expand into an unbounded benchmark.

### Out of scope

- Do not modify application source code.
- Do not add, remove, or update dependencies in the root `package.json` or lockfile.
- Do not create a production database schema.
- Do not run OAuth, connect real platform accounts, or perform uploads.
- Do not access or modify any existing user database/media directory.
- Do not change PRD, architecture, or ADR decisions.
- Do not claim Linux and Windows support from a single-OS test.
- Do not install system packages or change global Node/npm versions without explicit owner authorization.

## 4. Cross-platform evidence requirements

The target is Linux and Windows. Test each OS only when that environment is actually available to the agent.

For each OS, report one of:
- **PASS — executed:** exact commands, versions, and results included.
- **FAIL — executed:** reproducible failure and evidence included.
- **NOT RUN — environment unavailable:** explain why and give a precise manual verification procedure.

If only one OS is available, do not mark the overall cross-platform validation PASS. The report may conclude `PASS WITH FINDINGS` for the tested environment while keeping the other OS unverified.

Do not use emulation or an assumed compatibility matrix as a substitute for execution evidence. Official support metadata may be recorded separately from actual runtime verification.

## 5. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Node.js >=22 owner-approved runtime is respected | Environment and package engine requirements recorded |
| AC-02 | Candidate driver installs cleanly in isolated fixture | Exact install command, exit code, warnings, binary/prebuild details |
| AC-03 | SQLite basic operations work | Prepared statement insert/select and close/reopen |
| AC-04 | Database integrity behavior works | Foreign key enforcement and transaction commit/rollback tests |
| AC-05 | Concurrency configuration is understood | WAL and busy-timeout test/result or documented limitation |
| AC-06 | Drizzle migration generation works | Generated SQL migration files and schema snapshot evidence |
| AC-07 | Runtime migration works | Fresh DB migration and sequential upgrade test |
| AC-08 | Linux and Windows status is truthful | Separate PASS/FAIL/NOT RUN result for each OS |
| AC-09 | No QFAT application files/dependencies are changed | Git diff/status shows only the new report |
| AC-10 | Recommendation is evidence-based | Explicit ACCEPT / ACCEPT WITH CONDITIONS / REJECT recommendation for the proposed stack |

## 6. Required test design

Use a minimal isolated TypeScript or JavaScript fixture with two schema versions.

- Version 1: `accounts` and `jobs` tables with a foreign key.
- Version 2: add one non-secret metadata column through a generated migration.
- Insert a parent account and child job.
- Confirm invalid foreign-key insert fails.
- Confirm committed transaction persists.
- Confirm rolled-back transaction leaves no row.
- Close and reopen the DB, then verify persisted rows and migration state.
- Confirm WAL and busy timeout configuration can be applied and queried.
- Ensure no credentials or media data are used.

Keep the fixture minimal and delete only the temporary directory created by this task. Do not clean any pre-existing path or user data.

## 7. Report requirements

Create `reports/QFAT-002S-sqlite-driver-validation.md` containing:

1. Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Task path, branch, candidate commit SHA, and environment.
3. Exact package versions and official metadata references with access date.
4. Commands run and actual exit results.
5. Results for every acceptance criterion.
6. Linux and Windows result matrix, including NOT RUN reasons.
7. Findings, warnings, native build requirements, and limitations.
8. Recommendation: ACCEPT / ACCEPT WITH CONDITIONS / REJECT.
9. Explicit statement that owner acceptance is still required and no production dependencies were added.
10. Git publication details.

Do not paste the report body into OpenCode chat.

## 8. Git and workflow

Follow `docs/AI-DEVELOPMENT-WORKFLOW.md` exactly.

- Synchronize `main` safely before reading this task and relevant project guidance.
- Preserve all existing local changes.
- One agent only; serial execution.
- Only the report file may be added/changed by this task.
- Commit message: `docs(task): QFAT-002S SQLite driver validation report`
- Push to `main` and verify the remote branch and report.
- After push, OpenCode chat handoff must contain only branch, commit message, full SHA, and report path.

Agent PASS is not owner acceptance. GPT will audit the pushed report and evidence before recommending final adoption of the SQLite stack.
