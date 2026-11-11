# QFAT-003WX — Windows Clean Install Remediation for better-sqlite3

- **Status:** **BLOCKED** — investigation completed; **no safe in-scope fix exists** for npm 10.9.9 / 11.13.0 as shipped with Node.js 22 / 24. **No repository change was made.** Owner decision required (see §13).
- **Task ID:** QFAT-003WX
- **Task specification:** `tasks/QFAT-003WX-windows-clean-install-remediation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Synchronized base SHA:** `99bbb552688efd6ea3d1c4232c54ed2e0d70e905`
- **Implementation SHA:** `99bbb552688efd6ea3d1c4232c54ed2e0d70e905` (identical — no source, manifest, lockfile, test, or configuration change)
- **Report path:** `reports/QFAT-003WX-windows-clean-install-remediation-report.md`
- **Execution date:** 2026-11-11
- **Machine scope:** Windows only (owner's Windows 10 Pro 22H2 x64 PC). Linux **NOT RUN**.
- **Related finding:** QFAT-003W F-01; audit `40e6bd5984a77e73bafa84c65e9d0c4570db39f2`
- **CI:** Deferred by owner. No workflow created or executed.

---

## 1. Executive summary

The QFAT-003W blocker is **independently reproduced and the root cause is confirmed with new precision**, but **no safe, durable fix is available inside this task's scope**.

**Confirmed root cause (new detail).** `better-sqlite3@13.0.3` declares `"gypfile": false` in its tarball and ships prebuilt N-API binaries for `win32-x64` (and all other supported targets). The npm registry's **full** packument also contains `"gypfile": false`. However, npm's install path requests the **abbreviated ("corgi") packument**, whose fields for this version are only `name, version, dependencies, devDependencies, dist, engines` — `gypfile` is absent. npm's `package-lock.json` v3 writer does not record `gypfile` either (it is not in arborist's `pkgMetaKeys` whitelist). During `npm ci`, arborist's `#addToBuildSet()` reads `gypfile` from the **lockfile entry**, finds `undefined`, sees the shipped `binding.gyp`, and injects an implicit `install: node-gyp rebuild`. This machine has no Python and no Visual Studio C++ build tools, so the install fails.

**Required command result.** Ordinary `npm ci` **fails with exit code 1 on both required runtimes** (Node 22.23.4 / npm 10.9.9 and Node 24.16.0 / npm 11.13.0). AC-04 and AC-05 therefore **FAIL**.

**Candidate mechanisms tested (all in disposable temp copies):**

| Candidate | Result |
|---|---|
| Lockfile entry `"gypfile": false` | `npm ci` **succeeds** on both runtimes with lifecycle scripts enabled — but `npm install` **silently deletes the field**, after which `npm ci` fails again. Non-durable. |
| Tarball-URL dependency spec (`https://…/better-sqlite3-13.0.3.tgz`) | Lockfile still omits `gypfile`; `npm ci` **fails**. |
| npm configuration (`ignore-scripts`, `full-metadata`, per-package gyp control) | No per-package mechanism exists. npm 10.9.9 exposes only the blanket `ignore-scripts`; npm 11.13.0 adds only a `node-gyp` path. `full-metadata` is not an npm config key. Blanket suppression is forbidden by the task. |
| `npm ci --ignore-scripts` | Explicitly forbidden as the final solution. |
| Newer `better-sqlite3` 13.x | None published — `dist-tags.latest` is `13.0.3`. |

Because the only working lever is an undocumented, self-erasing lockfile hand-edit, it is **not a safe fix** and was **not implemented**. Per task §5.1 and §6, this report stops without code changes and requests an owner decision.

**Diagnostic (not acceptance) evidence.** In a faithful copy of `apps/server` with **only** `"gypfile": false` added to the lockfile entry, everything else works on this Windows PC with lifecycle scripts **enabled** and **no** `--ignore-scripts`: `npm ci` exit 0 with zero `node-gyp` invocations, native SQLite query OK on ABI 127 and ABI 137, `typecheck` exit 0, **14/14 tests** including `migration upgrade v1 to v2 preserves existing data`, `audit:prod` clean, `audit:full` transparent (4 moderate, ADR-001 dev-only). This isolates the defect to npm's metadata handling and confirms the shipped prebuild is correct.

