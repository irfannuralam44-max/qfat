# Task QFAT-013L2 — Isolated Linux Secret Service CRUD & Persistence Validation

- **Status:** OWNER-AUTHORIZED FOR EXECUTION — isolated Linux validation only
- **Owner authorization:** Explicitly granted in chat on 2026-11-12; recorded in GitHub authorization commit (see repository history).
- **Task type:** Linux-only isolated credential-store validation
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Parent workstream:** QFAT-013 Linux credential storage
- **Prerequisite:** QFAT-013L accepted as PASS WITH FINDINGS (investigation only)
- **Candidate:** `@napi-rs/keyring` with Linux store explicitly pinned to `secret-service`
- **Report path:** `reports/QFAT-013L2-linux-secret-service-crud-persistence-report.md`

## 1. Objective

Close the material evidence gap from QFAT-013L by validating Secret Service write/read/update/delete behavior and persistence across process restart using synthetic data in a genuinely disposable, isolated Linux Secret Service environment.

QFAT-013L established that the candidate library can require the Secret Service backend and fails closed when the host service is unavailable or its login collection is locked. It did **not** establish successful CRUD operations or persistence after process restart because the owner's normal login collection was locked and the task prohibited changing it.

This task must not weaken that boundary. It must create or use a disposable isolated Secret Service environment, or stop and report NOT RUN if that cannot be done safely.

## 2. Authority and platform boundary

- Owner authorization has been granted for this isolated feasibility-validation task only. This does not authorize production integration, QFAT dependency changes, or credential migration.
- Linux only. Windows remains DEFERRED and NOT AUTHORIZED.
- This task authorizes isolated feasibility validation only. It does not authorize production provider implementation, QFAT dependency changes, database changes, or credential migration.
- Do not infer authorization from this file's existence, task ID/order, roadmap, or prior approval of QFAT-013L.
- The QFAT-013L finding and recommendation are context, not approval to adopt the candidate.

## 3. Required reading

After synchronizing safely to the latest `origin/main`, read completely:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `tasks/QFAT-013L-linux-secret-service-validation.md`
- `reports/QFAT-013L-linux-secret-service-validation-report.md`
- Existing QFAT-013 credential provider contract and relevant test conventions.

The task and approved security requirements are authoritative. Do not modify any production source or project dependency.

## 4. Safety requirements — mandatory

### 4.1 Isolation

Use one of the following, in order of safety and availability:

1. A disposable Linux VM or container with its own D-Bus session and Secret Service/keyring state, destroyed after testing.
2. A demonstrably isolated temporary user/session and temporary keyring state, with a dedicated temporary home/data directory and no access to the owner's normal keyring collections.

Before writing any test secret, prove and record that the Secret Service endpoint and keyring storage belong to the disposable environment. Record the isolation method and the exact cleanup plan.

**Do not use or unlock the owner's existing `login` or `session` collections.** Do not write test entries into the normal user keyring.

Do not install packages system-wide, enable/reconfigure desktop services, restart the owner's keyring daemon, change login/keyring passwords, modify PAM, or alter the normal desktop/session configuration. Dependencies required by a disposable VM/container must remain inside that disposable environment.

If isolation cannot be proven, stop before writing any Secret Service entry. Mark CRUD and restart tests NOT RUN and explain the blocker. Do not improvise a weaker boundary.

### 4.2 Test data and cleanup

- Use synthetic, non-sensitive values only.
- Use a unique service/account namespace clearly identifying a disposable QFAT test.
- Never print secret values, place them in command-line arguments, commit them, or include them in reports. Use boolean equality or hashes for evidence.
- Verify that the test entry is deleted and absent before destroying the isolated environment.
- Destroy temporary keyring files, temporary home/session state, container, or VM after verification.
- Do not access QFAT's real credential DB, encryption key, existing encrypted rows, or any real platform credentials.

### 4.3 Backend pinning

Every candidate-library operation must explicitly require the Linux `secret-service` backend using the documented API/options for the exact pinned package version. Do not use default backend auto-selection for CRUD tests.

The report must show the exact sanitized configuration and explain why keyutils cannot be selected as a fallback in this test. Include a negative test proving that an unavailable Secret Service causes an error rather than successful storage through another backend.

## 5. Scope and required tests

### 5.1 Candidate/version reproducibility

- Record Linux distribution, kernel, architecture, Node/npm versions, session type, and isolation environment.
- Pin and record the exact `@napi-rs/keyring` version used.
- Record official documentation/repository/package source links and access date.
- Record native binary/platform package actually loaded and any runtime prerequisites.
- Do not add this package to QFAT manifests or lockfiles.

### 5.2 CRUD and data integrity

Within the disposable isolated Secret Service:

1. Create/store a synthetic secret using explicit `secret-service` backend selection.
2. Retrieve it and verify exact byte/string equality without printing the value.
3. Update/overwrite it with a second synthetic value.
4. Retrieve again and verify the new value matches exactly and the old value is no longer returned.
5. Delete the entry.
6. Verify subsequent retrieval reports absence using the library's documented behavior.
7. Verify the entry is absent in the isolated Secret Service before cleanup.

