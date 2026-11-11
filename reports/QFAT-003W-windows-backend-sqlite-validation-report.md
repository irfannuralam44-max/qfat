# QFAT-003W — Windows Backend SQLite Foundation Regression Validation Report

- **Status:** **BLOCKED** — validation was executed on Windows, but the mandatory lockfile install (`npm ci`) fails on this Windows machine for both Node.js 22 and Node.js 24. Install-dependent acceptance cannot be granted until the owner decides how to resolve it. See §5 and §14.1.
- **Task ID:** QFAT-003W
- **Task specification:** `tasks/QFAT-003W-windows-backend-sqlite-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Synchronized base SHA:** `301f2295da3d80b8acf79df204136621ea000c63`
- **Implementation state SHA:** `301f2295da3d80b8acf79df204136621ea000c63` (no source, test, schema, migration, manifest, or lockfile changes were made)
- **Report path:** `reports/QFAT-003W-windows-backend-sqlite-validation-report.md`
- **Execution date:** 2026-11-11
- **Machine scope:** Windows only (owner's Windows 10 Pro 22H2 x64 PC). Linux was **NOT RUN** for this task.
- **CI:** Deferred by owner. No workflow was created or executed.

---

## 1. Executive Summary

The committed `apps/server` backend was validated on Windows 10 Pro 22H2 x64 under Node.js 22.23.4 and Node.js 24.16.0.

**Blocking result:** the required clean install command `npm ci` **failed with exit code 1 on both runtimes**. npm attempted an implicit `node-gyp rebuild` for `better-sqlite3@13.0.3`, and this machine has no Python installation and no Visual Studio C++ build tools. The package does **not** need compilation: it ships `prebuilds/win32-x64.node` and `lib/binding.js` loads that prebuild at runtime. The rebuild is triggered because npm's abbreviated registry metadata for this package version omits `"gypfile": false`, so npm's `isGyp` check treats the package as a node-gyp package.

No system toolchain was installed and no repository change was made, because this task is validation-only and both actions are outside its authorization.

To determine whether the defect is limited to the install step, a clearly labeled **diagnostic** install (`npm ci --ignore-scripts`, which skips lifecycle scripts and uses the shipped prebuilds) was performed for each runtime. Under that diagnostic install:

- the native `better-sqlite3` binding actually loaded and executed SQLite queries on both runtimes;
- `npm run typecheck` passed on both runtimes;
- the complete committed test suite passed on both runtimes (14/14), including `migration upgrade v1 to v2 preserves existing data`;
- migration generation was idempotent and produced no tracked changes;
- the runtime migrator applied 2 migrations to a fresh temporary database and applied 0 on a second run;
- test fixtures left no database, WAL, SHM, or migration-directory files behind;
- `npm run audit:prod` reported 0 vulnerabilities (exit 0);
- `npm run audit:full` reported the ADR-001-documented dev-only advisory `GHSA-67mh-4wv8-2f99` (4 moderate, exit 1), unsuppressed.

These diagnostic results are **not** a substitute for the required `npm ci` and are reported as diagnostic evidence only.

A second, non-blocking finding: `npm run db:migrate` exits 0 but performs no migration. `tsx src/db/migrate.ts` loads a module that only defines exported functions; there is no CLI entrypoint and no explicit database-path argument. The runtime migrator is reachable only through the exported API and the test suite.

---

## 2. Safe Synchronization Evidence

| Check | Result |
|---|---|
| Repository root | `C:/Users/irfan/Documents/qfat` |
| `origin` fetch URL | `https://github.com/irfannuralam44-max/qfat.git` |
| `origin` push URL | `https://github.com/irfannuralam44-max/qfat.git` |
| Branch | `main` |
| HEAD before fetch | `4f47170558dd14d5e74a4dddd8b4aa69897649a1` |
| Working tree before fetch | Clean (`git status --porcelain=v1 -uall` produced no output) |
| `git fetch origin main --prune` | Succeeded; `origin/main` = `301f2295da3d80b8acf79df204136621ea000c63` |
| Fast-forward check | `git merge-base --is-ancestor HEAD origin/main` returned true |
| Synchronization | `git pull --ff-only origin main` → `Updating 4f47170..301f229`, fast-forward |
| HEAD after synchronization | `301f2295da3d80b8acf79df204136621ea000c63` |
| Working tree after synchronization | Clean |

No reset, clean, stash, overwrite, rebase, or force-push was used. No local work was discarded (the tree was clean before synchronization).