---

## 2. Mandatory safe synchronization evidence

| Check | Result |
|---|---|
| Repository root | `C:/Users/irfan/Documents/qfat` |
| `origin` fetch/push URL | `https://github.com/irfannuralam44-max/qfat.git` |
| Branch | `main` |
| HEAD before fetch | `93e6898072f1c3fb91cd740204808528678a4953` |
| Working tree before fetch | Clean (`git status --porcelain=v1 -uall` produced no output) |
| `git fetch origin main --prune` | Succeeded; `origin/main` = `99bbb552688efd6ea3d1c4232c54ed2e0d70e905` |
| Fast-forward check | `git merge-base --is-ancestor HEAD origin/main` → true |
| Synchronization | `git pull --ff-only origin main` → `Updating 93e6898..99bbb55` (fast-forward) |
| HEAD after synchronization | `99bbb552688efd6ea3d1c4232c54ed2e0d70e905` |
| `git rev-parse origin/main` | `99bbb552688efd6ea3d1c4232c54ed2e0d70e905` (equal) |

No reset, clean, stash, overwrite, rebase, or force-push was used. No local work was discarded (the tree was clean at the start).

Documents read before acting: this task file, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`, `apps/server/package.json`, `apps/server/package-lock.json`, `apps/server/src/db/connection.ts`, `apps/server/src/db/migrate.ts`, `apps/server/test/connection.test.ts`, `reports/QFAT-003W-windows-backend-sqlite-validation-report.md` including GPT audit §18 (`40e6bd5`), and `reports/QFAT-003R2A` / `QFAT-003R2B`.

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
| Node.js 22.x | Checksum-verified portable archive in the task temp dir | `…\qfat-003wx-c537f30b6d92\node-v22.23.4-win-x64\node.exe` (v22.23.4) | 10.9.9 (bundled, invoked explicitly) | 11.5.0 | 127 | 10 |
| Node.js 24.x | Existing system installation | `C:\Program Files\nodejs\node.exe` (v24.16.0) | 11.13.0 | 12.3.0 | 137 | 10 |

Node 22 portable archive verification:

- Source: `https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip`
- Expected SHA-256 (from `SHASUMS256.txt`): `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`
- Actual SHA-256: `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20` → **MATCH**
- No installer run; no persistent PATH/registry/system change. PATH was prefixed only inside the individual shells used for Node 22 commands.

### 3.3 Toolchain absence (verified, not assumed)

```
python.exe  -> C:\Users\irfan\AppData\Local\Microsoft\WindowsApps\python.exe   (Store alias stub)
python --version -> "Python was not found; run without arguments to install from the Microsoft Store…"
py -> not recognized
vswhere.exe -> not found (no Visual Studio installer)
C:\Program Files (x86)\Microsoft Visual Studio -> not present
```

No Python and no MSVC/Visual Studio Build Tools exist on this machine, matching the owner's constraint.

---

## 4. Root-cause investigation (independent reproduction)

### 4.1 Tarball metadata — `better-sqlite3@13.0.3`

Obtained with `npm pack better-sqlite3@13.0.3` into the task temp dir:

- Tarball: `better-sqlite3-13.0.3.tgz`, 11,402,131 bytes
- SHA-256: `77e0513dc1a469fb3bceec4c7fb5ad3f403109787eda05be047ec17fd56868cb`
- Extracted `package/package.json`:
  - `"gypfile": false` — **present**
  - `scripts.install` — **absent**
  - `scripts.preinstall` — **absent**
- Shipped files include `package/binding.gyp` **and** `package/prebuilds/win32-x64.node` (plus darwin, linux, linuxmusl, win32-arm64 prebuilds).
- `package/lib/binding.js` resolves `path.join(__dirname, '..', 'prebuilds', `${target}.node`)` at runtime — the package is designed to run from the prebuild with no compilation.

### 4.2 Registry metadata — abbreviated vs full packument

Direct registry requests with explicit `Accept` headers:

| Document | Fields for `13.0.3` | `gypfile` | `hasInstallScript` |
|---|---|---|---|
| `application/vnd.npm.install-v1+json` (**corgi**, used by installs) | `name, version, dependencies, devDependencies, dist, engines` | **absent** | absent |
| Default/full packument | full manifest | **`false`** | n/a |

`dist-tags.latest` = `13.0.3` — no newer 13.x release exists that might carry a corrected mechanism.

### 4.3 Committed lockfile

`apps/server/package-lock.json` (`lockfileVersion: 3`) entry:

```json
"node_modules/better-sqlite3": {
  "version": "13.0.3",
  "resolved": "https://registry.npmjs.org/better-sqlite3/-/better-sqlite3-13.0.3.tgz",
  "integrity": "sha512-RbOBxmLBG8uvFUc15X9+9SFemKcQ0WBuISBVkpuiaUB2qblC8UWlHEjdWVoZ8AdhSwmoEgsiXKfopX0CQxaACQ==",
  "license": "MIT",
  "dependencies": { "node-addon-api": "^8.0.0" },
  "engines": { "node": ">=22" }
}
```

No `gypfile`, no `hasInstallScript`.

### 4.4 npm decision path (verified in the installed npm sources)

`@npmcli/arborist/lib/arborist/rebuild.js`, `#addToBuildSet`:

