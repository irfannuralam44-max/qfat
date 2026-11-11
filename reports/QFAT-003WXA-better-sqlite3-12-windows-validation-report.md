# QFAT-003WXA — Adopt better-sqlite3 12.11.1 for Windows clean installs

- **Status:** **PASS WITH FINDINGS** — standard `npm ci` succeeds without Python/MSVC on both required Node runtimes; all backend checks pass. Findings: `prebuild-install` is deprecated and downloads from GitHub releases at install time, and the bundled SQLite engine is 3.53.2 (vs 3.53.4 in 13.0.3). Final cross-platform acceptance still requires a separate Linux validation and GPT audit.
- **Task ID:** QFAT-003WXA
- **Task specification:** `tasks/QFAT-003WXA-better-sqlite3-12-windows-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Synchronized base SHA:** `4b02aac3e62eeb3f26e1a12d82a716bebc9afa3e`
- **Implementation SHA:** reported in the OpenCode handoff (this commit changes `apps/server/package.json` and `apps/server/package-lock.json` plus this report)
- **Report path:** `reports/QFAT-003WXA-better-sqlite3-12-windows-validation-report.md`
- **Execution date:** 2026-11-11
- **Machine scope:** Windows only (owner's Windows 10 Pro 22H2 x64 PC). Linux **NOT RUN**.
- **Owner decision implemented:** Option A from `reports/QFAT-003WX-windows-clean-install-remediation-report.md` (approved 2026-11-11).
- **CI:** Deferred by owner. No workflow created or executed.

---

## 1. Executive summary

The owner-approved Option A was implemented: the sole direct SQLite dependency changed from `better-sqlite3@13.0.3` to `better-sqlite3@12.11.1`, and the lockfile was regenerated with npm 10.9.9. All other direct dependency versions, scripts, schema, migrations, and application source are untouched.

Result on the owner's Windows 10 Pro 22H2 x64 PC:

- `npm ci` exits **0** on Node 22.23.4 / npm 10.9.9 and on Node 24.16.0 / npm 11.13.0, with **zero** `node-gyp` invocations and **no** Python/MSVC/Visual Studio Build Tools.
- The installed native binding loads and executes a real SQLite query on both runtimes (SQLite 3.53.2, WAL, foreign keys, busy timeout, integrity check, FK violation blocked).
- `npm run typecheck` exits 0 and `npm test` passes **14/14** on both runtimes, including `migration upgrade v1 to v2 preserves existing data`.
- `npm run audit:prod` reports `found 0 vulnerabilities` (exit 0) on both runtimes.
- `npm run audit:full` reports only the pre-existing ADR-001 dev-only `GHSA-67mh-4wv8-2f99` (4 moderate), exit 1, unsuppressed.

Trade-offs introduced by this version change are documented in §9: `prebuild-install@7.1.3` is deprecated and downloads the native binary from GitHub releases at install time, and the bundled SQLite engine is 3.53.2 rather than 3.53.4.

---

## 2. Mandatory safe synchronization evidence

| Check | Result |
|---|---|
| Repository root | `C:/Users/irfan/Documents/qfat` |
| `origin` fetch/push URL | `https://github.com/irfannuralam44-max/qfat.git` |
| Branch | `main` |
| HEAD before fetch | `8123e7114ada8b1abe39f0663f50072c00ccbf49` |
| Working tree before fetch | Clean (`git status --porcelain=v1 -uall` produced no output) |
| `git fetch origin main --prune` | Succeeded; `origin/main` = `4b02aac3e62eeb3f26e1a12d82a716bebc9afa3e` |
| Fast-forward check | `git merge-base --is-ancestor HEAD origin/main` → true |
| Synchronization | `git pull --ff-only origin main` → `Updating 8123e71..4b02aac` (fast-forward) |
| HEAD after synchronization | `4b02aac3e62eeb3f26e1a12d82a716bebc9afa3e` |
| `git rev-parse origin/main` | `4b02aac3e62eeb3f26e1a12d82a716bebc9afa3e` (equal) |

No reset, clean, stash, overwrite, rebase, or force-push was used. No local work was discarded (tree was clean at the start).

