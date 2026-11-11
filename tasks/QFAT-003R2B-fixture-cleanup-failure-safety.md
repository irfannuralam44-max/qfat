# QFAT-003R2B — Protect Fixture Cleanup When Temp Directory Creation Fails

- **Task ID:** QFAT-003R2B
- **Status:** READY FOR EXECUTION — focused correction after GPT audit
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Audit base:** `0df07e6d040fa62b244615732df1a20dcce18598`
- **Latest GPT audit/report commit:** `f39a2a82c2fc201d985335ee53cf0338a714fddc`
- **Related implementation:** QFAT-003R2A
- **Related report:** `reports/QFAT-003R2A-migration-assertions-and-handle-safety-report.md`
- **Expected report:** `reports/QFAT-003R2B-fixture-cleanup-failure-safety-report.md`
- **Execution machine:** **PC LINUX ONLY**
- **Execution mode:** One agent, serial

---

## 1. Mandatory safe synchronization

At the very start:

1. Verify repository identity `irfannuralam44-max/qfat`, `origin` URL, current branch, HEAD, and working-tree status.
2. Preserve all local changes. Never reset, clean, stash, overwrite, or discard user work.
3. Fetch and synchronize safely. If clean and fast-forward is safe, run `git pull --ff-only origin main`.
4. Verify local HEAD equals `origin/main`.
5. If dirty, diverged, wrong remote, or unsafe, stop and report BLOCKED.
6. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, ADR-001, QFAT-003R2A task, QFAT-003R2A report including §12 GPT audit, and this task.

Do not perform a sync-only handoff; after safe synchronization, proceed with this task.

## 2. Objective

Resolve the remaining blocking issue in QFAT-003R2A:

- `createTestDb()` creates a database fixture, but `mkdtempSync()` currently executes before the outer `try/finally`. If temporary-directory creation throws, the database fixture's `cleanup()` is skipped.

Also correct report claims and publication metadata that the GPT audit found inaccurate. Do not change the already-correct dynamic hash/timestamp derivation or the per-handle close logic except where strictly needed to implement safe outer cleanup.

## 3. Required code change

File: `apps/server/test/connection.test.ts`

### 3.1 Ensure database fixture cleanup even if mkdtemp fails

Refactor the migration-upgrade test so that:

1. The database fixture is created first.
2. Temporary directory path is initialized as absent (for example, `let v1FixtureDir: string | undefined`).
3. `mkdtempSync()` is executed only after entering an outer `try` whose `finally` always invokes the database fixture's `cleanup()`.
4. In `finally`, remove the migration temp directory only if creation succeeded and only using the exact path returned by `mkdtempSync()`.
5. Database fixture cleanup runs regardless of:
   - temporary directory creation failure,
   - migration failure,
   - assertion failure,
   - handle close failure,
   - temp directory removal failure.
6. Preserve correct resource ordering: all opened SQLite handles close in their own `finally` blocks before migration temp directory removal and database fixture cleanup.
7. Do not swallow handle-close errors or report success when cleanup failed. Preserve the primary test error where possible while ensuring all cleanup actions are attempted.

Do not add a destructive or fixed project-relative cleanup path.

### 3.2 Failure-path verification

Provide concrete evidence for the `mkdtempSync()` failure path. Prefer a narrowly scoped test seam/helper or dependency injection that allows the temp-directory creation operation to throw deterministically, then assert that database fixture cleanup still runs. Do not add a broad mocking framework or dependency. If a deterministic failure-path test is not reasonably possible without disproportionate production/test complexity, explain why and provide a focused source-level control-flow proof; do not claim a runtime test was performed.

### 3.3 Scope

- No dependency changes.
- No changes to migrations, schema, runtime DB code, root Spoolcast CLI, unrelated tests, or product scope.
- Keep tests under `node:test`.
- Keep GitHub Actions deferred. Do not add a workflow or trigger CI.
- Do not perform Windows validation in this task.
- Preserve QFAT-003R2A dynamic SQL hash and journal timestamp derivation.
- Preserve try/finally closure of `conn1`, `db1`, `conn2`, and `db2`.