```js
const { package: pkg, hasInstallScript } = node.target   // lockfile entry for `npm ci`
const { gypfile, bin, scripts = {} } = pkg

const isGyp = gypfile !== false &&
  !install &&
  !preinstall &&
  await isNodeGypPackage(node.path)

if (bin || preinstall || install || postinstall || prepare || isGyp) {
  ...
  if (isGyp) { scripts.install = defaultGypInstallScript }   // "node-gyp rebuild"
  set.add(node)
}
```

- With `gypfile` absent from the lockfile entry, `gypfile !== false` is true.
- `isNodeGypPackage(node.path)` returns true because the tarball ships `binding.gyp`.
- npm therefore injects `install: node-gyp rebuild`, which fails without Python/MSVC.

The lockfile writer explains why the field never persists — `@npmcli/arborist/lib/shrinkwrap.js`:

```js
const pkgMetaKeys = [
  'version', 'dependencies', 'peerDependencies', 'peerDependenciesMeta',
  'optionalDependencies', 'bundleDependencies', 'acceptDependencies',
  'funding', 'engines', 'os', 'cpu', 'libc', '_integrity', 'license',
  '_hasShrinkwrap', 'hasInstallScript', 'bin', 'deprecated', 'workspaces',
]
```

`gypfile` is not in the whitelist, and `metaFieldFromPkg()` additionally drops falsey values. **`gypfile: false` can never be written by npm into a lockfile entry.**

### 4.5 Verdict on the prior report's hypothesis

QFAT-003W's F-01 hypothesis (corgi packument omission → implicit `node-gyp rebuild`) is **correct**, and this task adds the missing link: the lockfile-entry lookup and the `pkgMetaKeys` whitelist, which is why the defect cannot be repaired through package metadata alone.

---

## 5. Required standard install — **FAIL on both runtimes**

Run from `C:\Users\irfan\documents\qfat\apps\server`, no `--ignore-scripts`, no config changes.

### 5.1 Node.js 22.23.4 / npm 10.9.9

```powershell
npm.cmd ci
```

- **Exit code: 1**
- Key output:

```
npm error code 1
npm error path C:\Users\irfan\documents\qfat\apps\server\node_modules\better-sqlite3
npm error command failed
npm error command C:\Windows\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info using node-gyp@11.5.0
npm error gyp info using node@22.23.4 | win32 | x64
npm error gyp ERR! find Python You need to install the latest version of Python.
npm error gyp ERR! not ok
```

