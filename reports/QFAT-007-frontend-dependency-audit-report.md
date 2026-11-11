# QFAT-007 — Frontend Dependency Vulnerability Review

- **Status:** PASS
- **Task specification:** `tasks/QFAT-007-frontend-dependency-audit.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Starting HEAD:** `b5ebb35b87cca8ad9ed6343b93bbf4ff9070a457`
- **Final implementation commit SHA:** `07a96906147ae8b615d80730415bfb44243d0f3e`
- **Environment:** Linux `x86_64`, Node.js `v24.22.2`, npm `11.19.0`.

## Summary

The initial `npm audit --json` found one vulnerable package entry with overall **high** severity: direct development dependency `postcss@8.5.6`. The package audit grouped four PostCSS advisories (two moderate and two high). `npm audit --omit=dev --json` found zero production vulnerabilities; PostCSS is not a production dependency.

Updated only the direct app-local PostCSS development dependency to `8.5.32` and regenerated the app lockfile. This is a patch-level update, aligns with Vite's `^8.5.32` PostCSS requirement, and resolves all advisory ranges without changing React, Vite, Tailwind, backend, or root CLI dependencies. The post-remediation clean install and both audits report zero vulnerabilities.

## Initial findings

The frontend manifest pins `postcss@8.5.6` under `devDependencies`. `npm explain postcss` and `npm ls postcss --all` showed this root package was shared by Autoprefixer and Tailwind's PostCSS plugins. Vite had a separate nested `postcss@8.5.32`, which its package requires through `^8.5.32`; this nested copy did not remediate the vulnerable root package used by the rest of the frontend build tooling.

The full audit summary was `info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1`. This is one vulnerable package entry, not one advisory. The associated PostCSS advisory records were:

| Advisory | Severity | Affected range | First patched version | Finding |
|---|---|---|---|---|
| [GHSA-qx2v-qp2m-jg93 / CVE-2026-41305](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | Moderate | `< 8.5.10` | `8.5.10` | Unescaped `</style>` in CSS stringify output can enable XSS in affected non-bundler embedding use cases. |
| [GHSA-6g55-p6wh-862q / CVE-2026-45623](https://github.com/advisories/GHSA-6g55-p6wh-862q) | High | `<= 8.5.11` | `8.5.12` | Attacker-controlled `sourceMappingURL` can cause arbitrary local file reads/information disclosure when untrusted CSS is processed. |
| [GHSA-r28c-9q8g-f849 / CVE-2026-73646](https://github.com/advisories/GHSA-r28c-9q8g-f849) | High | `<= 8.5.17` | `8.5.18` | Path traversal through previous source-map auto-loading can disclose `.map` file contents. |
| [GHSA-fxqj-rqcc-2cmp / CVE-2026-69153](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | Moderate | `<= 8.5.22` | `8.5.23` | An incomplete prior source-map path fix still permits traversal when `from` is unset. |

The advisories describe risks when attacker-controlled CSS reaches PostCSS processing. In this repository, PostCSS is build/development tooling and is not included in the production dependency set. This classification does not make the high-severity build-tool advisories negligible: malicious CSS/dependency inputs processed during development or builds could still expose files accessible to the build process.

The official PostCSS `8.5.23` release changelog identifies the source-map loading security fix. Version `8.5.32` is later than all four patched thresholds and is also the version npm recommended as a compatible fix; the [8.5.32 release notes](https://github.com/postcss/postcss/releases/tag/8.5.32) contain additional patch fixes. No major upgrade was required.

## Remediation

Changed only:

- `apps/web/package.json`: exact dev dependency `postcss` from `8.5.6` to `8.5.32`.
- `apps/web/package-lock.json`: resolved root PostCSS to `8.5.32` and deduplicated Vite's identical nested copy. No unrelated direct dependencies changed.

The selected version satisfies the existing peer ranges for Autoprefixer and Tailwind and Vite's declared `^8.5.32` dependency. The remediation used an explicit `npm install --save-dev --save-exact postcss@8.5.32`, not `npm audit fix`.

## Commands and results

All npm commands below were run from `apps/web/` unless otherwise stated.

| Command | Exit | Result |
|---|---:|---|
| `node --version` | 0 | `v24.22.2` |
| `npm --version` | 0 | `11.19.0` |
| `uname -srm` | 0 | `Linux 7.0.0-42-generic x86_64` |
| `npm audit --json` (before remediation) | 1 | One high-severity package entry (`postcss`); four advisory records listed above. |
| `npm audit --omit=dev --json` (before remediation) | 0 | 0 vulnerabilities. |
| `npm explain postcss` (before remediation) | 0 | Confirmed direct dev dependency and Autoprefixer/Tailwind peer paths; Vite used separate patched nested copy. |
| `npm ls postcss --all` (before remediation) | 0 | Confirmed root `8.5.6` plus Vite nested `8.5.32`. |
| `npm install --save-dev --save-exact postcss@8.5.32` | 0 | One package changed and one deduplicated; install summary reported zero vulnerabilities. |
| `npm ci` (after remediation) | 0 | Clean lockfile install; npm reported zero vulnerabilities. |
| `npm audit --json` (after remediation) | 0 | `info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0`. |
| `npm audit --omit=dev --json` (after remediation) | 0 | `info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0`. |
| `npm explain postcss` (after remediation) | 0 | All toolchain peers resolve to the root `postcss@8.5.32`. |
| `npm ls postcss --all` (after remediation) | 0 | One deduplicated `postcss@8.5.32`; no vulnerable version remains. |
| `npm run typecheck` | 0 | Frontend and Vite config typechecks pass. |
| `npm run build` | 0 | Typecheck and Vite production build pass. |
| `git diff --cached --check` | 0 | Checked the staged dependency and report changes before commit. |

No tests were added or run; this task is limited to dependency review and remediation. No CI/GitHub Actions, backend checks, root CLI changes, firewall/host-binding/proxy/Tailscale changes, or publishing operations were performed.

## Risks and limitations

- The pre-remediation issue was development/build-tool-only according to the package classification and production-only audit, but included two high-severity advisories. The post-remediation full audit is clean.
- This is a point-in-time npm/GitHub advisory review. Future dependency advisories require a later audit.
- No major-version upgrade or owner decision was needed.

## Git publication

- **Remote:** `origin` (`https://github.com/irfannuralam44-max/qfat.git`)
- **Branch:** `main`
- **Implementation commit message:** `fix(web): remediate PostCSS dependency advisory`
- **Implementation commit SHA:** `07a96906147ae8b615d80730415bfb44243d0f3e`
- **Push and remote verification:** Pending publication at report metadata authoring. A separate report-only follow-up records the implementation SHA; the report commit's own SHA is provided by the required handoff rather than embedded in itself.
- **Report path:** `reports/QFAT-007-frontend-dependency-audit-report.md`

## Handoff

This report and the scoped dependency remediation are ready for GPT/owner audit after publication. PASS is the agent's verification result, not owner acceptance.
