# QFAT-002W — Windows 10 SQLite Driver and Migration Validation Report

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-002W-windows-sqlite-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Base commit (synchronized `origin/main` at start of work):** `54e106bac5ae1417f5d870e7e5f0b9a99f138c15`
- **Commit message (per task §10):** `docs(task): QFAT-002W Windows SQLite validation report`
- **Report path:** `reports/QFAT-002W-windows-sqlite-validation.md`
- **Validation date:** 2026-11-11
- **Execution mode:** one agent, serial, on the owner's Windows 10 PC

> The commit SHA of this report cannot be embedded in its own content (it would change the SHA). It is published as a single documentation-only commit on `main`; see §14 and GitHub for the exact SHA.

---

## 1. Executive Summary

The candidate stack — `better-sqlite3@13.0.3`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11` — was validated on the owner's **Windows 10 Pro 22H2, build 19045.6466, x64** machine on **two runtimes**: **Node.js 24.16.0** (installed system runtime) and **Node.js 22.23.4 LTS** (portable, checksum-verified extraction used only for this test).

Every functional requirement in the task passed with executed evidence: prebuilt `win32-x64.node` is the binary actually loaded by the runtime (no native compilation, no toolchain, no `build/` directory), SQLite CRUD/prepared statements/FK enforcement/commit/rollback/close-reopen persistence/WAL/bounded busy timeout behave correctly, Drizzle Kit generates reviewable SQL for v1 and v2, the runtime migrator applies both a fresh install and a v1→v2 upgrade without data loss, and two-process lock contention is deterministic in both required scenarios.

**Windows and combined Linux/Windows recommendation: ACCEPT WITH CONDITIONS** (§13). The conditions are arm64/Windows 11 coverage and owner approval — not defects in the tested configuration. Genuine findings are documented in §12.

---

## 2. Safe Synchronization Record (task §2)

| Step | Command | Result |
|---|---|---|
| Remote identity | `git remote -v` | `origin` = `https://github.com/irfannuralam44-max/qfat.git` (fetch/push) — matches the repository named by the task |
| Working tree / branch | `git status --short --branch` | `## main` — clean, no pre-existing local changes |
| HEAD before sync | `git rev-parse HEAD` | `54e106bac5ae1417f5d870e7e5f0b9a99f138c15` |
| Fetch | `git fetch origin main` | `branch main -> FETCH_HEAD` |
| Fast-forward only | `git pull --ff-only origin main` | `Already up to date.` |
| HEAD after sync | `git rev-parse HEAD` / `git rev-parse origin/main` | both `54e106bac5ae1417f5d870e7e5f0b9a99f138c15` |

No reset, clean, stash, checkout, rebase, or branch creation was performed. The task file was read only after this synchronization, and `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`, and `reports/QFAT-002S-sqlite-driver-validation.md` were read after that.

---

## 3. Environment Evidence (AC-01)

### 3.1 Operating system, architecture, tooling

```powershell
$PSVersionTable
[System.Environment]::OSVersion.Version
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
node --version
npm --version
node -p "process.platform + ' ' + process.arch"
```

| Property | Value |
|---|---|
| Windows product | **Windows 10 Pro** (`ProductName`), edition `Professional`, `InstallationType=Client` |
| Version / build | **22H2**, `CurrentBuild` **19045.6466** |
| `[Environment]::OSVersion.Version` | **10.0.19045.0** |
| `RuntimeInformation.OSArchitecture` | **X64** |
| 64-bit OS / process | `Is64BitOS=True`, `Is64BitProcess=True` |
| CPU | Intel(R) Core(TM) i5-3570 CPU @ 3.40GHz — 4 cores / 4 threads |
| `Win32_Processor.Architecture` | `9` (x64) |
| PowerShell | **5.1.19041.6456** (Desktop edition) |
| Node.js (system) | **v24.16.0** — `C:\Program Files\nodejs\node.exe` |
| npm (system) | **11.13.0** |
| `node -p "process.platform + ' ' + process.arch"` | **`win32 x64`** |

Architecture was **detected, not assumed**: x64 confirmed independently through `OSArchitecture`, `Win32_Processor.Architecture=9`, and `Is64BitProcess`.

### 3.2 Runtime matrix availability check (no system changes)

```powershell
Get-Command node,npm,nvm,fnm,volta -ErrorAction SilentlyContinue
Get-ChildItem "C:\Program Files\nodejs"
Get-ChildItem "$env:LOCALAPPDATA\nvm","$env:APPDATA\nvm","$env:LOCALAPPDATA\fnm","$env:LOCALAPPDATA\Volta","$env:USERPROFILE\.nvm" -ErrorAction SilentlyContinue
```

Result: only `node.exe` (`C:\Program Files\nodejs\node.exe`, product version 24.16.0) and `npm` are present. **No `nvm`, `fnm`, `volta`, or other version manager is installed**, and no Node 22 installation exists on the machine.

### 3.3 How Node.js 22 was obtained without changing the system

The task forbids changing global Node/npm installations, installing a version manager, or altering system configuration without owner authorization. To still execute the required minimum-runtime test on this machine, Node.js 22 was run as a **disposable portable extraction inside the task's own temporary fixture directory**:

```powershell
Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip" -OutFile node-v22.23.4-win-x64.zip
Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.23.4/SHASUMS256.txt" -OutFile SHASUMS256.txt
(Get-FileHash node-v22.23.4-win-x64.zip -Algorithm SHA256).Hash
Expand-Archive -Path node-v22.23.4-win-x64.zip -DestinationPath node22-portable
```

| Item | Value |
|---|---|
| Node.js 22 build | **v22.23.4** (LTS codename `Jod`, release date 2026-10-20, from `https://nodejs.org/dist/index.json`) |
| Archive | `node-v22.23.4-win-x64.zip` |
| Expected SHA-256 (official `SHASUMS256.txt`) | `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20` |
| Actual SHA-256 | `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20` |
| Checksum match | **True** |
| Bundled npm | **10.9.9** (`node_modules\npm\bin\npm-cli.js`) |
| `node.exe --version` | `v22.23.4` |