### 5.2 Node.js 24.16.0 / npm 11.13.0

```powershell
npm.cmd ci
```

- **Exit code: 1**
- Key output:

```
npm error code 1
npm error path C:\Users\irfan\documents\qfat\apps\server\node_modules\better-sqlite3
npm error command failed
npm error command C:\Windows\system32\cmd.exe /d /s /c node-gyp rebuild
npm error gyp info using node-gyp@12.3.0
npm error gyp info using node@24.16.0 | win32 | x64
npm error gyp ERR! find Python You need to install the latest version of Python.
npm error gyp ERR! not ok
```

Note: npm 11.13.0 on this machine **executed** the implicit script (it was not gated). No `allowScripts`/`install-scripts` approval mechanism was active by default in either tested npm version.

### 5.3 Tracked-file impact of the failed installs

`git status --porcelain=v1 -uall` was empty after both runs. `apps/server/package-lock.json` blob hash in the worktree equals the `HEAD` blob (`53bd8fed02dac311389cfa3cd5070625aed3aaf2`). `git diff --check` exit 0. Only the gitignored `apps/server/node_modules/` was touched.

---

## 6. Candidate mechanisms evaluated

All experiments were run in disposable directories under `C:\Users\irfan\AppData\Local\Temp\qfat-003wx-c537f30b6d92`. The repository was never modified.

### 6.1 Lockfile entry `"gypfile": false` — works today, but is erased by `npm install`

One-line candidate diff against `apps/server/package-lock.json`:

```diff
     "node_modules/better-sqlite3": {
       "version": "13.0.3",
       "resolved": "https://registry.npmjs.org/better-sqlite3/-/better-sqlite3-13.0.3.tgz",
       "integrity": "sha512-RbOBxmLBG8uvFUc15X9+9SFemKcQ0WBuISBVkpuiaUB2qblC8UWlHEjdWVoZ8AdhSwmoEgsiXKfopX0CQxaACQ==",
       "license": "MIT",
+      "gypfile": false,
       "dependencies": {
         "node-addon-api": "^8.0.0"
       },
```

Measured behavior (Node 24 / npm 11.13.0, faithful copy of `apps/server`):

| Step | Result |
|---|---|
| `npm ci` with the field present | **exit 0**, **0** occurrences of `node-gyp` in the log |
| `npm install` (ordinary developer action) | exit 0, **field removed from `package-lock.json`** (`gypfile` count 1 → 0) |
| `npm ci` immediately after that `npm install` | **exit 1**, `node-gyp rebuild`, `find Python` |

This is explained by §4.4: the lockfile writer regenerates the entry from the corgi manifest and cannot represent `gypfile`. The patch therefore works only until the next `npm install`, at which point the Windows clean install breaks again **silently** — exactly the failure mode that CI (deferred) or a new machine would hit. It is a latent trap, not a safe fix, so it was not implemented.

### 6.2 Tarball-URL dependency spec — no effect

Probe `package.json` with `"better-sqlite3": "https://registry.npmjs.org/better-sqlite3/-/better-sqlite3-13.0.3.tgz"`:

- `npm install --package-lock-only` exit 0, but the generated lockfile entry still contains **no** `gypfile` (whitelist again).
- `npm ci` → **exit 1**, `node-gyp rebuild`.

### 6.3 npm configuration — no per-package control exists

| npm | Relevant config keys found in `npm config ls -l` |
|---|---|
| 10.9.9 | `ignore-scripts = false` only |
| 11.13.0 | `ignore-scripts = false`, `node-gyp = …\node-gyp.js` |

