# QFAT-003R2 — Safe Migration Upgrade Fixture and Test Consolidation

- **Task ID:** QFAT-003R2
- **Status:** READY FOR EXECUTION — focused follow-up to QFAT-003R
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Base commit:** `ddceb5e4cf5a3786be863570c537c196e3f03c7a`
- **Related reports:** `reports/QFAT-003-backend-sqlite-foundation.md`, `reports/QFAT-003R-backend-sqlite-foundation-correction.md`
- **Expected report:** `reports/QFAT-003R2-migration-test-safety-report.md`
- **Execution mode:** One agent, serial; Linux implementation/verification first

---

## 1. Mandatory safe synchronization

At the very start:

1. Verify repository identity is `irfannuralam44-max/qfat`, `origin` URL, current branch, HEAD, and working-tree status.
2. Preserve local changes. Never reset, clean, stash, overwrite, or discard user work.
3. Fetch and safely synchronize. If clean and fast-forward is safe, run `git pull --ff-only origin main`.
4. Verify local HEAD equals `origin/main`.
5. If dirty, diverged, wrong remote, or unsafe, stop and report BLOCKED.
6. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, QFAT-003, QFAT-003R, and ADR-001.

Do not stop merely because the task file is absent before synchronization.

## 2. Objective

Resolve the outstanding GPT audit findings without expanding product scope:

1. Make the v1→v2 migration test fully isolated and non-destructive.
2. Remove or correctly convert the leftover standalone `migration-verify.test.ts`.
3. Prove migration hash/journal values are derived from committed artifacts rather than unexplained literals.
4. Re-run and document the required Linux tests locally.
5. Remove the not-yet-authorized GitHub Actions workflow so pushes do not trigger CI during this development phase.
6. Publish a factual report. Do not claim Windows validation.

## 3. Required changes

### 3.1 Safe temporary migration fixture

The current test creates `migrations-v1-snapshot` at a fixed path inside the package working directory, then unconditionally deletes that path in `finally`. This is unsafe.

Replace it with a unique temporary directory created using `mkdtemp` under the operating-system temporary directory (e.g. `os.tmpdir()`). The test must:

- Create a unique directory owned by that test invocation.
- Build its v1-only migration fixture from the actual committed v1 migration SQL file and corresponding journal metadata.
- Derive the migration tag, timestamp, and SQL content from committed migration artifacts; do not duplicate SQL text or hardcode a manually invented hash/timestamp.
- Run Drizzle migrator against that v1-only fixture so Drizzle itself writes the migration ledger row.
- Insert test data into the v1 schema.
- Run the full committed migration folder and verify only v2 is applied.
- Verify the v2 column exists and pre-existing data is preserved.
- Verify migration ledger has exactly the expected two entries with correct hashes/timestamps.
- Clean up only the exact unique temp directory created by this test. Never remove a fixed project-relative path or a directory that existed before the test.
- Close every database handle before cleanup, including on assertion failure.

If deriving fixture metadata requires a small helper, keep it test-local.

### 3.2 Test runner consolidation

Inspect `apps/server/test/migration-verify.test.ts`.

- If it is still the obsolete standalone script, remove it and confirm deletion in `git diff`.
- If any useful assertions are not already covered, convert them into `node:test` tests in the maintained suite before removing the standalone file.
- Ensure `npm test` runs every maintained test exactly once.
- Update test counts in reports to match actual output.
- Remove unused imports and dead helpers in touched test files only.

### 3.3 GitHub Actions deferred

Owner decision (2026-11-11): GitHub Actions/CI is deferred until the project is ready for real-world use. GitHub is currently the source repository and documentation host; it is not the test execution environment.

- Delete `.github/workflows/ci.yml` in this task because it was introduced prematurely and currently has push/PR triggers.
- Do not configure, trigger, or verify GitHub Actions.
- Record CI as `DEFERRED BY OWNER`, not as a failure or finding.
- All required verification in this task must run locally on Linux and be supported by exact commands, outputs, and exit codes.

### 3.4 Report corrections

Update `reports/QFAT-003-backend-sqlite-foundation.md` only if additional factual metadata corrections are required; preserve historical context and existing GPT audit note.

Create `reports/QFAT-003R2-migration-test-safety-report.md` with:

- Status PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Base commit, task path, changed files.
- Exact test fixture design and cleanup ownership.
- Migration artifact-derived tag/timestamp/hash evidence.
- Exact test command, test names/counts, and exit code.
- `git diff --check`, `git status`, and final changed-file list.
- GitHub Actions status: DEFERRED BY OWNER; confirm `.github/workflows/ci.yml` is absent.
- Linux OS, architecture, Node, npm versions.
- Windows explicitly marked NOT RUN.
- Any remaining limitations.
- Do not embed this report's own commit SHA before it exists. Git publication details may identify the base commit and commit message; post-publication metadata can be corrected by GPT if necessary.

## 4. Explicit exclusions

- No HTTP/API framework, routes, OAuth, platform credentials, frontend, uploads, media handling, or business schema.
- No Windows implementation/validation in this task.
- No dependency version changes, npm overrides, audit suppression, or `npm audit fix --force`.
- No changes to root Spoolcast CLI or unrelated files.
- Do not delete or modify any user/local directory or pre-existing fixture.

## 5. Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| AC-01 | Migration upgrade fixture uses unique OS temp directory | Test source and execution |
| AC-02 | Cleanup removes only test-owned temp directory | Test source; no fixed project path deletion |
| AC-03 | v1 migration fixture is derived from committed SQL/journal | Test source and assertions |
| AC-04 | Drizzle migrator creates ledger entry; no manual hash seeding | Test source and database assertions |
| AC-05 | Upgrade preserves data and applies v2 exactly once | Test output and assertions |
| AC-06 | Standalone test is removed or converted to node:test | Git diff and npm test output |
| AC-07 | Backend typecheck/tests and production audit pass | Exact commands and exit codes |
| AC-08 | GitHub Actions remains deferred; premature workflow removed | Git diff confirms `.github/workflows/ci.yml` deletion |
| AC-09 | No unrelated changes or user data cleanup | Diff/status review |
| AC-10 | Report accurately records results and Windows NOT RUN | Published report |

## 6. Verification

Run and record:

1. `cd apps/server && npm ci`
2. `cd apps/server && npm run typecheck`
3. `cd apps/server && npm test`
4. `cd apps/server && npm run audit:prod`
5. `cd apps/server && npm run audit:full` (record expected advisory)
6. `cd apps/server && npm run db:generate` twice; verify second run produces no unintended diff.
7. Root `npm run typecheck`
8. Root `npm run build`
9. `git diff --check`
10. Verify `.github/workflows/ci.yml` is absent and no CI run is required.

Do not report a command as executed unless it was actually run. Do not claim Windows PASS.

## 7. Git publication and handoff

- Target branch: `main`
- Commit message: `fix(server): isolate migration upgrade test fixtures`
- Push and verify the remote commit.
- Stop after report publication and local verification.
- Chat handoff contains only branch, commit message, full SHA, report path.

**Decision boundary:** This task is only a test-safety/CI-evidence correction. It does not authorize the next API task. Windows validation remains a separate task after GPT audits this result.