---

## 3. Machine and Runtime Matrix

### 3.1 Machine

| Property | Value |
|---|---|
| OS product name | Windows 10 Pro |
| Display version | 22H2 |
| Build / UBR | 19045 / 6466 |
| `[System.Environment]::OSVersion.Version` | 10.0.19045.0 |
| `RuntimeInformation.OSArchitecture` | X64 |
| PowerShell | 5.1.19041.6456 (Desktop, CLR 4.0.30319.42000) |
| `process.platform` / `process.arch` | `win32` / `x64` |

This report makes **no claim** about Windows 11, ARM64, or any other machine.

### 3.2 Runtime matrix

| Runtime | Source | Executable | npm | ABI (`process.versions.modules`) | N-API |
|---|---|---|---|---|---|
| Node.js 22.x (mandatory minimum) | Checksum-verified portable archive, extracted only inside this task's temp directory | `C:\Users\irfan\AppData\Local\Temp\qfat-003w-63187cdc53c8\node-v22.23.4-win-x64\node.exe` (v22.23.4) | 10.9.9 (bundled, invoked explicitly) | 127 | 10 |
| Node.js 24.x | Existing system installation | `C:\Program Files\nodejs\node.exe` (v24.16.0) | 11.13.0 | 137 | 10 |

**Node 22 was not installed on this PC.** Per task §3, a portable archive was used:

- Source: `https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip`
- Checksum file: `https://nodejs.org/dist/v22.23.4/SHASUMS256.txt`
- Expected SHA-256: `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`
- Actual SHA-256: `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20` → **MATCH**
- Archive size: 35,604,229 bytes
- Extracted only under `C:\Users\irfan\AppData\Local\Temp\qfat-003w-63187cdc53c8\`
- No installer was run; no persistent PATH, registry, or system configuration was changed. PATH was prefixed only within the individual shell processes used for the Node 22 commands, and the bundled `npm.cmd` was invoked explicitly (verified `node_exe` and `npm_exe` resolved to the portable directory).

---

## 4. Package and Lockfile Inspection

Inspection was performed from the synchronized checkout. No inspected file was edited.

### 4.1 `apps/server/package.json`

| Property | Value |
|---|---|
| Name / version | `@qfat/server` / `0.1.0` |
| Module type | ESM (`"type": "module"`) |
| Engines | `node >=22.0.0` |
| Runtime dependencies | `better-sqlite3@13.0.3`, `drizzle-orm@0.45.4` |
| Dev dependencies | `@types/better-sqlite3@7.6.11`, `@types/node@22.0.0`, `drizzle-kit@0.31.11`, `tsx@4.23.15`, `typescript@7.0.2` |
| Scripts | `build`, `clean`, `typecheck`, `test`, `db:generate`, `db:migrate`, `db:studio`, `audit:prod`, `audit:full` |

`apps/server/package-lock.json` is committed (`lockfileVersion: 3`).

### 4.2 Source inspection

- `src/db/connection.ts` — `openDatabase()` creates the parent directory, opens the file, applies and verifies `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`, and returns the SQLite version. `createTempDatabase()` uses `TMPDIR ?? TEMP ?? '/tmp'` with a timestamp plus random suffix.
- `src/db/migrate.ts` — exports `runMigrations()` and `runMigrationsWithVerification()`, both using the Drizzle migrator and the shared connection module. **There is no CLI entrypoint and no top-level execution.**
- `src/schema/index.ts` — minimal `app_meta` table with v2 `description` column; no business schema.
- `migrations/0000_lyrical_zemo.sql`, `migrations/0001_dapper_tony_stark.sql`, `migrations/meta/_journal.json` — two committed migrations, matching journal entries (`when` 1794370402769 and 1794370884131).
- `test/connection.test.ts` — 9 connection tests plus 5 migration tests, including the v1-to-v2 upgrade test.
- `drizzle.config.ts` — schema `./src/schema/index.ts`, output `./migrations`, SQLite dialect, `dbCredentials.url: 'sqlite:///dev/null'`.

Test paths were inspected before execution: fixtures are created under the process temp directory (not in the repository and not at any user database path).

### 4.3 Installed versions (diagnostic install, both runtimes)

`npm ls --depth=0` (Node 22 and Node 24 produced the same direct tree):

```
@qfat/server@0.1.0
+-- @types/better-sqlite3@7.6.11
+-- @types/node@22.0.0
+-- better-sqlite3@13.0.3
+-- drizzle-kit@0.31.11
+-- drizzle-orm@0.45.4
+-- tsx@4.23.15
`-- typescript@7.0.2
```

