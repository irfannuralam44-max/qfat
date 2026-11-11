# QFAT-003WX — Windows Clean Install Remediation for better-sqlite3

- **Task ID:** QFAT-003WX
- **Status:** READY FOR EXECUTION — scoped remediation
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Required machine:** **PC WINDOWS ONLY**
- **Runtime matrix:** Node.js 22.x and Node.js 24.x
- **Related finding:** QFAT-003W F-01; report `reports/QFAT-003W-windows-backend-sqlite-validation-report.md`
- **Audit reference:** `40e6bd5984a77e73bafa84c65e9d0c4570db39f2`
- **Expected report:** `reports/QFAT-003WX-windows-clean-install-remediation-report.md`
- **Execution:** one OpenCode agent, serial; no parallel agents

---

## 1. Owner-approved objective

The owner explicitly approved this remediation direction on 2026-11-11:

> Make the QFAT backend install reproducibly on Windows with ordinary `npm ci`, without requiring the owner to install Python or Visual Studio C++ Build Tools, while **retaining better-sqlite3**.

Resolve the Windows install blocker demonstrated in QFAT-003W for the actual committed backend package and lockfile. The result must remain compatible with the approved Linux/Windows MVP target and Node.js >=22.

This task authorizes a narrowly scoped install remediation only. It does not authorize changing SQLite drivers, weakening dependency security, changing the product architecture, or starting API implementation.

## 2. Mandatory safe synchronization

At the very start:

1. Verify repository identity `irfannuralam44-max/qfat`, origin URL `https://github.com/irfannuralam44-max/qfat.git`, branch, HEAD, and working-tree status.
2. Preserve all local changes. Never reset, clean, stash, overwrite, discard, rebase, or force-push.
3. Fetch and synchronize only by `git pull --ff-only origin main` if the tree is clean and fast-forward-safe.
4. Stop and report BLOCKED if dirty, diverged, wrong remote, or unsafe.
5. Verify local HEAD equals `origin/main`.
6. Read this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`, `apps/server/package.json`, `apps/server/package-lock.json`, and the complete QFAT-003W report including GPT audit §18.
7. Inspect current package metadata and npm behavior before selecting a fix. Do not rely solely on the prior report's root-cause hypothesis.

## 3. Strict scope

### Allowed

- Investigate and implement the smallest safe change needed so standard `npm ci` succeeds on Windows without Python/MSVC.
- Retain `better-sqlite3` and its currently approved version unless a version change is separately approved. Prefer no dependency version change.
- Modify only install-related configuration and/or package scripts necessary for this objective, plus tests/docs/report required to prove the fix.
- Add a deterministic automated regression check for the install behavior where practical.
- Update the package lockfile only if the selected safe solution requires it; explain why and show the exact diff.
- Use official npm/Node/package documentation and reproducible experiments to justify the chosen method.

### Forbidden

- Do not replace `better-sqlite3` with another driver.
- Do not require Python, Visual Studio, MSVC, Windows SDK, node-gyp compilation, or other machine-wide toolchain installation.
- Do not use `npm ci --ignore-scripts` as the final user installation procedure.
- Do not set blanket `ignore-scripts=true` or otherwise disable all dependency lifecycle scripts without explicit owner approval. If this appears to be the only viable path, STOP and present the exact security/operational trade-off; do not implement it.
- Do not suppress npm audit findings, add vulnerability overrides, run `npm audit fix --force`, or downgrade Drizzle Kit.
- Do not change SQLite schema, migrations, application source behavior, API features, Facebook/YouTube integrations, credentials, or upload logic.
- Do not fix unrelated findings F-02 (migration CLI), F-03 (clean script), or F-04 (cleanup error suppression). Keep them explicitly out of scope.
- Do not create or run GitHub Actions. CI remains deferred by owner.
- Do not use real databases, credentials, platform accounts, or perform uploads.

## 4. Required investigation

Before editing, establish with evidence:

1. Exact `better-sqlite3@13.0.3` package tarball metadata versus npm registry metadata used by the tested npm clients.
2. Whether `gypfile: false` is present in the tarball and absent/present in the registry packument for the relevant metadata request.
3. Which npm versions (bundled with Node 22 and Node 24) trigger implicit `node-gyp rebuild`, and the exact conditions.
4. Whether a supported npm configuration or package metadata mechanism can prevent the false rebuild while still allowing required dependency lifecycle scripts to run.
5. Whether any proposed workaround disables legitimate lifecycle scripts, changes install reproducibility, or creates Linux regressions.
6. Whether the fix works from a clean checkout with standard `npm ci`, not merely with `--ignore-scripts`.

Do not assert the prior report's explanation as fact until these checks reproduce it. If the root cause differs, document the corrected diagnosis.

## 5. Implementation and verification

### 5.1 Implementation requirements

- Make the minimal cross-platform change that preserves normal dependency lifecycle behavior.
- Preserve the committed SQLite driver and approved dependency versions unless the task owner approves otherwise.
- Ensure standard commands remain straightforward and documented.
- Do not leave hidden manual steps for the owner (such as manually copying native binaries or running undocumented post-install commands).
- If no safe solution exists within this scope, make no code changes; publish an investigation report and request an owner decision.

### 5.2 Windows validation — mandatory

On **PC WINDOWS ONLY**, use the owner's Windows 10 Pro 22H2 x64 PC. Do not use the Linux PC for execution in this task.

For both Node.js 22.x and Node.js 24.x:

1. Record OS/build/architecture, PowerShell, exact Node executable, Node version, npm version, and `process.platform/process.arch`.
2. Use clean, isolated install state for each runtime.
3. Run the ordinary command from `apps/server`:

   ```powershell
   npm ci
   ```

4. Confirm exit code 0 without Python/MSVC/Visual Studio Build Tools and without `--ignore-scripts`.
5. Confirm the installed `better-sqlite3` binding loads and executes a real SQLite query against a newly created disposable temp database.
6. Run:
   - `npm run typecheck`
   - `npm test`
   - `npm run audit:prod`
   - `npm run audit:full` (record the existing ADR-001 dev-only advisory honestly; do not suppress it)
7. Verify the v1-to-v2 migration upgrade test passes.
8. Confirm `npm ci` does not modify tracked files or lockfile.
9. Record exact commands, outputs, exit codes, and any warnings.

If either runtime fails, report the exact failure and do not claim cross-runtime success.

### 5.3 Linux regression evidence

This task's execution machine is Windows only. Do not run commands on the Linux PC. Review the existing Linux QFAT-003 and QFAT-003R2B validation evidence and assess the proposed change for Linux compatibility. Mark any Linux execution test as NOT RUN; do not claim it passed.

### 5.4 Data and environment safety

- All disposable DBs and diagnostic files must be inside a unique, newly created system-temp directory outside the repository.
- Never target a default or user database.
- Do not install system packages, alter persistent PATH/registry/system configuration, or change global Node/npm.
- Portable runtimes may be used only under the task temp directory with official checksum verification.
- Record before/after Git status.
- Do not delete anything outside the exact task temp directory created by this task.

## 6. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Root cause independently reproduced | Tarball/registry metadata and npm behavior evidence |
| AC-02 | better-sqlite3 retained | Manifest and lockfile evidence |
| AC-03 | No Python/MSVC/Visual Studio build tools required | Actual environment and successful install |
| AC-04 | Standard `npm ci` succeeds on Node 22 | Exit 0 on Windows, no ignore-scripts |
| AC-05 | Standard `npm ci` succeeds on Node 24 | Exit 0 on Windows, no ignore-scripts |
| AC-06 | Native SQLite binding executes | Actual runtime query against disposable DB on both runtimes |
| AC-07 | Typecheck and full tests pass | Exact command outputs and exit codes on both runtimes |
| AC-08 | Production audit remains clean | `audit:prod` output and exit code |
| AC-09 | Full audit remains transparent | Full audit output; ADR-001 exception unsuppressed |
| AC-10 | v1-to-v2 upgrade test passes | Named test output on both runtimes |
| AC-11 | No install-time tracked changes | Before/after Git status and lockfile comparison |
| AC-12 | No blanket lifecycle-script suppression | Config/package review and actual install evidence |
| AC-13 | No unrelated scope expansion | Exact changed-file list |
| AC-14 | Report factual and reproducible | Exact environment, commands, results, findings, and limitations |

Overall PASS requires AC-01 through AC-14. If no safe fix can meet AC-12, stop without implementing and report BLOCKED with alternatives for owner decision.

## 7. Expected report

Create:

`reports/QFAT-003WX-windows-clean-install-remediation-report.md`

Include:

1. Final status PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Task, repo, branch, synchronized base SHA, implementation SHA, report path, date.
3. Root-cause investigation evidence and links/metadata.
4. Exact files changed and rationale for every change.
5. Windows machine/runtime matrix for Node 22 and 24.
6. Exact standard `npm ci` commands and exit codes.
7. Native binding proof, test/typecheck/migration/audit outputs.
8. Lifecycle-script security analysis.
9. Linux compatibility assessment; Linux execution explicitly NOT RUN.
10. Before/after Git status, lockfile diff, and data-safety statement.
11. Findings and remaining limitations.
12. Accurate Git publication metadata. Never invent SHA/timestamp or claim GPT independently ran local tests.

## 8. Publication and handoff

- Target branch: `main`.
- Keep changes narrowly scoped.
- Run all task-required checks and `git diff --check`.
- Commit and push only the scoped implementation and report after local verification.
- Do not amend or rewrite published history.
- Do not start another task or API implementation.
- Final OpenCode handoff must contain exactly:

```text
Branch:
Commit message:
Full SHA:
Report path:
```

Agent completion is not owner acceptance. GPT will audit the commit, code, and report before the owner accepts the remediation.