- There is **no** per-package "do not rebuild this package" setting in either version.
- `fullMetadata` is a **pacote** option, not an npm config key (`npm config get full-metadata` → `undefined`; no such definition in `@npmcli/config/lib/definitions/definitions.js`). In the npm 11.13.0 command sources it is set explicitly only by `view`, `outdated`, `cache`, `owner`, and `publish`; `pacote` otherwise defaults to the corgi document (`accept: this.fullMetadata ? fullDoc : corgiDoc`).
- Even if full metadata were fetched, §4.4 shows the lockfile could not record `gypfile`, so `npm ci` would remain broken.
- `ignore-scripts` is blanket lifecycle suppression and is **forbidden** by task §3.

### 6.4 Version change — not authorized (measured for the owner's decision only)

`better-sqlite3@12.11.1` (`engines: 20.x || 22.x || 23.x || 24.x || 25.x || 26.x`, `scripts.install: "prebuild-install || node-gyp rebuild --release"`) was probed **outside** the repository:

| Runtime | `npm install` | `npm ci` from generated lockfile | Runtime query |
|---|---|---|---|
| Node 24.16.0 | exit 0 | **exit 0** (`hasInstallScript` recorded in lockfile) | OK, SQLite 3.53.2 |
| Node 22.23.4 | exit 0 | **exit 0** | OK, SQLite 3.53.2 |

This works without Python/MSVC because `prebuild-install` downloads a prebuilt binary from the project's GitHub releases. Durability was measured too: after an ordinary `npm install`, the lockfile still records `hasInstallScript` (count 1 → 1) and a subsequent `npm ci` still exits 0, because `hasInstallScript` **is** in npm's lockfile whitelist. It is still a **version change** and introduces an install-time dependency on `github.com`, so it was **not implemented** — task §3 requires separate approval.

### 6.5 Upstream status (as of 2026-11-11)

- `WiseLibs/better-sqlite3#1516` — "v13.0.3: `gypfile:false` does not prevent node-gyp/Python invocation on Windows (`npm ci`)".
- `WiseLibs/better-sqlite3#1503` — original v13 Windows report.
- `npm/cli#9837` — `[BUG] Incorrect detection of install script for better-sqlite3@13.0.2?` (open; labels Bug / Needs Triage / allowScripts). Commenters report a **hard failure on npm 10** and that the lockfile carries no `gypfile`. A related PR (`npm/cli#10061`) is **open**; no released npm fix was identified.
- Reported (not independently verified here) behavior of npm 12: the implicit script is still synthesized but gated behind `allowScripts`, producing a warning rather than a failure. That is blanket default-deny script suppression, which the task forbids, and it does not exist in npm 10.

---

## 7. Diagnostic verification (NOT acceptance evidence for AC-04/AC-05)

Purpose: prove that the shipped prebuild and the committed backend are otherwise correct on this Windows PC, and that the **only** blocker is npm's metadata handling. Method: `robocopy` of `apps/server` (excluding `node_modules`, `dist`) into the task temp dir, then **one** added lockfile line (`"gypfile": false`) — no `--ignore-scripts`, no config, no source change.

### 7.1 Install

| Runtime | Command | Exit | `node-gyp` occurrences |
|---|---|---|---|
| Node 22.23.4 / npm 10.9.9 | `npm ci` | **0** | **0** |
| Node 24.16.0 / npm 11.13.0 | `npm ci` | **0** | **0** |

Lifecycle scripts ran normally (esbuild/tsx install scripts included) — this is stronger evidence than the `--ignore-scripts` path used in QFAT-003W.

### 7.2 Native SQLite binding

Node 22 (ABI 127):

```
node=v22.23.4
platform_arch=win32 x64
modules_abi=127
prebuild_exists=true
direct_prebuild_load=ok
sqlite_version=3.53.4
journal_mode=wal
foreign_keys=1
busy_timeout=5000
roundtrip={"id":1,"note":"qfat-003wx"}
integrity=ok
db_closed=ok
wal_sidecar_after_close=false
shm_sidecar_after_close=false
```

Node 24 (ABI 137): identical, `modules_abi=137`. Exit code 0 in both cases; the database was created new inside the task temp directory.

### 7.3 Typecheck, tests, migration upgrade