The diagnostic install reported `added 24 packages, and audited 25 packages`.

---

## 5. Required Clean Install — **BLOCKING FAILURE**

### 5.1 Node.js 22.23.4 / npm 10.9.9

Command (from `apps/server`, portable npm invoked explicitly):

```powershell
npm.cmd ci
```

- **Exit code: 1**
- Output (excerpt):

```
npm error code 1
npm error path C:\Users\irfan\documents\qfat\apps\server\node_modules\better-sqlite3
npm error command failed
npm error command C:\Windows\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info using node-gyp@11.5.0
npm error gyp info using node@22.23.4 | win32 | x64
npm error gyp ERR! find Python You need to install the latest version of Python.
npm error gyp ERR! configure error
npm error gyp ERR! stack Error: Could not find any Python installation to use
```

The first run also emitted a transient cleanup warning:

```
npm warn cleanup Failed to remove some directories [
npm warn cleanup   [ '\\\\?\\...\\node_modules\\@esbuild-kit\\core-utils\\node_modules\\esbuild',
npm warn cleanup     [Error: EPERM: operation not permitted, rmdir ...] ] ]
```

This warning did not recur on the confirmation run and did not affect tracked files (see finding F-05).

A **confirmation run** of the same command produced the same failure:

- **Exit code: 1**
- Same `node-gyp rebuild` failure, same missing-Python cause.

### 5.2 Node.js 24.16.0 / npm 11.13.0

Command:

```powershell
npm.cmd ci
```

- **Exit code: 1**
- Output (excerpt):

```
npm error code 1
npm error path C:\Users\irfan\documents\qfat\apps\server\node_modules\better-sqlite3
npm error command failed
npm error command C:\Windows\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info using node-gyp@12.3.0
npm error gyp info using node@24.16.0 | win32 | x64
npm error gyp ERR! find Python You need to install the latest version of Python.
npm error gyp ERR! stack Error: Could not find any Python installation to use
```

### 5.3 Root cause analysis (evidence-based)

1. `better-sqlite3@13.0.3` ships prebuilt binaries. The published tarball contains:
   - `prebuilds/win32-x64.node` (1,989,632 bytes)
   - `lib/binding.js`, which resolves `prebuilds/<platform>-<arch>.node` at runtime
   - `lib/win32-x64.js`, which loads `../prebuilds/win32-x64.node`
2. The tarball's own `package.json` contains `"gypfile": false` and **no** `install` script.
3. However, the npm registry's abbreviated ("corgi") packument for `better-sqlite3@13.0.3` contains only `name, version, dependencies, devDependencies, dist, engines` — **`gypfile` is absent**.
4. npm's arborist rebuild logic (verified in both npm 10.9.9 and npm 11.13.0) is:

   ```js
   const isGyp = gypfile !== false &&
     !install &&
     !preinstall &&
     await isNodeGypPackage(node.path)
   ...
   if (isGyp) { scripts.install = defaultGypInstallScript }
   ```

   With `gypfile` undefined, npm runs `node-gyp rebuild` for any package containing `binding.gyp`.
5. This machine has **no usable Python** (`python`/`python3` resolve only to the Microsoft Store alias stub; `py` is not installed) and **no Visual Studio build tools** (`vswhere.exe` absent). `node-gyp` therefore fails.
6. Installing Python and the MSVC C++ toolchain, or changing npm/repository configuration, would be an unapproved system/repository change and is outside this validation task.

Because the package already ships a loadable N-API prebuild, the install failure is an npm metadata/build-detection problem, not a missing-binary problem. The owner must decide how to address it (for example, an approved toolchain, an approved install configuration, or an approved dependency/npm change). This report does not implement or authorize any of those options.

### 5.4 Diagnostic install (not acceptance evidence)

To determine whether the committed package itself works on Windows, the following **diagnostic** command was run for each runtime, using the same committed lockfile and no system changes:

```powershell
npm ci --ignore-scripts
```

| Runtime | Exit code | Result |
|---|---|---|
| Node 22.23.4 / npm 10.9.9 | 0 | `added 24 packages, and audited 25 packages in 15s` |
| Node 24.16.0 / npm 11.13.0 | 0 | `added 24 packages, and audited 25 packages in 7s` |

