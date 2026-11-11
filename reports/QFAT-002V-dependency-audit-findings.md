# QFAT-002V — SQLite Candidate Dependency Audit Findings Report

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-002V-dependency-audit-findings.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Base commit (synchronized `origin/main` at start of work):** `2d8f97a76d39be881d80d738af4fd7f76bd2c486`
- **Commit message (per task §8):** `docs(task): QFAT-002V dependency audit findings report`
- **Report path:** `reports/QFAT-002V-dependency-audit-findings.md`
- **Audit date:** 2026-11-11
- **Execution mode:** one agent, serial, isolated temporary fixtures only

> The commit SHA of this report cannot be embedded in its own content (it would change the SHA). It is published as a single documentation-only commit on `main`; see §10 and GitHub for the exact SHA.

---

## 1. Executive Summary

The “four moderate npm audit findings” reported in QFAT-002S and QFAT-002W were reproduced and traced to **one single advisory** — `GHSA-67mh-4wv8-2f99` (`esbuild`, vulnerable `<=0.24.2`, fixed in `0.25.0`) — reached through **one single dependency chain**:

```
drizzle-kit@0.31.11 → @esbuild-kit/esm-loader@2.6.5 → @esbuild-kit/core-utils@3.3.2 → esbuild@0.18.20
```

Key results, all executed:

1. The count is still **4 moderate**, and it is 4 *package nodes* for **1 advisory** — not four distinct vulnerabilities.
2. The affected package is **`drizzle-kit` (development tooling), not the runtime closure**. In a QFAT-shaped manifest (`better-sqlite3` + `drizzle-orm` in `dependencies`, `drizzle-kit` + `tsx` + `typescript` in `devDependencies`), `npm audit --omit=dev` exits **0** with **0 vulnerabilities**, while `npm audit` (all scopes) reports 4 moderate.
3. The vulnerable `esbuild@0.18.20` copy is **not loaded at all** during normal use: a module-resolution trace of `drizzle-kit generate` (CJS *and* ESM project) loaded **only** the safe `esbuild@0.25.12`; loading the application runtime (`better-sqlite3` + `drizzle-orm`) loaded **zero** esbuild modules.
4. `@esbuild-kit/esm-loader` is declared by `drizzle-kit@0.31.11` but **not referenced by any shipped file**; Drizzle Kit 0.31.x bundles `tsx` internally (`tsx.register()`), so the declared legacy loader appears to be dead weight.
5. **No genuine fix exists in the selected stable line.** `drizzle-kit@0.31.11` *is* `latest`. npm's proposed fix is a **breaking downgrade to `drizzle-kit@0.18.1`**, which itself declares `esbuild@^0.15.18` — still inside the advisory range, so it is a downgrade, not a remediation.
6. A scoped npm override (`@esbuild-kit/core-utils` → `esbuild@0.25.12`) was **tested in a separate exploratory fixture**: install OK, `npm audit` → **0 vulnerabilities**, `drizzle-kit generate` OK, runtime OK. It removes the vulnerable file rather than hiding the advisory, but it is an unsupported custom patch.

**Recommendation: ACCEPT WITH MITIGATION** (§8). Runtime exposure is nil; the finding is confined to deprecated development tooling with no upstream stable fix; mitigation is dependency-scope discipline plus a CI gate on `npm audit --omit=dev` and a documented, dated exception. No dependency, override, manifest, lockfile, or application change is authorized or performed by this report.

---

## 2. Safe Synchronization Record (task §2)

| Step | Command | Result |
|---|---|---|
| Remote identity | `git remote -v` | `origin` = `https://github.com/irfannuralam44-max/qfat.git` (fetch/push) — matches the task's repository |
| Working tree / branch | `git status --short --branch` | `## main` — clean, no pre-existing local changes |
| HEAD before sync | `git rev-parse HEAD` | `ecf1aa69202d1404ff317987fd7db40d6cb83425` |
| Fetch | `git fetch origin main` | `ecf1aa6..2d8f97a main -> origin/main` |
| Fast-forward only | `git pull --ff-only origin main` | `Updating ecf1aa6..2d8f97a`, `Fast-forward` (2 files, +183/-7) |
| HEAD after sync | `git rev-parse HEAD` / `git rev-parse origin/main` | both `2d8f97a76d39be881d80d738af4fd7f76bd2c486` |

