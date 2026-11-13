> **QFAT-021 scope note — 2026-11-13 (HELD / UNAUTHORIZED):** This task remains historical evidence of its original authorized scope. It is not current authorization to build or extend a standalone QFAT publishing backend. Current product identity is QFAT frontend for Spoolcast; see `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`. Windows credential work remains deferred under the Linux-first owner gate. Task-file presence is not authorization. Future reuse requires a new bounded task and explicit owner authorization.

# Task QFAT-013W — Windows Credential Storage ACL and Durability

> **OWNER HOLD — DO NOT EXECUTE.**
>
> Windows work is explicitly deferred. This task is retained as a future specification
> only; its presence in the repository is **not authorization** to start it. Do not
> dispatch it to an agent, implement it, test it, or treat it as the next task.
>
> Windows may be reconsidered only after the owner explicitly confirms that Linux
> credential storage is 100% complete, all Linux verification and independent audit
> are finished, the Linux stage is formally accepted, and the owner then gives
> separate, explicit authorization to begin Windows work. Until all of those
> conditions are met, keep Windows fail-closed and leave this task untouched.

- **Status:** DEFERRED — NOT AUTHORIZED FOR EXECUTION
- **Task type:** Windows-specific credential key-file security implementation and host verification
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Parent:** QFAT-013 / QFAT-013R / QFAT-013R2
- **Linux accepted baseline:** `b537380f443bca43c1cb24db31060857e9fd2e7b`
- **Report path:** `reports/QFAT-013W-windows-credential-storage-report.md`

## 1. Objective

Complete the deferred Windows stage for the temporary encrypted credential key-file provider. Implement and verify Windows-specific filesystem security so that the provider can operate on Windows only when the effective ACL and key-file lifecycle guarantees are established.

The Linux implementation is still the active workstream and must reach 100% completion, independent audit, and explicit owner acceptance first. This task must remain untouched until the owner separately authorizes the Windows stage. If later authorized, it must be executed and tested on the owner's Windows PC; Linux-only simulation is not evidence of Windows ACL correctness.

## 2. Authoritative decisions and source

