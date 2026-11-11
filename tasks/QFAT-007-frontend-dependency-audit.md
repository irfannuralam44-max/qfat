# QFAT-007 — Frontend Dependency Vulnerability Review

## Objective

Investigate and, only if safely possible, remediate the high-severity vulnerability reported by `npm ci` in `apps/web/` during QFAT-006. Keep this task narrowly limited to the frontend dependency tree. Do not begin dashboard or publishing UI work.

## Current context

- Repository: `irfannuralam44-max/qfat`
- Branch: `main`
- QFAT-006 implementation: `e28254dff9713fe9275edb0e8a6eaf00e18a098d`
- QFAT-006 report: `reports/QFAT-006-private-network-web-entrypoint-report.md`
- Frontend app: `apps/web/`
- QFAT-006 agent report says `npm ci` completed but its install summary reported one high-severity vulnerability. A separate `npm audit` was not run.
- Owner manually verified physical phone access over LAN (`192.168.1.21:5173)) and Tailscale (`100.69.215.44:5173`); frontend showed backend Connected. Direct phone access to backend port 3001 was refused, as expected.
- The root package is the imported Spoolcast CLI. Do not add root-level scripts or alter root dependencies for this task.

## Environment

- Execute on the owner's Linux PC.
- Prefer Node.js 24 LTS; use the currently installed supported Node version if already selected.
- Use the single OpenCode agent serially. Do not spawn parallel agents.

## Mandatory safe synchronization

Before any work:

1. Verify repository identity, `origin`, current branch, HEAD, and worktree status.
2. Preserve all existing local changes. Do not overwrite, discard, stash, reset, clean, rebase, or force-push.
3. If and only if the worktree is clean, branch is `main`, origin is the expected QFAT repository, and local branch is safely fast-forwardable, run `git pull --ff-only origin main`.
4. If dirty, diverged, wrong remote, or otherwise unsafe, stop and report the exact condition. Do not attempt recovery.

## Scope

1. Inspect `apps/web/package.json` and `apps/web/package-lock.json`.
2. From `apps/web/`, run and capture:
   - `npm audit --json`
   - `npm audit --omit=dev --json`
   - `npm ls --all` (or focused `npm explain <package>` for each affected package)
3. Identify the exact advisory/advisories, affected package versions, dependency paths, whether each is direct/transitive, and whether it affects production dependencies or development/build tooling only.
4. Check the official advisory and package release notes/changelog as needed. Record the advisory identifiers and patched version ranges.
5. Evaluate the smallest compatible remediation. Prefer a narrow, non-breaking patch/minor update and a lockfile-only adjustment where appropriate.
6. Before changing anything, inspect the proposed change. Do not blindly run `npm audit fix`.
7. If a safe patch/minor remediation exists, apply only the minimal change in `apps/web/`, update the lockfile reproducibly, then rerun clean installation, both audits, frontend typecheck, and frontend production build.
8. If remediation requires a major upgrade, broad dependency churn, an override with uncertain compatibility, or an unrelated stack change, do not apply it. Report the options and stop for owner decision.
9. Record whether `npm audit --omit=dev` reports zero vulnerabilities. Clearly distinguish production runtime risk from dev/build-tool risk; do not downplay a high-severity advisory merely because it is dev-only.
10. Do not change backend dependencies, root Spoolcast dependencies, app architecture, UI, host binding, proxy, security policy, or unrelated documentation.

## Explicit exclusions

- No dashboard, editor, upload, OAuth, account, or publishing features.
- No dependency refresh unrelated to the reported advisory.
- No major-version upgrades without owner approval.
- No CI/GitHub Actions.
- No firewall, network, or Tailscale changes.
- No publishing or real platform API calls.
- Do not claim physical-device tests were repeated.

## Required verification

If a remediation is applied, run from `apps/web/`:

- `npm ci`
- `npm audit --json`
- `npm audit --omit=dev --json`
- `npm run typecheck`
- `npm run build`

If no safe remediation is available, still run both audits and dependency-path inspection, then report the reason no code change was made. Include exit codes and concise relevant output. Do not create or run CI.

## Report

Create `reports/QFAT-007-frontend-dependency-audit-report.md` with:

- Status: PASS, PASS WITH FINDINGS, or BLOCKED
- Environment and exact Node/npm versions
- Starting HEAD and final commit SHA (if any)
- Full audit summary and advisory IDs
- Affected package(s), dependency path(s), patched version(s), and production-vs-dev classification
- Changes made, or why no safe change was made
- Exact commands, exit codes, and test/build results
- Remaining risks and owner decisions required

## Git handoff

- Commit only the narrowly scoped frontend dependency and lockfile changes plus the report.
- If no source/lockfile change is warranted, commit the report only.
- Do not push if synchronization or repository identity checks fail.
- No CI.
- Final OpenCode handoff must be exactly four lines:

Branch:
Commit message:
Full SHA:
Report path:
