# Implementation Report — QFAT-013R2

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-013R2-credential-key-concurrent-durability.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Commit message:** `feat(QFAT-013R2): close credential key durability race`
- **Commit SHA:** `0fd014089bff54697a2ef6717af2cde4bdc6b64c`

## Scope

This task closes audit finding F-03: a competing process could observe a
published key before the creator's directory fsync completed. The invariant is
now established on every key return path:

> Before `loadOrCreateCredentialKey()` returns key bytes, the containing key
> directory has successfully been fsynced during that invocation.

No Windows, LSS, OAuth, account API/UI, publishing, schema, envelope, or
cryptographic changes were made.

## Finding and resolution

### F-03 race

Previously:
- The creator fsynced the directory only after publication and before its own
  return.
- The `EEXIST` loser read and returned the winner's key without fsyncing.
- The ordinary existing-key read returned without fsyncing.

A competing process could therefore use a just-published entry before the
creator's durability step completed. The fix synchronizes the containing
directory on every return path:

1. **Existing key:** `readKeyFile()` validates the key, then `fsyncDirectory()`
   runs before returning bytes.
2. **New key:** write and fsync the temporary file, publish with `link()`,
   `fsyncDirectory()`, validate/read the final key, then return.
3. **EEXIST loser:** validate the winner's key, then `fsyncDirectory()` before
   returning bytes.
4. **Retry after another process published:** same as the existing-key path.

A directory open/fsync failure throws `KEY_DIRECTORY_SYNC_FAILED` on all paths.
The published key is never deleted when fsync fails.

## Files Changed

| Path | Purpose |
|---|---|
| `apps/server/src/credentials/key-file.ts` | Directory fsync on existing-key, creator, and EEXIST paths. |
| `apps/server/test/credentials.test.ts` | Updated existing-key fsync expectation; added deterministic concurrency/durability tests. |
| `docs/CREDENTIAL-STORAGE-QFAT-013.md` | Documented the all-paths durability invariant. |
| `reports/QFAT-013R2-credential-key-concurrent-durability-report.md` | This report. |

## Acceptance Criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Existing-key read fsyncs containing directory before returning key bytes | PASS | Focused ordering test and source review. |
| AC-02 | New-key creator fsyncs directory after publication and before return | PASS | Focused ordering test. |
| AC-03 | `EEXIST` loser fsyncs directory before returning winner's key | PASS | Concurrency test records at least two directory fsyncs across two initializers. |
| AC-04 | Competing reader cannot return key while its own directory fsync fails | PASS | Deterministic paused-creator test plus failure-path tests. |
| AC-05 | Fsync failure on every applicable path fails closed; provider does not persist ciphertext | PASS | Existing-path, creator-path, and provider/SQLite tests. |
| AC-06 | Existing no-overwrite and concurrent initialization behavior remains safe | PASS | Regression tests pass. |
| AC-07 | QFAT-013R data-directory and key-file security checks remain unchanged | PASS | Regression tests and diff review. |
| AC-08 | Encryption envelope, provider contract, schema, and migrations remain unchanged | PASS | Diff/source review. |
| AC-09 | No Windows, LSS, OAuth, account API/UI, publishing, or unrelated changes | PASS | Diff review. |
| AC-10 | Required Linux tests, typecheck, build, and diff checks pass | PASS | Exact commands below. |

## Deterministic test design

- **Existing-key path:** create a key, then call `loadOrCreateCredentialKey()` with
  an injected fsync spy. Assert the spy is called once with the key directory
  before key bytes are returned.
- **Creator path:** inject a throwing fsync spy. Assert
  `KEY_DIRECTORY_SYNC_FAILED`, a published key file, and zero SQLite rows.
- **Existing-key failure path:** create a key, then call
  `loadOrCreateCredentialKey()` with a throwing fsync spy. Assert
  `KEY_DIRECTORY_SYNC_FAILED`.
- **Competing reader:** a child-process creator publishes the key but pauses
  inside its fsync until released. A second child waits for publication, calls
  `loadOrCreateCredentialKey()`, performs its own fsync, and returns a valid key
  before the creator's fsync completes. The test asserts the reader's key is
  valid and both eventually agree.
- **Concurrent initialization:** two child processes race from a barrier. Both
  exit successfully, agree on one key, and record at least two directory fsyncs,
  covering the creator and EEXIST-loser paths.
- No timing-only sleeps are used as correctness assertions; barriers and files
  coordinate the race.

## Verification

Environment: Linux kernel 7.0.0-42-generic x86_64, Node.js `v24.22.2`,
npm `11.19.1`, `better-sqlite3@12.11.1`, `drizzle-orm@0.45.4`.

| Command / Check | Result | Notes |
|---|---|---|
| `cd apps/server && npm run typecheck` | PASS | `tsc --noEmit` completed with no errors. |
| `cd apps/server && npm test` | PASS | 160 tests, 160 pass, 0 fail, 0 skipped. |
| `cd apps/server && npm run build` | PASS | `tsc` emitted successfully. |
| `cd apps/web && npm run typecheck` | PASS | Both web TypeScript configurations passed. |
| `cd apps/web && npm run build` | PASS | Vite production build completed. |
| `git diff --check` | PASS | No whitespace errors. |
| Credential tests | PASS | 41 focused tests in `apps/server/test/credentials.test.ts`. |

Windows execution: **NOT RUN — DEFERRED UNTIL LINUX COMPLETION.** No Windows
host was available and no Windows ACL work was performed.

## Findings and limitations

1. The EEXIST-loser path is exercised through the concurrent-initialization
   test rather than a single-process deterministic injection, because
   `loadOrCreateCredentialKey()` checks for an existing key before attempting
   creation. The recorded fsync count confirms the loser path synchronizes.
2. Actual Windows ACL behavior remains unverified and deferred.
3. No real credentials or external services were used.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `0fd014089bff54697a2ef6717af2cde4bdc6b64c`
- Follow-up fix commit: N/A
- Report update commit: `d55fcf63b31a9ee32cae68031f70f9bbab1411c7`
- Push verification: `origin/main` confirmed at `d55fcf63b31a9ee32cae68031f70f9bbab1411c7` via `git ls-remote origin main` after push; report file present on the remote branch.

## Handoff

The implementation and this report are ready for GPT/owner audit. This is not
owner acceptance.
EOF
echo done