No installer was run, no PATH entry was persisted, no system Node/npm binary or global package was modified, and the extraction lives only under `%TEMP%\qfat-sqlite-validation-20261111-102816` and is deleted during cleanup (§15).

**Interpretation limit:** this is a genuine executed Node 22 runtime on the correct OS and architecture, but it is not the machine's system-installed Node. The owner's system runtime remains Node 24.16.0.

### 3.4 Isolated fixture directory

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir = Join-Path $env:TEMP "qfat-sqlite-validation-$ts"
if (Test-Path $dir) { "EXISTS" } else { New-Item -ItemType Directory -Path $dir }
```

- Existence was checked before creation (the branch that would have reported `EXISTS` did not trigger).
- Created: `%TEMP%\qfat-sqlite-validation-20261111-102816`
- All work happened inside this directory, **outside** the QFAT repository.

---

## 4. Candidate Stack Installation (AC-02)

### 4.1 Node.js 24.16.0 / npm 11.13.0

```powershell
npm init -y
npm install --save-exact better-sqlite3@13.0.3 drizzle-orm@0.45.4 drizzle-kit@0.31.11 tsx@4.23.15 typescript@7.0.2
```

- `npm init -y` → **exit code 0**
- `npm install …` → **exit code 0**, duration **27 s**, `added 21 packages, and audited 22 packages`
- Warnings: `npm warn deprecated @esbuild-kit/esm-loader@2.6.5: Merged into tsx` and `npm warn deprecated @esbuild-kit/core-utils@3.3.2: Merged into tsx`
- Audit at install time: `4 moderate severity vulnerabilities` (see §12.2)
- **No native compilation occurred** — see §5

`npm ls --depth=0`:

```
qfat-sqlite-validation-20261111-102816@1.0.0
+-- better-sqlite3@13.0.3
+-- drizzle-kit@0.31.11
+-- drizzle-orm@0.45.4
+-- tsx@4.23.15
`-- typescript@7.0.2
```

### 4.2 Declared engine requirements

Read from each installed `package.json`:

| Package | Installed | `engines` |
|---|---|---|
| `better-sqlite3` | **13.0.3** | `{"node":">=22"}` |
| `drizzle-orm` | **0.45.4** | *(none declared)* |
| `drizzle-kit` | **0.31.11** | *(none declared)* |
| `tsx` | **4.23.15** | `{"node":">=18.0.0"}` |
| `typescript` | **7.0.2** | `{"node":">=16.20.0"}` |

Resolved transitive versions relevant to the native path: `node-addon-api@8.9.2`, `esbuild@0.25.12` (lockfile values, verified through `package-lock.json`).

`better-sqlite3@13.0.3` therefore requires **Node >= 22**, matching the owner-approved QFAT backend minimum; no `EBADENGINE` warning was emitted on either runtime.

### 4.3 Node.js 22.23.4 / npm 10.9.9