`--ignore-scripts` skips lifecycle scripts, including esbuild's install scripts. The esbuild platform binaries are present as optional dependencies in the committed lockfile (`@esbuild/win32-x64@0.18.20`, `0.25.12`, `0.28.2`), and `tsx` and `drizzle-kit` executed successfully. This diagnostic does not replace the failed `npm ci` and is not treated as acceptance evidence for AC-04.

---

## 6. Native Binding Evidence

A disposable diagnostic script was placed in the task temp directory. It resolved the installed package from `apps/server`, loaded the prebuild directly, and opened a new database under the task temp directory.

### 6.1 Node.js 22.23.4

```
node=v22.23.4
platform_arch=win32 x64
modules_abi=127
napi=10
prebuild_path=C:\Users\irfan\documents\qfat\apps\server\node_modules\better-sqlite3\prebuilds\win32-x64.node
prebuild_exists=true
direct_addon_load=ok
sqlite_version=3.53.4
journal_mode=wal
foreign_keys=1
roundtrip={"id":1,"note":"windows-diag"}
db_closed=ok
db_path=C:\Users\irfan\AppData\Local\Temp\qfat-003w-63187cdc53c8\diag-node22\diag-abi127.db
```

Exit code: 0.

### 6.2 Node.js 24.16.0

```
node=v24.16.0
platform_arch=win32 x64
modules_abi=137
napi=10
prebuild_path=C:\Users\irfan\documents\qfat\apps\server\node_modules\better-sqlite3\prebuilds\win32-x64.node
prebuild_exists=true
direct_addon_load=ok
sqlite_version=3.53.4
journal_mode=wal
foreign_keys=1
roundtrip={"id":1,"note":"windows-diag"}
db_closed=ok
db_path=C:\Users\irfan\AppData\Local\Temp\qfat-003w-63187cdc53c8\diag-node24\diag-abi137.db
```

Exit code: 0.

The same `win32-x64.node` N-API prebuild loaded under both ABI 127 and ABI 137. After `db.close()`, only the main `.db` file remained; no `-wal` or `-shm` sidecar files were present.

---

## 7. Backend Verification

All commands below were run from `apps/server` with the runtime-specific Node/npm identified in §3.2, after the diagnostic install. "Node 22" = 22.23.4 / npm 10.9.9; "Node 24" = 24.16.0 / npm 11.13.0.

| Check | Command | Node 22 | Node 24 |
|---|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0 | exit 0 |
| Complete test suite | `npm test` | exit 0, 14/14 pass | exit 0, 14/14 pass |
| Production audit | `npm run audit:prod` | exit 0, 0 vulnerabilities | exit 0, 0 vulnerabilities |
| Full audit | `npm run audit:full` | exit 1, 4 moderate (documented) | exit 1, 4 moderate (documented) |
| Migration generation (1st) | `npm run db:generate` | exit 0, no schema changes | exit 0, no schema changes |
| Migration generation (2nd) | `npm run db:generate` | exit 0, no schema changes | exit 0, no schema changes |
| Migration script | `npm run db:migrate` | exit 0, **no migration performed** | exit 0, **no migration performed** |
| Runtime migrator (diagnostic) | exported `runMigrationsWithVerification()` on a fresh temp DB | exit 0, 2 applied then 0 | exit 0, 2 applied then 0 |

`tsconfig.json` excludes `test`, so `tsc --noEmit` covers `src/**/*.ts`.

### 7.1 Test results (Node 22)

```
# tests 14
# suites 2
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Tests:

```
SQLite Connection
  ok 1 - opens file-backed database and verifies PRAGMAs
  ok 2 - enables and verifies foreign key enforcement
  ok 3 - transaction commit persists data
  ok 4 - transaction rollback leaves no partial data
  ok 5 - WAL mode is enabled and verified
  ok 6 - busy timeout is applied and readable
  ok 7 - prepared statement insert/select works
  ok 8 - close and reopen preserves data
  ok 9 - integrity_check returns ok

Drizzle Migrations
  ok 1 - applies initial migration to fresh database
  ok 2 - re-running migrations is safe and idempotent
  ok 3 - migration tracking table records applied migrations
  ok 4 - Drizzle basic read-write operation works
  ok 5 - migration upgrade v1 to v2 preserves existing data
```

### 7.2 Test results (Node 24)

```
ℹ tests 14
ℹ suites 2
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

