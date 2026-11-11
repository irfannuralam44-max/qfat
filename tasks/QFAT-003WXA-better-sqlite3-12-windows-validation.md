# QFAT-003WXA — Adopt better-sqlite3 12.11.1 for Windows clean installs

- **Task ID:** QFAT-003WXA
- **Status:** READY FOR EXECUTION — owner-approved dependency-version change
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Required machine:** **PC WINDOWS ONLY** (owner's Windows 10 Pro 22H2 x64 PC)
- **Runtime matrix:** Node.js 22.x and Node.js 24.x
- **Owner decision:** Option A explicitly approved on 2026-11-11 after QFAT-003WX.
- **Related investigation:** `reports/QFAT-003WX-windows-clean-install-remediation-report.md`
- **Related decision record:** `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`
- **Expected report:** `reports/QFAT-003WXA-better-sqlite3-12-windows-validation-report.md`
- **Execution:** one OpenCode agent, serial; no parallel agents
- **CI:** Deferred by owner; do not create or run GitHub Actions.

---

## 1. Explicit owner authorization

The owner selected **Option A** in the QFAT-003WX report: change the version of the existing SQLite driver from `better-sqlite3@13.0.3` to `better-sqlite3@12.11.1`.

This task explicitly authorizes that narrowly scoped version change and the corresponding lockfile update, subject to all verification and stop conditions below.

The owner has **not** authorized:
- replacing `better-sqlite3` with another SQLite driver;
- changing Drizzle ORM, Drizzle Kit, TypeScript, tsx, or any unrelated dependency;
- installing Python, Visual Studio, MSVC, Windows SDK, or other machine-wide build tools;
- blanket lifecycle-script suppression or `npm ci --ignore-scripts`;
- changing schemas, migrations, application behavior, API integrations, credentials, or uploads;
- activating CI.

The selected 12.11.1 path has been diagnostically tested by the QFAT-003WX agent on both Windows Node runtimes, but that evidence is not a substitute for this task's clean repository implementation and full validation.

## 2. Objective

Make the committed QFAT backend install on the owner's Windows PC using ordinary `npm ci` with both Node.js 22.x and 24.x, without Python/MSVC/Visual Studio Build Tools, while retaining `better-sqlite3`.

The implementation must:
1. Change only the `better-sqlite3` version to `12.11.1` in the backend manifest and regenerate the lockfile reproducibly.
2. Preserve all other direct dependency versions and project scripts.
3. Confirm the resolved dependency tree and native prebuild behavior.
4. Validate actual SQLite operations and the existing backend test/migration suite.
5. Document the install-time GitHub release download introduced by the `prebuild-install` chain, including its network/provenance implications.
6. Keep the existing ADR-001 development-tooling audit exception transparent; do not suppress it.

Do not silently update ADR-001 during this implementation task. GPT will audit the result and then prepare a separate documentation-only ADR update if validation is accepted.

## 3. Mandatory safe synchronization

At the very start:

1. Verify repository identity `irfannuralam44-max/qfat`, origin URL `https://github.com/irfannuralam44-max/qfat.git`, branch, HEAD, and working-tree status.
2. Preserve all local changes. Never reset, clean, stash, overwrite, discard, rebase, or force-push.
3. Fetch and synchronize only by `git pull --ff-only origin main` if the tree is clean and fast-forward-safe.
4. Stop and report BLOCKED if dirty, diverged, wrong remote, or unsafe.
5. Verify local HEAD equals `origin/main`.
6. Read this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, the complete ADR-001, QFAT-003W and QFAT-003WX reports, `apps/server/package.json`, and `apps/server/package-lock.json`.
7. Inspect the current dependency graph before editing.

No synchronization-only handoff: once safely synchronized, proceed with the authorized work.

## 4. Strict implementation scope

### Allowed

- Change `apps/server/package.json` direct dependency `better-sqlite3` from `13.0.3` to exactly `12.11.1`.
- Regenerate `apps/server/package-lock.json` using the appropriate npm version and document the exact command/runtime.
- Make no other dependency changes.
- Add or adjust only a narrowly scoped regression test if required to prove install behavior; prefer no source/test changes if the existing suite covers the needed runtime behavior.
- Create the required Markdown report.

### Forbidden

- Do not replace the SQLite driver.
- Do not change Drizzle ORM, Drizzle Kit, tsx, TypeScript, @types packages, Node engine minimum, scripts, schema, migrations, or application source behavior.
- Do not use npm overrides, vendor/patch the tarball, hand-edit generated lockfile metadata, or rely on manual post-install steps.
- Do not use `--ignore-scripts`, set `ignore-scripts=true`, or suppress required lifecycle scripts.
- Do not run `npm audit fix`, especially `--force`; do not suppress advisories or downgrade Drizzle Kit.
- Do not modify QFAT-003W findings for migration CLI, clean script, or cleanup helpers.
- Do not touch real user databases, credentials, platform accounts, YouTube/Facebook APIs, or uploads.
- Do not create or run GitHub Actions.

## 5. Required Windows validation

**This task must execute on PC WINDOWS ONLY. Do not use PC Linux for execution.**

Machine target: owner's Windows 10 Pro 22H2 x64 PC. Record actual OS/build/architecture, PowerShell version, exact Node executable path, Node/npm versions, and `process.platform/process.arch`.

Runtime matrix:
- Node.js 22.x — mandatory.
- Node.js 24.x — mandatory.

For each runtime, use a clean, isolated install state. Do not reuse a native `node_modules` tree across Node majors.

### 5.1 Dependency update and lockfile

1. Change the manifest pin to `better-sqlite3: 12.11.1`.
2. Regenerate the lockfile with the matching npm runtime.
3. Inspect the complete diff and prove that no other direct dependency version changed.
4. Confirm lockfile integrity/resolved tarball and the transitive `prebuild-install` dependency chain.
5. Record package metadata, engine range, install scripts, deprecation notices, and native prebuild source/host.

### 5.2 Clean install

From `apps/server`, on both Node 22 and Node 24:

```powershell
npm ci
```

Requirements:
- Exit code 0 on both runtimes.
- No Python, MSVC, Visual Studio Build Tools, Windows SDK, or native compilation required.
- No `--ignore-scripts`, no blanket lifecycle-script suppression, and no manual binary copying.
- Record all warnings and any install-time network dependency, especially GitHub release asset retrieval by `prebuild-install`.
- Verify installed `better-sqlite3` version is exactly 12.11.1.

If either runtime fails, stop and report exact evidence; do not claim Windows clean-install success.

### 5.3 Native SQLite proof

On both runtimes, load the installed native binding and execute a real SQLite query against a newly created disposable database in a unique system-temp directory outside the repository. Verify and record:
- actual runtime/platform/architecture and native binding load;
- SQLite version and a simple create/insert/select round trip;
- foreign-key enforcement;
- WAL mode and busy timeout where supported by the existing connection configuration;
- integrity check and clean close;
- removal of disposable database sidecars only within the exact task temp directory.

Do not use any existing/default QFAT database.

### 5.4 Backend checks

On both runtimes, execute and record exact commands, output summaries, and exit codes:
- `npm run typecheck`
- `npm test`
- `npm run audit:prod`
- `npm run audit:full`

The full audit must remain unsuppressed. Record the known `GHSA-67mh-4wv8-2f99` development-tooling advisory and any newly introduced advisory separately. If the 12.11.1 transitive chain adds a material vulnerability or unresolved supply-chain concern, stop and report for owner review.

Confirm the v1-to-v2 migration upgrade test actually runs and passes on both runtimes. Do not claim a test passed merely because it exists.

### 5.5 Linux compatibility boundary

This is a Windows-only execution task. Do not run anything on PC Linux. Review the prior Linux evidence and assess the 12.11.1 package metadata/build targets for Linux compatibility. Mark Linux execution **NOT RUN**. A separate Linux validation task is required before final cross-platform acceptance.

### 5.6 Working tree and safety

- All disposable databases/logs must be under one unique system-temp directory created by this task.
- Record before/after `git status --short --branch`.
- Confirm ordinary `npm ci` does not alter tracked files or the committed lockfile.
- Do not remove or overwrite any user data.
- No persistent PATH, registry, global Node/npm, or machine configuration changes.

## 6. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Owner-approved exact driver version selected | Manifest pin exactly 12.11.1 |
| AC-02 | Only intended dependency changed | Manifest and lockfile diff; all unrelated direct dependencies unchanged |
| AC-03 | Lockfile reproducibly generated | Exact npm version/command and clean regeneration evidence |
| AC-04 | Node 22 standard Windows install succeeds | `npm ci` exit 0, no toolchain, no script suppression |
| AC-05 | Node 24 standard Windows install succeeds | Same evidence |
| AC-06 | Correct native binding works | Real disposable SQLite query on both runtimes |
| AC-07 | Typecheck and complete tests pass | Exact commands and exit codes on both runtimes |
| AC-08 | v1-to-v2 migration upgrade passes | Named test output on both runtimes |
| AC-09 | Production audit remains clean | Exact output and exit code |
| AC-10 | Full audit remains transparent | Exact output; known exception and new advisories distinguished |
| AC-11 | Install-time supply-chain behavior documented | `prebuild-install` source/host, deprecation and network implications |
| AC-12 | Lifecycle scripts remain enabled | Config and actual install evidence |
| AC-13 | No real data/account/API use | Explicit safety statement |
| AC-14 | Linux execution honestly marked NOT RUN | No unsupported cross-platform claim |
| AC-15 | No CI activation | No workflow created or executed |
| AC-16 | Report factual and complete | Environment, diffs, commands, exit codes, findings and limitations |

Overall result for this task can be **PASS WITH FINDINGS** only if AC-01 through AC-13 and AC-15 through AC-16 pass; AC-14 must accurately state Linux NOT RUN. Final cross-platform acceptance remains pending a separate Linux validation and GPT audit.

## 7. Stop conditions

Stop and report BLOCKED/FAIL if:
- repository identity or safe synchronization is incorrect;
- working tree is dirty before work;
- npm changes unrelated dependency versions;
- clean install fails on either runtime;
- native compilation/toolchain is required;
- a proposed workaround suppresses lifecycle scripts or relies on undocumented manual steps;
- production audit becomes vulnerable or a new material advisory appears;
- install requires an unreviewed network/provenance exception;
- test cleanup targets ambiguous/pre-existing data;
- evidence is incomplete or cannot be reproduced.

Do not invent a workaround outside the authorization.

## 8. Expected report

Create exactly:

`reports/QFAT-003WXA-better-sqlite3-12-windows-validation-report.md`

Include:
1. Status PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Task/repo/branch/base SHA/implementation SHA/report path/date.
3. Safe synchronization evidence.
4. Windows machine/runtime matrix.
5. Exact manifest/lockfile changes and direct/transitive dependency comparison.
6. Exact `npm ci` commands/results for Node 22 and Node 24.
7. Native SQLite binding and disposable DB proof.
8. Typecheck, complete test, migration, and audit outputs/exit codes.
9. `prebuild-install` network/provenance/deprecation analysis.
10. Linux compatibility assessment with Linux execution explicitly NOT RUN.
11. Before/after Git status and data-safety statement.
12. Findings, limitations, and explicit handoff for GPT/owner audit.
13. Accurate publication metadata; never invent a SHA or claim GPT ran local tests.

## 9. Publication and handoff

- Target branch: `main`.
- Run task-required checks and `git diff --check`.
- Commit and push only the scoped manifest/lockfile change and report after local verification.
- Do not amend or rewrite published history.
- Do not update ADR-001 in this task; GPT will make a separate docs-only update after audit and Linux validation.
- Do not start another task or any platform API implementation.
- Final OpenCode handoff must contain exactly:

```text
Branch:
Commit message:
Full SHA:
Report path:
```

Agent completion is not owner acceptance. GPT will audit the pushed diff/report; Linux validation and a separate ADR update remain mandatory before final dependency decision acceptance.