Documents read before acting: this task file, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/decisions/ADR-001-sqlite-driver-and-migrations.md` (complete), `reports/QFAT-003W-windows-backend-sqlite-validation-report.md` (including GPT audit §18), `reports/QFAT-003WX-windows-clean-install-remediation-report.md`, `apps/server/package.json`, `apps/server/package-lock.json`, `apps/server/src/db/connection.ts`, `apps/server/src/db/migrate.ts`, `apps/server/test/connection.test.ts`.

---

## 3. Windows machine and runtime matrix

### 3.1 Machine

| Property | Value |
|---|---|
| OS | Windows 10 Pro, 22H2 |
| Build / UBR | 19045 / 6466 |
| `[System.Environment]::OSVersion.Version` | `10.0.19045.0` |
| `RuntimeInformation.OSArchitecture` | `X64` |
| PowerShell | `5.1.19041.6456` (Desktop, CLR 4.0.30319.42000) |
| `process.platform` / `process.arch` | `win32` / `x64` |

### 3.2 Runtime matrix

| Runtime | Source | Executable | npm | node-gyp | ABI | N-API |
|---|---|---|---|---|---|---|
| Node.js 22.x | Checksum-verified portable archive in the task temp dir | `…\qfat-003wxa-febbcf3ffd77\node-v22.23.4-win-x64\node.exe` (v22.23.4) | 10.9.9 (bundled, invoked explicitly) | 11.5.0 | 127 | 10 |
| Node.js 24.x | Existing system installation | `C:\Program Files\nodejs\node.exe` (v24.16.0) | 11.13.0 | 12.3.0 | 137 | 10 |

Node 22 portable archive verification:

- Source: `https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip`
- Expected SHA-256: `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`
- Actual SHA-256: `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20` → **MATCH**
- No installer run; no persistent PATH/registry/system change.

### 3.3 Toolchain absence (verified)

```
python.exe  -> C:\Users\irfan\AppData\Local\Microsoft\WindowsApps\python.exe   (Store alias stub)
python --version -> "Python was not found; run without arguments to install from the Microsoft Store…"
py -> not recognized
vswhere.exe -> not found (no Visual Studio installer)
C:\Program Files (x86)\Microsoft Visual Studio -> not present
```

No Python and no MSVC/Visual Studio Build Tools exist on this machine.

---

## 4. Implementation — exact changes

### 4.1 Manifest

`apps/server/package.json`:

```diff
   "dependencies": {
-    "better-sqlite3": "13.0.3",
+    "better-sqlite3": "12.11.1",
     "drizzle-orm": "0.45.4"
   },