All 14 named tests passed, including `migration upgrade v1 to v2 preserves existing data`.

---

## 8. Migration Generation, Runtime Migrator, and v1-to-v2 Upgrade

### 8.1 Generation idempotence

`npm run db:generate` was run twice per runtime. Both runs reported:

```
Reading config file 'C:\Users\irfan\documents\qfat\apps\server\drizzle.config.ts'
1 tables
app_meta 4 columns 0 indexes 0 fks

No schema changes, nothing to migrate 😴
```

Exit code 0 on every run. `git status --porcelain=v1 -uall` was empty after each run and after both runs; `git diff --stat` was empty. No migration or metadata file was rewritten.

### 8.2 Runtime migration command

`npm run db:migrate` executes `tsx src/db/migrate.ts`. The module only defines exports; it has no top-level invocation and no CLI argument parsing. Both runtimes exited 0 with no output and created no database file. **Finding F-02:** the committed migration command is a no-op and does not expose a safe explicit-path CLI. Per task §6.4, a script-driven migration against a disposable database is therefore **NOT RUN — no such command exists**.

### 8.3 Runtime migrator (diagnostic invocation)

To verify the actual migrator logic on Windows, the exported `runMigrationsWithVerification()` was invoked from a temporary diagnostic script against a new database inside the task temp directory:

Node 22:

```
first={"appliedCount":2,"tables":["app_meta"]}
second={"appliedCount":0,"tables":["app_meta"]}
db_exists=true
wal_exists=false
shm_exists=false
```

Node 24 produced the identical result. Exit code 0 in both cases. The second run applied 0 migrations, confirming repeat safety. No WAL/SHM files remained after the connection closed.

### 8.4 v1-to-v2 upgrade test

Test name: `migration upgrade v1 to v2 preserves existing data`.

Observed result: **ok 5** under `Drizzle Migrations` on Node 22 and **✔** on Node 24 (see §7.1/§7.2). The test:

- derives the v1 and v2 tags from `migrations/meta/_journal.json`;
- reads the committed SQL files and computes both SHA-256 hashes at runtime;
- builds a v1-only migration fixture in a unique `mkdtempSync` directory;
- applies v1, asserts the `description` column is absent, inserts a row;
- applies the full migration set (v1 skipped, v2 applied);
- asserts the `description` column exists, the row and value are preserved, exactly two migrations are tracked, and both ledger hashes/timestamps match the dynamically derived values.

---

## 9. Fixture and Cleanup Review

### 9.1 Source review against task §6.5

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Test creates a unique database fixture | PASS | `createTempDatabase()` uses `Date.now()` + 6 random base-36 characters under `TMPDIR`/`TEMP` |
| 2 | v1 fixture directory created inside the outer `try` | PASS | `v1FixtureDir = mkdtempSync(...)` at line 327, inside the outer `try` |
| 3 | Directory removed only if the variable was assigned | PASS | `if (v1FixtureDir) { rmSync(v1FixtureDir, { recursive: true, force: true }) }` |
| 4 | Each database handle closes in its own `finally` | PASS | `conn1` (lines 364–371), `db1` (374–387), `conn2` (390–397), `db2` (400–428) |
| 5 | Outer `finally` attempts DB fixture cleanup after temp-directory removal | PASS | `rmSync(...)` then `cleanup()` at line 439 |
| 6 | Cleanup does not target a pre-existing directory or database | PASS | `mkdtempSync` path is unique; `cleanup()` unlinks only its own path and its `-wal`/`-shm` sidecars |

Limitation: both cleanup helpers suppress filesystem errors (`catch {}`), so a locked Windows file would be silently left behind rather than reported by the test itself. This run produced no leftovers, but the helper cannot prove absence by itself (finding F-04).

### 9.2 Before/after temp-directory evidence

Each test run used a dedicated, previously non-existent directory under the task temp root, with `TMPDIR`, `TEMP`, and `TMP` set to that directory for the test process:

| Runtime | Test temp directory | Before | After |
|---|---|---|---|
| Node 22 | `...\qfat-003w-63187cdc53c8\test-run-node22` | empty | `node-compile-cache\`, `tsx-irfan\` only |
| Node 24 | `...\qfat-003w-63187cdc53c8\test-run-node24` | empty | `node-compile-cache\`, `tsx-irfan\` only |

`node-compile-cache` and `tsx-irfan` are Node/tsx tool caches created because `TEMP` was redirected; they are not test fixtures.

A recursive search of the task temp directory, plus a top-level search of the system temp root, for `qfat-test-*` and `qfat-v1-fixture-*` returned **no results** after the test runs. No `-wal`/`-shm` files remained.

### 9.3 Remaining task temp files (retained evidence)

All disposable files live under one unique directory outside the repository:

```
C:\Users\irfan\AppData\Local\Temp\qfat-003w-63187cdc53c8
```

Contents retained for evidence: the checksum file and Node 22 zip/extracted runtime, command logs, diagnostic scripts, `diag-node22\diag-abi127.db`, `diag-node24\diag-abi137.db`, `migrate-diag-node22\migrate-diag.db`, `migrate-diag-node24\migrate-diag.db`, and the two test-run directories. No tracked repository file and no user data file was deleted or modified; the only non-temp changes were inside the gitignored `apps/server/node_modules/` install tree, which `npm ci` recreates by design. No user database, credential, queue, or `.secrets/` path was accessed.

---

## 10. Dependency Audits and ADR-001 Interpretation

### 10.1 Production scope

`npm run audit:prod` (`npm audit --omit=dev`) on both runtimes:

```
found 0 vulnerabilities
```

Exit code 0.

### 10.2 Full scope

`npm run audit:full` (`npm audit`) on both runtimes. Output (excerpt):

```
esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install drizzle-kit@0.18.1, which is a breaking change
node_modules/@esbuild-kit/core-utils/node_modules/esbuild
  @esbuild-kit/core-utils  *
    @esbuild-kit/esm-loader  *
      drizzle-kit  0.19.0 - 1.0.0-beta.1-fd8bfcc

4 moderate severity vulnerabilities
```

Exit code 1.

Interpretation under ADR-001: this is the documented, dated development-tooling exception (`GHSA-67mh-4wv8-2f99`, four npm nodes, vulnerable `esbuild@0.18.20` in the deprecated `@esbuild-kit` chain under `drizzle-kit`). Production scope is clean. Nothing was suppressed, no override was added, and `npm audit fix --force` was not run.

---

## 11. Working-Tree Integrity

| Point in time | `git status` | Result |
|---|---|---|
| Before fetch/pull | clean | `## main` |
| After `git pull --ff-only` | clean | `## main` |
| After Node 22 validation | clean | no tracked changes |
| After Node 24 validation | clean | `## main` |
| Final check (after staging the report) | clean | `## main`; `git diff --cached --check` exit 0; only this report staged |

No tracked source, test, schema, migration, package manifest, or lockfile was modified. `apps/server/node_modules/` is gitignored and untracked; after the final confirmation run of the failing `npm ci`, it contained only an empty `.bin/` directory. No `.db`, `-wal`, or `-shm` file exists in the repository.

The only file added by this task is this report.

---

## 12. Acceptance Criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Correct Windows machine and architecture identified | **PASS** | Windows 10 Pro 22H2, build 19045.6466, X64, PowerShell 5.1.19041.6456 (§3.1) |
| AC-02 | Node 22 minimum runtime tested | **BLOCKED** | Portable Node 22.23.4 checksum-verified and used; required `npm ci` exit 1 (node-gyp/Python). Diagnostic install, typecheck, native load, and 14/14 tests passed (§5.1, §6.1, §7.1) |
| AC-03 | Node 24 regression tested when available | **BLOCKED** | Node 24.16.0 available; required `npm ci` exit 1 (same cause). Diagnostic install, typecheck, native load, and 14/14 tests passed (§5.2, §6.2, §7.2) |
| AC-04 | Actual committed backend package installs from lockfile | **FAIL** | `npm ci` exit 1 on both runtimes; `node-gyp rebuild` attempted for `better-sqlite3@13.0.3`; no Python/MSVC (§5.1–5.3) |
| AC-05 | Windows native SQLite binding actually loads | **PASS (diagnostic install)** | `prebuilds/win32-x64.node` loaded directly; SQLite 3.53.4 query executed on both ABI 127 and ABI 137 (§6) |
| AC-06 | Backend typecheck and complete tests pass | **PASS (diagnostic install)** | `tsc --noEmit` exit 0; 14/14 tests exit 0 on both runtimes (§7) |
| AC-07 | Migration generation/runtime checks are safe | **PASS (with finding F-02)** | Two generation runs per runtime, exit 0, no tracked changes; runtime migrator applied 2 then 0 on a fresh temp DB. `db:migrate` is a no-op (§8) |
| AC-08 | v1-to-v2 upgrade test passes on Windows | **PASS** | `migration upgrade v1 to v2 preserves existing data` passed on both runtimes (§8.4) |
| AC-09 | Fixture and database cleanup are Windows-safe | **PASS** | Source review of all six §6.5 requirements; before/after temp directories; no `qfat-test-*`, `qfat-v1-fixture-*`, WAL, or SHM leftovers (§9) |
| AC-10 | Production audit result documented | **PASS** | `found 0 vulnerabilities`, exit 0 on both runtimes (§10.1) |
| AC-11 | Full audit advisory interpreted under ADR-001 | **PASS** | 4 moderate `GHSA-67mh-4wv8-2f99`, exit 1, dev-only, unsuppressed (§10.2) |
| AC-12 | No tracked changes or user data touched | **PASS** | Clean `git status` before/after; only this report added; no user DB or credentials (§11) |
| AC-13 | CI remains deferred | **PASS** | No `.github` directory/workflow exists; none created or executed (§13) |
| AC-14 | Report accurately distinguishes PASS, FAIL, BLOCKED, and NOT RUN | **PASS** | This report separates required-command failures from diagnostic results; no inferred results |