---

## 4. Report corrections

Create `reports/QFAT-003R2B-fixture-cleanup-failure-safety-report.md`.

Include:

- Status PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Exact base commit and implementation commit.
- Exact changed paths for the implementation commit.
- Separate explanation of the broader compare range if reporting it: the compare from audit base may include task/report documentation commits as well as implementation changes. Do not conflate compare-range paths with implementation-commit paths.
- Explain outer cleanup control flow and failure-path evidence.
- Exact test names/counts and actual output.
- Exact local commands and exit codes.
- Linux OS, architecture, Node and npm versions.
- `git diff --check`, `git status`, and changed-file list.
- GitHub Actions: DEFERRED BY OWNER.
- Windows: NOT RUN.
- Remaining limitations.

Correct `reports/QFAT-003R2A-migration-assertions-and-handle-safety-report.md` without deleting or rewriting its historical §12 GPT audit note. Specifically:

1. Correct AC-06 and any claims about temp directory creation failure so they reflect the actual implementation and verified outcome.
2. Correct §5/§6 changed-file statements. The implementation commit must be described separately from the broader compare range. Do not claim only two files changed if that is not what the referenced range shows.
3. Remove the unfinished `[To be completed after commit and push]` placeholder. Record actual publication verification only after it is available; otherwise state precisely that the report was prepared before publication and leave no false claim.
4. Ensure summary/status text does not continue to claim QFAT-003R2A was accepted. Preserve the historical GPT audit disposition **NOT ACCEPTED** and add a cross-reference to QFAT-003R2B.
5. Do not embed the new report's own commit SHA before it exists. GPT may correct factual post-publication metadata.

Do not alter the older QFAT-003R2 report unless a concrete factual error directly relevant to this task is discovered.

---

## 5. Local Linux verification

Run and record at minimum:

1. `cd apps/server && npm ci`
2. `cd apps/server && npm run typecheck`
3. `cd apps/server && npm test`
4. `cd apps/server && npm run audit:prod`
5. `cd apps/server && npm run audit:full` (record known advisory and actual exit code)
6. `cd apps/server && npm run db:generate` twice; ensure no unintended migration diff.
7. Root `npm run typecheck`
8. Root `npm run build`
9. `git diff --check`

Do not claim any command passed unless actually executed. No GitHub Actions run is expected or required.

---

## 6. Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| AC-01 | Database fixture cleanup runs if `mkdtempSync()` throws | Deterministic failure-path test or explicit source-level proof |
| AC-02 | Temp directory removal occurs only if this test created it | Source review |
| AC-03 | All DB handles close before fixture cleanup on all paths | Source review and tests |
| AC-04 | Cleanup attempts DB fixture cleanup even if temp directory removal fails | Source review / test where feasible |
| AC-05 | Existing dynamic hashes/timestamps remain derived from SQL/journal | Source review and migration test |
| AC-06 | QFAT-003R2A report corrected without erasing historical GPT audit | Diff and report |
| AC-07 | Report distinguishes implementation commit paths from broader compare-range paths | Git compare and report |
| AC-08 | Linux verification documented with exact commands and exit codes | Report |
| AC-09 | CI remains deferred; Windows marked NOT RUN | Report |
| AC-10 | No unrelated files/dependency/product changes | Diff review |

## 7. Git publication and handoff

- Target branch: `main`.
- Suggested commit message: `fix(server): guarantee fixture cleanup on temp setup failure`.
- Push and verify the remote commit.
- Stop after local verification and report publication.
- Chat handoff only:
  - Branch
  - Commit message
  - Full SHA
  - Report path

**Decision boundary:** This is a narrow test cleanup-safety correction. It does not authorize Windows validation, API work, or any other next stage. GPT must audit the published commit/report before further authorization.
