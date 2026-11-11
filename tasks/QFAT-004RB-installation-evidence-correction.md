# Task QFAT-004RB — Correct Installation Verification Evidence

- **Status:** READY FOR OWNER REVIEW
- **Task type:** Documentation-only evidence correction
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Baseline commit:** `2e49aa4435948d068ffb324e7829332180a5439c`
- **Parent documentation correction:** `2e49aa4435948d068ffb324e7829332180a5439c`

## 1. Objective

Resolve the remaining contradictory installation evidence in the QFAT-004 and QFAT-004R reports. The source audit found that the reports acknowledge the agent ran `npm install`, not the required clean-lockfile command `npm ci`, but one verification table was changed to show `npm ci` with exit code 0 and PASS.

This task is documentation-only. Do not run installation or code verification commands.

## 2. Required corrections

1. In `reports/QFAT-004-local-backend-health-server-report.md`, correct the verification table so it does not falsely claim `npm ci` was run successfully:
   - Preserve the actual historical fact: `cd apps/server && npm install` was run, exit code 0, as agent-reported.
   - Add a separate row for the task-required `cd apps/server && npm ci` with result **NOT VERIFIED** and no invented exit code.
   - Add a clear note that the successful `npm install` does not establish a clean lockfile installation.
   - Keep the other verification rows unchanged unless necessary to remove a direct contradiction.
2. In `reports/QFAT-004R-health-server-audit-corrections-report.md`:
   - Preserve `npm install` as the actual command the earlier agent reported running.
   - Mark the required `npm ci` clean-install check **NOT VERIFIED** in the verification table or a clearly adjacent explicit status row.
   - State that this is a remaining finding and that QFAT-004R did not demonstrate this required check.
   - Do not state that all task verification requirements passed. Keep the report status/recommendation consistent with this unresolved verification finding (for example, PASS WITH FINDINGS, with the clean-install check explicitly outstanding).
3. Append a dated QFAT-004RB note to both reports explaining the correction. Preserve all previous report history and audit notes.
4. Do not claim the clean-install requirement was satisfied. Do not infer an npm ci run from the README command or task instructions.

## 3. Explicit exclusions

- Do not run `npm ci`, `npm install`, tests, builds, audits, or server commands.
- Do not modify source code, tests, package manifests, lockfiles, or dependencies.
- Do not change any test results except to accurately distinguish reported facts from unverified checks.
- Do not change unrelated files or root README.
- Do not create/run CI or GitHub Actions.
- Do not perform Windows validation.
- Do not begin any subsequent QFAT task.

## 4. Safe repository procedure

1. Verify repository identity and `origin` is `https://github.com/irfannuralam44-max/qfat.git`.
2. Verify branch `main`, HEAD, and working-tree status.
3. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, QFAT-004R and QFAT-004RA task files, and both reports.
4. Confirm baseline `2e49aa4435948d068ffb324e7829332180a5439c` is reachable and working tree clean. If dirty, wrong branch/remote, or diverged, stop. Never reset, clean, stash, rebase, force-push, or discard.
5. If clean and safe, run `git pull --ff-only origin main` before editing. Stop if fast-forward is not possible.
6. Use one agent serially; no parallel agents.

## 5. Change control and completion gate

Expected changed paths only:
- `reports/QFAT-004-local-backend-health-server-report.md`
- `reports/QFAT-004R-health-server-audit-corrections-report.md`

Run only `git diff --check`. Review complete diff and working-tree status. Commit and push to `main` only if changes stay within scope. Verify the commit and both reports on GitHub.

Clearly distinguish GitHub-verified repository facts from local test/install results reported by the earlier agent. This task does not independently validate any local command.

Agent PASS is not owner acceptance. GPT will independently audit the pushed documentation-only correction.

## 6. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:
