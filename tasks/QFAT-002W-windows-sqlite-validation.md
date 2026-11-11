# QFAT-002W — Windows 10 SQLite Driver and Migration Validation

- **Task ID:** QFAT-002W
- **Status:** READY FOR EXECUTION — Windows validation only
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Expected environment:** Owner's Windows 10 PC; test the actual machine architecture (expected x64, but detect rather than assume)
- **Runtime constraint:** Node.js >=22; Node.js 22 is the minimum-runtime verification target; Node.js 24 LTS is preferred
- **Candidate stack:** `better-sqlite3@13.0.3`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`
- **Related task/report:** `tasks/QFAT-002S-sqlite-driver-validation.md`, `reports/QFAT-002S-sqlite-driver-validation.md`
- **Related decision:** `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`
- **Expected report:** `reports/QFAT-002W-windows-sqlite-validation.md`
- **Execution mode:** One agent, serial; run on the owner's Windows 10 machine

---

## 1. Objective

Complete the Windows half of QFAT's SQLite stack validation on the owner's Windows 10 PC. Linux validation has already been executed and reported in QFAT-002S; do not repeat it.

Verify the candidate native driver, SQLite behavior, Drizzle migration workflow, Windows file/path behavior, and real lock contention on this Windows machine. Produce reproducible evidence and a recommendation.

This is a validation-only task. It does not authorize adding dependencies to QFAT, modifying application source, or accepting the proposed stack.

## 2. Mandatory safe synchronization and task reading

At the very start:

1. Verify the workspace is the repository `irfannuralam44-max/qfat`, remote `origin` is the expected GitHub URL, and target branch is `main`.
2. Inspect `git status --short --branch`, current branch, and current HEAD.
3. Preserve all pre-existing local changes. Do not reset, clean, stash, overwrite, or discard user work.
4. Fetch and safely synchronize with `origin/main`. If the working tree is clean and the local branch can fast-forward, use `git pull --ff-only origin main`.
5. If the working tree is dirty, the remote is unexpected, or fast-forward is not safe, stop and report BLOCKED; do not attempt destructive cleanup or reconciliation.
6. Verify local HEAD equals `origin/main`.
7. Only then read this task in full, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, the ADR, and the QFAT-002S report.

After safe synchronization, proceed with this task; do not create a separate synchronization-only handoff.

## 3. Scope

### In scope

- Confirm Windows edition/build, CPU architecture, PowerShell version, Node.js and npm versions.
- Test Node.js 22 on Windows as the minimum-runtime target. Test Node.js 24 LTS as well if already available through an approved version manager or separate installation.
- Do not change global Node/npm installations, install a version manager, or alter system configuration without explicit owner authorization. If Node 22 is unavailable, report it as NOT RUN and clearly state that minimum-runtime acceptance remains blocked; continue other safe tests on the available Node 24 runtime.
- In an isolated temporary directory outside the QFAT repository, install the exact candidate package versions listed above.
- Verify that the Windows prebuilt native binary is selected and that no unexpected native compilation/toolchain dependency occurs.
- Run the same functional test coverage as QFAT-002S: database open/close, prepared statements, foreign keys, transactions, WAL, close/reopen persistence, Drizzle migration generation, fresh migration, and v1-to-v2 upgrade.
- Add a deterministic two-process lock-contention smoke test for Windows.
- Record exact commands, output, exit codes, and relevant evidence.

### Out of scope

- Do not edit QFAT application source, root `package.json`, lockfiles, PRD, architecture, or ADR.
- Do not install system packages or modify global developer tooling.
- Do not access or modify any existing QFAT user database, credentials, tokens, or media.
- Do not connect YouTube/Facebook accounts or perform uploads.
- Do not claim Windows 11, ARM64, or other Windows configurations were tested.
- Do not repeat Linux validation.

## 4. Environment and install checks

Record actual values from PowerShell, including:

```powershell
$PSVersionTable
[System.Environment]::OSVersion.Version
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
node --version
npm --version
node -p "process.platform + ' ' + process.arch"
```

Create a uniquely named directory under the system temporary directory (for example, `$env:TEMP\qfat-sqlite-validation-<timestamp>`). Confirm it does not already exist before creating it. Work only inside that newly created directory.

Install exact versions:

```powershell
npm init -y
npm install --save-exact better-sqlite3@13.0.3 drizzle-orm@0.45.4 drizzle-kit@0.31.11 tsx@4.23.15 typescript@7.0.2
```

Record the complete install result, exit code, warnings, package engine requirements, and installed versions. Inspect `node_modules\better-sqlite3\prebuilds\` and the resolved binding to identify the actual Windows binary used (for example, `win32-x64.node`). Do not infer runtime success merely from a binary file being present.

## 5. Required functional tests

Use a small isolated TypeScript/JavaScript fixture, with no real user data.

### 5.1 SQLite operations and integrity

- Open a file-backed database and close it cleanly.
- Enable and query `PRAGMA foreign_keys = ON`; prove invalid FK inserts fail.
- Create parent `accounts` and child `jobs` tables.
- Use prepared statements for insert/select and verify returned values.
- Verify transaction commit persists and rollback leaves no inserted rows.
- Close and reopen the database; verify persisted data.
- Enable WAL and verify `PRAGMA journal_mode` reports `wal` after reopen.
- Set a bounded `busy_timeout` and verify its configured value.
- Record Windows path handling and any file-locking or cleanup behavior that differs from Linux.

### 5.2 Drizzle migrations

- Generate reviewable SQL migrations using Drizzle Kit.
- Version 1 schema: `accounts` and `jobs` with a foreign key.
- Version 2 schema: add a non-secret metadata column to `accounts`.
- Apply both migrations to a fresh database using the runtime migrator.
- Separately verify an upgrade path from an already migrated v1 database to v2.
- Verify resulting schema and migration tracking state.
- Record exact commands and exit codes.

### 5.3 Deterministic multi-process lock contention

Use two Node processes against a disposable file-backed database; do not rely on a vague stress test or timing guess.

1. Process A opens the database, sets WAL and a known busy timeout, begins a write transaction with `BEGIN IMMEDIATE`, updates a fixture row, and signals the parent process that the lock is held. It must hold the transaction only for the controlled test interval, then commit and exit.
2. After receiving the lock-held signal, the parent starts Process B, which attempts a write to the same database.
3. First scenario: Process A releases the lock before B's configured busy timeout expires. Verify B eventually succeeds and record elapsed time and exit codes.
4. Second scenario: Process A holds the lock longer than B's configured busy timeout. Verify B fails with the expected SQLite busy/locked error, record the actual error code/message and elapsed time, then ensure A exits and the database can be reopened.
5. Use explicit inter-process signaling (for example, temporary ready/release files or standard input/output) so Process B does not race ahead before A owns the lock.
6. Ensure every child process is awaited and terminated safely. Use bounded timeouts to prevent hung processes. Clean up only this task's temporary fixture directory after collecting evidence.

If the chosen design cannot deterministically establish the lock before B writes, do not report PASS; explain the limitation and revise the test design.

## 6. Node runtime matrix

| Runtime | Requirement | Result |
|---|---|---|
| Node.js 22.x | Required minimum-runtime test | PASS / FAIL / NOT RUN with reason |
| Node.js 24.x LTS | Preferred runtime test | PASS / FAIL / NOT RUN with reason |

If only one runtime is available, test it and mark the other NOT RUN. Do not change the owner's global Node installation to satisfy this matrix. The final stack recommendation must explicitly retain a blocker if Node 22 has not been executed.

## 7. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Actual Windows 10 environment and architecture identified | OS/build, architecture, PowerShell, Node/npm versions |
| AC-02 | Candidate stack installs in an isolated fixture | Exact command, exit code, package versions, warnings |
| AC-03 | Correct Windows native prebuilt is actually loaded | Binary path/selection evidence and no unsupported inference |
| AC-04 | Minimum Node.js 22 runtime is validated | Executed test result; otherwise NOT RUN and acceptance blocker |
| AC-05 | SQLite CRUD, prepared statements, FK, commit/rollback, reopen pass | Commands/output and assertions |
| AC-06 | WAL and bounded busy timeout work on Windows | PRAGMA evidence and reopen result |
| AC-07 | Drizzle fresh and v1-to-v2 migrations pass | Generated SQL, runtime command results, schema verification |
| AC-08 | Two-process lock contention behaves as expected | Both deterministic scenarios, error code, elapsed time, process exit results |
| AC-09 | QFAT repository/application remains unchanged | Git status/diff shows only the new report |
| AC-10 | Recommendation reflects Windows evidence and remaining gaps | ACCEPT / ACCEPT WITH CONDITIONS / REJECT with rationale |

## 8. Report requirements

Create `reports/QFAT-002W-windows-sqlite-validation.md` with:

1. Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Task path, repository, branch, base/candidate commit details, and environment.
3. Exact package versions and actual Windows binary selection.
4. Node 22 and Node 24 result matrix.
5. Exact commands, exit codes, meaningful output, and evidence for every acceptance criterion.
6. Functional SQLite and migration results.
7. Both lock-contention scenarios with timing, error codes, and process outcomes.
8. Warnings, limitations, and any unrun checks.
9. Clear recommendation for Windows and combined Linux/Windows readiness.
10. Git publication details and statement that agent PASS is not owner acceptance.

Do not invent or summarize test output that was not captured. Keep the report reproducible; include concise scripts or essential test snippets in the report where that materially supports the results. Do not paste the full report into chat.

## 9. Recommendation rules

- If Windows 10 tests pass on the actual architecture and Node 22, and lock contention/migrations pass, recommend Windows validation PASS (with any genuine findings).
- If Node 22 is unavailable, the Windows run may still be PASS WITH FINDINGS for Node 24, but minimum-runtime validation remains open and final stack acceptance must remain conditional.
- If the binary fails to load, migrations fail, or database behavior is incorrect, report FAIL and provide reproducible evidence.
- Prebuilt file presence alone is not proof of runtime compatibility.
- This task validates only the owner's Windows 10 configuration, not all Windows versions or CPU architectures.
- Do not authorize dependency adoption or implementation. Owner approval remains a separate decision after GPT audits both reports and updates the ADR if appropriate.

## 10. Git publication and handoff

- Target branch: `main`.
- Commit message: `docs(task): QFAT-002W Windows SQLite validation report`.
- Add only `reports/QFAT-002W-windows-sqlite-validation.md`.
- Push to `origin/main` and independently verify the remote commit and report.
- Follow `docs/AI-DEVELOPMENT-WORKFLOW.md`, including GPT's post-publication audit.
- Chat handoff must contain only branch, commit message, full SHA, and report path.

---

**Decision boundary:** This Windows validation complements QFAT-002S's Linux evidence. Neither report by itself nor a combined agent recommendation constitutes owner acceptance of the SQLite stack. No QFAT application dependency or implementation change is authorized by this task.