A **separate, fresh** install was performed in `node22-run\` with the portable runtime so that Node 22 was not merely running a tree installed by Node 24:

```powershell
& "$np\node.exe" "$np\node_modules\npm\bin\npm-cli.js" init -y
& "$np\node.exe" "$np\node_modules\npm\bin\npm-cli.js" install --save-exact better-sqlite3@13.0.3 drizzle-orm@0.45.4 drizzle-kit@0.31.11 tsx@4.23.15 typescript@7.0.2
```

- `npm init` → **exit code 0**
- `npm install` → **exit code 0**, **27 s**, `added 21 packages, and audited 22 packages`
- Identical warning set (`@esbuild-kit/*` deprecated) and identical `4 moderate severity vulnerabilities`
- No `EBADENGINE`, no compilation

---

## 5. Native Binary Selection on Windows (AC-03)

### 5.1 Contents shipped in `prebuilds\`

```
node_modules\better-sqlite3\prebuilds\
  darwin-arm64.node     1,980,736
  darwin-x64.node       1,982,880
  linux-arm64.node      2,066,328
  linux-x64.node        2,226,168
  linuxmusl-arm64.node  2,312,112
  linuxmusl-x64.node    2,435,680
  win32-arm64.node      1,903,104
  win32-x64.node        1,989,632
```

`node_modules\better-sqlite3\build\` → **does not exist** (checked with `Test-Path`).

### 5.2 Runtime proof — not file presence

`binding-select.ts` (executed with `npx tsx binding-select.ts`) resolves the prebuild path, loads the driver through its public entry point, then inspects the module cache to prove **which file the runtime actually loaded**:

```
process.platform      = win32
process.arch          = x64
node version          = v24.16.0
modules ABI (NODE_MODULE_VERSION) = 137
v8                    = 13.6.233.17-node.49
getPrebuildPath()     = %TEMP%\qfat-sqlite-validation-20261111-102816\node_modules\better-sqlite3\prebuilds\win32-x64.node
prebuild exists       = true
prebuild size (bytes) = 1989632
sqlite_version()      = 3.53.4
loaded native modules = ["C:\\Users\\irfan\\AppData\\Local\\Temp\\qfat-sqlite-validation-20261111-102816\\node_modules\\better-sqlite3\\prebuilds\\win32-x64.node"]
  realpath            = %TEMP%\qfat-sqlite-validation-20261111-102816\node_modules\better-sqlite3\prebuilds\win32-x64.node
  basename            = win32-x64.node
node_modules build/ dir exists = false
BINDING_SELECTION: PASS
```

Exit code **0**. Exactly **one** native module was loaded: `win32-x64.node`. Under Node 22 the same script printed `node version = v22.23.4`, `modules ABI (NODE_MODULE_VERSION) = 127`, and again exactly one loaded native module, `…\node22-run\node_modules\better-sqlite3\prebuilds\win32-x64.node`; `BINDING_SELECTION: PASS`, exit code **0**.

### 5.3 No unexpected native build/toolchain dependency

| Evidence | Result |
|---|---|
| `Test-Path node_modules\better-sqlite3\build` | `False` (both runtimes) |
| `gypfile` in `better-sqlite3/package.json` | `false` |
| Lifecycle scripts in `better-sqlite3/package.json` | only `build-release`, `build-debug`, `test`, `benchmark`, `download`, `clean` — **no `install`/`preinstall`/`postinstall` hook** |
| `Select-String install.log -Pattern 'gyp\|node-pre-gyp\|prebuild-install\|MSBuild\|Visual Studio\|rebuild'` | **NONE** |
| Only postinstall output in the install log | `esbuild@0.25.12`, `esbuild@0.18.20`, `esbuild@0.28.2` (`node install.js`, code 0) — pure JS download/link step, not a native compile of SQLite |

Conclusion: `better-sqlite3@13.0.3` installs and runs on this Windows machine from the shipped prebuilt `win32-x64.node`; no Python, no Visual Studio Build Tools, no node-gyp invocation was required or observed.

---

## 6. Node Runtime Matrix (task §6, AC-04)

| Runtime | Requirement | Result | Evidence |
|---|---|---|---|
| Node.js 22.x | Required minimum-runtime test | **PASS** | **v22.23.4** (LTS Jod), ABI 127, portable ZIP SHA-256 verified. Fresh install exit 0; `BINDING_SELECTION: PASS`; 14/14 SQLite checks; 6/6 migration checks; 8/8 lock checks; `drizzle-kit generate` exit 0. Outputs quoted in §7, §8, §9. |
| Node.js 24.x LTS | Preferred runtime test | **PASS** | **v24.16.0** (system runtime), ABI 137. Fresh install exit 0; `BINDING_SELECTION: PASS`; 14/14 SQLite checks; 6/6 migration checks; 8/8 lock checks. Outputs quoted in §7, §8, §9. |

Notes:

- Node 22 was **not** previously installed and **no** version manager or global installation was created; the runtime was extracted into the task fixture only. Minimum-runtime acceptance is therefore **not** blocked, but the owner should be aware the evidence comes from a portable extraction rather than from a system-wide Node 22 installation.
- The system runtime is Node 24.16.0; the latest 24.x LTS at validation time is 24.22.2 (from `https://nodejs.org/dist/index.json`). The difference is a patch-level drift in the same LTS line and does not affect the validated behaviour (the native binary is Node-API based and no ABI-specific rebuild was needed).

---

## 7. SQLite Operations and Integrity (AC-05, AC-06)

### 7.1 Command

```powershell
npx tsx test-basic-ops.ts     # Node.js 24.16.0  -> exit code 0
& "$np\node.exe" "node_modules\tsx\dist\cli.mjs" test-basic-ops.ts   # Node.js 22.23.4 -> exit code 0
```

The fixture intentionally uses a directory name containing a space (`db fixtures\qfat test.db`) to exercise Windows path handling.

### 7.2 Results — identical on both runtimes

Node 24 output:

```
dbPath = %TEMP%\qfat-sqlite-validation-20261111-102816\db fixtures\qfat test.db
CWD    = %TEMP%\qfat-sqlite-validation-20261111-102816
[PASS] open file-backed database + version :: driver=better-sqlite3@13.0.3 sqlite=3.53.4
[PASS] PRAGMA foreign_keys = ON :: foreign_keys=1
[PASS] invalid FK insert is rejected :: SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed
[PASS] prepared statement insert/select round-trip :: account={"id":"acc-1","platform":"youtube","alias":"main-channel","status":"active"} jobs=[{"id":"job-1","media_id":"media-1","status":"queued"}]
[PASS] transaction commit persists :: accounts=2 jobs_for_acc2=1
[PASS] transaction rollback leaves no rows :: accounts_before=2 accounts_after=2 acc3_rows=0
[PASS] bounded busy_timeout is applied and readable :: busy_timeout=2500
[PASS] WAL journal mode enabled :: default=delete after_set=wal
[PASS] sidecar files present while WAL connection is open :: -wal=true -shm=true
[PASS] clean close releases Windows file handle :: db closed; file could be reopened for writing by the process
[PASS] close/reopen persistence + WAL persists after reopen :: journal_mode=wal accounts=3 jobs=2
[PASS] foreign keys still enforced after reopen :: SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed
[PASS] integrity_check on reopened database :: integrity_check=ok
[PASS] Windows delete-while-open behavior recorded :: delete-while-open threw EBUSY; -wal present=true
sidecars after close: { wal: false, shm: false }
SUMMARY: 14/14 checks passed
PERSISTED_COUNTS: {"accounts":3,"jobs":2}
```

Node 22 produced the **same 14 PASS lines and `SUMMARY: 14/14 checks passed`**, exit code 0, with `sqlite=3.53.4`.

### 7.3 Requirement mapping

| Task §5.1 requirement | Result | Evidence line |
|---|---|---|
| Open file-backed DB, close cleanly | PASS | open + `clean close releases Windows file handle` |
| `PRAGMA foreign_keys = ON` and invalid FK insert fails | PASS | `foreign_keys=1`; `FOREIGN KEY constraint failed` (before and after reopen) |
| Parent `accounts` / child `jobs` tables | PASS | created in fixture; FK + `ON DELETE CASCADE` exercised in §8 |
| Prepared statements insert/select with verified values | PASS | `insertAccount`/`insertJob`/`selectAccount`/`selectJobs` round-trip |
| Transaction commit persists | PASS | `accounts=2 jobs_for_acc2=1` |
| Rollback leaves no inserted rows | PASS | `accounts_before=2 accounts_after=2 acc3_rows=0` |
| Close/reopen persistence | PASS | `accounts=3 jobs=2` after reopen |
| WAL enabled; `PRAGMA journal_mode` reports `wal` after reopen | PASS | `default=delete after_set=wal` → after reopen `journal_mode=wal` |
| Bounded `busy_timeout` set and readable | PASS | `busy_timeout=2500` |
| Windows path handling / locking / cleanup recorded | PASS | §7.4 |

### 7.4 Windows-specific behaviour observed

1. **Paths with spaces and nested directories work.** `…\db fixtures\qfat test.db` opened, migrated and reopened without escaping issues.
2. **Windows mandatory locking is visible.** `fs.unlinkSync(dbPath)` while the connection was open threw **`EBUSY`**; on Linux the same call would succeed and leave an open-but-unlinked file. Consequence for QFAT: the database file must be closed before any delete/move/replace operation, and "delete the DB while the app runs" cannot be a recovery strategy on Windows.
3. **Sidecar cleanup is automatic on last close.** While the WAL connection was open, `-wal` and `-shm` existed; after `db.close()` both were gone (`sidecars after close: { wal: false, shm: false }`). No manual sidecar cleanup is needed after a clean shutdown.
4. **WAL mode is persistent in the database file.** After reopen the mode remained `wal`, so the mode does not have to be re-set on every connection (though QFAT should still assert it).
5. **`busy_timeout` is a retry budget, not a hard deadline.** A configured 1000 ms timeout produced an actual failure at ~1255 ms (§9.2). Applications must not treat the timeout value as an exact latency bound.

---

## 8. Drizzle Migrations (AC-07)

### 8.1 Generation (Node.js 24.16.0)

```powershell
npx drizzle-kit generate        # schema v1 -> exit code 0
npx drizzle-kit generate        # schema v2 -> exit code 0
```

```
No config path provided, using default 'drizzle.config.ts'
Reading config file '…\drizzle.config.ts'
2 tables
accounts 5 columns 1 indexes 0 fks
jobs 5 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ migrations\0000_bent_justin_hammer.sql 🚀
```

After adding `metadata: text('metadata')` to `accounts`:

```
2 tables
accounts 6 columns 1 indexes 0 fks
jobs 5 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ migrations\0001_spotty_nightmare.sql 🚀
```

`migrations\0000_bent_justin_hammer.sql`:

```sql
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`alias` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_alias_unique` ON `accounts` (`alias`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`media_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
```

`migrations\0001_spotty_nightmare.sql`:

```sql
ALTER TABLE `accounts` ADD `metadata` text;
```

`migrations\meta\_journal.json` records both entries (`when` = `1794367926321` and `1794367962063`), and `meta\0000_snapshot.json` was produced. Migration SQL is reviewable and committable, matching ADR-001's workflow.

A v1-only snapshot of the migration folder (`migrations-v1-snapshot\`) was retained so the upgrade path could be exercised without hand-editing bookkeeping tables.

### 8.2 Generation on Node.js 22.23.4

```powershell
& "$np\node.exe" "node_modules\drizzle-kit\bin.cjs" generate --config=drizzle.config.node22.ts
```

- **Exit code 0**
- Output: `[✓] Your SQL migration file ➜ migrations-gen22\0000_eminent_riptide.sql`
- Generated SQL contains the v2 shape (`metadata` column) plus the same FK/unique-index DDL

This confirms the Windows path handling of Drizzle Kit's config/schema/out resolution on Node 22 as well.

### 8.3 Runtime migration execution

```powershell
npx tsx test-migrations.ts     # Node.js 24.16.0 -> exit code 0
```

```
[PASS] fresh database: apply all migrations (v1 + v2) :: accounts=[id,platform,alias,status,created_at,metadata] jobs=[id,account_id,media_id,status,created_at] migration_rows=2
[PASS] fresh database: migration tracking hashes recorded :: id=null hash=65dbc07d6289… created_at=1794367926321 | id=null hash=c13d0f0b7f3c… created_at=1794367962063
[PASS] fresh database: foreign key works against migrated schema :: valid insert OK, invalid FK rejected (SQLITE_CONSTRAINT_FOREIGNKEY), jobs=1
[PASS] fresh database: integrity_check :: integrity_check=ok
[PASS] upgrade: v1 database migrated from v1-only migration folder :: v1 columns=[id,platform,alias,status,created_at] migration_rows=1
[PASS] upgrade: existing v1 data survives the v2 migration :: rows 1->2, columns=[id,platform,alias,status,created_at,metadata], preserved=[{"id":"acc-up1","alias":"legacy-page"}], v1_hash_unchanged=true, integrity=ok
SUMMARY: 6/6 checks passed
```

Node 22 produced **identical results, `SUMMARY: 6/6 checks passed`**, exit code 0, including the same migration hashes.

Upgrade procedure actually executed (not simulated):

1. Fresh database file.
2. `migrate(drizzle(db), { migrationsFolder: 'migrations-v1-snapshot' })` → v1 schema only (`accounts` without `metadata`), `__drizzle_migrations` = 1 row.
3. Insert a row (`acc-up1`) into the v1 database.
4. Close the connection, reopen the same file.
5. `migrate(drizzle(db), { migrationsFolder: 'migrations' })` → only the outstanding `ALTER TABLE … ADD metadata` is applied.
6. Assertions: migration rows `1 -> 2`, `metadata` present, the pre-existing row preserved, the v1 hash unchanged, `integrity_check=ok`.

Schema and tracking-state verification was performed through `PRAGMA table_info(accounts)`, `PRAGMA table_info(jobs)`, a direct `SELECT` on `__drizzle_migrations`, and `PRAGMA integrity_check`.

---

## 9. Two-Process Lock Contention on Windows (AC-08)

### 9.1 Design (deterministic, no timing guesses)

Three files, all inside the fixture:

- **`locker.cjs` (Process A)** — `node locker.cjs <dbPath> <holdMs> <readyFile>`: opens the DB, sets `journal_mode=WAL` and `busy_timeout=5000`, runs `BEGIN IMMEDIATE`, updates the fixture row, **writes the `readyFile` and prints `LOCK_HELD` only after the write lock is owned**, then sleeps for the controlled interval (`Atomics.wait`), commits, closes, exits 0.
- **`writer.cjs` (Process B)** — `node writer.cjs <dbPath> <busyTimeoutMs> <label>`: opens the DB, sets WAL and the passed `busy_timeout`, attempts `UPDATE lock_fixture …`, prints `WRITE_SUCCEEDED elapsed_ms=…` and exits **0**, or prints `error_name`/`error_code`/`error_message` and exits **2**.
- **`lock-test.ts` (parent)** — prepares the fixture DB, spawns A, **waits for the ready-file signal** (poll + 15 s bound) before spawning B, measures B's wall time from spawn to exit, awaits both children under a 20 s watchdog (SIGKILL on overrun), then reopens the DB to verify value, `journal_mode`, and `integrity_check`.

Because the parent starts B only after A has proven ownership of the write lock, B cannot race ahead of the lock.

### 9.2 Scenario 1 — A releases before B's busy timeout (expect success)

A holds 700 ms; B `busy_timeout = 8000` ms.

```
=== scenario-1-release-before-timeout: A hold=700ms, B busy_timeout=8000ms ===
A signalled lock ownership (ready file ts=1794368138288)
B stdout:
  B[scenario-1-release-before-timeout]: opened, busy_timeout=8000
  B[scenario-1-release-before-timeout]: WRITE_SUCCEEDED elapsed_ms=696 changes=1
  B[scenario-1-release-before-timeout]: EXIT_OK
B exit code=0 signal=null wall_ms=793
A stdout:
  A: opened …\lock dbs\contention.db journal_mode=wal
  A: LOCK_HELD at 1794368138288 (holdMs=700)
  A: COMMITTED at 1794368138995 value=held-by-A
  A: CLOSED
A exit code=0 signal=null wall_ms=810
[PASS] scenario-1: A exited cleanly after commit :: exit=0 wall_ms=810
[PASS] scenario-1: B eventually succeeded after A released the lock :: exit=0 wall_ms=793
[PASS] scenario-1: B waited for A instead of writing immediately :: wall_ms=793 vs A hold=700ms
[PASS] scenario-1: database reopened after contention with expected value :: value=written-by-B expected=written-by-B journal_mode=wal integrity=ok
```

Interpretation: B blocked on the write lock, retried within its busy timeout, succeeded after A committed (`elapsed_ms=696`, wall 793 ms ≳ A's 700 ms hold), and its write is the durable final state.

### 9.3 Scenario 2 — A holds beyond B's busy timeout (expect bounded failure)

A holds 4000 ms; B `busy_timeout = 1000` ms.

```
=== scenario-2-hold-beyond-timeout: A hold=4000ms, B busy_timeout=1000ms ===
A signalled lock ownership (ready file ts=1794368139222)
B stdout:
  B[scenario-2-hold-beyond-timeout]: opened, busy_timeout=1000
  B[scenario-2-hold-beyond-timeout]: WRITE_FAILED elapsed_ms=1255
  B[scenario-2-hold-beyond-timeout]: error_name=SqliteError
  B[scenario-2-hold-beyond-timeout]: error_code=SQLITE_BUSY
  B[scenario-2-hold-beyond-timeout]: error_message=database is locked
B exit code=2 signal=null wall_ms=1345
A stdout:
  A: LOCK_HELD at 1794368139222 (holdMs=4000)
  A: COMMITTED at 1794368143251 value=held-by-A
  A: CLOSED
A exit code=0 signal=null wall_ms=4140
[PASS] scenario-2: A exited cleanly after commit :: exit=0 wall_ms=4140
[PASS] scenario-2: B rejected with SQLITE_BUSY within its busy timeout :: exit=2 wall_ms=1345
[PASS] scenario-2: B elapsed approximates configured busy_timeout (1000ms) :: wall_ms=1345
[PASS] scenario-2: database reopened after contention with expected value :: value=held-by-A expected=held-by-A journal_mode=wal integrity=ok
```

Recorded failure detail:

| Field | Value |
|---|---|
| SQLite extended message | `database is locked` |
| `err.name` | `SqliteError` |
| `err.code` | **`SQLITE_BUSY`** |
| B internal elapsed (before open → error) | **1255 ms** (configured `busy_timeout` = 1000 ms) |
| B wall time (spawn → exit) | **1345 ms** |
| B exit code | **2** (fixture's busy exit code) |
| A outcome | committed, closed, **exit 0** at 4140 ms |
| Post-contention state | `value=held-by-A`, `journal_mode=wal`, `integrity_check=ok` |

### 9.4 Summary and process hygiene

- **8/8 lock checks passed**, exit code **0**, on **both** runtimes.
- Node 22 run: scenario 1 `WRITE_SUCCEEDED elapsed_ms=692` / wall 805 ms; scenario 2 `WRITE_FAILED elapsed_ms=1250`, `SQLITE_BUSY`, exit 2 / wall 1365 ms; `SUMMARY: 8/8 lock checks passed`.
- Every child process was awaited; both exited by themselves well inside the 20 s watchdog (max observed 4146 ms); no orphaned `node` processes remained; ready-files were removed per scenario.

---

## 10. Acceptance Criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Actual Windows 10 environment and architecture identified | **PASS** | §3.1 — Windows 10 Pro 22H2 19045.6466, X64, PowerShell 5.1.19041.6456, Node v24.16.0, npm 11.13.0, `win32 x64` |
| AC-02 | Candidate stack installs in an isolated fixture | **PASS** | §4.1/§4.3 — `npm install --save-exact …` exit 0 on Node 24 and Node 22, 21 packages, versions pinned exactly, warnings recorded |
| AC-03 | Correct Windows native prebuilt is actually loaded | **PASS** | §5.2 — module-cache proof: exactly one loaded native module, `prebuilds\win32-x64.node`; no `build\`, no gyp, no lifecycle build script |
| AC-04 | Minimum Node.js 22 runtime is validated | **PASS** | §6 — Node **v22.23.4** (SHA-256 verified portable runtime): install, binding, 14/14 SQLite, 6/6 migration, 8/8 lock, `drizzle-kit generate` all exit 0 |
| AC-05 | SQLite CRUD, prepared statements, FK, commit/rollback, reopen pass | **PASS** | §7.2 — `SUMMARY: 14/14 checks passed` on both runtimes |
| AC-06 | WAL and bounded busy timeout work on Windows | **PASS** | §7.2/§7.4 — `journal_mode=wal` before/after reopen, sidecars created and removed, `busy_timeout=2500` readable, real contention timing in §9 |
| AC-07 | Drizzle fresh and v1-to-v2 migrations pass | **PASS** | §8 — generated `0000_*`/`0001_*.sql`, `SUMMARY: 6/6 checks passed`, upgrade preserved `acc-up1`, `metadata` added, hashes unchanged |
| AC-08 | Two-process lock contention behaves as expected | **PASS** | §9 — scenario 1 success (793 ms), scenario 2 `SQLITE_BUSY "database is locked"` (1255 ms, exit 2), A exit 0, DB reopened `integrity_check=ok` |
| AC-09 | QFAT repository/application remains unchanged | **PASS** | §11 — `git status --short --branch` = `## main`, `git diff --stat` empty; only this report is added |
| AC-10 | Recommendation reflects Windows evidence and remaining gaps | **PASS** | §13 — ACCEPT WITH CONDITIONS with explicit untested areas |

---

## 11. Repository Unchanged (AC-09)

Before writing this report, inside `%USERPROFILE%\documents\qfat`:

```
$ git status --short --branch
## main
$ git diff --stat
(no output)
$ git rev-parse HEAD
54e106bac5ae1417f5d870e7e5f0b9a99f138c15
```

- Working tree clean; HEAD still equals `origin/main` from synchronization.
- No change to root `package.json`, `package-lock.json`, source, tests, PRD, architecture, or ADR.
- No dependency was added to QFAT; the entire candidate stack lives in `%TEMP%\qfat-sqlite-validation-20261111-102816`.
- No QFAT user database, credential, token, or media file was read or modified; no YouTube/Facebook call and no upload was performed.

The only repository change produced by this task is the new report file `reports/QFAT-002W-windows-sqlite-validation.md`.

---

## 12. Findings, Warnings, and Limitations

### 12.1 Positive findings

1. Windows x64 prebuilt works on both Node 22 (ABI 127) and Node 24 (ABI 137) with no rebuild — consistent with a Node-API based addon.
2. No native toolchain requirement: no `build/` directory, `gypfile: false`, no `install` lifecycle script, zero node-gyp/MSBuild traces.
3. FK enforcement, prepared statements, commit/rollback, and reopen persistence are identical to the Linux QFAT-002S behaviour.
4. WAL mode is persistent across reopen and sidecar files are cleaned up automatically on last close.
5. Drizzle Kit + runtime migrator work end-to-end on Windows, including a data-preserving v1→v2 upgrade; the v2 migration hash (`c13d0f0b…`) matches the QFAT-002S Linux run for the same DDL.
6. Deterministic two-process contention produced exactly the expected `SQLITE_BUSY`/"database is locked" outcome at the configured budget.

### 12.2 Findings and warnings

| # | Finding | Impact | Notes |
|---|---|---|---|
| F-1 | Deleting an open database file on Windows throws **`EBUSY`** (mandatory locking), unlike Linux where unlink succeeds. | Design constraint | QFAT must close connections before delete/move/replace; no "delete while running" recovery path. |
| F-2 | `busy_timeout` is a retry budget, not an exact deadline: 1000 ms configured → failure observed at ~1255 ms (25 % overshoot). | Error-message/telemetry accuracy | Surface lock contention as an actionable error; do not use the timeout value as a latency SLA. |
| F-3 | `npm audit` reports **4 moderate** vulnerabilities, all through `drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild` (deprecated tsx bridge; dev-time only, not shipped in the runtime path). | Dev dependency only | Not present in `better-sqlite3`/`drizzle-orm` runtime path. Re-check when Drizzle Kit updates its bundler chain. |
| F-4 | Deprecated packages installed as transitive deps of `drizzle-kit@0.31.11`: `@esbuild-kit/esm-loader@2.6.5`, `@esbuild-kit/core-utils@3.3.2` ("Merged into tsx"). | Cosmetic / audit noise | Upstream issue; no functional effect observed. |
| F-5 | Node 22 evidence comes from a **portable extraction**, not a system installation (task forbade changing global Node/version managers). | Evidence scope | Executed on the correct OS/architecture with a checksum-verified official binary; system runtime remains Node 24.16.0. |
| F-6 | System Node is 24.16.0 while the newest 24.x LTS is 24.22.2. | Minor drift | Same LTS line; no ABI-specific behaviour involved. |

### 12.3 Not tested / limitations

| Area | Status | Reason |
|---|---|---|
| Windows **arm64** (`win32-arm64.node`) | **NOT RUN** | Owner machine is x64 only; task requires testing the actual machine architecture and forbids claiming other configurations. |
| **Windows 11** | **NOT RUN** | Not the owner's OS. |
| Node 22 as a **system-installed** runtime | **NOT RUN** | Forbidden without owner authorization; portable runtime used instead. |
| >2-process / sustained contention stress | **NOT RUN** | Task specified a deterministic two-process smoke test; no vague stress test was added. |
| WAL growth / checkpoint behaviour under large write volume | **NOT RUN** | Out of scope for this validation; ADR-001 already requires documenting checkpoint/backup behaviour. |
| Non-NTFS, OneDrive-synced, or network-share database paths | **NOT RUN** | Fixture used the local `%TEMP%` NTFS volume. |
| `tsc --noEmit` typecheck of the fixture | **NOT RUN** | Fixtures are runtime-verification scripts; TypeScript 7.0.2 was installed per the task's exact-version list but no typecheck is claimed. |
| Antivirus / EDR interference with SQLite handles | **NOT RUN** | Not requested; no AV-triggered failure was observed during ~30 min of runs. |
| Linux re-validation | **NOT RUN** | Explicitly out of scope; QFAT-002S already covers Linux. |

---

## 13. Recommendation

### 13.1 Windows-only

**Windows 10 x64 validation: PASS WITH FINDINGS.**

Tests passed on the actual architecture on **both** Node 22.23.4 (required minimum runtime) and Node 24.16.0 (preferred LTS), covering install, native binary selection, SQLite semantics, WAL, busy timeout, Drizzle generation, fresh migration, v1→v2 upgrade, and deterministic lock contention. Findings F-1…F-6 are operational constraints and evidence-scope notes, not functional failures.

### 13.2 Combined Linux + Windows readiness

**ACCEPT WITH CONDITIONS.**

Combined evidence: Linux Mint 22.3 x86_64 / Node 24.22.2 (QFAT-002S, PASS WITH FINDINGS) + Windows 10 Pro 22H2 x64 / Node 22.23.4 and 24.16.0 (this report). The `better-sqlite3@13.0.3` + `drizzle-orm@0.45.4` + `drizzle-kit@0.31.11` stack behaves consistently on both platforms, including the previously untested concurrent-access area.

Conditions remaining before final owner acceptance:

1. **Owner approval** of the driver/migration choice (ADR-001 remains PROPOSED; this report does not authorize adoption).
2. **Windows arm64 and Windows 11** remain unvalidated; if QFAT must support them, run a scoped follow-up before claiming them.
3. **Node 22 should be installed normally** (or pinned in CI) on developer machines so the minimum runtime is verified with the same setup developers will use; this run used a portable extraction due to the no-system-change constraint.
4. **Operational rules for Windows** must be recorded in the implementation: close before delete/move, treat `SQLITE_BUSY` as an actionable error, do not rely on exact busy-timeout latency, and account for WAL sidecars in backup.

No evidence in this task contradicts ADR-001's choice. This report does **not** authorize adding dependencies or changing QFAT implementation.

---

## 14. Reproduction Summary

```powershell
# 1. Environment
$PSVersionTable; [System.Environment]::OSVersion.Version
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
node --version; npm --version; node -p "process.platform + ' ' + process.arch"

# 2. Isolated fixture
$dir = Join-Path $env:TEMP ("qfat-sqlite-validation-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $dir; Set-Location $dir

# 3. Exact stack
npm init -y
npm install --save-exact better-sqlite3@13.0.3 drizzle-orm@0.45.4 drizzle-kit@0.31.11 tsx@4.23.15 typescript@7.0.2

# 4. Binary + behaviour (Node 24)
npx tsx binding-select.ts
npx tsx test-basic-ops.ts
npx drizzle-kit generate            # schema v1 -> add metadata -> generate again (v2)
npx tsx test-migrations.ts
npx tsx lock-test.ts

# 5. Minimum runtime (Node 22 portable, checksum verified)
Invoke-WebRequest "https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip" -OutFile node22.zip
Invoke-WebRequest "https://nodejs.org/dist/v22.23.4/SHASUMS256.txt" -OutFile SHASUMS256.txt
(Get-FileHash node22.zip -Algorithm SHA256).Hash   # must equal SHASUMS256.txt entry
Expand-Archive node22.zip -DestinationPath node22-portable
# fresh install in node22-run\ then:
& "$np\node.exe" "node_modules\tsx\dist\cli.mjs" binding-select.ts
& "$np\node.exe" "node_modules\tsx\dist\cli.mjs" test-basic-ops.ts
& "$np\node.exe" "node_modules\tsx\dist\cli.mjs" test-migrations.ts
& "$np\node.exe" "node_modules\tsx\dist\cli.mjs" lock-test.ts
& "$np\node.exe" "node_modules\drizzle-kit\bin.cjs" generate --config=drizzle.config.node22.ts
```

### 14.1 Lock-contention harness (essential snippets)

`locker.cjs` (Process A):

```js
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.exec('BEGIN IMMEDIATE');
db.prepare("UPDATE lock_fixture SET value = 'held-by-A' WHERE id = 1").run();
fs.writeFileSync(readyFile, String(Date.now()));      // lock is owned at this point
console.log(`A: LOCK_HELD at ${Date.now()} (holdMs=${holdMs})`);
sleep(holdMs);                                        // Atomics.wait, controlled interval
db.exec('COMMIT');
```

`lock-test.ts` (parent) — the deterministic ordering:

```ts
const aPromise = runNode('locker.cjs', [dbPath, String(holdMs), readyFile], { timeoutMs: 20000 });
const locked = waitForFile(readyFile, 15000);          // B never starts before A owns the lock
const b = await runNode('writer.cjs', [dbPath, String(busyTimeoutMs), name], { timeoutMs: 20000 });
const a = await aPromise;                              // both children awaited, bounded watchdog
```

`writer.cjs` (Process B) reports `error_code` / `error_message` from `SqliteError` and exits `2` on failure, `0` on success.

---

## 15. Temporary Fixture Cleanup

Cleanup applies only to this task's fixture directory:

```powershell
Remove-Item -LiteralPath "%TEMP%\qfat-sqlite-validation-20261111-102816" -Recurse -Force
```

Status: performed after evidence collection and report preparation. No file outside that directory (and the task's own report) was removed. The QFAT repository and any user data were untouched.

---

## 16. Git Publication

- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Branch:** `main`
- **Base commit:** `54e106bac5ae1417f5d870e7e5f0b9a99f138c15`
- **Commit message:** `docs(task): QFAT-002W Windows SQLite validation report`
- **Files added:** `reports/QFAT-002W-windows-sqlite-validation.md` only
- **Push:** `git push origin main`, followed by independent remote verification (`git ls-remote origin main`, `git fetch` + `git rev-parse origin/main`, report presence on the remote branch)

The exact commit SHA is visible on GitHub; it is intentionally not embedded here because embedding a commit's own SHA would change that SHA (workflow §3 Phase G).

---

## 17. Verification Matrix

| Command / Check | Runtime | Result |
|---|---|---|
| `npm init -y` | Node 24.16.0 | PASS (exit 0) |
| `npm install --save-exact …` | Node 24.16.0 | PASS (exit 0, 21 packages, 4 moderate) |
| `npm init -y` / `install --save-exact …` | Node 22.23.4 | PASS (exit 0, 21 packages, 4 moderate) |
| `npx tsx binding-select.ts` | Node 24.16.0 | PASS (exit 0, `win32-x64.node` loaded) |
| `node22 node … tsx binding-select.ts` | Node 22.23.4 | PASS (exit 0, `win32-x64.node` loaded) |
| `npx tsx test-basic-ops.ts` | Node 24.16.0 | PASS (exit 0, 14/14) |
| `node22 node … tsx test-basic-ops.ts` | Node 22.23.4 | PASS (exit 0, 14/14) |
| `npx drizzle-kit generate` (v1, v2) | Node 24.16.0 | PASS (exit 0 ×2) |
| `node22 node … drizzle-kit generate` | Node 22.23.4 | PASS (exit 0) |
| `npx tsx test-migrations.ts` | Node 24.16.0 | PASS (exit 0, 6/6) |
| `node22 node … tsx test-migrations.ts` | Node 22.23.4 | PASS (exit 0, 6/6) |
| `npx tsx lock-test.ts` | Node 24.16.0 | PASS (exit 0, 8/8) |
| `node22 node … tsx lock-test.ts` | Node 22.23.4 | PASS (exit 0, 8/8) |
| `git status` / `git diff --stat` in QFAT repo | — | PASS (clean; only report added) |

All checks above were **executed**, not inferred. No result in this report is fabricated or summarised from an unrun step; unavailable checks are explicitly marked NOT RUN in §12.3.

---

## 18. Handoff

This report is ready for **GPT/owner audit** on GitHub. It contains developer self-executed validation evidence for the owner's Windows 10 machine only. **Agent PASS is not owner acceptance.** Adoption of `better-sqlite3` + Drizzle and any implementation work remain separate owner decisions after GPT audits both this report and `reports/QFAT-002S-sqlite-driver-validation.md` and updates ADR-001 if appropriate.

---


---

## 19. GPT post-publication audit — 2026-11-11

This section was appended by GPT after fetching the published report from `main`. It preserves the agent's original test record and distinguishes post-publication verification from facts recorded during execution.

### 19.1 Publication verification

- Agent report commit: `ecf1aa69202d1404ff317987fd7db40d6cb83425`.
- The GitHub compare from task commit `54e106bac5ae1417f5d870e7e5f0b9a99f138c15` to the agent commit reports exactly one commit ahead, zero behind, and exactly one added file: this report.
- The added file is `reports/QFAT-002W-windows-sqlite-validation.md`; no application source, package manifest, lockfile, or other repository file was changed by the agent task commit.
- The report was fetched successfully from the remote `main` branch.

### 19.2 Technical audit

GPT reviewed the report's environment record, runtime matrix, install and native-binding evidence, SQLite assertions, Drizzle migration procedure, lock-contention scenarios, acceptance matrix, and stated limitations.

- The reported Windows 10 Pro 22H2 x64 test coverage is internally consistent with the task: Node 22.23.4 portable runtime and Node 24.16.0 system runtime were both actually executed.
- The report distinguishes Windows x64 evidence from untested Windows 11 and ARM64 configurations. No broader Windows support claim is accepted from this run.
- The lock test's ready-file signal is emitted only after Process A has acquired its `BEGIN IMMEDIATE` write lock; Process B is started after that signal. The two reported outcomes are therefore meaningfully separated rather than inferred from configuration alone.
- The Windows v1-to-v2 upgrade uses a v1-only migration folder, the runtime migrator, and verifies preservation of an existing row. This is stronger end-to-end upgrade evidence than merely inserting a migration-ledger row manually.
- The Linux report QFAT-002S remains the evidence for Linux. Its upgrade fixture manually seeds the v1 schema and migration ledger before applying v2; this distinction is retained when interpreting the combined evidence.
- GPT has reviewed the report and GitHub publication metadata, but has not independently rerun the agent's temporary test scripts. The scripts were intentionally kept outside the repository and the report states that the temporary fixture was removed after evidence collection.

### 19.3 Findings retained for later decision

1. Windows validation is specific to Windows 10 Pro 22H2 x64. Windows 11 and Windows ARM64 remain untested; run additional validation only if those configurations become explicit product targets.
2. The Node 22 result used a checksum-verified portable official runtime. This is valid runtime execution evidence and did not alter the system installation; a normal developer/CI runtime pin remains an operational follow-up.
3. Both platform reports mention four moderate npm audit findings in the Drizzle Kit/esbuild development-tool dependency chain and deprecated `@esbuild-kit` packages. The reports do not include the complete advisory IDs or raw audit output. Before locking the dependency set for implementation, capture the exact advisories and dependency paths, determine whether the findings remain present in the then-current package versions, and decide whether an update or documented exception is appropriate.
4. Windows reports `EBUSY` when attempting to delete an open database file and observes busy-timeout overshoot. These are valid implementation constraints: close database handles before file operations and treat `SQLITE_BUSY` as an actionable error rather than a precise latency promise.

### 19.4 Audit conclusion

**QFAT-002W: AUDIT PASS WITH FINDINGS.** The report provides credible, task-aligned executed evidence for the tested Windows 10 x64 configuration on Node 22 and Node 24. No substantive contradiction or repository-scope violation was found in the report.

**Combined QFAT-002S + QFAT-002W: technically viable candidate, pending owner decision.** The evidence supports continuing with `better-sqlite3@13.0.3`, Drizzle ORM `0.45.4`, and Drizzle Kit `0.31.11` as the proposed stack for Linux x64 and Windows 10 x64. It does not establish support for untested Windows variants or architectures, resolve the npm audit findings, or authorize dependency adoption.

ADR-001 remains **PROPOSED** until the owner explicitly accepts the driver and migration choice. No implementation authorization is created by this audit.


*End of QFAT-002W Windows SQLite Validation Report*
