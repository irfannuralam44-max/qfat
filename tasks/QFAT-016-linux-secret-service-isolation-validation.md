# QFAT-016 — Validate Process-Isolated Linux Secret Service Access

- **Status:** READY FOR EXECUTION — bounded Linux validation task
- **Task type:** Credential-storage risk validation / implementation readiness
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Parent workstream:** QFAT-013 Linux credential storage
- **Previous accepted task:** QFAT-015 — Spoolcast upload-service boundary
- **Relevant decisions:** `docs/CREDENTIAL-STORAGE-QFAT-013.md`, `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- **Architecture:** `docs/ARCHITECTURE-QFAT-MVP.md`
- **Workflow:** `docs/AI-DEVELOPMENT-WORKFLOW.md`
- **Evaluation:** `reports/QFAT-013L3A-linux-secret-service-dependency-security-evaluation.md`
- **Expected report:** `reports/QFAT-016-linux-secret-service-isolation-validation-report.md`

## 1. Objective

Resolve the main technical blocker identified in QFAT-013L3A before adopting Linux Secret Service in production: the `@napi-rs/keyring@2.1.2` constructor may block the Node.js process indefinitely during D-Bus setup.

Validate whether a separate child process can safely contain that blocking behavior, be terminated on timeout, and perform CRUD against a **disposable isolated Secret Service instance**. Also verify the package's default collection behavior sufficiently to confirm the owner-approved Linux MVP direction.

This is a validation/spike task, not production provider integration. It must produce evidence for a subsequent narrowly scoped implementation task.

## 2. Owner decisions already in force

- Linux is the only active platform target. Windows remains deferred and unauthorized.
- `@napi-rs/keyring@2.1.2` is the preferred conditional candidate, not unconditionally approved for production.
- Pin the explicit `secret-service` backend; never permit automatic fallback to keyutils.
- Use the Linux default/login collection if disposable-environment testing confirms the behavior.
- When locked or unavailable, fail closed with clear instructions to unlock through Linux and retry.
- Keep the existing AES-256-GCM envelope and SQLite ciphertext format.
- Migration from the current key-file provider is separate and explicitly invoked. Do not migrate, overwrite, or delete real key material.
- No real user keyring, credentials, or platform accounts may be accessed.

## 3. Required reading

Read the current versions on `main` before work:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `README.md` and relevant `CLAUDE.md` overlay
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `reports/QFAT-013L3A-linux-secret-service-dependency-security-evaluation.md`
- `apps/server/src/credentials/provider.ts`
- `apps/server/src/credentials/envelope.ts`
- Relevant credential tests and the exact QFAT-013L3A source links for package version 2.1.2.

Confirm the current branch and working tree, preserve all pre-existing changes, and synchronize `main` safely before implementation or testing.

## 4. Scope

### 4.1 Disposable environment only

- Use a separate D-Bus session and a disposable Secret Service/keyring instance created solely for this test.
- Do not connect to, unlock, enumerate, read, modify, or delete items in the owner's normal desktop keyring.
- Use synthetic random test bytes only; never use QFAT's actual credential key, OAuth tokens, Page tokens, or app secrets.
- If an isolated Secret Service cannot be created safely on the available Linux environment, stop that portion and report BLOCKED/NOT RUN. Do not fall back to the real desktop session.

### 4.2 Child-process containment

Build a minimal temporary validation harness outside tracked production source, or under a clearly isolated test-only location if the repository test convention requires it.

Demonstrate:
1. The parent Node process starts a dedicated child process for keyring operations.
2. The child pins `{ linux: { store: 'secret-service' } }` explicitly.
3. The child can create/store, retrieve, and delete a synthetic 32-byte secret in the disposable Secret Service.
4. The parent enforces a finite operation/startup timeout.
5. If the child is deliberately made to hang, the parent can terminate it and recover without hanging or terminating the parent process.
6. Child exit, timeout, malformed IPC, and provider errors are converted into bounded, secret-free parent errors.
7. Secret bytes are passed only through the child IPC channel and are never written to logs, stdout/stderr, command arguments, environment variables, or temporary files.

Do not use worker threads as the containment mechanism; the evaluation identified that as insufficient for this blocking issue.

### 4.3 Default collection behavior

Using only the disposable environment:
- Verify which collection receives the stored item.
- Verify that the item persists across child-process restart within the disposable test session.
- Verify locked/unavailable behavior and the exact observable error.
- Record what was directly observed versus inferred from library behavior.
- Do not claim support for selecting a named collection; the candidate API does not expose that capability.

### 4.4 Dependency handling

- Do not add the candidate package to the QFAT production dependency manifest or lockfile in this task.
- If required, install/use the exact package in a temporary directory outside the repository and record the exact version and package integrity details.
- Do not install packages globally.
- Do not update unrelated packages or lockfiles.

### 4.5 Production boundary

This task MUST NOT:
- Add a production Secret Service provider.
- Change the default credential provider or wire Secret Service into server startup.
- Change the existing key-file provider, AES envelope, SQLite schema, or migrations.
- Migrate, rotate, replace, or retire the existing key file.
- Access real desktop keyring items or real credential material.
- Implement OAuth/account routes or publishing routes.
- Perform live Google/Meta authorization or uploads.
- Perform Windows work.
- Create, enable, trigger, or rely on GitHub Actions or hosted CI.

## 5. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | Validation uses an isolated disposable D-Bus/Secret Service environment and proves the normal desktop keyring was not accessed. |
| AC-02 | Exact `@napi-rs/keyring@2.1.2` is used with explicit `secret-service` backend pinning; no keyutils fallback is possible. |
| AC-03 | Synthetic 32-byte secret CRUD succeeds, and persistence across child-process restart is demonstrated. |
| AC-04 | The parent process remains responsive when the child is deliberately hung; a finite timeout terminates the child and returns a bounded error. |
| AC-05 | Locked/unavailable behavior is tested in the disposable environment or clearly marked NOT RUN with a specific environmental reason. |
| AC-06 | Default collection behavior is directly observed and documented, including any limitations. |
| AC-07 | Secret bytes do not appear in logs, stdout/stderr, command arguments, environment variables, or temporary files. |
| AC-08 | No production source, package manifest/lockfile, schema, migration, real keyring, or real credential state is changed. |
| AC-09 | Report separates direct observations, source-based inferences, limitations, and unresolved risks. |
| AC-10 | No hosted CI is used; all executed checks are local and exact commands/results are recorded. |

## 6. Verification and report

- Run the temporary harness on Linux only.
- Capture exact Node.js/npm/OS versions and the exact package version.
- Include the disposable D-Bus/Secret Service setup and teardown commands.
- Include evidence for child timeout/termination and parent responsiveness.
- Include evidence for CRUD and persistence without exposing secret bytes.
- Run repository typecheck/build/tests only if repository files were changed; otherwise mark them NOT APPLICABLE and explain.
- Do not run live platform APIs or use real credentials.

Create `reports/QFAT-016-linux-secret-service-isolation-validation-report.md` with:
- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Task path, repository, branch, commit message, full commit SHA.
- Scope and files changed.
- Acceptance criteria table with evidence.
- Exact environment and commands/results.
- Disposable environment setup/cleanup and safety evidence.
- Direct observations vs source-based inferences.
- Remaining risks and recommendation whether production provider implementation is READY or BLOCKED.
- Confirmation that no real keyring/credential state or production dependency/source was changed.
- Required `## Git Publication` section.
- Handoff for GPT audit; do not claim owner acceptance.

## 7. Stop conditions

Stop and report BLOCKED if:
- A separate disposable D-Bus/Secret Service cannot be established without touching the normal desktop keyring.
- The candidate cannot be pinned to Secret Service without keyutils fallback.
- The child process cannot be terminated reliably when the native operation blocks.
- The parent process becomes unresponsive or secret bytes leak into observable output.
- The default collection behavior cannot be established safely.

Do not work around a stop condition by testing against the owner's real keyring or by weakening the timeout/security requirements.

## 8. Expected handoff

After report commit/push and remote verification, provide only:
- Branch
- Commit message
- Full SHA
- Report path

Stop and wait for GPT/owner audit. Do not begin production provider integration, account/OAuth integration, migration, or another task until QFAT-016 is accepted and the next task is explicitly issued.
