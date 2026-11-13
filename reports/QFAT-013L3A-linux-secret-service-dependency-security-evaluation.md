# Implementation Report — QFAT-013L3A

- Status: PASS WITH FINDINGS
- Task specification: tasks/QFAT-013L3A-linux-secret-service-dependency-security-evaluation.md
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Commit message: docs(QFAT-013L3A): add Linux Secret Service dependency security evaluation
- Commit SHA: 0db74eaf567490220679ac994a1807e6d7833c5f

## Scope

Phase A evaluation only. No dependency, source, test, schema, migration, keyring, or credential state was changed. The report evaluates `@napi-rs/keyring@2.1.2` using public npm/GitHub metadata and source documentation, compares one relevant alternative, and provides a recommendation for owner decisions. It does not authorize Phase B or any implementation.

## Findings

### Candidate package identity

- Package: `@napi-rs/keyring`
- Exact version evaluated: `2.1.2`
- Published: 2026-10-19T08:30:36.710Z
- License: `MIT` (npm package metadata and GitHub repository)
- Repository: `https://github.com/Brooooooklyn/keyring-node`
- Homepage: `https://github.com/Brooooooklyn/keyring-node#readme`
- Issues: `https://github.com/Brooooooklyn/keyring-node/issues`
- npm publisher account shown by npm: `GitHub Actions <npm-oidc-no-reply@github.com>`
- npm `_npmUser` indicates OIDC/GitHub Actions publishing rather than a personal npm token.
- npm `_npmVersion`: `12.2.0`; `_nodeVersion`: `24.21.0`
- Package has npm provenance attestations, including an SLSA provenance v1 bundle for build definition `Brooooooklyn/keyring-node/.github/workflows/CI.yml@refs/heads/main` and git commit `52184fbebffeef8a061234f60f313c479b954f9f`.
- Release tag `v2.1.2` was published 2026-10-19T08:20:56Z. The npm `gitHead` is `52184fbebffeef8a061234f60f313c479b954f9f`, matching the release commit shown by GitHub.
- Maintainers listed by npm: `broooooklyn`, `forehalo`.
- Repository is public, MIT-licensed, has 108 stars, 9 forks, and 162 commits on the default branch at the time of review.

### Maintenance and project health

Evidence is dated and public:

- Latest release `v2.1.2` published 2026-10-19.
- Recent commits on 2026-10-10, 2026-10-19, 2026-10-21, 2026-10-26, and 2026-11-10.
- The 2026-11-10 commit is a Renovate dependency update; it is not product code, but shows repository automation is active.
- Three open issues at review time:
  - #156 (opened 2026-11-06): `AsyncEntry` constructor can block indefinitely when the D-Bus session bus accepts a connection but never answers.
  - #99 (opened 2025-09-17): password length limit error.
  - #5: dependency dashboard.
- No GitHub Security Advisories were returned for the repository.
- No OSV entries were returned for `@napi-rs/keyring@2.1.2`.

Assessment: the project is actively maintained and recently released, but issue #156 is materially relevant to QFAT because it describes a blocking D-Bus path that can defeat timeout and fail-closed behavior. This is not a clean security proof; it is a negative availability/correctness finding.

### Native and prebuilt binary model

- Runtime dependencies: none in npm metadata.
- Platform binaries are optional dependencies:
  - `@napi-rs/keyring-linux-x64-gnu`
  - `@napi-rs/keyring-linux-x64-musl`
  - `@napi-rs/keyring-linux-arm64-gnu`
  - `@napi-rs/keyring-linux-arm64-musl`
  - `@napi-rs/keyring-linux-arm-gnueabihf`
  - `@napi-rs/keyring-linux-riscv64-gnu`
  - plus macOS, Windows, and FreeBSD targets.