**Overall status: BLOCKED.** The mandatory lockfile install fails on this Windows machine for both required runtimes. All install-dependent criteria that could be evaluated diagnostically passed, but they are not claimed as acceptance evidence for the required `npm ci` command.

---

## 13. Platform and CI Scope

| Item | Status |
|---|---|
| Windows 10 Pro 22H2 x64 | Executed (this report) |
| Windows 11 / ARM64 / other editions | **NOT RUN** — not available; no claim made |
| Linux | **NOT RUN** in this task (prohibited by task §3) |
| GitHub Actions / CI | **DEFERRED BY OWNER** — no workflow file exists, none was created, none was executed |

---

## 14. Findings and Limitations

### 14.1 Blocking finding

**F-01 — `npm ci` fails on Windows for both Node 22 and Node 24.**

- npm runs an implicit `node-gyp rebuild` for `better-sqlite3@13.0.3`.
- The registry's abbreviated packument omits `gypfile: false`, which the tarball itself declares, so npm's `isGyp` detection is true even though the package ships a working `win32-x64` prebuild and needs no compilation.
- This machine has no Python and no Visual Studio C++ build tools.
- Installing those toolchains, or changing npm/repository configuration, is outside this validation-only task and was not attempted.
- Owner decision required before AC-02/AC-03/AC-04 can be accepted.

### 14.2 Non-blocking findings

**F-02 — `npm run db:migrate` performs no migration.** The script runs `tsx src/db/migrate.ts`, a module with exports only. There is no CLI entrypoint and no explicit database-path argument, so the command exits 0 without opening a database. The runtime migrator is verified only through its exported API and the test suite. A future task should decide whether to add a safe explicit-path CLI.

**F-03 — `npm run clean` is not Windows-compatible.** It uses `rm -rf dist`, which is a Unix shell command. It was not executed in this task and does not affect the validated paths.

**F-04 — Test cleanup helpers suppress filesystem errors.** `createTestDb().cleanup()` and the v1 fixture-directory removal both use `catch {}`. A locked Windows file would be silently left behind. No leftovers were observed in this run, but the helpers cannot self-report a failure.

**F-05 — Transient npm cleanup `EPERM` warning.** The first Node 22 `npm ci` run reported `EPERM` while removing `@esbuild-kit/core-utils/node_modules/esbuild`. It did not recur on the confirmation run and did not touch tracked files. Likely a transient file lock (for example, antivirus scanning); recorded for completeness.

### 14.3 Limitations

- The required clean install was not achieved; all runtime verification used `npm ci --ignore-scripts`, which also skips esbuild install scripts. The esbuild platform packages are present from the lockfile and `tsx`/`drizzle-kit` worked, but this is diagnostic, not acceptance, evidence.
- Node 22 was a portable, checksum-verified runtime in the task temp directory, not a system installation. No persistent PATH change was made.
- Only Windows 10 Pro 22H2 x64 was tested. No Windows 11, ARM64, or Linux claim is made.
- No concurrent/multi-process SQLite contention or large-WAL stress test was performed.
- No real user database, credential, platform account, or upload was used.
- All results are agent-executed evidence; the GPT/owner audit is an independent review of the published source and report, not a rerun of these commands.