The fast-forward brought in the QFAT-002W GPT post-publication audit commit (`0ebe58a`) and this task file. No reset, clean, stash, checkout, rebase, or branch creation was performed. After synchronization the task read: this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, ADR-001, `reports/QFAT-002S-sqlite-driver-validation.md`, and `reports/QFAT-002W-windows-sqlite-validation.md` (including GPT's §19 audit note, which explicitly flags the unresolved audit-findings evidence gap this task addresses).

---

## 3. Environment and Baseline Fixture (AC-01)

| Property | Value |
|---|---|
| Date of audit | 2026-11-11 |
| OS | Windows 10 Pro 22H2, build 19045 (`win32 x64`) |
| Node.js | **v24.16.0** (system runtime) |
| npm | **11.13.0** |
| Registry | `https://registry.npmjs.org/` (public npm registry, from `npm config get registry`) |
| Fixture location | `%TEMP%\qfat-dep-audit-<timestamp>` (created only after confirming the path did not exist; outside the repository) |
| lockfile | `package-lock.json`, `lockfileVersion=3`, 113 package entries |

### 3.1 Exact manifest and install

```powershell
npm init -y
npm install --save-exact better-sqlite3@13.0.3 drizzle-orm@0.45.4 drizzle-kit@0.31.11 tsx@4.23.15 typescript@7.0.2
```

- `npm init -y` → **exit 0**
- `npm install …` → **exit 0**, `added 21 packages, and audited 22 packages in 15s`, `4 moderate severity vulnerabilities`
- Warnings: `npm warn deprecated @esbuild-kit/esm-loader@2.6.5` and `npm warn deprecated @esbuild-kit/core-utils@3.3.2` (“Merged into tsx: https://tsx.hirok.io”)

### 3.2 Installed candidate versions

| Package | Installed | Role in this fixture |
|---|---|---|
| `better-sqlite3` | **13.0.3** | SQLite driver (runtime) |
| `drizzle-orm` | **0.45.4** | Typed query/schema layer (runtime) |
| `drizzle-kit` | **0.31.11** | Migration generation CLI (tooling) |
| `tsx` | **4.23.15** | TS execution (tooling) |
| `typescript` | **7.0.2** | TypeScript (tooling) |

### 3.3 Complete installed tree (audit-relevant excerpt of `npm ls --all`, exit 0)

```
qfat-dep-audit-<timestamp>@1.0.0
+-- better-sqlite3@13.0.3
| `-- node-addon-api@8.9.2
+-- drizzle-kit@0.31.11
| +-- @drizzle-team/brocli@0.10.2
| +-- @esbuild-kit/esm-loader@2.6.5
| | +-- @esbuild-kit/core-utils@3.3.2
| | | +-- esbuild@0.18.20            <-- vulnerable copy
| | | | `-- @esbuild/win32-x64@0.18.20
| | | `-- source-map-support@0.5.21
| | `-- get-tsconfig@4.14.3
| +-- esbuild@0.25.12                <-- safe copy, declared by drizzle-kit
| `-- tsx@4.23.15 deduped
+-- drizzle-orm@0.45.4
| +-- better-sqlite3@13.0.3 deduped
| `-- (all other entries are UNMET OPTIONAL peer/driver adapters)
+-- tsx@4.23.15
| `-- esbuild@0.28.2                 <-- safe copy, declared by tsx
`-- typescript@7.0.2
```

Three separate esbuild installations exist, only one of which is in the advisory range:

| Path | Version | Declared by |
|---|---|---|
| `node_modules/@esbuild-kit/core-utils/node_modules/esbuild` | **0.18.20** | `@esbuild-kit/core-utils` (`~0.18.20`) |
| `node_modules/esbuild` | **0.25.12** | `drizzle-kit` (`^0.25.4`) |
| `node_modules/tsx/node_modules/esbuild` | **0.28.2** | `tsx` (`~0.28.0`) |

---

## 4. Baseline Audit Results (AC-02)

```powershell
npm ls --all        # exit 0
npm audit --json    # exit 1  (evidence artifact captured)
npm audit           # exit 1
```

`npm audit --json` metadata:

```json
{
  "vulnerabilities": { "info": 0, "low": 0, "moderate": 4, "high": 0, "critical": 0, "total": 4 },
  "dependencies": { "prod": 18, "dev": 0, "optional": 95, "peer": 0, "peerOptional": 0, "total": 112 }
}
```

(`prod: 18 / dev: 0` only reflects that the fixture installs all five candidate packages as regular dependencies; see §5.2 for the production-scope measurement in a QFAT-shaped manifest.)

Human-readable output (`npm audit`, exit 1):

```
# npm audit report

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install drizzle-kit@0.18.1, which is a breaking change
node_modules/@esbuild-kit/core-utils/node_modules/esbuild
  @esbuild-kit/core-utils  *
  Depends on vulnerable versions of esbuild
  node_modules/@esbuild-kit/core-utils
    @esbuild-kit/esm-loader  *
    Depends on vulnerable versions of @esbuild-kit/core-utils
    node_modules/@esbuild-kit/esm-loader
      drizzle-kit  0.19.0 - 1.0.0-beta.1-fd8bfcc
      Depends on vulnerable versions of @esbuild-kit/esm-loader
      node_modules/drizzle-kit

4 moderate severity vulnerabilities
```

A second `npm audit --json` run produced an **identical** result (4 moderate, exit 1, advisory source set `{1102341}`), confirming the count is stable for the pinned versions on the audit date.

---

## 5. Advisory Table and Exposure (AC-03, AC-04)

### 5.1 Advisory identification

| Field | Value |
|---|---|
| GHSA | **GHSA-67mh-4wv8-2f99** |
| npm advisory source id | `1102341` |
| CVE alias | **none listed** in the OSV/GHSA record (no CVE alias returned for this advisory) |
| Title | esbuild enables any website to send any requests to the development server and read the response |
| Package | `esbuild` (npm) |
| Installed vulnerable version | **0.18.20** |
| Vulnerable range | `<= 0.24.2` (`introduced: 0`, `fixed: 0.25.0`) |
| Severity | **moderate**, CVSS 3.1 **5.3** — `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N` |
| Weakness | CWE-346 (Origin Validation Error) |
| Published / modified | 2025-02-10 / 2026-09-10 |
| References | `https://github.com/advisories/GHSA-67mh-4wv8-2f99`, `https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99`, fix commit `de85afd65edec9ebc44a11e245fd9e9a2e99760d` |
| Data source accessed | `https://api.osv.dev/v1/vulns/GHSA-67mh-4wv8-2f99` and `npm audit` bulk advisory endpoint, both on 2026-11-11 |

**Affected functionality and exploit preconditions:** esbuild's **dev server** (`esbuild --serve`) answered every request with `Access-Control-Allow-Origin: *`, including the SSE endpoint. An attacker who hosts a malicious page can have the victim's browser `fetch` `http://127.0.0.1:<port>/…` and read the bundled output (source disclosure). Preconditions: (a) the victim runs `esbuild`'s serve/dev server, (b) the attacker knows or guesses the local port and bundle path, and (c) the victim visits the attacker's page while the server runs. It is **not** a code-execution or data-integrity issue, and it does not affect one-shot transform/build calls.

### 5.2 The four reported nodes (one advisory)

`npm audit` counts **package nodes**, not unique advisories. The single advisory propagates to four nodes:

| # | Node (as reported by npm) | Severity | Vulnerable range | Direct? | `via` | `fixAvailable` |
|---|---|---|---|---|---|---|
| 1 | `esbuild` (`node_modules/@esbuild-kit/core-utils/node_modules/esbuild`, **0.18.20**) | moderate | `<=0.24.2` | no | advisory GHSA-67mh-4wv8-2f99 | `drizzle-kit@0.18.1` (semver-major) |
| 2 | `@esbuild-kit/core-utils` (**3.3.2**) | moderate | `*` | no | string: `esbuild` | `drizzle-kit@0.18.1` (semver-major) |
| 3 | `@esbuild-kit/esm-loader` (**2.6.5**) | moderate | `*` | no | string: `@esbuild-kit/core-utils` | `drizzle-kit@0.18.1` (semver-major) |
| 4 | `drizzle-kit` (**0.31.11**) | moderate | `0.19.0 - 1.0.0-beta.1-fd8bfcc` | **yes** (root dependency) | string: `@esbuild-kit/esm-loader` | `drizzle-kit@0.18.1` (semver-major) |

Concise JSON excerpt (verbatim fields, one entry shown per node type):

```json
"esbuild": {
  "severity": "moderate", "isDirect": false, "range": "<=0.24.2",
  "nodes": ["node_modules/@esbuild-kit/core-utils/node_modules/esbuild"],
  "effects": ["@esbuild-kit/core-utils"],
  "fixAvailable": { "name": "drizzle-kit", "version": "0.18.1", "isSemVerMajor": true },
  "via": [{ "source": 1102341, "name": "esbuild", "dependency": "esbuild",
            "title": "esbuild enables any website to send any requests to the development server and read the response",
            "url": "https://github.com/advisories/GHSA-67mh-4wv8-2f99",
            "severity": "moderate", "range": "<=0.24.2", "cwe": ["CWE-346"],
            "cvss": { "score": 5.3, "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N" } }]
},
"drizzle-kit": {
  "severity": "moderate", "isDirect": true,
  "range": "0.19.0 - 1.0.0-beta.1-fd8bfcc",
  "nodes": ["node_modules/drizzle-kit"], "effects": [],
  "fixAvailable": { "name": "drizzle-kit", "version": "0.18.1", "isSemVerMajor": true },
  "via": ["@esbuild-kit/esm-loader"]
}
```

Dependency path proven with `npm explain` (exit 0):

```
esbuild@0.18.20
  node_modules/@esbuild-kit/core-utils/node_modules/esbuild
    esbuild@"~0.18.20" from @esbuild-kit/core-utils@3.3.2
      @esbuild-kit/core-utils@"^3.3.2" from @esbuild-kit/esm-loader@2.6.5
        @esbuild-kit/esm-loader@"^2.5.5" from drizzle-kit@0.31.11
          drizzle-kit@"0.31.11" from the root project
```

### 5.3 Runtime vs development exposure — measured, not assumed

**(a) Production-scope audit (QFAT-shaped manifest).** A third fixture declared `better-sqlite3@13.0.3` and `drizzle-orm@0.45.4` as `dependencies` and `drizzle-kit@0.31.11`, `tsx@4.23.15`, `typescript@7.0.2` as `devDependencies` (the shape ADR-001 implies for QFAT):

| Command | Exit | Vulnerabilities | Scope metadata |
|---|---|---|---|
| `npm install` | 0 | `4 moderate` | — |
| `npm audit --json` | **1** | `moderate: 4, total: 4` | `prod: 4, dev: 109` |
| `npm audit --omit=dev --json` | **0** | `moderate: 0, total: 0` | `prod: 4, dev: 109` |

**The production dependency closure is clean.** All four findings live in the `devDependencies` tree.

**(b) Actual module loading.** A `--require` hook (`Module._resolveFilename` trace) recorded every resolved module whose path matches `esbuild|esm-loader|core-utils`:

```
=== drizzle-kit generate (CommonJS project) ===
[RESOLVE] esbuild -> .\node_modules\esbuild\lib\main.js
[RESOLVE SUMMARY] count=1
[LOADED] .\node_modules\esbuild\lib\main.js          # 0.25.12 — safe copy
generate exit=0
```

```
=== drizzle-kit generate (ESM project, package.json "type": "module") ===
[RESOLVE] esbuild -> …\node_modules\esbuild\lib\main.js
[RESOLVE SUMMARY] count=1
[LOADED] …\node_modules\esbuild\lib\main.js         # 0.25.12 — safe copy
generate exit=0
```

```
=== application runtime closure (better-sqlite3 + drizzle-orm) ===
[RUNTIME] drizzle handle created = true
[RUNTIME] row = {"id":"acc-1","alias":"main"}
[RESOLVE SUMMARY] count=0
exit=0
```

Neither the vulnerable `esbuild@0.18.20` nor either `@esbuild-kit` package was resolved during migration generation in either module mode, and the application runtime loaded no esbuild at all.

**Trace-method limitation (stated explicitly):** `Module._resolveFilename` observes the CommonJS loader only; a hypothetical ESM `import` of `@esbuild-kit/esm-loader` would not appear in this trace. This is mitigated by two independent facts: `@esbuild-kit/esm-loader` is a `--loader` registration package (not something imported by application code), and no reference to `esbuild-kit`, `--loader`, or `--experimental-loader` exists in any shipped Drizzle Kit file (`bin.cjs`, `api.js`, `utils.js`, `index.js`); Drizzle Kit 0.31.x instead bundles a `tsx` runtime and calls `tsx.register()` (`bin.cjs:15267`).

**Conclusion:** the vulnerable node is *installed on disk but unreachable in normal operation*. It is a development-tooling-only, unused-dependency finding. It is **not** automatically harmless — the file could be loaded by any future code path or by a developer who directly invokes `esbuild@0.18.20 --serve` — which is why mitigation, not dismissal, is recommended.

---

## 6. Deprecated Package Assessment

| Package | Installed | Latest | Deprecation message | Declared in | Used at runtime? |
|---|---|---|---|---|---|
| `@esbuild-kit/esm-loader` | **2.6.5** | 2.6.5 (no newer) | “Merged into tsx: https://tsx.hirok.io” | `drizzle-kit@0.31.11` → `"^2.5.5"` | **No evidence of use** (§5.3) |
| `@esbuild-kit/core-utils` | **3.3.2** | 3.3.2 (no newer) | “Merged into tsx: https://tsx.hirok.io” | `@esbuild-kit/esm-loader@2.6.5` | **No evidence of use** |
| `esbuild` (nested) | **0.18.20** | latest 0.26.0 | not deprecated | `@esbuild-kit/core-utils` → `"~0.18.20"` | **No** (only 0.25.12 loaded) |

Assessment: `@esbuild-kit/*` is a **superseded, deprecated toolchain** that Drizzle Kit still declares but, on the evidence above, no longer executes — Drizzle Kit 0.31.x ships its own bundled `tsx` runtime. Both packages are pinned to their final published versions, so the deprecated chain cannot be fixed by updating *them*; only Drizzle Kit (or a consumer-side override) can change it.

**Upstream trajectory (registry metadata, 2026-11-11):**

| `drizzle-kit` version | Declared dependencies (relevant) | Vulnerable chain? |
|---|---|---|
| `0.31.11` (**`latest`**, candidate) | `@esbuild-kit/esm-loader ^2.5.5`, `esbuild ^0.25.4`, `tsx ^4.21.0` | **Yes** (declared, unused) |
| `1.0.0-beta.22` (`beta` tag) | `jiti ^2.6.1`, `esbuild ^0.25.10`, `@drizzle-team/brocli ^0.11.0` | No — chain removed |
| `0.18.1` (npm's proposed “fix”) | `esbuild ^0.15.18`, `esbuild-register ^3.4.2`, … | Replaces one `<=0.24.2` esbuild with another |

The upstream removal of `@esbuild-kit` exists only in the **1.0.0 pre-release line** (beta/rc), which is outside the selected stable line and is not appropriate to adopt as a validation-driven change here.

---

## 7. Fix Availability and Remediation Options (AC-05, AC-06)

### 7.1 Assessment matrix

| Option | Availability | Effect on audit | Compatibility risk | Tested? |
|---|---|---|---|---|
| **A. Do nothing, keep `drizzle-kit@0.31.11`** | Available now (it *is* `latest`) | Still 4 moderate (dev scope only) | None | Yes — baseline |
| **B. `npm audit fix --force` (→ `drizzle-kit@0.18.1`)** | Proposed by npm | Not a genuine fix: 0.18.1 declares `esbuild ^0.15.18`, itself `<=0.24.2` | **High** — 13-minor-line downgrade, different config/CLI behaviour | **NOT RUN** (explicitly forbidden by task; rationale from metadata) |
| **C. Update `drizzle-kit` within 0.31.x** | **No fix exists** — 0.31.11 is the newest 0.31.x and `latest` | None | — | Registry metadata checked |
| **D. Update `drizzle-kit` to 1.0.0-beta/rc** | Exists (`1.0.0-beta.22` removes the chain) | Removes findings | **High** — pre-release API/behaviour changes; ADR-001 validation covered 0.31.11 | **NOT RUN** (out of scope: would change the candidate line) |
| **E. Scoped npm override** `@esbuild-kit/core-utils` → `esbuild@0.25.12` | Available | **0 vulnerabilities** | Low–medium: removes the vulnerable file; `@esbuild-kit/core-utils` is unused, but the override is unsupported upstream and must be maintained | **Yes — separate exploratory fixture** |
| **F. Dev/prod scope discipline** (`drizzle-kit` as `devDependency`; gate CI on `npm audit --omit=dev`) | Available immediately | Full audit still 4 moderate; **production gate 0** | None (advisory remains visible) | **Yes — QFAT-shaped fixture** |

### 7.2 Option E — exploratory override results (separate disposable fixture)

Manifest addition (exploratory fixture only; **not** applied to the baseline fixture and **not** proposed as an applied change):

```json
"overrides": { "@esbuild-kit/core-utils": { "esbuild": "0.25.12" } }
```

| Check | Result |
|---|---|
| `npm install` | **exit 0**, `added 19 packages, and audited 20 packages in 10s`, **`found 0 vulnerabilities`** |
| `npm audit --json` | **exit 0**, `{"moderate":0,"total":0}` (vs 4 moderate / exit 1 baseline) |
| `npm ls esbuild --all` | `@esbuild-kit/core-utils` → `esbuild@0.25.12 deduped` (declared `~0.18.20` overridden); no `0.18.20` present |
| `drizzle-kit generate` (with trace) | **exit 0**; `[RESOLVE SUMMARY] count=1`; only `node_modules/esbuild/lib/main.js` (0.25.12) loaded |
| Runtime closure probe | **exit 0**, `drizzle handle created = true`, 0 esbuild modules resolved |
| Migration SQL produced | `migrations\0000_light_unicorn.sql` |

This is a **genuine removal** of the vulnerable package (the file is not installed), not an advisory suppression. Residual risk: the override bypasses the deprecated package's declared `~0.18.20` constraint; because no code path loads that package, the observed risk is low, but it is an unsupported custom patch that must be re-verified on every dependency change and removed once Drizzle Kit stable drops the dependency.

### 7.3 Option F — production gate results (QFAT-shaped fixture)

| Command | Exit | Total |
|---|---|---|
| `npm audit` | 1 | 4 moderate |
| `npm audit --omit=dev` | **0** | **0** |

### 7.4 What was *not* tested

- `npm audit fix` / `npm audit fix --force` / overrides applied to the **baseline** fixture — forbidden by the task and excluded by design.
- `drizzle-kit@1.0.0-beta.22` / `rc` install and smoke test — would change the candidate line; out of scope.
- Exploit reproduction of the esbuild dev-server CORS issue — would require running a vulnerable dev server and a malicious page; unnecessary because the vulnerable copy is provably not loaded.
- Node.js 22 audit run — see §9.

---

## 8. Recommendation

### **ACCEPT WITH MITIGATION**

**Rationale (bounded to the evidence above):**

1. **One advisory, four nodes.** `GHSA-67mh-4wv8-2f99` affects `esbuild <= 0.24.2`; the only affected copy is `0.18.20`, pulled by a deprecated and apparently unused `@esbuild-kit` chain declared by `drizzle-kit`. The finding count is unchanged from QFAT-002S/002W (still 4 moderate).
2. **No production exposure.** `npm audit --omit=dev` = **0** on a QFAT-shaped manifest, and the application runtime loads zero esbuild code.
3. **No stable upstream fix exists.** `drizzle-kit@0.31.11` is `latest`; the chain is removed only in the 1.0.0 pre-release line; npm's suggested “fix” is a breaking downgrade that reintroduces a `<=0.24.2` esbuild.
4. **Exploitability in this stack is effectively nil** (the advisory concerns an esbuild dev *serve* mode that Drizzle Kit never starts), yet the package remains on disk, so it should be tracked, not ignored.

**Mitigations to adopt when QFAT implementation begins (subject to owner approval; none applied here):**

| # | Mitigation | Rationale |
|---|---|---|
| M-1 | Declare `drizzle-kit` (and `tsx`, `typescript`) as **`devDependencies`**, never runtime `dependencies` | Keeps the advisory out of the production closure |
| M-2 | Add a CI gate running `npm audit --omit=dev` (fail on any finding) and publish the full-scope result as a **documented, dated exception** referencing `GHSA-67mh-4wv8-2f99` | Prevents silent regression while recording the accepted dev-only finding |
| M-3 | Optionally apply the **scoped override** from §7.2 to eliminate the vulnerable file entirely | Tested: install, audit, CLI generation, and runtime all pass; adds a maintained patch |
| M-4 | Re-evaluate when `drizzle-kit` 1.x ships stable with the `jiti`-based loader, then drop the override and the exception | Upstream already removed the chain in pre-releases |

**Explicitly not recommended:** `npm audit fix --force` / downgrading `drizzle-kit` to `0.18.1`.

No dependency change, override, lockfile edit, application adoption, or ADR amendment is authorized by this report. ADR-001 remains **PROPOSED**.

---

## 9. Finding Count and Differences vs Earlier Reports

| Question | Answer |
|---|---|
| Does the count still equal four? | **Yes.** `npm audit` reports `moderate: 4, total: 4` (exit 1) on the exact pinned candidate versions, reproduced twice on 2026-11-11. |
| Why four and not one, if only one advisory exists? | npm counts **affected package nodes**: `esbuild` → `@esbuild-kit/core-utils` → `@esbuild-kit/esm-loader` → `drizzle-kit`. Only the leaf has a real advisory record (source `1102341`); the other three are “depends on vulnerable versions” propagation. |
| Any difference from QFAT-002S/002W? | No numerical difference: both earlier reports recorded “4 moderate”. Those reports did not capture advisory IDs, dependency paths, or scope classification — this report closes that gap. QFAT-002W additionally recorded the deprecated-package warnings; those are confirmed here as `@esbuild-kit/esm-loader@2.6.5` and `@esbuild-kit/core-utils@3.3.2`. |
| New information that changes interpretation? | Yes, three items: (a) the four findings reduce to **one** advisory; (b) the vulnerable copy is **not loaded** by either the runtime or the CLI; (c) **no non-breaking fix exists in the stable line**, and npm's proposed fix is invalid. |

**Node.js runtime matrix for the audit:** `npm audit` was run with **Node.js 24.16.0 / npm 11.13.0**. Node.js 22 was **NOT RUN** — it is not installed on this machine and the task forbids installing or changing global runtimes/tools; npm audit output is registry/advisory data and not a runtime behaviour test (runtime behaviour on Node 22 was already established in QFAT-002W). No independent reproduction on a second npm version is claimed.

---

## 10. Acceptance Criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Exact candidate package versions installed in isolated fixture | **PASS** | §3.1–§3.3 — `package.json` pinned exactly, `package-lock.json` (`lockfileVersion=3`, 113 entries), `npm ls --all` exit 0 |
| AC-02 | Full audit results captured | **PASS** | §4 — `npm audit --json` (exit 1) and `npm audit` (exit 1) captured to evidence artifacts; summary and excerpt quoted; re-run identical |
| AC-03 | Every advisory identified | **PASS** | §5.1 — GHSA-67mh-4wv8-2f99, source 1102341, no CVE alias, `<=0.24.2` fixed in `0.25.0`, CVSS 5.3/CWE-346, OSV + npm links, date accessed |
| AC-04 | Dependency path and runtime/dev classification established | **PASS** | §5.2–§5.3 — `npm explain` path, `npm audit --omit=dev` = 0, module-resolution traces for CLI (CJS+ESM) and runtime closure; trace limitation disclosed |
| AC-05 | Fix availability assessed without mutation | **PASS** | §6, §7.1 — 0.31.11 = latest; 1.0 pre-release removes chain; npm's `0.18.1` “fix” re-introduces `esbuild ^0.15.18`; baseline unchanged |
| AC-06 | Any proposed remediation is evidence-based | **PASS** | §7.2 — separate exploratory fixture: install, audit (0 vulns), `npm ls`, `drizzle-kit generate` CLI smoke, runtime smoke. Untested items listed in §7.4 |
| AC-07 | No QFAT files/dependencies or global tooling changed | **PASS** | §11 — `git status --short --branch` = `## main`, no diff; no `package.json`/lockfile/source edit; no global install; no `npm audit fix` executed |
| AC-08 | Recommendation is clear and bounded | **PASS** | §8 — **ACCEPT WITH MITIGATION** with M-1…M-4, explicit non-recommendation of `audit fix --force`, and no adoption authority claimed |

---

## 11. Repository and Global Tooling Unchanged (AC-07)

Inside `C:\Users\<user>\documents\qfat` (path abbreviated; no home-directory secrets published):

```
$ git status --short --branch
## main
$ git diff --stat
(no output)
$ git rev-parse HEAD       # 2d8f97a76d39be881d80d738af4fd7f76bd2c486
$ git rev-parse origin/main # 2d8f97a76d39be881d80d738af4fd7f76bd2c486
```

- No QFAT `package.json`, lockfile, source, test, PRD, architecture, or ADR file was modified.
- No dependency was added to QFAT; every install happened in `%TEMP%\qfat-dep-audit-*` fixtures.
- **`npm audit fix` and `npm audit fix --force` were never executed** in any fixture.
- No global npm package, Node runtime, npm configuration, or version manager was installed or changed (`npm config get registry` read-only; no `.npmrc` written).
- No QFAT user database, credential, token, media file, or platform account was accessed.
- No secrets, tokens, or registry credentials were captured in evidence; the registry is the public npm registry accessed anonymously.

The only repository change produced by this task is `reports/QFAT-002V-dependency-audit-findings.md`.

---

## 12. Reproduction Commands

```powershell
# 1. Isolated baseline fixture (path must not pre-exist)
$dir = Join-Path $env:TEMP ("qfat-dep-audit-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $dir; Set-Location $dir
npm init -y
npm install --save-exact better-sqlite3@13.0.3 drizzle-orm@0.45.4 drizzle-kit@0.31.11 tsx@4.23.15 typescript@7.0.2

# 2. Dependency tree + audit (capture evidence)
npm ls --all          # exit 0
npm audit --json      # exit 1, 4 moderate
npm audit             # exit 1, human-readable chain

# 3. Path and scope analysis
npm explain esbuild
npm explain "@esbuild-kit/esm-loader"
npm explain "@esbuild-kit/core-utils"
npm explain drizzle-kit

# 4. Runtime/dev exposure probes (fixture scripts, not repository files)
node --require ./log-requires.cjs node_modules/drizzle-kit/bin.cjs generate
node --require ./log-requires.cjs runtime-closure.cjs

# 5. Production-scope measurement in a QFAT-shaped manifest
#    (dependencies: better-sqlite3, drizzle-orm; devDependencies: drizzle-kit, tsx, typescript)
npm audit --json              # exit 1, 4 moderate
npm audit --omit=dev --json   # exit 0, 0 vulnerabilities

# 6. Exploratory override fixture (separate directory)
#    "overrides": { "@esbuild-kit/core-utils": { "esbuild": "0.25.12" } }
npm install
npm audit --json                                  # exit 0, 0 vulnerabilities
npm ls esbuild --all                              # 0.25.12 deduped, no 0.18.20
node --require ./log-requires.cjs node_modules/drizzle-kit/bin.cjs generate
node --require ./log-requires.cjs runtime-closure.cjs
```

`log-requires.cjs` — the module-resolution probe used for §5.3 (diagnostic only, never imported by application code):

```js
const Module = require('node:module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const resolved = origResolve.call(this, request, parent, ...rest);
  if (/esbuild|esm-loader|core-utils/i.test(resolved)) console.log('[RESOLVE] ' + request + ' -> ' + resolved);
  return resolved;
};
```

---

## 13. Git Publication

- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Branch:** `main`
- **Base commit:** `2d8f97a76d39be881d80d738af4fd7f76bd2c486`
- **Commit message:** `docs(task): QFAT-002V dependency audit findings report`
- **Files added:** `reports/QFAT-002V-dependency-audit-findings.md` only
- **Push:** `git push origin main`, followed by independent remote verification (`git ls-remote origin main`, fresh `git fetch` + `git rev-parse origin/main`, and confirmation that the report blob exists on `origin/main`)

The exact commit SHA is visible on GitHub; it is intentionally not embedded here because embedding a commit's own SHA would change that SHA (workflow §3 Phase G).

---

## 14. Findings, Limitations, and Handoff

### 14.1 Findings

1. **One root advisory, four npm nodes** — the count itself is not evidence of four independent problems.
2. **Dev-tooling-only, and currently unreachable** — proven by `npm audit --omit=dev` (0) and module-resolution traces (only safe `esbuild@0.25.12` loaded; runtime loads none).
3. **`@esbuild-kit/esm-loader` is declared but unused** by `drizzle-kit@0.31.11`, which bundles `tsx` and calls `tsx.register()` — a defect worth reporting upstream, and the reason the finding cannot be fixed locally.
4. **npm's `fixAvailable` is misleading** for this case: `drizzle-kit@0.18.1` is a breaking downgrade that declares `esbuild@^0.15.18`, still inside the advisory range.
5. **A scoped override removes the vulnerable file** and passed install/audit/CLI/runtime checks, but remains an unsupported custom patch.
6. **No stable upstream fix exists today**; the chain is removed only in `drizzle-kit` 1.0.0 pre-releases.

### 14.2 Limitations

- Audit output is registry/advisory data as of 2026-11-11; advisories can change after publication.
- Only Node 24.16.0 / npm 11.13.0 was used (see §9).
- The module-resolution trace observes the CommonJS loader; the ESM caveat and its mitigations are documented in §5.3.
- Exploitability was assessed from the advisory's preconditions and the observed absence of esbuild serve usage; no exploit was executed.
- Override and 1.0 pre-release options were not evaluated against QFAT's eventual runtime workload beyond the minimal smoke checks described.

### 14.3 Handoff

This report is ready for **GPT/owner audit** on GitHub. It is an audit-only deliverable: agent PASS is not owner acceptance, and no dependency update, override, adoption, or implementation is authorized by it. ADR-001 remains **PROPOSED** until GPT audits the evidence and the owner explicitly decides.

---

*End of QFAT-002V Dependency Audit Findings Report*