```

Only the `better-sqlite3` pin changed. `drizzle-orm`, `drizzle-kit`, `tsx`, `typescript`, `@types/better-sqlite3`, `@types/node`, scripts, engines, and module type are unchanged.

### 4.2 Lockfile regeneration

- Command: `npm install --package-lock-only`
- Runtime used: Node.js 22.23.4 / npm 10.9.9 (minimum supported client)
- Exit code: 0
- Output (tail): `11 packages are looking for funding` / `4 moderate severity vulnerabilities` (the ADR-001 dev-only advisory). No `node-gyp` invocation.

### 4.3 Dependency-graph comparison (programmatic, old lockfile vs new)

| Metric | Value |
|---|---|
| Old package entries | 116 |
| New package entries | 152 |
| Lockfile version | 3 → 3 |
| Direct dependency version changes | **1** (`better-sqlite3`: `13.0.3` → `12.11.1`) |
| Direct dev dependency changes | **0** |
| Engine requirement change | none (`>=22.0.0` unchanged) |
| Removed packages | **1** (`node_modules/node-addon-api` 8.9.2) |
| Added packages | **36** (the `prebuild-install` chain: `bindings`, `prebuild-install`, `detect-libc`, `minimist`, `mkdirp-classic`, `napi-build-utils`, `node-abi`, `rc`, `simple-get`, `tar-fs`, `tar-stream`, `pump`, `bl`, `buffer`, `chownr`, `decompress-response`, `expand-template`, `github-from-package`, `ini`, `mimic-response`, `once`, `safe-buffer`, `semver`, `string_decoder`, `strip-json-comments`, `tunnel-agent`, `util-deprecate`, `wrappy`, `end-of-stream`, `file-uri-to-path`, `fs-constants`, `ieee754`, `inherits`, `readable-stream`, `deep-extend`, `base64-js`) |

No other direct dependency version, script, schema, migration, or application source changed.

### 4.4 Installed `better-sqlite3` metadata (both runtimes)

| Property | Value |
|---|---|
| Version | `12.11.1` (exact) |
| `engines.node` | `20.x || 22.x || 23.x || 24.x || 25.x || 26.x` |
| `scripts.install` | `prebuild-install || node-gyp rebuild --release` |
| `gypfile` | absent (not set; the explicit install script is what drives the build) |
| `hasInstallScript` in lockfile | `true` (whitelisted, so it survives `npm install`) |
| Dependencies | `bindings@^1.5.0`, `prebuild-install@^7.1.1` |
| Native binary location | `node_modules/better-sqlite3/build/Release/better_sqlite3.node` (1,918,976 bytes) |
| Binary source | downloaded by `prebuild-install` from the project's GitHub releases (host `github.com`, repository `WiseLibs/better-sqlite3`) |
| SQLite engine version reported by binding | 3.53.2 |

---

## 5. Clean install — **PASS on both runtimes**

Run from `C:\Users\irfan\documents\qfat\apps\server`, no `--ignore-scripts`, no config changes, no manual binary copying. `npm ci` removes `node_modules` first, so the Node 22 and Node 24 runs used isolated install state.

### 5.1 Node.js 22.23.4 / npm 10.9.9

```powershell
npm.cmd ci
```

- **Exit code: 0**
- Output (tail): `added 60 packages, and audited 61 packages in 20s` / `4 moderate severity vulnerabilities`
- `node-gyp` invocations in the log: **0**
- Installed `better-sqlite3` version: `12.11.1`
- Warnings: `npm warn deprecated @esbuild-kit/esm-loader@2.6.5`, `npm warn deprecated @esbuild-kit/core-utils@2.6.5`, `npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native package.`

### 5.2 Node.js 24.16.0 / npm 11.13.0

```powershell
npm.cmd ci
```

- **Exit code: 0**
- Output (tail): `added 60 packages, and audited 61 packages in 8s` / `4 moderate severity vulnerabilities`
- `node-gyp` invocations in the log: **0**
- Installed `better-sqlite3` version: `12.11.1`
- Warnings: same three deprecation warnings, including `prebuild-install@7.1.3`.

No Python, MSVC, Visual Studio Build Tools, Windows SDK, or native compilation was required on either runtime.

---

## 6. Native SQLite binding proof

### 6.1 Node 22 (ABI 127)

```
node=v22.23.4
platform_arch=win32 x64
modules_abi=127
sqlite_version=3.53.2
journal_mode=wal
foreign_keys=1
busy_timeout=5000
roundtrip={"id":1,"note":"qfat-003wxa","fkref":null}
integrity=ok
fk_violation_blocked=true
db_closed=ok
wal_sidecar_after_close=false
shm_sidecar_after_close=false
node_modules_version=12.11.1
```

Exit code: 0. Database created new inside the task temp directory.

### 6.2 Node 24 (ABI 137)

```
node=v24.16.0
platform_arch=win32 x64
modules_abi=137
sqlite_version=3.53.2
journal_mode=wal
foreign_keys=1
busy_timeout=5000
roundtrip={"id":1,"note":"qfat-003wxa","fkref":null}
integrity=ok
fk_violation_blocked=true
db_closed=ok
wal_sidecar_after_close=false
shm_sidecar_after_close=false
node_modules_version=12.11.1
```

Exit code: 0.

---

## 7. Backend checks

### 7.1 Typecheck and tests

| Check | Node 22 | Node 24 |
|---|---|---|
| `npm run typecheck` | exit 0 | exit 0 |
| `npm test` | exit 0 — `# tests 14 / # pass 14 / # fail 0` | exit 0 — `ℹ tests 14 / ℹ pass 14 / ℹ fail 0` |
| `migration upgrade v1 to v2 preserves existing data` | `ok 5` | `✔` |
| leftover fixtures (`qfat-*`) in redirected TMPDIR | 0 | 0 |

### 7.2 Audits

| Check | Node 22 | Node 24 |
|---|---|---|
| `npm run audit:prod` | `found 0 vulnerabilities`, exit 0 | `found 0 vulnerabilities`, exit 0 |
| `npm run audit:full` | 4 moderate (`GHSA-67mh-4wv8-2f99`, dev-only `esbuild@0.18.20` via `@esbuild-kit` under `drizzle-kit`), exit 1 | same, exit 1 |

Only the pre-existing ADR-001 development-tooling advisory appears; no new advisory was introduced by the 12.11.1 transitive chain (`prebuild-install` and its dependencies audited clean). No suppression, override, or `npm audit fix --force` was used.

### 7.3 Migration generation