- Supported Linux targets include x86_64 and aarch64 for GNU and musl, armv7 GNU, and riscv64 GNU.
- Node engine requirement: `>= 10`.
- QFAT's accepted runtime is Node.js >= 22 with Node.js 24 preferred on Linux. The package's engine range is compatible, but QFAT must pin and test the exact binary on its supported Linux distributions.
- The native module is an N-API addon built with napi-rs. Binaries are published as separate optional platform packages.
- The Linux binary statically links `libdbus` from vendored `libdbus-sys` sources. The README states this vendored component is licensed `AFL-2.1 OR GPL-2.0-or-later`, and the platform package includes `LICENSE.third-party.md`.
- The project uses `--locked` builds, committed `Cargo.lock`, and `cargo-auditable` so native dependency lists can be recovered for license/vulnerability scanning.
- Packaging risk: QFAT must verify the correct GNU vs musl binary for its deployment environment and avoid relying on postinstall behavior that may be restricted in locked-down environments.

### Vulnerability and advisory review

Sources checked:

- GitHub Security Advisories API for `Brooooooklyn/keyring-node`: no advisories returned.
- OSV query for `@napi-rs/keyring@2.1.2`: no entries returned.
- npm metadata and release notes reviewed; no advisory or CVE cited in the package metadata.

Limitation: absence of returned advisories is not proof of absence. OSV/GitHub advisory coverage may lag, and transitive Rust crate vulnerabilities require binary-level audit (`cargo audit bin` or equivalent) against the exact installed `.node` file. The README documents that `cargo-auditable` metadata is embedded for this purpose, but this evaluation did not install or scan the binary.

### API and Secret Service behavior

From the published TypeScript declarations and README:

- API classes: `Entry` and `AsyncEntry`.
- Constructor: `new Entry(service, username, options?)` and `new AsyncEntry(service, username, options?)`.
- Static: `Entry.withTarget(target, service, username, options?)`.
- Methods:
  - `setPassword(password)` / `setSecret(secret: Uint8Array)`
  - `getPassword()` / `getSecret()`
  - `deleteCredential()` / `deletePassword()`
- Async equivalents accept an optional `AbortSignal`.
- `getPassword()`/`getSecret()` return `null` when no credential exists.
- `getSecret()` throws if the store cannot be read, for example when locked or inaccessible.
- `deleteCredential()` returns `true` if deleted, `false` if absent; a failed deletion throws rather than being reported as `false`.
- `getPassword()`/`getSecret()` can throw `Ambiguous` if multiple matching credentials exist.
- Linux backend pinning is supported:
  - `{ linux: { store: 'secret-service' } }` requires Secret Service.
  - `{ linux: { store: 'keyutils' } }` requires the kernel keyring.
  - Without the option, auto-fallback selects Secret Service first, then keyutils.
- `withTarget` can provide a target modifier; with keyutils, the target becomes the kernel key description.

Collection behavior:

- The API exposes no collection selection parameter. QFAT cannot choose a named Secret Service collection through this API.
- `Store::new_with_configuration(&HashMap::new())` is used with an empty configuration in the source, so the library relies on the underlying `dbus-secret-service-keyring-store` default collection behavior.
- The README does not state which Secret Service collection is used. Based on the underlying keyring crate behavior, this is expected to be the login/default collection, but QFAT must verify this in a disposable environment before relying on it.
- There is no documented way to unlock, create, or select a collection through this package.

Create-if-absent behavior:

- `setPassword`/`setSecret` sets the credential for an entry. The declarations do not document an atomic create-if-absent operation.
- For QFAT's 32-byte key, the required create-if-absent semantics would need an adapter-level read-check-write or a dedicated existence check plus careful handling of concurrent initialization.
- The API does provide `getSecret()` returning `null` for absent entries, which can support an adapter-level create-if-absent pattern, but this is not an atomic primitive.

Error surfaces:

