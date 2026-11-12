# QFAT-013R2 — GPT Audit Follow-up

- **Status:** Local verification passed; pending GPT audit
- **Repository:** `irfannuralam44-max/qfat`
- **Branch:** `main`
- **Original implementation:** `0fd014089bff54697a2ef6717af2cde4bdc6b64c`
- **Audit follow-up commits:** 
  - `49a6577c9384f430dbd4884a8e6b30fe1d8be752`
  - `1663f09092dd99c334b18528ffce880f85feef00`
  - `2f9306e7450cd52638482e6375f0ea421aa6dfdb`
  - `6b00721dc4228aea8bc1b3837533e1c2f662f9df`

## 1. Reason for follow-up

The first QFAT-013R2 report described the concurrent-reader test as proving the reader synchronized the key directory before returning. It did not test the required failure case where the competing reader's own directory fsync fails while the creator is still paused. Its concurrent-initialization test also counted fsync calls but did not deterministically establish that one initializer entered the `EEXIST` loser branch.

This follow-up strengthens the test seams and tests. The production durability ordering in QFAT-013R2 is preserved.

## 2. Changes made

### 2.1 Deterministic EEXIST injection seam

- Added optional `linkFile` injection to `KeyFileOptions`, defaulting to the real `node:fs linkSync`.
- Passed the seam through `KeyFileCredentialProvider` to `loadOrCreateCredentialKey()`.
- Added a test that publishes a valid competing key immediately before the real `linkSync`. The real call must raise `EEXIST`, causing the production loser branch to validate the winner key, fsync the containing directory, and return the winner's key.
- Added a provider-level test where the same forced EEXIST branch encounters directory-fsync failure. It asserts `KEY_DIRECTORY_SYNC_FAILED`, preserves the published key, and leaves SQLite with zero credential rows.

The seam defaults to the original production filesystem operation. It does not alter the normal production path.

### 2.2 Competing-reader fsync failure

Replaced the prior competing-reader success-only assertion with a deterministic failure test:

1. A child process publishes the key and pauses inside its creator fsync callback.
2. While the creator is still paused, a separate provider instance attempts to store a dummy credential.
3. The reader's own directory-fsync callback throws.
4. The provider must reject with `KEY_DIRECTORY_SYNC_FAILED`.
5. The test asserts no credential row was written and the creator had not yet been released.

This proves the competing reader cannot persist ciphertext before its own directory synchronization succeeds.

## 3. Files changed in this follow-up

- `apps/server/src/credentials/key-file.ts`
- `apps/server/src/credentials/provider.ts`
- `apps/server/test/credentials.test.ts`

No cryptographic envelope, AAD, SQLite schema, migration, data-directory security validation, or Windows behavior was changed. Windows remains deferred and fail-closed.

## 4. Verification status

Local verification was executed on `main` at HEAD `8d71a30b5253713477d05c9d999107f7b0d7cea6`.

Environment:
- OS: Linux 7.0.0-42-generic x86_64
- Node.js: v24.22.2
- npm: 11.19.1

Commands and results:
- `cd apps/server && npm run typecheck` — PASS (exit 0)
- `cd apps/server && npm test` — PASS (exit 0): 162 tests, 162 pass, 0 fail, 0 skip
- `cd apps/server && npm run build` — PASS (exit 0)
- `cd /mnt/data-ext/project/qfat && git diff --check` — PASS (exit 0)

QFAT-013R2-specific tests verified PASS:
- `EEXIST loser validates the winner key and fsyncs before returning it`
- `EEXIST loser fails closed on fsync failure and commits no ciphertext`
- `competing reader fails closed when its own fsync fails while creator is paused`
- `concurrent initialization records a directory fsync for every initializer`
- Existing-key directory fsync success and failure tests
- Creator directory-fsync failure with zero SQLite rows

Regression coverage verified PASS:
- QFAT-013R data-directory validation, ownership, symlink, and permission tests
- QFAT-013 envelope, provider, key-file, and migration tests
- Full backend suite, including security and media tests

Windows execution: **NOT RUN — DEFERRED** (unchanged; no Windows ACL work performed).

## 5. Acceptance status

Local runtime verification passed. GPT final acceptance remains pending independent audit.

- Implementation source review: corrected test seams and assertions are present on `main`.
- Runtime verification: PASS (162/162 tests, typecheck, build, diff check).
- GPT final acceptance: pending independent audit.
- Owner acceptance: not granted.