| Check | Node 22 | Node 24 |
|---|---|---|
| `npm run typecheck` | exit 0 | exit 0 |
| `npm test` | exit 0 — `# tests 14 / # pass 14 / # fail 0` | exit 0 — `ℹ tests 14 / ℹ pass 14 / ℹ fail 0` |
| `migration upgrade v1 to v2 preserves existing data` | `ok 5` | `✔` |
| leftover fixtures (`qfat-*`) in redirected TMPDIR | 0 | 0 |

### 7.4 Audits (unsuppressed)

| Check | Node 22 | Node 24 |
|---|---|---|
| `npm run audit:prod` | `found 0 vulnerabilities`, exit 0 | `found 0 vulnerabilities`, exit 0 |
| `npm run audit:full` | 4 moderate (`GHSA-67mh-4wv8-2f99`, dev-only `esbuild@0.18.20` via `@esbuild-kit` under `drizzle-kit`), exit 1 | same, exit 1 |

No suppression, override, or `npm audit fix --force` was used.

### 7.5 Migration generation

`npm run db:generate` twice per runtime: exit 0, "No schema changes, nothing to migrate". Migration file hashes were identical before and after (`migrations_unchanged=True`). `npm run db:migrate` remains a no-op (QFAT-003W F-02) and is **out of scope**; it was not modified.

---

## 8. Lifecycle-script security analysis

