# Task QFAT-013R2 — Credential Key Concurrent Durability Fix

- **Status:** OWNER-AUTHORIZED FOR EXECUTION
- **Task type:** Narrow Linux backend correctness fix and regression verification
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Baseline commit:** `f47af58ef5086cc58079cebd308546aa6e9c1e0d`
- **Parent tasks:** QFAT-013, QFAT-013R
- **Parent implementation:** `3de74770869309a5d6ef0d2d33ea482b51e17dd3`
- **Prior audit finding:** F-03 — concurrent key publication can be observed before directory durability is established
- **Report path:** `reports/QFAT-013R2-credential-key-concurrent-durability-report.md`

## 1. Objective

Close the remaining durability race identified in GPT's independent audit of QFAT-013R.

The current implementation fsyncs the `keys` directory after the process that wins `linkSync(tempPath, keyPath)` publishes a new key. However:
- A competing process can observe the published key before the winning process completes its directory fsync.
- The `EEXIST` path reads and returns the winner's key without synchronizing the containing directory.
- The ordinary existing-key read path also returns the key without synchronizing the containing directory.

A process must never return/use a key whose directory entry has not first been durably synchronized. The fix must cover every path by which a key can be returned to a caller, not just the creator process.

## 2. Platform sequence — binding owner decision

Linux remains the only active target until all Linux implementation, integration, and verification work is complete.

- Work only on Linux behavior.
- Windows remains deferred until Linux is complete and must remain fail-closed.
- Do not implement or validate Windows ACL behavior.
- Do not let Windows work block this task.

## 3. Required reading and preservation

Read before editing:
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `tasks/QFAT-013R-linux-credential-storage-hardening.md`
- `reports/QFAT-013R-linux-credential-storage-hardening-report.md`
- Current credential key implementation and tests.

Preserve all accepted QFAT-013 and QFAT-013R behavior:
- AES-256-GCM envelope and AAD.
- CredentialProvider contract and SQLite schema.
- QFAT data-directory, `keys` directory, and key-file ownership/permission/symlink checks.
- Exclusive no-overwrite key creation.
- Missing key with existing encrypted records fails closed.
- No silent key regeneration, plaintext fallback, or weakening of Windows fail-closed behavior.

## 4. Scope

### 4.1 Ensure durability before every key return

Review `apps/server/src/credentials/key-file.ts` and establish one clear invariant:

**Before `loadOrCreateCredentialKey()` returns key bytes, the containing key directory has successfully been fsynced during that invocation.**

This must hold for all paths:
1. Loading an already existing key.
2. Creating and publishing a new key.
3. Losing the creation race and handling `EEXIST`.
4. Any retry/recovery path after another process has published the key.

Requirements:
- Synchronize the directory that contains the validated key path, after the key entry is observed and validated, and before key bytes are returned to the provider.
- On the creation path, retain the required ordering: write complete temporary key, fsync temporary file, atomically publish without overwrite, fsync containing directory, validate/read final key, then return.
- On the `EEXIST` path, validate the winner's key and fsync the containing directory before returning its bytes.
- On the ordinary existing-key path, validate the key and fsync the containing directory before returning its bytes. This ensures a competing process cannot use a just-published entry before the creator's durability step completes.
- Any directory open/fsync failure must fail closed with the existing typed `KEY_DIRECTORY_SYNC_FAILED` error (or a narrowly justified equivalent).
- Do not remove or replace a published key when fsync fails.
- Ensure file descriptors are closed on all paths. Do not suppress fsync errors.
- Avoid redundant or confusing multiple fsync calls where a single correctly ordered call establishes the invariant. Document the ordering in code.
- Keep injectable test seams if useful, but do not allow tests to bypass the actual production fsync path entirely.

### 4.2 Deterministic concurrency regression tests

Add tests that exercise the race rather than merely asserting that a callback was invoked.

At minimum:
- **Creator success:** creator publishes key; directory fsync completes; only then key is returned.
- **Competing reader while creator is paused:** deterministically pause the creator after publication but before its fsync completes. A second invocation sees the key. Verify the second invocation performs its own directory fsync before returning key bytes. Verify a simulated fsync failure in that second invocation causes it to fail closed and cannot proceed to credential persistence.
- **EEXIST path:** force or deterministically arrange two initializers so the losing initializer validates the winner's key and synchronizes the directory before returning.
- **Existing-key path:** verify a normal existing key read also synchronizes the containing directory before return.
- **Failure:** inject directory fsync failure for each applicable read/create/race path and verify no key is returned and no credential row is written by the failing provider.
- Keep the existing concurrent initialization test and all QFAT-013R regression tests passing.