- The native errors are surfaced as JavaScript errors/exceptions. The declarations describe high-level cases such as locked/inaccessible stores, ambiguous entries, and missing entries.
- No stable QFAT-facing error code or enum is exposed by the package. A QFAT adapter would need to map native errors, likely by type/name/message.
- Issue #156 directly reproduces the indefinite main-thread block for `new AsyncEntry(...)`. Its author also reports that source inspection suggests `new Entry(...)` follows the same synchronous D-Bus setup path, but explicitly labels that part as inferred rather than separately reproduced. Treat the `Entry` impact as a source-based inference, not a reproduced result.

### Compatibility risks for QFAT

1. Blocking constructor: `new AsyncEntry()` is directly reproduced as performing D-Bus connection work synchronously. The same path appears to affect `new Entry()` by source inspection, but that specific case was not separately reproduced in issue #156. A wedged session bus can block the whole Node process; the issue also reports that moving the call to a worker does not make the process reliably terminable.
2. Default fallback: without explicit `{ linux: { store: 'secret-service' } }`, the library may silently fall back to the kernel keyring, which is in-memory and does not persist across reboot. QFAT must always pin `secret-service`.
3. No collection selection: QFAT cannot choose a dedicated QFAT collection or explicitly handle a locked login collection through this API.
4. Error classification: QFAT would need a mapping layer from native error text/type to stable QFAT error codes.
5. Process isolation: to preserve fail-closed behavior and avoid indefinite main-thread blocking, QFAT may need to construct entries in a child process or otherwise bound the operation.
6. Deployment matrix: QFAT must validate the correct GNU/musl binary and D-Bus/Secret Service availability on each target Linux distribution.

### Alternatives review

Credible maintained Node.js Secret Service clients with better collection selection were not identified through npm search and repository review. `@napi-rs/keyring` is the only clearly maintained Node.js binding found that directly supports Linux Secret Service with prebuilt binaries.

Relevant alternative: a small Linux-specific Secret Service helper using the system Secret Service/D-Bus API or `libsecret`/`secret-tool`, invoked or bound narrowly by QFAT.

Comparison:

| Criterion | `@napi-rs/keyring@2.1.2` | Small Secret Service helper / direct integration |
|---|---|---|
| Maintenance | Active project, recent releases, public issue tracker | Depends on QFAT-owned code; higher maintenance burden |
| Licensing | MIT package; Linux binary includes vendored libdbus under AFL-2.1 OR GPL-2.0-or-later | Depends on chosen libraries; must be audited separately |
| Native/runtime dependencies | Prebuilt N-API addon, no npm runtime dependencies, explicit platform matrix | Could avoid Node native addon complexity, but requires D-Bus/libsecret integration and packaging |
| Explicit collection selection | Not exposed by API | Could be implemented if QFAT needs it |
| Backend pinning/fallback | Explicit `secret-service` or `keyutils`; default auto-fallback must be avoided | Could enforce Secret Service only |
| Error semantics | Native JS errors; no stable QFAT codes; blocking constructor issue | Could define stable typed errors, but all D-Bus edge cases must be handled by QFAT |
| Operational complexity | Lower integration effort, but hidden collection/default behavior | Higher implementation and test burden, but more control |
| Testability | Requires disposable Secret Service; issue #156 complicates timeout testing | Requires disposable Secret Service plus helper lifecycle testing |

Recommendation: do not switch to a custom helper solely to avoid the candidate's limitations unless owner review concludes that explicit collection selection or bounded constructor behavior is mandatory. The custom helper would move significant D-Bus and security-boundary complexity into QFAT.

### Decision matrix

