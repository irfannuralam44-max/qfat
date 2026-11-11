# QFAT-003WXAL — Validate better-sqlite3 12.11.1 on Linux

- **Task ID:** QFAT-003WXAL
- **Status:** READY FOR EXECUTION — mandatory cross-platform validation following QFAT-003WXA
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Required machine:** **PC LINUX ONLY** (owner's Linux Mint 22.3 x86_64 PC)
- **Runtime matrix:** Node.js 22.x and Node.js 24.x
- **Related Windows implementation:** `9a83b01985c973d92412b2861c6d6f00d1382f39`
- **Windows report:** `reports/QFAT-003WXA-better-sqlite3-12-windows-validation-report.md`
- **Windows audit note commit:** `840861a423afe22532a7944a31090ccdf9e5ede6`
- **Expected report:** `reports/QFAT-003WXAL-better-sqlite3-12-linux-validation-report.md`
- **Execution:** one OpenCode agent, serial; no parallel agents
- **CI:** Deferred by owner; do not create or run GitHub Actions.

---

## 1. Purpose and authorization boundary

The owner approved Option A to pin the existing SQLite driver to `better-sqlite3@12.11.1`. The Windows-only QFAT-003WXA validation and GPT source audit are complete with findings. This task validates the same committed dependency state on the owner's Linux PC before final cross-platform acceptance.

This is a **validation-only task**. The implementation is already committed. Do not change the dependency manifest, lockfile, application source, tests, scripts, schema, migrations, ADR-001, or any other tracked project file. The only permitted tracked change is this task's required Markdown report.

This task does not authorize:
- changing any dependency or package version;
- installing machine-wide toolchains or changing persistent machine configuration;
- suppressing lifecycle scripts or using `npm ci --ignore-scripts`;
- modifying source/tests/schema/migrations or the Windows report;
- accessing real databases, credentials, platform accounts, YouTube/Facebook APIs, or uploads;
- creating or running CI workflows.

## 2. Mandatory safe synchronization

At the very start:

1. Verify repository identity `irfannuralam44-max/qfat`, origin URL `https://github.com/irfannuralam44-max/qfat.git`, branch, HEAD, and working-tree status.
2. Preserve all local changes. Never reset, clean, stash, overwrite, discard, rebase, or force-push.
3. Fetch and synchronize only by `git pull --ff-only origin main` if the tree is clean and fast-forward-safe.
4. Stop and report BLOCKED if dirty, diverged, wrong remote, or unsafe.
5. Verify local HEAD equals `origin/main`.
6. Read this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, complete `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`, QFAT-003W Linux/Windows reports, the QFAT-003WX investigation, the QFAT-003WXA Windows report including GPT audit §14, and `apps/server/package.json` plus `apps/server/package-lock.json`.

No synchronization-only handoff: once safely synchronized, proceed with validation.

## 3. Strict machine and runtime scope

**Execute on PC LINUX ONLY. Do not use PC Windows.**

Target machine: owner's Linux Mint 22.3 x86_64 environment. Record actual distribution/release, kernel, architecture, shell, libc/glibc version, `process.platform`, and `process.arch`.

Validate both:
- Node.js 22.x with npm version bundled/selected for that runtime.
- Node.js 24.x with npm version bundled/selected for that runtime.

Use the existing runtime if it satisfies the matrix. If Node 22 is unavailable, a checksum-verified official portable Node.js 22 x64 archive may be unpacked only inside the task's unique temporary directory; do not install it system-wide or modify persistent PATH. Record exact archive URL and verify SHA-256 against the official Node.js checksum file. Do not assume runtime paths or versions.

Use isolated install state per Node major. Do not reuse `node_modules` across runtimes.

## 4. Required validation

All temporary databases, logs, extracted portable runtimes, and disposable test artifacts must live inside one unique system-temp directory created by this task and outside the repository.

### 4.1 Committed dependency integrity

Before running installs, record:
- current commit SHA and clean working tree;
- exact `apps/server/package.json` pin (`better-sqlite3: 12.11.1`);
- lockfile version and integrity/resolved entries for `better-sqlite3@12.11.1`;
- `hasInstallScript` and the `prebuild-install` dependency chain;
- `better-sqlite3` engine range and install script;
- no unexpected package/lockfile modifications.

Do not regenerate the lockfile. This task validates the committed lockfile as-is.

### 4.2 Standard clean install

From `apps/server`, for both Node 22 and Node 24, execute ordinary:

```bash
npm ci
```

Requirements:
- Exit code 0 on both runtimes.
- No `--ignore-scripts`, no blanket lifecycle-script suppression, and no manual binary copying.
- Record warnings and network behavior, especially GitHub release asset retrieval by `prebuild-install`.
- Confirm installed `better-sqlite3` is exactly `12.11.1`.
- Confirm no native compilation or system build toolchain was required, if that is the observed result.
- Record any fallback to `node-gyp`; if it occurs, stop and report exact evidence.

Do not make claims about offline installs; explicitly note whether GitHub release access was available during testing.

### 4.3 Native SQLite proof

On both runtimes, load the installed native binding and execute real SQLite operations against a newly created disposable database in the task temp directory. Verify and record:
- runtime/platform/architecture and native binding load;
- SQLite engine version;
- create/insert/select round trip;
- foreign-key enforcement, including a rejected invalid FK write;
- WAL mode and busy timeout;
- integrity check and clean close;
- no remaining WAL/SHM sidecars after close, where applicable.

Never open or modify an existing/default QFAT database.

### 4.4 Backend checks

On both runtimes execute and record exact commands, output summaries, and exit codes:
- `npm run typecheck`
- `npm test`
- `npm run audit:prod`
- `npm run audit:full`

Confirm the named test `migration upgrade v1 to v2 preserves existing data` actually executes and passes on both runtimes. Do not claim a test passed merely because it exists.

Expected audit interpretation:
- `npm run audit:prod` must remain clean (zero production vulnerabilities).
- `npm run audit:full` is expected to report the existing `GHSA-67mh-4wv8-2f99` development-tooling advisory (four moderate npm findings) and exit nonzero, consistent with ADR-001 and the Windows report.
- Do not suppress the advisory, run `npm audit fix`, or change dependencies. Any additional/new advisory must be separately investigated and reported; stop for owner review if material.

### 4.5 Linux install and supply-chain review

Verify the actual Linux native prebuild selected by `prebuild-install`, including binary architecture and successful load. Record:
- source host and release asset URL if available from install logs/debug output;
- whether the install fetched the native binary from GitHub releases;
- whether any compilation occurred;
- deprecation warning for `prebuild-install@7.1.3`;
- fallback behavior if the release asset is unavailable, based on package script/source inspection only (do not deliberately break network or force a failed install).

Compare Linux findings with the Windows report. Do not overstate support beyond Linux Mint 22.3 x86_64 and the exact tested Node versions.

### 4.6 Data safety and Git state

- Use only the unique task temp directory for disposable databases/logs.
- Record before/after `git status --short --branch`.
- Confirm `npm ci` does not modify tracked files or the committed lockfile.
- Do not remove anything outside the task temp directory.
- No persistent PATH, shell profile, registry, global Node/npm, or machine configuration changes.

## 5. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Correct committed version tested | Manifest and installed version exactly 12.11.1 |
| AC-02 | Committed lockfile used unchanged | Lockfile hash before/after; no regeneration |
| AC-03 | Node 22 Linux install succeeds | Standard `npm ci`, exit 0, native binding loads |
| AC-04 | Node 24 Linux install succeeds | Same evidence |
| AC-05 | No build toolchain needed | Install logs and environment evidence |
| AC-06 | Native SQLite works | Disposable DB round trip, FK, WAL, timeout, integrity |
| AC-07 | Typecheck and complete tests pass | Exact commands and exit codes on both runtimes |
| AC-08 | v1-to-v2 migration test passes | Named test output on both runtimes |
| AC-09 | Production audit remains clean | Exact output and exit code |
| AC-10 | Full audit remains transparent | Known advisory recorded; no suppression |
| AC-11 | Linux prebuild/supply-chain behavior documented | Host, asset, deprecation, fallback and network notes |
| AC-12 | No real data/account/API use | Explicit safety statement |
| AC-13 | No CI activation | No workflow created or executed |
| AC-14 | Report factual and complete | Environment, commands, outputs, exit codes, limitations |

Overall result may be **PASS WITH FINDINGS** only if AC-01 through AC-14 pass, with the known audit advisory handled transparently. If either runtime fails standard `npm ci`, native binding, or required tests, report BLOCKED/FAIL with exact evidence; do not invent a workaround.

## 6. Stop conditions

Stop and report BLOCKED/FAIL if:
- repository identity or safe synchronization is incorrect;
- working tree is dirty before work;
- lockfile must be modified to install;
- either runtime's standard `npm ci` fails;
- native compilation is required or `node-gyp` fallback occurs;
- production audit reports vulnerabilities;
- new material full-audit advisories appear;
- a disposable test risks touching pre-existing data;
- evidence is incomplete or cannot be reproduced.

Do not expand scope or alter committed implementation.

## 7. Expected report

Create exactly:

`reports/QFAT-003WXAL-better-sqlite3-12-linux-validation-report.md`

Include:
1. Status PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Task/repo/branch/base SHA/implementation SHA/report path/date.
3. Safe synchronization evidence.
4. Linux distribution/kernel/architecture/libc and Node/npm matrix.
5. Committed manifest/lockfile evidence and lockfile unchanged proof.
6. Exact `npm ci` commands/results for Node 22 and Node 24.
7. Native SQLite binding and disposable DB proof.
8. Typecheck, complete test, migration, and audit outputs/exit codes.
9. Linux prebuild source/host, deprecation, network and fallback analysis.
10. Before/after Git status and data-safety statement.
11. Findings, limitations, and explicit handoff for GPT/owner audit.
12. Accurate publication metadata; never invent a SHA or claim GPT ran local tests.

## 8. Publication and handoff

- Target branch: `main`.
- Run task-required checks and `git diff --check`.
- Commit and push only the required report after local validation.
- Do not amend or rewrite published history.
- Do not update ADR-001 in this task; GPT will audit both platform reports and then make a separate docs-only ADR update if cross-platform validation is accepted.
- Do not start another task or any platform API implementation.
- Final OpenCode handoff must contain exactly:

```text
Branch:
Commit message:
Full SHA:
Report path:
```

Agent completion is not owner acceptance. GPT will audit the report and GitHub diff. Cross-platform dependency acceptance and the ADR-001 update remain gated on that audit and owner approval.