Use deterministic barriers/hooks or child-process coordination; avoid timing-only sleeps as the correctness assertion. Tests must validate observable behavior, not only source text.

### 4.3 Documentation and report

Update `docs/CREDENTIAL-STORAGE-QFAT-013.md` only as needed to accurately state that every key load/creation path synchronizes the containing directory before returning key material.

Do not rewrite historical QFAT-013 or QFAT-013R reports. Create the separate QFAT-013R2 report at the path above.

## 5. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Existing-key read fsyncs containing directory before returning key bytes | Focused ordering test and source review |
| AC-02 | New-key creator fsyncs directory after publication and before return | Focused ordering test |
| AC-03 | `EEXIST` loser fsyncs directory before returning winner's key | Deterministic test |
| AC-04 | Competing reader cannot return key while its own directory fsync fails | Deterministic interleaving test |
| AC-05 | Fsync failure on every applicable path fails closed; provider does not persist ciphertext | Focused provider/SQLite tests |
| AC-06 | Existing no-overwrite and concurrent initialization behavior remains safe | Full regression tests |
| AC-07 | QFAT-013R data-directory and key-file security checks remain unchanged | Regression tests and diff review |
| AC-08 | Encryption envelope, provider contract, schema, and migrations remain unchanged | Diff/source review |
| AC-09 | No Windows, LSS, OAuth, account API/UI, publishing, or unrelated changes | Diff review |
| AC-10 | Required Linux tests, typecheck, build, and diff checks pass | Exact commands/results in report |

## 6. Explicit exclusions

- Windows ACL implementation/testing or Windows support claims.
- Linux Secret Service integration or migration.
- OAuth, YouTube/Meta authorization, real accounts, account UI/API, uploads, or publishing.
- Changes to encryption algorithm/parameters, envelope format, AAD, SQLite schema, or migrations.
- Whole-database encryption, key rotation, password prompts, plaintext fallback, or alternate key storage.
- Broad refactors, unrelated frontend work, Figma, or later QFAT tasks.

## 7. Verification requirements

- Run on Linux.
- Use synthetic dummy credentials and isolated temporary directories/databases only.
- Inspect package scripts before selecting commands.
- Run focused credential tests, complete backend tests, backend typecheck, backend build, and `git diff --check`.
- Run frontend checks only if shared contracts or frontend files are changed; explain if not applicable.
- Record exact commands, test counts, host OS, and exit results.
- Explicitly record that Windows was not tested because it remains deferred.
- Review the complete diff to ensure QFAT-013R's F-02 checks were not regressed.

## 8. Safe repository procedure

1. Verify repository identity, origin, branch `main`, HEAD, and working-tree status.
2. Preserve pre-existing local changes; stop if checkout is dirty or unsafe to synchronize.
3. Synchronize using `git pull --ff-only origin main`.
4. Verify this task exists on `main` and read it completely after synchronization.
5. Use one OpenCode main agent serially.
6. Keep changes within this task.
7. Review complete diff, staged paths, and Git status before commit.
8. Commit and push to `main`; verify remote HEAD and report publication.

## 9. Required report and handoff

Create `reports/QFAT-013R2-credential-key-concurrent-durability-report.md` using the report structure in `docs/AI-DEVELOPMENT-WORKFLOW.md`.

The report must:
- Explain the F-03 race and the invariant implemented.
- Describe how each path (existing, creator, EEXIST loser, competing reader) is synchronized.
- Include deterministic test design and results, not only a test count.
- List changed files and exact verification commands/results.
- State Windows is deferred and was not tested.
- Include the exact `## Git Publication` section required by the workflow.
- State that the result is ready for GPT/owner audit, not owner-accepted.

After successful remote verification, return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Agent completion is not owner acceptance. GPT independently audits the pushed implementation and report. QFAT-013 remains unaccepted until the audit and explicit owner approval. Stop after handoff.
