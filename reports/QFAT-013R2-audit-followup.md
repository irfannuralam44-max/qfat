# QFAT-013R2 — GPT Audit Follow-up

- **Status:** Code and regression-test corrections pushed; local verification required
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

**NOT RUN in the GPT environment.** The GitHub edits are source changes only; no claim is made that TypeScript compilation or tests have passed after these changes.

Run locally after pulling `origin/main`:

```bash
git pull --ff-only origin main
cd apps/server
npm run typecheck
npm test
npm run build
cd ../..
git diff --check
```

Expected test coverage includes:
- Existing-key directory fsync success and failure.
- Creator directory-fsync failure with zero SQLite rows.
- Competing-reader directory-fsync failure while creator is paused, with zero SQLite rows.
- Deterministically forced EEXIST success path.
- Deterministically forced EEXIST fsync failure with zero SQLite rows.
- Existing concurrent initialization regression and QFAT-013R data-directory/key-file security tests.

Record the actual local command outputs and exit codes before considering QFAT-013R2 accepted. Windows execution remains **NOT RUN — DEFERRED**.

## 5. Acceptance status

The original report's PASS WITH FINDINGS status is superseded for audit purposes by this follow-up note until the updated tests have been executed locally.

- Implementation source review: corrected test seams and assertions are present on `main`.
- Runtime verification: pending local execution.
- GPT final acceptance: pending local results and subsequent review.
- Owner acceptance: not granted.
