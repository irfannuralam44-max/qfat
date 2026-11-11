# Task QFAT-004RA — QFAT-004R Documentation Accuracy Corrections

- **Status:** READY FOR OWNER REVIEW
- **Task type:** Documentation-only correction
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Baseline commit:** `7cc3f2b2bd643c5cac8d9e6276c50c2c7ef6d4a3`
- **Parent implementation:** `7cc3f2b2bd643c5cac8d9e6276c50c2c7ef6d4a3`
- **Audit findings:** Independent GPT source audit of QFAT-004R commit `7cc3f2b2bd643c5cac8d9e6276c50c2c7ef6d4a3`

## 1. Objective

Correct only the remaining documentation inaccuracies found after the QFAT-004R source audit. The implementation code has already been reviewed and must not be changed in this task.

## 2. Required corrections

1. In `apps/server/README.md`, correct the full test count from 23 to 29, consistent with the 14 existing database/migration tests plus 3 health-server tests plus 12 port-validation tests.
2. In `reports/QFAT-004-local-backend-health-server-report.md`:
   - Replace the correction commit `TBD` with the verified full SHA `7cc3f2b2bd643c5cac8d9e6276c50c2c7ef6d4a3`.
   - Replace the stale push-verification placeholder with the verified GitHub commit URL.
   - Ensure the stated correction commit path count (5) and message match the GitHub commit.
3. In `reports/QFAT-004R-health-server-audit-corrections-report.md`:
   - Replace the correction commit `TBD` in all relevant locations with the verified full SHA `7cc3f2b2bd643c5cac8d9e6276c50c2c7ef6d4a3`.
   - Replace the stale push-verification placeholder with the verified GitHub commit URL.
   - Ensure the report records the actual five changed paths and the exact commit message.
   - Check that all test totals are consistent (29 total; 14 existing + 15 server tests).
4. Correct the installation command record only if the agent can verify what was actually executed. The task QFAT-004R required a clean lockfile installation using `npm ci`, but the report currently records `npm install`. Do not silently rewrite history:
   - If `npm ci` was actually run successfully, correct the report to `npm ci`.
   - If only `npm install` was run, preserve that fact, explicitly record that the required clean-install check was not demonstrated, and mark that verification item NOT VERIFIED / a finding. Do not claim QFAT-004R fully passed that check.
   - Do not rerun installation or any code tests in this docs-only task merely to manufacture historical evidence.
5. Append a dated audit/correction note to the QFAT-004R report explaining the documentation corrections and the installation-evidence disposition. Preserve all existing report history and the earlier independent audit sections.

## 3. Explicit exclusions

- Do not modify application source, tests, package manifests, lockfiles, or dependencies.
- Do not run npm install, npm ci, tests, builds, audits, or server commands.
- Do not alter the root README or unrelated files.
- Do not change the health endpoint, port handling, host binding, or any behavior.
- Do not create or run CI/GitHub Actions.
- Do not perform Windows validation.
- Do not begin any later QFAT task.

If any correction requires code changes or new verification beyond this documentation-only scope, stop and report the blocker.

## 4. Safe repository procedure

1. Verify repository identity and that `origin` points to `https://github.com/irfannuralam44-max/qfat.git`.
2. Verify branch is `main`; record HEAD and working-tree status.
3. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, the QFAT-004R task, and both reports.
4. Confirm baseline commit `7cc3f2b2bd643c5cac8d9e6276c50c2c7ef6d4a3` is reachable and the working tree is clean. If dirty, wrong branch/remote, or diverged, stop. Preserve all changes; never reset, clean, stash, rebase, force-push, or discard.
5. If clean and safe, synchronize before editing with `git pull --ff-only origin main`. If fast-forward is not possible, stop and report; do not force synchronization.
6. Use one agent serially; no parallel agents.

## 5. Change control and completion gate

Expected changed paths only:
- `apps/server/README.md`
- `reports/QFAT-004-local-backend-health-server-report.md`
- `reports/QFAT-004R-health-server-audit-corrections-report.md`

Review the complete diff and working-tree status. Run only `git diff --check` (documentation whitespace check). Commit and push to `main` only if all changes are within scope. Verify the pushed commit and all three files on GitHub.

The correction report must distinguish facts verified from GitHub from local test claims reported by the earlier agent. This task does not independently re-run or validate Linux tests.

Agent PASS is not owner acceptance. GPT will independently audit the pushed docs-only commit.

## 6. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:
