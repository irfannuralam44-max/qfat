# Task QFAT-013R — Linux Credential Storage Hardening

- **Status:** OWNER-AUTHORIZED FOR EXECUTION
- **Task type:** Bounded Linux backend hardening and verification
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Baseline commit:** `6469446656200da9a74bd6077b1a03c24c947c63`
- **Synchronization note:** This is the QFAT-013 implementation baseline; the task and platform-sequencing documentation were published in subsequent documentation-only commits. The agent must synchronize to the latest `origin/main` before execution and must not reset to this baseline.
- **Parent task:** QFAT-013
- **Parent implementation:** `972e490574709c71f54215c8098a46fc157a4911`
- **Approved decision:** `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- **Report path:** `reports/QFAT-013R-linux-credential-storage-hardening-report.md`

## 1. Objective

Resolve the two Linux-specific findings from GPT's independent source audit of QFAT-013:

- **F-01 — Key-file publication durability:** the final key directory entry is not explicitly fsynced after publication.
- **F-02 — Parent data-directory safety:** the Linux provider validates the `keys` directory and key file but does not validate the QFAT data-directory parent that contains them.

This is a narrow corrective task. Preserve the existing CredentialProvider contract, AES-256-GCM envelope, SQLite schema, and temporary ADR-004 approach.

## 2. Platform sequencing — owner decision

The owner has explicitly decided:

1. Complete **all Linux work first**, including implementation, integration, testing, and Linux readiness.
2. Handle **Windows only after Linux work is complete**, as a separate platform stage on the owner's Windows PC.
3. Windows ACL implementation and Windows-host validation are not part of this task and must not block Linux completion.

For this task:
- Keep the existing Windows provider behavior fail-closed.
- Do not implement, refactor, or test Windows ACL handling.
- Do not claim Windows support.
- Mark Windows as **DEFERRED — AFTER LINUX COMPLETION** in task/report notes where platform status is summarized.
- The existing Windows fail-closed behavior must not be weakened or bypassed.

This platform sequence supersedes any implication in the original QFAT-013 task that Windows ACL work must be completed in parallel with Linux.

## 3. Authoritative documents and constraints

Read completely before editing:
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `tasks/QFAT-013-encrypted-local-credential-storage.md`
- `reports/QFAT-013-encrypted-local-credential-storage-report.md`
- Current implementation and focused credential tests.

Preserve:
- Linux-first platform sequence stated above.
- AES-256-GCM and current envelope format.
- Existing SQLite schema and migration history.
- Fail-closed behavior for missing/corrupt/unreadable key material.
- No plaintext fallback, no key regeneration when encrypted records exist.
- No real credentials and no external platform calls.

## 4. Scope

### 4.1 F-01 — Durable key-file publication

Inspect the current exclusive temporary-file + hard-link publication flow in `apps/server/src/credentials/key-file.ts`.

After the final key path is published, ensure the containing `keys` directory entry is durably synchronized before the provider returns the newly created key and before any caller can persist ciphertext that depends on it.

Requirements:
- Synchronize the parent directory using a Linux-supported directory file descriptor and `fsync` (or an equivalently reliable mechanism).
- Preserve exclusive/no-overwrite creation and concurrent-initialization safety.
- Correctly close descriptors and clean temporary artifacts on success and failure.
- If directory synchronization fails or cannot be guaranteed, fail closed; do not return the key as successfully initialized.
- Do not delete or replace a published final key merely because the directory fsync failed. A subsequent attempt must safely inspect and use/fail on the existing key according to normal validation.
- Add focused tests for successful directory synchronization ordering and injected/observable synchronization failure. Tests must not rely solely on source-text assertions.

### 4.2 F-02 — QFAT data-directory validation

Before trusting or creating the `keys` directory, validate the configured QFAT data directory itself.

Requirements:
- Validate the resolved QFAT data directory used by the key path, including the default `~/.qfat` and configured `QFAT_DATA_DIR` cases.
- Reject a missing/invalid path state where it cannot be safely established, symlinks at the QFAT data-directory path, non-directory paths, ownership mismatch, and group/world-writable data-directory permissions.
- Ensure the directory is owned by the effective OS user and is not writable by group or other users. Use restrictive owner-only permissions where the implementation creates the directory.
- Keep the existing stricter `keys` directory (0700) and key file (0600) checks.
- Do not impose unsafe or impractical checks on unrelated system ancestors such as `/` or a shared `/home` directory; document the exact trust boundary and checks.
- Handle configured paths and temporary test directories correctly without following a symlink at the QFAT data-directory leaf.
- Fail closed with typed, non-sensitive errors. Do not leak absolute paths, key bytes, or credential contents.
- Add focused tests for symlink, non-directory, wrong owner where testable, group/world-writable mode, safe mode, default path, and configured data-directory path.

If implementation details expose a material security trade-off not resolved here, stop and report it rather than weakening checks.

### 4.3 Documentation

Update `docs/CREDENTIAL-STORAGE-QFAT-013.md` to:
- Explain the validated QFAT data-directory boundary and the key directory/file checks.
- Explain directory fsync after key publication and fail-closed behavior if synchronization fails.
- Clearly label platform sequence: Linux first; Windows deferred until all Linux work is complete.
- Keep Windows status as deferred and fail-closed/unverified; do not imply Windows readiness.

Update ADR-004 only if needed to record the Linux-first / Windows-later owner sequencing. Do not change the approved cryptographic design or broaden the ADR's security claims.

Do not rewrite the historical QFAT-013 report. QFAT-013R must have its own report.

## 5. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Final key publication is followed by successful parent-directory fsync before the new key is returned | Focused test and source inspection |
| AC-02 | Directory fsync failure fails closed and never reports key initialization success | Focused failure-path test |
| AC-03 | Existing exclusive creation/concurrent initialization behavior remains safe | Existing and focused concurrency tests |
| AC-04 | QFAT data-directory leaf is validated for directory type, ownership, symlink safety, and non-group/world-writable permissions | Focused Linux tests |
| AC-05 | Existing keys directory 0700 and key file 0600 checks remain enforced | Focused and regression tests |
| AC-06 | Missing/corrupt key with existing credential records still fails closed without regeneration | Regression tests |
| AC-07 | Credential encryption envelope, SQLite persistence, and provider contract remain unchanged | Diff/source review and regression tests |
| AC-08 | No OAuth, account API/UI, real credentials, publishing, or unrelated feature changes | Diff review |
| AC-09 | Documentation accurately records Linux-first sequence and Windows deferral | Documentation review |
| AC-10 | Required backend tests, typecheck, build, and diff checks pass | Exact commands and results in report |

## 6. Explicit exclusions

- Windows ACL implementation, Windows host testing, or Windows support claims.
- Linux Secret Service integration or migration.
- OAuth, YouTube/Meta authorization, real accounts, account UI/API, uploads, or publishing.
- Changes to AES-GCM parameters, envelope format, AAD, SQLite schema, or migration history unless a directly necessary compatibility issue is found; stop for owner review if so.
- Whole-database encryption, key rotation, password prompts, plaintext fallback, or alternate key storage.
- PRD changes, broad refactors, unrelated frontend work, and Figma.
- Starting QFAT-014 or any later task.

## 7. Verification requirements

- Use synthetic dummy credentials only and isolated temporary directories/databases.
- Run focused credential tests, the complete backend test suite, backend typecheck, backend build, and `git diff --check` as applicable to the current package scripts.
- Inspect package scripts before choosing commands.
- Include a regression proving ciphertext cannot be committed using a newly generated key unless key publication durability checks have completed successfully.
- Record exact commands, host OS, and actual exit results.
- Mark Windows execution **NOT RUN — DEFERRED UNTIL LINUX COMPLETION**, not PASS or BLOCKED.
- Do not claim Linux readiness based only on source inspection; execute the tests on Linux.

## 8. Safe repository procedure

1. Verify repository identity, origin, branch `main`, HEAD, and working-tree status.
2. Preserve pre-existing local changes; stop if the checkout is dirty or unsafe to synchronize.
3. Synchronize with `git pull --ff-only origin main`; stop if fast-forward is not possible.
4. Verify this task exists on `main`, then read it completely after synchronization.
5. Use one OpenCode main agent serially.
6. Keep all changes within this task.
7. Review full diff, staged paths, and status before commit.
8. Commit and push to `main`; verify remote HEAD and report publication.

## 9. Required report and handoff

Create `reports/QFAT-013R-linux-credential-storage-hardening-report.md` using the report structure in `docs/AI-DEVELOPMENT-WORKFLOW.md`.

The report must:
- Identify the two findings and their resolutions.
- List files changed and exact verification commands/results.
- Separate executed Linux evidence from Windows deferred status.
- State that Windows work begins only after Linux work is complete.
- Include the exact `## Git Publication` section required by the workflow.
- State that the work is ready for GPT/owner audit, not owner-accepted.

After successful remote verification, return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Agent completion is not owner acceptance. Stop after handoff. GPT independently audits the pushed implementation and report. QFAT-013 remains unaccepted until GPT audit and explicit owner approval.
