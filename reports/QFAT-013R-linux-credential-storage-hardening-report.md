# Implementation Report — QFAT-013R

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-013R-linux-credential-storage-hardening.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Commit message:** `feat(QFAT-013R): harden Linux credential storage`
- **Commit SHA:** `3de74770869309a5d6ef0d2d33ea482b51e17dd3`

## Scope

This corrective task resolves two Linux-specific findings from the independent
audit of QFAT-013:

- **F-01 — Key-file publication durability:** the final key directory entry is
  now durably synchronized after publication.
- **F-02 — Parent data-directory safety:** the QFAT data-directory leaf is now
  validated before trusting or creating the `keys` directory.

No OAuth, account API/UI, real credentials, publishing, Windows ACL work,
LSS/WCV integration, schema, or envelope-format changes were made.

## Findings and resolutions

### F-01

`createKeyFile()` previously published `credential.key` with an atomic hard link
but did not fsync the containing `keys` directory. It now calls an injectable
directory synchronization step after `linkSync()` and before returning the new
key. The default implementation opens the directory with `O_RDONLY` (plus
`O_DIRECTORY` when available) and calls `fsync()`. A synchronization failure
throws `KEY_DIRECTORY_SYNC_FAILED` and fails closed. The published key is not
deleted, so a later call inspects and uses or fails on it through normal
validation. The fsync step is not invoked when an existing key is loaded.

### F-02

Before creating or trusting the `keys` directory, `ensurePrivateKeyDirectory()`
now calls `validateDataDirectory()` on its parent leaf. That leaf must be a real
directory, not a symlink, owned by the effective OS user, and not group/world
writable. A missing leaf is created with mode `0700`. The existing `0700` keys
directory and `0600` key-file checks remain unchanged. Unrelated ancestors are
intentionally not validated.

## Files Changed

| Path | Purpose |
|---|---|
| `apps/server/src/credentials/errors.ts` | Added `KEY_DATA_DIRECTORY_UNSAFE` and `KEY_DIRECTORY_SYNC_FAILED`. |
| `apps/server/src/credentials/key-file.ts` | Data-directory validation, directory fsync after publication, option threading. |
| `apps/server/src/credentials/provider.ts` | Threaded `fsyncDirectory` through provider construction and key loading. |
| `apps/server/test/credentials.test.ts` | Added data-directory validation, durability, and regression tests. |
| `docs/CREDENTIAL-STORAGE-QFAT-013.md` | Documented trust boundary, data-directory checks, and directory fsync. |
| `reports/QFAT-013R-linux-credential-storage-hardening-report.md` | This report. |

## Acceptance Criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Final key publication is followed by successful parent-directory fsync before the new key is returned | PASS | Focused spy test asserts one fsync call to the key directory after publication. |
| AC-02 | Directory fsync failure fails closed and never reports key initialization success | PASS | Injected throwing fsync produces `KEY_DIRECTORY_SYNC_FAILED`; no SQLite row is committed. |
| AC-03 | Existing exclusive creation/concurrent initialization behavior remains safe | PASS | Existing concurrency test still passes; link/no-overwrite behavior unchanged. |
| AC-04 | QFAT data-directory leaf validated for directory type, ownership, symlink safety, and non-group/world-writable permissions | PASS | Focused tests for symlink, non-directory, wrong owner, group/world-writable, safe mode, creation. |
| AC-05 | Existing keys directory 0700 and key file 0600 checks remain enforced | PASS | Existing and regression tests pass. |
| AC-06 | Missing/corrupt key with existing credential records still fails closed without regeneration | PASS | Existing regression tests pass. |
| AC-07 | Credential encryption envelope, SQLite persistence, and provider contract unchanged | PASS | Diff/source review; no changes to envelope, schema, or provider interface. |
| AC-08 | No OAuth, account API/UI, real credentials, publishing, or unrelated feature changes | PASS | Diff review. |
| AC-09 | Documentation accurately records Linux-first sequence and Windows deferral | PASS | Documentation review. |
| AC-10 | Required backend tests, typecheck, build, and diff checks pass | PASS | Exact commands below. |

## Verification

Environment: Linux kernel 7.0.0-42-generic x86_64, Node.js `v24.22.2`,
npm `11.19.1`, `better-sqlite3@12.11.1`, `drizzle-orm@0.45.4`.

| Command / Check | Result | Notes |
|---|---|---|
| `cd apps/server && npm run typecheck` | PASS | `tsc --noEmit` completed with no errors. |
| `cd apps/server && npm test` | PASS | 155 tests, 155 pass, 0 fail, 0 skipped. |
| `cd apps/server && npm run build` | PASS | `tsc` emitted successfully. |
| `cd apps/web && npm run typecheck` | PASS | Both web TypeScript configurations passed. |
| `cd apps/web && npm run build` | PASS | Vite production build completed. |
| `git diff --check` | PASS | No whitespace errors. |
| Credential tests | PASS | 36 focused tests in `apps/server/test/credentials.test.ts`. |

Windows execution: **NOT RUN — DEFERRED UNTIL LINUX COMPLETION.** No Windows
host was available and no Windows ACL work was performed. The Windows
fail-closed behavior remains unchanged.

## Findings and limitations

1. The key-ownership check for the `keys` directory itself is structurally
   present but cannot be independently exercised as a separate code path from the
   data-directory ownership check in a non-root test environment because both
   use the same effective UID. The data-directory ownership test covers the
   ownership concept.
2. Actual Windows ACL behavior remains unverified and deferred.
3. No real credentials or external services were used.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `3de74770869309a5d6ef0d2d33ea482b51e17dd3`
- Follow-up fix commit: N/A
- Report update commit: Pending
- Push verification: Pending

## Handoff

The implementation and this report are ready for GPT/owner audit. This is not
owner acceptance.
EOF
echo done