Read completely before editing:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `README.md`
- `CLAUDE.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `tasks/QFAT-013-encrypted-local-credential-storage.md`
- `tasks/QFAT-013R-linux-credential-storage-hardening.md`
- Current QFAT-013, QFAT-013R, and QFAT-013R2 reports.
- Current credential implementation, configuration, schema, and tests.

Synchronize to latest `origin/main` before reading this task. Preserve all local changes; do not reset, clean, stash, or overwrite user work.

## 3. Security and compatibility invariants

Preserve without weakening:
- AES-256-GCM envelope, 32-byte random key, 12-byte fresh nonce, 16-byte authentication tag, version marker, and context-bound AAD.
- SQLite stores ciphertext only; the key remains separate from the database.
- The existing `CredentialProvider` contract and key-file provider abstraction.
- No silent key regeneration when encrypted credential records exist.
- No plaintext, machine-ID, hardcoded-key, environment-secret, or alternate-storage fallback.
- No key/token/plaintext/ciphertext disclosure through logs, errors, APIs, or frontend state.
- Fail closed on any unverified ACL, unsafe path, malformed key, or durability failure.
- Linux behavior and its accepted tests must remain unchanged.
- No OAuth, account management, real credentials, platform API calls, uploads, or publishing in this task.

## 4. Scope

### 4.1 Windows data/key directory ACLs

Implement Windows-specific validation and setup for the QFAT data directory, `keys` directory, and key file.

Requirements:
- Use the configured `QFAT_DATA_DIR` or the existing per-user default from `getDataDir()`; do not invent a second path convention.
- Reject reparse points/symlinks at protected path leaves and reject non-directory/non-regular-file objects.
- Establish and verify the actual Windows security descriptor/DACL, not POSIX mode bits or a best-effort `chmod`.
- Restrict access to the current user identity. Any additional principals (for example SYSTEM or built-in Administrators) must be explicitly justified, narrowly scoped, and documented; broad principals such as Everyone, Authenticated Users, Users, or equivalent must not have access to the protected key material.
- Remove or safely constrain inherited permissions where required; verify the resulting effective access rather than assuming that setting an ACL succeeded.
- Verify ownership/owner SID and ACL state after creation and on every key load.
- Handle paths containing spaces and non-ASCII characters safely.
- Avoid parsing localized human-readable command output. If using PowerShell/.NET or Windows utilities, use structured, locale-independent output and check exit status.
- Do not add a native dependency unless the task documents why built-in Windows/.NET facilities are insufficient and stops for owner approval before introducing one.
- Any ACL inspection or modification failure must return a typed, non-sensitive error and fail closed.

### 4.2 Key-file creation, publication, and durability

Preserve the Linux publication guarantees while implementing a Windows-appropriate equivalent:
- Exclusive creation; no overwrite of an existing key.
- Complete key write and file flush before publication.
- Atomic/no-overwrite publication under concurrent initialization.
- Every process that observes an existing or competing key must verify the key and establish the required durability guarantee before returning key bytes.
- A durability failure must fail closed before any credential ciphertext is persisted.
- Never delete a published key merely because a later durability check failed.
- Do not assume POSIX directory `fsync`, hard-link semantics, or POSIX file descriptor flags behave identically on Windows.
- Document the Windows durability mechanism and its guarantees. If a reliable equivalent cannot be implemented and tested, retain Windows fail-closed behavior and stop for owner review; do not weaken the invariant.

### 4.3 Platform dispatch and diagnostics

- Windows provider construction may stop failing with `WINDOWS_ACL_UNVERIFIED` only after all required ACL and lifecycle checks are implemented and verified.
- Keep unsupported platforms fail-closed.
- Use stable typed errors that do not disclose absolute paths, usernames, SIDs, key bytes, or credential data to untrusted callers.
- Preserve the Linux provider path and error behavior.

### 4.4 Tests

Add Windows-host tests using synthetic credentials and isolated temporary directories/databases. At minimum:
- Default and configured data-directory handling.
- Directory/key-file ACL creation and read-back verification.
- Rejection of broad/inherited access entries or unsafe ACL states.
- Reparse point/symlink and non-regular path rejection where supported.
- Wrong owner / unexpected owner SID rejection where testable.
- Key file creation, reload, and permissions/ACL verification.
- Concurrent first initialization converges on one key and does not overwrite.
- Existing-key and competing-reader durability behavior.
- Failure during ACL setup/verification and durability checks prevents ciphertext persistence.
- Missing key with existing encrypted records fails closed.
- Existing AES-GCM, envelope, provider, and SQLite regression tests.
- Linux regression suite remains green; do not change Linux expectations to accommodate Windows.

Tests that cannot run on Windows must be explicitly NOT RUN with a reason. Mocked platform branches are supplementary only and cannot replace actual Windows host verification.

## 5. Documentation

Update `docs/CREDENTIAL-STORAGE-QFAT-013.md` to replace the Windows deferred status only after Windows host evidence passes. Document:
- The exact ACL principals and access levels permitted.
- How ACLs are created, inspected, and revalidated.
- Windows path/reparse-point checks.
- The key publication/durability mechanism and its limitations.
- Windows-specific verification environment and results.
- Any remaining platform limitations.

Update ADR-004 only if the implementation exposes a material decision requiring owner approval. Do not broaden its security claims.

## 6. Explicit exclusions

- OAuth, account management UI/API, real accounts, platform authorization, upload, publishing.
- LSS or Windows Credential Vault integration/migration.
- Changes to AES-GCM parameters, envelope/AAD, SQLite schema, or migration history.
- Whole-database encryption, key rotation, password prompts, plaintext fallback, or machine-ID-derived keys.
- Unrelated frontend, media, job, or UI work.
- Figma.
- Starting QFAT-014 or any later task.

If any required Windows security or durability guarantee cannot be established, stop with BLOCKED/PASS WITH FINDINGS as appropriate, retain fail-closed behavior, and report the exact blocker. Do not claim Windows readiness.

## 7. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Windows data/key directories are protected by a verified owner-restricted DACL | Windows host tests and ACL inspection evidence |
| AC-02 | Unsafe inherited/broad principals and reparse-point paths fail closed | Windows negative tests |
| AC-03 | Key file is regular, owner-protected, and verified on every load | Windows host tests and source review |
| AC-04 | Exclusive/no-overwrite creation remains safe under concurrent initialization | Windows concurrency test |
| AC-05 | Windows publication/durability guarantee is implemented and verified, or Windows remains fail-closed | Focused Windows tests and documented mechanism |
| AC-06 | No ciphertext is persisted if ACL or durability verification fails | Provider-level SQLite assertions |
| AC-07 | Missing/invalid key with existing records never regenerates a key | Regression test |
| AC-08 | Crypto envelope, AAD, schema, and provider contract remain compatible | Diff review and regression tests |
| AC-09 | Linux implementation and regression tests remain unchanged and green | Linux test evidence or existing accepted baseline plus fresh run if available |
| AC-10 | Documentation accurately reflects Windows status and limitations | Documentation review |
| AC-11 | No OAuth/account/API/UI/publishing or unrelated feature scope is introduced | Diff review |
| AC-12 | Windows typecheck, tests, build, and diff checks pass | Exact commands, environment, and exit codes |

## 8. Verification and publication (future stage only — currently prohibited)

The following commands are **not authorized to run now**. They apply only after the owner has explicitly released the hold described at the top of this file.

Run on the owner's Windows PC:
- `cd apps/server && npm run typecheck`
- `cd apps/server && npm test`
- `cd apps/server && npm run build`
- From repository root: `git diff --check`

Also run the focused credential tests independently if the test runner supports selecting them. Record Windows edition/build, architecture, Node.js/npm versions, exact commands, test counts, and exit codes.

Run the full backend suite on Linux after Windows changes if a Linux environment is available. If not available, mark the fresh Linux run NOT RUN and reference the previously accepted Linux baseline without presenting it as a fresh run.

Before commit, inspect the full diff, staged paths, and working-tree status. Ensure no real secrets, key files, temporary credential data, or user data are included. Commit and push only task-related changes to `main`; verify remote HEAD and report publication.

Report path: `reports/QFAT-013W-windows-credential-storage-report.md`.

The report must distinguish actual Windows host evidence from mocks/source inspection and must include the exact `## Git Publication` section required by `docs/AI-DEVELOPMENT-WORKFLOW.md`.

After successful push, return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Stop after handoff. GPT audits the pushed source and report; owner acceptance is separate. Do not start another task.
