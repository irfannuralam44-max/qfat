# QFAT-003W — Windows Backend SQLite Foundation Regression Validation

- **Task ID:** QFAT-003W
- **Status:** READY FOR EXECUTION — Windows validation only
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Required machine:** **PC WINDOWS ONLY** (owner's Windows 10 PC)
- **Runtime target:** Node.js 22.x minimum; Node.js 24.x also validate when available
- **Related implementation:** QFAT-003 backend SQLite foundation and accepted follow-ups QFAT-003R2A / QFAT-003R2B
- **Related prior platform validation:** `reports/QFAT-002W-windows-sqlite-validation.md`
- **Expected report:** `reports/QFAT-003W-windows-backend-sqlite-validation-report.md`
- **Execution mode:** One agent, serial; no parallel agents

---

## 1. Objective

Run a Windows regression validation against the **actual QFAT backend package now committed in the repository**, rather than repeating the earlier isolated candidate-stack experiment in QFAT-002W.

Verify that the backend package installs reproducibly on Windows, loads the expected native SQLite binding, typechecks, passes its real repository test suite, applies migrations, and handles Windows temporary-file/path cleanup correctly. Include the v1-to-v2 migration upgrade test whose cleanup structure was corrected in QFAT-003R2A and QFAT-003R2B.

This is validation-only. The task does not authorize source changes, dependency changes, schema changes, or product implementation.

## 2. Mandatory safe synchronization and reading

At the very start:

1. Verify repository identity is `irfannuralam44-max/qfat`, `origin` URL is `https://github.com/irfannuralam44-max/qfat.git`, current branch, HEAD, and working-tree status.
2. Preserve all pre-existing local changes. Never reset, clean, stash, overwrite, discard, rebase, or force-push.
3. Fetch and safely synchronize with `origin/main`. Only if clean and fast-forward-safe, run `git pull --ff-only origin main`.
4. If dirty, diverged, wrong remote, or unsafe, stop and report BLOCKED.
5. Verify local HEAD equals `origin/main`.
6. Read this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`, `tasks/QFAT-003-backend-sqlite-foundation.md`, and the QFAT-003, QFAT-003R2A, QFAT-003R2B reports.
7. Inspect the current `apps/server/package.json`, lockfile, source, migration files, and tests before running commands. Do not assume prior task file paths or scripts are unchanged.

After safe synchronization, proceed with validation. Do not create a synchronization-only handoff.

## 3. Machine and runtime requirements

**This task must run on PC WINDOWS ONLY. Do not use PC Linux for execution.**

Record actual Windows edition/version/build, architecture, PowerShell version, Node.js/npm versions, and `process.platform/process.arch`. Detect architecture; do not assume x64.

Runtime matrix:

| Runtime | Requirement |
|---|---|
| Node.js 22.x | Mandatory minimum-runtime validation |
| Node.js 24.x | Validate if available on the PC |

Do not modify global Node/npm installations, PATH, registry, system configuration, or install a version manager without explicit owner authorization. If Node 22 is not installed, a checksum-verified portable Node 22 archive may be downloaded and extracted **only inside this task's unique temporary directory**, with official checksum verification recorded. No installer or persistent PATH change. If this cannot be done safely, mark Node 22 NOT RUN and the minimum-runtime acceptance criterion BLOCKED; do not claim full acceptance.

For each runtime tested, record exact executable path and npm version. Use a separate clean install for each runtime if practical; do not reuse a potentially incompatible native module tree between Node majors.

## 4. Scope

### In scope

- Reproducible installation of the committed `apps/server` package using its committed lockfile.
- Actual Windows native `better-sqlite3` binding load and a real SQLite query.
- Backend package typecheck and complete local test suite.
- Migration generation idempotence check, runtime migration command, fresh database migration, and v1-to-v2 upgrade coverage as exposed by current package scripts/tests.
- Windows temporary directory, database file, WAL/SHM sidecar cleanup behavior.
- Review of migration test fixture cleanup on Windows, including unique temp directory and cleanup behavior.
- Production dependency audit and full audit result, interpreted under ADR-001.
- Exact commands, outputs, exit codes, environment, and evidence in the report.

### Out of scope

- Do not modify tracked source, tests, package manifests, lockfiles, migrations, schema, PRD, architecture, or ADR.
- Do not create a code fix or commit implementation changes. If a defect is found, stop the affected test safely, document it, and report BLOCKED/FAIL with evidence.
- Do not access, open, migrate, or modify any real user QFAT database.
- Do not use real credentials, YouTube/Facebook accounts, platform APIs, or upload media.
- Do not repeat the isolated candidate-stack experiment or the earlier two-process contention experiment from QFAT-002W unless a concrete regression is discovered that makes a narrow diagnostic necessary.
- Do not claim Windows 11, ARM64, or other machine coverage unless actually tested.
- Do not add or execute GitHub Actions/CI. CI remains deferred by owner.

## 5. Isolated test-data safety

- Run repository commands from the synchronized checkout, but all generated test databases and any ad-hoc diagnostic files must live in a unique directory under the system temporary directory, outside the repository.
- Confirm the chosen directory does not exist before creating it.
- Never point a test at a guessed/default user database path.
- Inspect test helpers before execution to verify their fixture paths are unique and cleanup targets only their own files.
- Do not delete files based only on a shared prefix. Retain the exact path returned by the directory creation API.
- If cleanup fails, report the exact remaining path and error. Do not broaden deletion.
- Do not run tests concurrently; use the package's normal serial test command.

## 6. Required validation procedure

### 6.1 Environment evidence

Record output/equivalent evidence for:

```powershell
$PSVersionTable
[System.Environment]::OSVersion.Version
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
node --version
npm --version
node -p "process.platform + ' ' + process.arch"
```

Also record Windows product edition/build and the exact Node executable path.

### 6.2 Inspect actual backend package

From `apps/server`:

- Record package name, scripts, engines, dependency/devDependency versions.
- Confirm committed lockfile is present.
- Inspect the database connection helper and migration runner.
- Inspect test fixture helpers and the v1-to-v2 upgrade test, especially all database handles and the outer temp-directory cleanup.
- Confirm test paths do not point to project/user data.
- Do not edit any inspected files.

### 6.3 Clean dependency installation

For each runtime in the matrix, use the package's committed lockfile and run:

```powershell
cd apps/server
npm ci
```

Record exit code, warnings, installed versions, and whether native compilation was attempted. If using portable Node 22, invoke its matching bundled npm explicitly; do not accidentally invoke the system npm.

Inspect the resolved `better-sqlite3` binding and prove that the runtime actually loads it by executing a small read-only diagnostic against a newly created disposable database under the task temp directory. Record the actual loaded binary path if it can be established from runtime/module evidence. Merely finding a prebuild file is not sufficient.

### 6.4 Backend verification

For each runtime tested, execute the scripts that actually exist in `apps/server/package.json` and record exact commands/exit codes. At minimum, run:

- package typecheck;
- complete package test suite;
- production-scope audit (`npm audit --omit=dev` or the committed script equivalent);
- full audit (`npm audit` or committed script equivalent);
- migration generation twice, only if the repository's generation command is documented as safe/idempotent; verify the second run creates no tracked changes;
- migration runner against a new disposable database, if the package exposes a safe explicit-path command.

Do not invent scripts or commands. If a command's path/database target is unclear or could touch user data, inspect implementation and stop to report rather than guessing.

### 6.5 Migration upgrade and cleanup regression

Run the actual repository test that exercises migration upgrade v1 to v2. Confirm from the test output that it ran and passed, not merely that it exists.

Review and record whether:

1. The test creates a unique database fixture.
2. The v1 migration fixture directory is created inside the outer `try`.
3. The directory is removed only if the variable was assigned.
4. Each database handle closes in its own `finally`.
5. The outer `finally` attempts database fixture cleanup after the temp-directory removal attempt.
6. Test cleanup does not target a pre-existing directory or database.

If Windows filesystem behavior causes a cleanup error (for example, a locked database/WAL/SHM file), record the exact error and remaining paths. Do not suppress or mislabel it as a pass.

### 6.6 Working tree integrity

Before and after validation, record `git status --short --branch`. Validation must not alter tracked files or lockfiles. If migration generation modifies tracked artifacts, capture the exact diff and restore nothing automatically; stop and report the unexpected modification for owner review. Never discard changes.

## 7. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Correct Windows machine and architecture identified | Actual OS/build/architecture/PowerShell output |
| AC-02 | Node 22 minimum runtime tested | Executed install, native load, typecheck, and tests; otherwise BLOCKED |
| AC-03 | Node 24 regression tested when available | Same relevant results, or explicit NOT RUN reason |
| AC-04 | Actual committed backend package installs from lockfile | `npm ci` exit code and installed package versions |
| AC-05 | Windows native SQLite binding actually loads | Runtime query and binding evidence |
| AC-06 | Backend typecheck and complete tests pass | Exact commands, output, exit codes |
| AC-07 | Migration generation/runtime checks are safe | Idempotence and fresh/upgrade evidence where scripts support them |
| AC-08 | v1-to-v2 upgrade test passes on Windows | Named test result and migration data-preservation assertions |
| AC-09 | Fixture and database cleanup are Windows-safe | Source review, test output, before/after temp fixture evidence |
| AC-10 | Production audit result documented | Exact output and exit code |
| AC-11 | Full audit advisory interpreted under ADR-001 | Exact output; no suppression or forced fix |
| AC-12 | No tracked changes or user data touched | Before/after Git status and explicit data-safety statement |
| AC-13 | CI remains deferred | No workflow changes or CI execution |
| AC-14 | Report accurately distinguishes PASS, FAIL, BLOCKED, and NOT RUN | Evidence-based report; no fabricated or inferred results |

## 8. Stop conditions

Stop the affected operation and report BLOCKED/FAIL if:

- repository identity, remote, branch, or safe synchronization does not match;
- the working tree is dirty before execution;
- a command would target an existing or ambiguous database;
- Node 22 validation cannot be performed safely;
- native binding fails to load or requires unapproved system changes;
- migration/test cleanup leaves handles or files behind;
- tests modify tracked files unexpectedly;
- any evidence cannot be reproduced or the command output/exit code is unavailable.

Do not patch source code as part of this validation task.

## 9. Report requirements

Create exactly:

`reports/QFAT-003W-windows-backend-sqlite-validation-report.md`

The report must include:

1. Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Exact task ID, repository, branch, synchronized base SHA, implementation state SHA, report path, and execution date.
3. Safe synchronization evidence.
4. Actual Windows machine and runtime matrix.
5. Package/lockfile inspection and exact installed versions.
6. Commands, relevant output excerpts, and exit codes.
7. Native binding evidence.
8. Test results including the named v1-to-v2 test.
9. Migration generation/runtime results.
10. Cleanup evidence and any remaining temp files.
11. Audit outputs and ADR-001 interpretation.
12. Before/after Git status and exact changed-file list.
13. Explicit Windows-only scope; Linux NOT RUN in this task; no claims beyond the tested Windows edition/architecture.
14. CI deferred by owner; no CI workflow created or run.
15. Findings and limitations, including any untested runtime.
16. Git publication details with actual implementation/report commit identifiers; never invent a SHA or leave publication placeholders after push.

Do not claim the agent's local commands were independently run by GPT. Separate agent-executed evidence from source/report audit.

## 10. Git publication and handoff

- Target branch: `main`.
- Commit message: `test(server): validate SQLite foundation on Windows` if no source changes; if only report is committed, use `docs(report): publish QFAT-003W Windows validation`.
- Push the report to `origin/main` only after successful local report review and `git diff --check`.
- Do not publish any implementation fix under this task.
- Final OpenCode handoff must contain exactly:
  - Branch
  - Commit message
  - Full SHA
  - Report path

Agent completion is not owner acceptance. GPT will audit the pushed report and repository evidence before any next-stage authorization.