Capture exact commands or a reproducible test script, exit codes, and sanitized output.

### 5.3 Process restart persistence

- Store a synthetic value in one process.
- Terminate that process cleanly.
- Start a separate new Node.js process in the same disposable Secret Service session/environment.
- Retrieve and verify exact value equality without printing the value.
- Where feasible, restart the disposable Secret Service daemon or disposable VM/container and repeat retrieval. Distinguish ordinary process restart from daemon/host restart; do not claim one proves the other.
- If daemon/host restart cannot safely be tested, mark that subtest NOT RUN.

### 5.4 Fail-closed and fallback negative tests

- Run a negative test with the Secret Service endpoint unavailable while backend selection remains explicitly pinned.
- Verify the operation fails and no successful secret retrieval can occur through keyutils or another backend.
- If feasible, inspect the disposable environment to show no keyutils entry was created. Explain the evidence and its limits.
- Characterize locked/unavailable behavior only inside the disposable environment; do not lock or unlock the owner's normal collections.
- Record exact error codes/messages with paths and environment-specific identifiers sanitized.

### 5.5 Findings and architecture implications

Document:
- Whether CRUD and process-restart persistence passed.
- Whether collection selection/default collection behavior remains a limitation.
- Whether the library's API and error mapping are adequate for a future QFAT provider.
- Native packaging, maintenance, license, and supply-chain risks already identified in QFAT-013L that remain unresolved.
- Any new risks or limitations.
- A clear recommendation: candidate suitable for a separate implementation proposal, further investigation required, or reject candidate.

Do not implement the provider or migration.

## 6. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Test environment is demonstrably isolated from owner's normal keyring | Isolation proof, endpoint/path evidence, cleanup plan |
| AC-02 | Candidate package/version and exact backend selection are reproducible | Pinned version, source links, sanitized config |
| AC-03 | Store and retrieve work with exact data equality | Executed test evidence |
| AC-04 | Update/overwrite works and returns only the new value | Executed test evidence |
| AC-05 | Delete works and subsequent retrieval confirms absence | Executed test evidence |
| AC-06 | New process can retrieve previously stored value | Separate-process test evidence |
| AC-07 | Secret Service unavailable causes fail-closed behavior; no weaker backend fallback | Negative test and backend pinning evidence |
| AC-08 | Test entry and disposable environment are cleaned up | Cleanup verification |
| AC-09 | No normal keyring, real credential, QFAT DB/key file/source/dependency/lockfile is touched | Scope review, Git diff/status, explicit confirmation |
| AC-10 | Report accurately distinguishes PASS, FAIL, and NOT RUN | Complete evidence-based report |
| AC-11 | Windows, OAuth, account UI/API, upload, publishing, production integration, and migration remain untouched | Diff and scope review |

A test that was not run is NOT RUN, never PASS. If AC-01 cannot be established, do not proceed with any write operation; report all dependent tests NOT RUN.

## 7. Explicit exclusions

- Production Linux Secret Service provider implementation or factory wiring.
- Adding `@napi-rs/keyring` or any package to QFAT manifests/lockfiles.
- Changes to QFAT source, database schema, migrations, credential rows, key files, or configuration.
- Migration, deletion, rotation, or rewriting of existing credentials/encryption keys.
- Access to real Google/YouTube/Meta credentials or account authorization.
- OAuth, account management UI/API, platform API calls, uploads, or publishing.
- Changes to the owner's normal keyring, login/session collections, D-Bus session, desktop services, PAM, or system configuration.
- Windows Credential Vault/ACL work or Windows host testing.
- Figma or unrelated work.

## 8. Report, verification, and publication

Create:

`reports/QFAT-013L2-linux-secret-service-crud-persistence-report.md`

The report must include:
- Scope and isolation proof.
- Environment and package/version details.
- Exact commands/scripts and sanitized outputs.
- Separate results for CRUD, process restart, daemon/host restart (if attempted), and fail-closed tests.
- Cleanup evidence.
- Acceptance criteria table with PASS/FAIL/NOT RUN.
- Findings, limitations, recommendation, and unresolved decisions.
- Exact `## Git Publication` section from `docs/AI-DEVELOPMENT-WORKFLOW.md`.
- Handoff stating that the work is ready for GPT/owner audit and is not owner acceptance.

Follow the repository workflow:
1. Confirm repository identity, branch `main`, HEAD, and clean working tree; preserve all pre-existing changes.
2. Pull only with `git pull --ff-only origin main`; stop if unsafe.
3. Verify and read this exact task after synchronization.
4. Run only the isolated tests permitted above.
5. Inspect full diff and status; run `git diff --check`.
6. Commit only the report and explicitly permitted sanitized evidence artifacts.
7. Push to `main` and verify remote publication.
8. Do not modify this task, ADRs, PRD, architecture, or production source.

Agent completion is not owner acceptance. GPT independently audits the report and remote evidence. A separate owner decision is required before any production implementation/migration task.

## 9. Required final handoff

After successful remote verification, return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Stop after handoff. Do not begin production integration, migration, or another QFAT task.