---

## 15. Data-Safety Statement

- No real QFAT user database was opened, migrated, or modified.
- No OAuth token, Page token, app secret, credential, `.secrets/` file, or `queue/` content was accessed, logged, or transmitted.
- No YouTube/Facebook/platform API was called; no upload occurred.
- Network access was limited to downloading the official Node.js 22 archive and checksum, and npm registry dependency metadata/packages.
- All generated databases, migration fixtures, diagnostic scripts, and logs are under the single unique task temp directory recorded in §9.3, outside the repository.
- Deletion was limited to files created by this task; no pre-existing file was removed.

---

## 16. Git Publication

- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Branch:** `main`
- **Synchronized base / implementation state:** `301f2295da3d80b8acf79df204136621ea000c63`
- **Commit message:** `docs(report): publish QFAT-003W Windows validation`
- **Report commit:** the commit that adds this file to `main`. Its full SHA is reported in the OpenCode handoff and can be verified on the remote with:

  ```powershell
  git log -1 --format=%H -- reports/QFAT-003W-windows-backend-sqlite-validation-report.md
  ```

  The SHA is intentionally not embedded in this same commit's content, because embedding it would change the commit SHA.
- **Push verification:** performed after commit; the report is published only if the push to `origin/main` succeeded and the remote commit was confirmed. No implementation change is published under this task.
- **Changed files:** this report only.

---

## 17. Handoff

This report is ready for GPT/owner audit. It is **not** an owner acceptance and does not authorize API implementation, live account connections, uploads, or any next stage.

The blocking item is the Windows `npm ci` failure for `better-sqlite3@13.0.3` described in §5 and §14.1. The owner must decide how to proceed (approved toolchain, approved install configuration, or an approved dependency/npm change) before this validation can be accepted. Diagnostic evidence shows the committed backend package, native prebuild, typecheck, test suite, migrations, and cleanup behavior otherwise work on this Windows 10 x64 machine under both Node 22 and Node 24.


---

## 18. GPT Repository Audit — 2026-11-11

- **Audited report commit:** `93e6898072f1c3fb91cd740204808528678a4953`
- **Audit base:** `301f2295da3d80b8acf79df204136621ea000c63`
- **Audit result:** **REPORT ACCEPTED AS AN ACCURATE BLOCKED VALIDATION RECORD; VALIDATION NOT ACCEPTED.**
- **Scope:** GitHub commit metadata, compare range, task specification, report contents, and the committed backend package/source. GPT did not rerun Windows commands; execution evidence remains agent-reported.

### Audit checks

1. The report commit is on `main`, has the stated commit message, and is exactly one commit ahead of the task-publication base.
2. The compare shows exactly one changed path: this report. No source, test, schema, migration, manifest, lockfile, or CI workflow was changed in the validation commit.
3. The report's task ID, base SHA, report path, commit message, and Windows-only scope match the published task and commit metadata.
4. The committed package manifest confirms the declared Node engine (`>=22.0.0`), approved runtime/dev dependency split, and scripts described in the report.
5. The committed source confirms that `db:migrate` maps to `tsx src/db/migrate.ts`, while `src/db/migrate.ts` only exports migration functions and has no CLI/top-level invocation. The report's F-02 finding is therefore supported by source inspection.
6. The committed `clean` script is `rm -rf dist`; the Windows-compatibility limitation in F-03 is supported by the manifest.
7. The committed test cleanup helpers contain catch-all suppression for filesystem cleanup errors, supporting F-04. The report appropriately distinguishes source-level limitations from the agent's reported no-leftover observation.
8. The report clearly separates required `npm ci` failures from `--ignore-scripts` diagnostic results and does not present the latter as acceptance evidence. Its overall BLOCKED disposition is retained.

### Audit disposition and next gate

The Windows validation is **BLOCKED**, not accepted, because the required clean lockfile installation failed on both Node.js 22 and Node.js 24. Diagnostic success does not satisfy that acceptance criterion. The owner must explicitly choose an approved remediation direction before a separate remediation task is prepared. No remediation is authorized by this audit.

The no-op migration script and Unix-only clean script are also recorded as follow-up findings; they must not be silently folded into the Windows install remediation without an explicit task scope. No API implementation, live account connection, upload, or next-stage work is authorized.

*This audit note records a repository/source review only. It does not independently verify the Windows machine, reproduce npm's registry-metadata explanation, or rerun the agent's local tests.*