`npm run db:generate` twice per runtime: exit 0, "No schema changes, nothing to migrate". Migration file hashes identical before and after. `npm run db:migrate` remains a no-op (unchanged, out of scope).

---

## 8. `prebuild-install` supply-chain analysis

- **Package:** `prebuild-install@7.1.3`, a runtime dependency of `better-sqlite3@12.11.1`.
- **Deprecation:** npm emits `npm warn deprecated prebuild-install@7.1.3: No longer maintained. Please contact the author of the relevant native package.` on every install.
- **Network behavior:** during `npm ci`, `prebuild-install` fetches a prebuilt binary tarball from the project's GitHub releases (`github.com/WiseLibs/better-sqlite3`) for the host's ABI (127 on Node 22, 137 on Node 24) and extracts it into `build/Release/better_sqlite3.node`. No compilation occurs.
- **Provenance:** the binary is a third-party prebuilt retrieved from GitHub at install time, not from the npm registry. This is the standard `better-sqlite3` 12.x install mechanism and is what makes the toolchain-free install possible.
- **Failure mode:** if GitHub releases are unreachable (offline machine, corporate proxy, or a removed release asset), `prebuild-install` fails and falls back to `node-gyp rebuild --release`, which **does** require Python/MSVC and would reintroduce the original blocker. This is a residual operational risk and is recorded as a finding (F-03).
- **Durability:** `hasInstallScript` is in npm's lockfile whitelist, so the install script survives `npm install` and `npm ci`. Verified: after an ordinary `npm install`, `hasInstallScript` remains (count 1 → 1) and a subsequent `npm ci` still exits 0.
- **No install-time tracked change:** `npm ci` does not modify tracked files or the lockfile (verified in §10).

---

## 9. Findings and limitations

**F-01 (finding) — `prebuild-install` is deprecated.** `prebuild-install@7.1.3` prints a deprecation warning on every install. It is unmaintained upstream. It is a prod transitive dependency, so the warning appears for every consumer.

**F-02 (finding) — SQLite engine version moved from 3.53.4 to 3.53.2.** The v12 binding reports SQLite 3.53.2 (vs 3.53.4 in 13.0.3). This is a minor patch difference introduced by the version change; no schema or API impact is expected, but it is recorded for the audit.

**F-03 (finding, residual risk) — install depends on GitHub release availability.** `prebuild-install` downloads the native binary from GitHub releases. An offline or restricted environment would fall back to `node-gyp rebuild`, reintroducing the Python/MSVC requirement. This is the price of the toolchain-free install.

**F-04 (unchanged, out of scope) — QFAT-003W findings F-02/F-03/F-04 remain open.** `npm run db:migrate` is still a no-op, `npm run clean` is still `rm -rf dist`, and test cleanup helpers still swallow filesystem errors. Not touched.

**F-05 (informational) — advisory unchanged.** Only the pre-existing ADR-001 dev-only `GHSA-67mh-4wv8-2f99` appears; no new advisory from the 12.11.1 chain.

### Limitations

