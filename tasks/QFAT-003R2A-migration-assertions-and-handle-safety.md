# QFAT-003R2A — Derive Migration Assertions and Guarantee Handle Closure

- **Task ID:** QFAT-003R2A
- **Status:** READY FOR EXECUTION — focused correction after GPT audit
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Audit base:** `e076ec6d0359e2f443bb321f25eeb95989b3e9cf`
- **Latest documentation audit commit:** `a3d614d97198ca99b0d216fd881c5568bd6478ae`
- **Related task:** `tasks/QFAT-003R2-migration-test-safety.md`
- **Related report:** `reports/QFAT-003R2-migration-test-safety-report.md`
- **Expected report:** `reports/QFAT-003R2A-migration-assertions-and-handle-safety-report.md`
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
6. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, ADR-001, QFAT-003R2 task, QFAT-003R2 report including its GPT audit note, and this task.

Do not perform a sync-only handoff; after safe synchronization, proceed with this task.

## 2. Objective

Resolve only the two blocking source-code findings from the GPT audit:

1. Derive expected migration hashes and timestamps dynamically from committed SQL files and journal metadata. No hardcoded expected hash/timestamp literals.
2. Guarantee every SQLite database handle opened by the migration-upgrade test is closed on both success and failure, before any fixture cleanup.

Also correct the report's factual claims and publication metadata. Do not expand product scope.

## 3. Required code changes

File: `apps/server/test/connection.test.ts`

### 3.1 Derive both migration hashes from SQL artifacts

- Import `createHash` from `node:crypto`.
- Read the committed SQL file for each journal entry, using the journal tag to construct the filename:
  - v1: `migrations/<entry0.tag>.sql`
  - v2: `migrations/<entry1.tag>.sql`
- Compute each expected hash using SHA-256 over the exact SQL file content bytes/string in the same way Drizzle computes its migration hash:
  `createHash('sha256').update(sqlContent).digest('hex')`.
- Read both timestamps from the corresponding `journal.entries[0].when` and `journal.entries[1].when`.
- Assert journal has exactly the expected two entries and the expected tags are distinct; do not hardcode the tag, timestamp, or hash values.
- Use the derived first entry to create the v1-only journal fixture.
- Compare ledger row 0 and row 1 against the dynamically derived hashes and timestamps.
- No SHA-256 literal, migration timestamp literal, or manually duplicated SQL is allowed in this test.
- Keep fixture construction based on committed artifacts, not a synthetic/manual ledger seed.

### 3.2 Guarantee handle closure

Refactor the migration-upgrade test so every handle closes even if a migration or assertion throws:

- Wrap each `openDatabase()` connection in `try/finally` and call `closeDatabase()` in the finally.
- Wrap each direct `new Database(path)` handle in `try/finally` and close it in the finally.
- Ensure the outer cleanup order is:
  1. All database handles have already closed through their own finally blocks.
  2. Remove only the exact unique migration fixture directory created by this test.
  3. Run the database fixture cleanup.
- If temporary directory creation fails after the database fixture is created, still clean up the database fixture.
- Never clean up a path that the test did not create.
- Do not swallow handle-close errors in a way that falsely reports a passing test. Cleanup may preserve the original test error while recording/propagating cleanup errors appropriately.

### 3.3 Scope

- No dependency changes.
- No changes to migrations, schema, runtime DB code, root Spoolcast CLI, or unrelated tests.
- Keep the test under `node:test`.
- Keep GitHub Actions deferred. Do not add a workflow or trigger CI.
- Do not perform Windows validation in this task.

---

## 4. Report correction

Create `reports/QFAT-003R2A-migration-assertions-and-handle-safety-report.md`.

Include:

- Status PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Base commit and exact changed files.
- Explain dynamic SHA-256 derivation for both migration files and journal timestamp derivation.
- Explain handle ownership and closure on success/failure.
- Exact test names/counts and actual output.
- Exact local commands and exit codes.
- Linux OS, architecture, Node and npm versions.
- `git diff --check`, `git status`, and changed-file list.
- GitHub Actions: DEFERRED BY OWNER.
- Windows: NOT RUN.
- Any remaining limitations.

Also update `reports/QFAT-003R2-migration-test-safety-report.md` only to correct objectively inaccurate statements and add a cross-reference to this follow-up. Preserve the existing historical content and GPT audit note. Do not remove or rewrite the audit disposition.

Do not embed this report's own commit SHA before it exists. GPT may correct post-publication metadata.

---

## 5. Local Linux verification

Run and record:

1. `cd apps/server && npm ci`
2. `cd apps/server && npm run typecheck`
3. `cd apps/server && npm test`
4. `cd apps/server && npm run audit:prod`
5. `cd apps/server && npm run audit:full` (record the known advisory and actual exit code)
6. `cd apps/server && npm run db:generate` twice; ensure no unintended migration diff.
7. Root `npm run typecheck`
8. Root `npm run build`
9. `git diff --check`

Do not claim any command passed unless actually executed. No GitHub Actions run is expected or required.

---

## 6. Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| AC-01 | Both migration SQL hashes computed dynamically from committed files | Test source and successful assertions |
| AC-02 | Both timestamps derived dynamically from journal entries | Test source and successful assertions |
| AC-03 | No hardcoded migration hash/timestamp literals remain in upgrade test | Source review |
| AC-04 | All database handles close on success and assertion/migration failure | try/finally source structure and test output |
| AC-05 | Temp migration fixture cleanup occurs only after handles close | Source review |
| AC-06 | DB fixture cleanup still occurs if temp directory creation fails | Source review |
| AC-07 | Linux typecheck, tests, production audit and remaining verification documented | Exact commands and exit codes |
| AC-08 | Report corrected without erasing historical audit note | Git diff and report |
| AC-09 | CI remains deferred; Windows marked NOT RUN | Report |
| AC-10 | No unrelated files/dependency changes | Diff review |

## 7. Git publication and handoff

- Target branch: `main`.
- Commit message: `fix(server): derive migration assertions and close test handles safely`.
- Push and verify the remote commit.
- Stop after local verification and report publication.
- Chat handoff only:
  - Branch
  - Commit message
  - Full SHA
  - Report path

**Decision boundary:** This is a narrow test correctness/safety correction. It does not authorize Windows validation, API work, or any other next stage. Owner acceptance requires GPT audit after publication.