- **No fix was implemented**, so no lifecycle behavior changed in the repository.
- The required install currently runs **all** lifecycle scripts (the failure is that it runs *one too many* — npm's synthesized `node-gyp rebuild`).
- Every candidate that would "solve" the problem by disabling scripts (`ignore-scripts`, `ignore-scripts=true`, npm 12's default-deny `allowScripts`, `npm ci --ignore-scripts`) was rejected as forbidden blanket suppression.
- The lockfile-patch candidate (§6.1) preserves all legitimate lifecycle scripts, but it is unsafe for a different reason: npm **silently removes** the field, so the guarantee is not durable and the regression would surface only on a clean install.
- No audit finding was suppressed, no override added, and no dependency version changed.
- No credentials, tokens, `.secrets/`, `queue/`, or real database was read or written.

---

## 9. Linux compatibility assessment (Linux execution **NOT RUN**)

Per task §5.3, no command was executed on the Linux PC.

- The defect is **not** Windows-specific in origin: the same implicit `node-gyp rebuild` is triggered on Linux from a lockfile-driven install. On Linux it usually *succeeds* only because a C++ toolchain is present; commenters on `npm/cli#9837` report hard failures on toolchain-less Linux containers.
- Any candidate considered here would be platform-neutral (it changes whether the rebuild runs at all), and `better-sqlite3@13.0.3` ships `prebuilds/linux-x64.node` and `linux-arm64.node`, so the prebuild path exists on Linux.
- Linux compatibility of a future chosen fix must still be validated on Linux in a separate authorized task; **no Linux pass is claimed**.
- Existing Linux evidence reviewed: `reports/QFAT-003-backend-sqlite-foundation.md`, `reports/QFAT-003R2B-fixture-cleanup-failure-safety-report.md`.

---

## 10. Files changed, Git state, data safety

### 10.1 Files changed

**None.** The only addition is this report. No source, test, schema, migration, manifest, lockfile, `.npmrc`, or script was modified, and no dependency version was changed.

### 10.2 Git state

| Point | `git status --porcelain=v1 -uall` |
|---|---|
| Before fetch | empty |
| After `git pull --ff-only` | empty |
| After repo `npm ci` (Node 24, failed) | empty |
| After repo `npm ci` (Node 22, failed) | empty |
| Before writing this report | empty |
| `git diff --check` | exit 0 |

`apps/server/package-lock.json` worktree blob `53bd8fed02dac311389cfa3cd5070625aed3aaf2` equals `HEAD` blob — the lockfile is byte-identical to the synchronized base.

### 10.3 Data safety

- No real QFAT database, credential, token, `.secrets/` file, `queue/` content, or platform account was accessed.
- No upload or platform API call occurred.
- All disposable databases, probes, logs, and the portable runtime live under the single unique task directory `C:\Users\irfan\AppData\Local\Temp\qfat-003wx-c537f30b6d92`; nothing outside it was deleted or modified.
- Network access: `nodejs.org` (Node 22 archive + checksums), `registry.npmjs.org` (metadata, tarball, packages), and — during the out-of-scope v12 alternative probe only — the better-sqlite3 GitHub release assets fetched by `prebuild-install`.

---

## 11. Findings

**F-01 (blocking, confirmed and refined) — npm cannot honor `gypfile: false` from lockfile-driven installs.**
The corgi packument omits the field, the lockfile cannot record it (`pkgMetaKeys` whitelist, falsey-value drop), and arborist reads it from the lockfile entry. Result: implicit `node-gyp rebuild` on a package that ships a working prebuild. Affects npm 10.9.9 and 11.13.0 identically on this machine.

**F-02 (blocking, scope) — the only working npm-native lever is non-durable.**
A one-line lockfile `"gypfile": false` makes `npm ci` pass on both runtimes with scripts enabled, but ordinary `npm install` deletes it and `npm ci` fails again immediately afterwards (measured). Implementing it without owner acceptance would create a silent regression trap.

**F-03 (informational) — the full registry packument is correct.**
`gypfile: false` is present in the full packument; only the abbreviated install document is deficient. This is an npm metadata/packaging defect (`npm/cli#9837`), not a wrong declaration by the package author.

**F-04 (informational) — no fixed 13.x release.**
`dist-tags.latest` is `13.0.3`; no upstream package fix is available to pin to.

**F-05 (out of scope, unchanged) — QFAT-003W findings F-02/F-03/F-04 remain open.**
`npm run db:migrate` is still a no-op, `npm run clean` is still `rm -rf dist`, and test cleanup helpers still swallow filesystem errors. They were not touched.

**F-06 (informational) — npm 11.13.0 executed the implicit script.**
No `allowScripts` gate was active by default in this environment; the failure path was identical to npm 10.

### Limitations

- Windows 10 Pro 22H2 x64 only. No Windows 11/ARM64 claim.
- Node 22 was a portable, checksum-verified runtime, not a system installation.
- Diagnostic results in §7 used a lockfile metadata field; they demonstrate the prebuild path but are **not** acceptance evidence for AC-04/AC-05.
- npm 12 behavior is reported from upstream discussion, not executed here.
- No concurrent/multi-process SQLite contention testing was performed.

---

## 12. Acceptance criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Root cause independently reproduced | **PASS** | Tarball vs corgi vs full packument, lockfile inspection, arborist `rebuild.js`/`shrinkwrap.js` (§4) |
| AC-02 | `better-sqlite3` retained | **PASS** | No manifest/lockfile change; version still `13.0.3` (§10) |
| AC-03 | No Python/MSVC/VS build tools required | **BLOCKED** | Required install *does* require them as-is; machine has neither (§3.3, §5) |
| AC-04 | Standard `npm ci` succeeds on Node 22 | **FAIL** | exit 1, `node-gyp rebuild`, `find Python` (§5.1) |
| AC-05 | Standard `npm ci` succeeds on Node 24 | **FAIL** | exit 1, same cause (§5.2) |
| AC-06 | Native SQLite binding executes | **PASS (diagnostic only)** | ABI 127 and 137, SQLite 3.53.4, WAL/FK/busy_timeout, integrity ok (§7.2) |
| AC-07 | Typecheck and full tests pass | **PASS (diagnostic only)** | exit 0, 14/14 on both runtimes (§7.3) |
| AC-08 | Production audit clean | **PASS (diagnostic only)** | `found 0 vulnerabilities`, exit 0 (§7.4) |
| AC-09 | Full audit transparent | **PASS (diagnostic only)** | 4 moderate `GHSA-67mh-4wv8-2f99`, exit 1, unsuppressed (§7.4) |
| AC-10 | v1→v2 upgrade test passes | **PASS (diagnostic only)** | Named test passed on both runtimes (§7.3) |
| AC-11 | No install-time tracked changes | **PASS** | Clean `git status`; lockfile blob identical to `HEAD` (§10.2) |
| AC-12 | No blanket lifecycle-script suppression | **PASS** | No suppression used or implemented (§8) |
| AC-13 | No unrelated scope expansion | **PASS** | Only this report added (§10.1) |
| AC-14 | Report factual and reproducible | **PASS** | Exact commands, outputs, exit codes, environment recorded |

**Overall status: BLOCKED.** AC-04 and AC-05 fail on both runtimes, and AC-03 cannot be satisfied without an owner decision. Per task §5.1 and §6, no code change was made and the decision is returned to the owner.

---

## 13. Alternatives for owner decision

Ranked by fit with the approved constraints (retain `better-sqlite3`, no toolchain, no script suppression, reproducible `npm ci`).

| # | Option | Meets constraints | Evidence / trade-off |
|---|---|---|---|
| **A** | **Approve a version change to `better-sqlite3@12.11.1`** | Driver retained; no toolchain; no suppression; durable | Measured here: `npm ci` exit 0 and native query OK on Node 22 and 24; lockfile records `hasInstallScript`, so it survives `npm install`. Costs: changes the ADR-001 approved version (downgrade), and install-time download from GitHub releases via `prebuild-install` (deprecated package, network dependency). |
| **B** | **Approve the lockfile `"gypfile": false` patch + an explicit maintenance rule** | No version change; no toolchain; no suppression | Measured: `npm ci` exit 0 on both runtimes with scripts enabled (§6.1). Costs: undocumented hand-edit; **erased by the next `npm install`**; needs a documented re-apply step and a check (CI is deferred) to avoid silent regression. Requires the owner to accept that fragility. |
| **C** | **Wait for / require an npm fix** | No repo change | `npm/cli#9837` open, PR `#10061` open, no released fix; npm 10 and 11 both affected. Blocks Windows clean installs indefinitely. |
| **D** | **Install Python 3 + Visual Studio C++ Build Tools on the Windows PC** | Driver and version retained | Compiles from source; contradicts the owner's stated no-toolchain objective and adds a machine-wide requirement for every Windows contributor. |
| **E** | **Switch package manager (pnpm/yarn)** | Would bypass npm's rebuild injection | Out of scope; changes tooling for the whole repo and its lockfile format. |
| **F** | **Vendor/patch the dependency tarball** | Driver retained | Supply-chain and provenance change; 11 MB artifact; not recommended. |

**Agent recommendation (not a decision):** option **A** is the only path found that is simultaneously durable, toolchain-free, script-preserving, and npm-native; option **B** is the only path that avoids a version change but is inherently fragile. Either requires explicit owner approval before implementation.

---

## 14. Git publication

- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Branch:** `main`
- **Synchronized base / implementation SHA:** `99bbb552688efd6ea3d1c4232c54ed2e0d70e905`
- **Commit message:** `docs(report): publish QFAT-003WX clean install investigation`
- **Changed files:** this report only.
- **Report commit SHA:** reported in the OpenCode handoff and verifiable on the remote with:

  ```powershell
  git log -1 --format=%H -- reports/QFAT-003WX-windows-clean-install-remediation-report.md
  ```

  It is not embedded here because embedding it would change the commit SHA.
- **Push verification:** performed after commit; the report is published only if the push to `origin/main` succeeded and the remote commit was confirmed.

---

## 15. Handoff

This report is ready for GPT/owner audit. It is **not** owner acceptance and does not authorize any implementation, dependency change, toolchain installation, API work, account connection, or upload.

The Windows clean-install blocker is **not resolved**: ordinary `npm ci` fails on Node 22 and Node 24 on this machine, and no safe, durable, in-scope npm-native fix exists as of 2026-11-11. An owner decision is required among the alternatives in §13 before any code change is made.