- Windows 10 Pro 22H2 x64 only. No Windows 11/ARM64 claim.
- Node 22 was a portable, checksum-verified runtime, not a system installation.
- No concurrent/multi-process SQLite contention or large-WAL stress test was performed.
- Linux execution was **not run** (§10 of this report's scope; task §5.5).

---

## 10. Linux compatibility assessment (Linux execution **NOT RUN**)

Per task §5.5, no command was executed on the Linux PC. This is a Windows-only execution task.

- `better-sqlite3@12.11.1` declares `engines.node: 20.x || 22.x || 23.x || 24.x || 25.x || 26.x` and ships `prebuilds/linux-x64.node` and `linux-arm64.node` (and linuxmusl variants). The prebuild path exists for Linux.
- `prebuild-install` would fetch the matching Linux prebuild from GitHub releases on a Linux host, so the toolchain-free behavior is expected to carry over, but this is not verified.
- A separate Linux validation task is required before final cross-platform acceptance. **No Linux pass is claimed.**
- Existing Linux evidence reviewed: `reports/QFAT-002S-sqlite-driver-validation.md`, `reports/QFAT-003-backend-sqlite-foundation.md`, `reports/QFAT-003R2B-fixture-cleanup-failure-safety-report.md`.

---

## 11. Git state, data safety, and changed files

### 11.1 Files changed

- `apps/server/package.json` — one-line version change (`13.0.3` → `12.11.1`).
- `apps/server/package-lock.json` — regenerated; better-sqlite3 and transitive prebuild-install chain; `node-addon-api` removed.
- This report.

No source, test, schema, migration, script, `.npmrc`, or other configuration changed.

### 11.2 Git state

| Point | `git status --short --branch` |
|---|---|
| Before fetch | `## main` (clean) |
| After `git pull --ff-only` | `## main` (clean) |
| After `npm ci` (Node 24, succeeded) | `## main` (only the two tracked changes) |
| Before writing this report | ` M apps/server/package-lock.json` / ` M apps/server/package.json` |
| `git diff --check` | exit 0 |

`npm ci` did not modify tracked files beyond the intended change; the lockfile on disk matches the committed regeneration (blob `188d18b97026f7fb3bac4d6838a5270f840f3e2b`).

### 11.3 Data safety

- No real QFAT database, credential, token, `.secrets/` file, `queue/` content, or platform account was accessed.
- No upload or platform API call occurred.
- All disposable databases, probes, logs, and the portable runtime live under the single unique task directory `C:\Users\irfan\AppData\Local\Temp\qfat-003wxa-febbcf3ffd77`; nothing outside it was deleted or modified.
- Network access: `nodejs.org` (Node 22 archive + checksums), `registry.npmjs.org` (metadata, tarball, packages), and `github.com` (prebuild binaries fetched by `prebuild-install` during `npm ci`).

---

## 12. Acceptance criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Owner-approved exact driver version selected | **PASS** | Manifest pin exactly `12.11.1` (§4.1) |
| AC-02 | Only intended dependency changed | **PASS** | Manifest/lockfile diff; one direct dep changed, 0 dev dep changes (§4.3) |
| AC-03 | Lockfile reproducibly generated | **PASS** | `npm install --package-lock-only`, npm 10.9.9, exit 0; lockfile v3 (§4.2) |
| AC-04 | Node 22 standard Windows install succeeds | **PASS** | `npm ci` exit 0, no toolchain, no script suppression (§5.1) |
| AC-05 | Node 24 standard Windows install succeeds | **PASS** | `npm ci` exit 0 (§5.2) |
| AC-06 | Correct native binding works | **PASS** | Real disposable SQLite query on both runtimes (§6) |
| AC-07 | Typecheck and complete tests pass | **PASS** | exit 0, 14/14 on both runtimes (§7.1) |
| AC-08 | v1-to-v2 migration upgrade passes | **PASS** | Named test passed on both runtimes (§7.1) |
| AC-09 | Production audit remains clean | **PASS** | `found 0 vulnerabilities`, exit 0 (§7.2) |
| AC-10 | Full audit remains transparent | **PASS** | 4 moderate `GHSA-67mh-4wv8-2f99`, exit 1, unsuppressed; no new advisory (§7.2) |
| AC-11 | Install-time supply-chain behavior documented | **PASS** | `prebuild-install` source/host, deprecation, network, durability (§8) |
| AC-12 | Lifecycle scripts remain enabled | **PASS** | `hasInstallScript` present; `npm ci` ran `prebuild-install`; 0 gyp invocations (§5, §8) |
| AC-13 | No real data/account/API use | **PASS** | §11.3 |
| AC-14 | Linux execution honestly marked NOT RUN | **PASS** | §10 states NOT RUN |
| AC-15 | No CI activation | **PASS** | No workflow created or executed |
| AC-16 | Report factual and complete | **PASS** | Environment, diffs, commands, exit codes, findings, limitations recorded |

**Overall: PASS WITH FINDINGS.** AC-01 through AC-13 and AC-15 through AC-16 pass; AC-14 accurately states Linux NOT RUN. Findings F-01 through F-03 (deprecation, SQLite 3.53.2, GitHub-release network dependency) are recorded but do not block this task. Final cross-platform acceptance remains pending a separate Linux validation and GPT audit.

---

## 13. Handoff

This report is ready for GPT/owner audit. It is **not** owner acceptance and does not authorize API implementation, live account connections, uploads, or any next stage.

The Windows clean-install objective is met for both Node 22 and Node 24 using ordinary `npm ci` with no Python/MSVC, by adopting the owner-approved `better-sqlite3@12.11.1`. Residual findings (deprecated `prebuild-install`, install-time GitHub release download, SQLite 3.53.2 vs 3.53.4) and the separate ADR-001 documentation update are left for GPT/owner review. A separate Linux validation task is required before final cross-platform acceptance.