| Owner review question | Evidence | Recommendation |
|---|---|---|
| 1. Candidate dependency | Active, MIT-licensed, provenance-attested, prebuilt N-API addon; but open issue #156 and no collection selection | Suitable only with documented limitations/mitigations, unless owner requires a different client before implementation |
| 2. Default/login collection vs explicit collection | API exposes no collection selection; default likely login collection but unverified | Accept limitation only if owner accepts default/login collection behavior; otherwise require another library or direct integration |
| 3. Locked first-run behavior | `getSecret()` throws when store is locked/inaccessible; no unlock API in package | Fail with clear instructions by default; an explicit user-driven unlock/setup flow would require additional design and owner approval |
| 4. Migration remains separate | Proposal already defines separate phases; no migration performed | Confirm migration remains a separately invoked future task and retain the key file until separately approved retirement |
| 5. Phase B planning | Phase A evaluation is complete, but owner decisions remain | Phase B can be planned only after owner decisions on dependency, collection behavior, and first-run UX |

### Recommendation

`@napi-rs/keyring@2.1.2` is **suitable only with documented limitations/mitigations** for QFAT's Linux Secret Service integration, not unconditionally suitable.

Recommended mitigations if the owner approves further work:

1. Pin `{ linux: { store: 'secret-service' } }` on every entry; never use auto-fallback.
2. Treat the open D-Bus blocking issue as a design constraint: avoid constructing entries on the main thread or provide a bounded process-isolated construction path.
3. Document that collection selection is unavailable and verify default collection behavior in a disposable Secret Service environment.
4. Implement a typed error mapping layer rather than relying on raw native error strings.
5. Keep migration, key-file retention, and retirement as separate future tasks.
6. Verify the exact binary and license notices on the target Linux distribution before dependency adoption.

## Evidence table

| URL | Source owner | Retrieval date | What it establishes |
|---|---|---|---|
| `https://registry.npmjs.org/@napi-rs/keyring` | npm registry | 2026-11-13 | Package metadata, version list, license, maintainers, repository, engine, optional dependencies, publish metadata, attestations |
| `https://github.com/Brooooooklyn/keyring-node` | Brooooooklyn | 2026-11-13 | Repository ownership, README, license, issue count, public project status |
| `https://github.com/Brooooooklyn/keyring-node/blob/main/README.md` | Brooooooklyn | 2026-11-13 | Linux backend selection, explicit pinning, keyutils persistence warning, bundled Rust dependencies, libdbus licensing, cargo-auditable |
| `https://raw.githubusercontent.com/Brooooooklyn/keyring-node/52184fbebffeef8a061234f60f313c479b954f9f/index.d.ts` | Brooooooklyn | 2026-11-13 | Exact TypeScript API: constructors, `withTarget`, `getSecret`, `setSecret`, `deleteCredential`, `EntryOptions`, `LinuxStore` |
| `https://raw.githubusercontent.com/Brooooooklyn/keyring-node/52184fbebffeef8a061234f60f313c479b954f9f/src/entry_builder.rs` | Brooooooklyn | 2026-11-13 | Explicit Secret Service construction with empty configuration; auto-fallback behavior; target modifier handling |
| `https://raw.githubusercontent.com/Brooooooklyn/keyring-node/52184fbebffeef8a061234f60f313c479b954f9f/src/linux_credential_builder.rs` | Brooooooklyn | 2026-11-13 | Secret Service is tried first, then keyutils fallback on construction error |
| `https://raw.githubusercontent.com/Brooooooklyn/keyring-node/52184fbebffeef8a061234f60f313c479b954f9f/src/result.rs` | Brooooooklyn | 2026-11-13 | `NoEntry` becomes absent; other errors propagate; deletion failure is not reported as false |
| `https://raw.githubusercontent.com/Brooooooklyn/keyring-node/52184fbebffeef8a061234f60f313c479b954f9f/src/options.rs` | Brooooooklyn | 2026-11-13 | Linux store enum values `secret-service` and `keyutils` |
| `https://github.com/Brooooooklyn/keyring-node/issues/156` | Brooooooklyn | 2026-11-13 | Open blocking D-Bus constructor issue and suggested fixes |
| `https://github.com/Brooooooklyn/keyring-node/issues/99` | Brooooooklyn | 2026-11-13 | Open password-length limitation |
| `https://github.com/Brooooooklyn/keyring-node/releases` | Brooooooklyn | 2026-11-13 | Release history including `v2.1.2` on 2026-10-19 |
| `https://api.osv.dev/v1/query` | OSV | 2026-11-13 | No OSV entries returned for exact version |
| `https://api.github.com/repos/Brooooooklyn/keyring-node/security-advisories` | GitHub | 2026-11-13 | No GitHub Security Advisories returned |
| `https://registry.npmjs.org/-/npm/v1/attestations/@napi-rs%2fkeyring@2.1.2` | npm/Sigstore | 2026-11-13 | npm provenance attestations, SLSA provenance, build workflow reference, git commit |

## Explicit unknowns and limitations

1. The exact Secret Service collection used by the underlying crate is not documented in the README or TypeScript declarations. It is likely the default/login collection, but QFAT must verify this.
2. Whether `setSecret` is atomic create-if-absent is not documented. QFAT would need an adapter-level pattern and concurrency tests.
3. Native error taxonomy is not stable/exposed as codes; QFAT would need mapping and tests.
4. Issue #156 reports a reproducible `AsyncEntry` constructor hang on Linux; the `Entry` constructor impact is inferred from source, not separately reproduced. This evaluation did not independently execute the candidate or reproduce the issue.
5. No binary-level Rust dependency audit (`cargo audit bin`) was performed because the package was not installed.
6. OSV/GitHub advisory searches are point-in-time and may not cover all transitive Rust crates.
7. No Windows work was evaluated; Windows remains deferred.

## Confirmation of no changes

- No dependencies were added, removed, or updated.
- `package.json`, lockfiles, application source, tests, schema, and migrations were not modified.
- No package scripts or native build scripts were run.
- No candidate package was installed or executed.
- No real keyring, credential, or key material was accessed, copied, migrated, rotated, or deleted.
- No live platform accounts, OAuth tokens, or publishing operations were used.
- No Windows work was performed.
- No GitHub Actions or hosted CI was created, enabled, triggered, or relied upon.

## Local verification

| Command | Result | Notes |
|---|---|---|
| `git status --short --branch` | PASS (clean except unrelated untracked report) | Working tree clean for tracked files before this report |
| `git diff --stat` | PASS | No tracked changes before this report |
| `npm view @napi-rs/keyring@2.1.2 --json` | PASS | Metadata retrieved; no install performed |
| `npm view @napi-rs/keyring@2.1.2 dependencies optionalDependencies peerDependencies os cpu --json` | PASS | No runtime dependencies; platform optional dependencies listed |
| `npm search keyring secret-service` | PASS | Only `@napi-rs/keyring` identified as relevant maintained Secret Service client |
| `curl -sS -X POST https://api.osv.dev/v1/query ...` | PASS | No OSV entries returned |
| `gh api repos/Brooooooklyn/keyring-node/security-advisories` | PASS | No advisories returned |
| `gh api repos/Brooooooklyn/keyring-node/issues/156` | PASS | Open blocking D-Bus issue retrieved |
| `curl https://registry.npmjs.org/-/npm/v1/attestations/@napi-rs%2fkeyring@2.1.2` | PASS | Provenance attestations retrieved |
| `bash -n` / project tests | NOT APPLICABLE | Documentation-only task; no package or test execution performed |

Environment: Linux, Node.js v24.22.2, npm 11.19.1. Retrieval date for all web sources: 2026-11-13.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 0db74eaf567490220679ac994a1807e6d7833c5f
- Follow-up fix commit: N/A
- Report update commit: Pending (this audit metadata correction)
- Push verification: PASS (implementation commit verified on remote `main`)

## Handoff

This evaluation is ready for GPT/owner audit. It is not owner acceptance and does not authorize dependency adoption, provider implementation, migration, or Phase B. Agent-reported PASS is not owner acceptance.
