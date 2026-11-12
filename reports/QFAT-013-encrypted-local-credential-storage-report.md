# Implementation Report — QFAT-013

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-013-encrypted-local-credential-storage.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Commit message:** `feat(QFAT-013): add encrypted local credential storage foundation`
- **Commit SHA:** `972e490574709c71f54215c8098a46fc157a4911`

## Scope

Implemented the temporary ADR-004 credential persistence foundation only:

- A typed `CredentialProvider` abstraction with store, retrieve, and delete operations.
- A local key-file-backed provider using AES-256-GCM through `node:crypto`.
- A minimal `credential_records` SQLite table and Drizzle migration.
- A separate key file under the existing QFAT data-directory convention.
- Linux POSIX permission/ownership verification, symlink/non-regular rejection, and fail-closed key handling.
- Windows fail-closed behavior because Windows ACL verification was not implemented or executed in this task.
- Focused offline tests using only synthetic dummy credentials.
- Threat-model, key-location, startup-failure, and backup/restore documentation.

No OAuth, real account connection, account HTTP API, Account Management UI, platform API call, upload, publishing, frontend credential exposure, LSS/WCV integration, or PRD change was introduced.

## Implementation

### Provider contract

`CredentialProvider` in `apps/server/src/credentials/provider.ts` exposes:

```ts
store(context: CredentialContext, payload: Buffer): Promise<void>
retrieve(context: CredentialContext): Promise<Buffer | null>
delete(context: CredentialContext): Promise<boolean>
```

`CredentialContext` is `{ id, purpose, provider }`. The ID is an internal record
identifier. Callers never receive key material or envelope internals.

### Encryption envelope

`apps/server/src/credentials/envelope.ts` implements:

- AES-256-GCM (`aes-256-gcm`).
- 32-byte key, 12-byte nonce generated with `randomBytes` for every encryption,
  and 16-byte authentication tag.
- Envelope version `1` persisted in SQLite.
- Canonical AAD built from the envelope version, record ID, purpose, and
  provider discriminator. Context fields reject NUL bytes.
- Envelope shape and length validation before decryption.
- Generic `DECRYPT_FAILED` errors with no partial plaintext, key bytes,
  ciphertext, or authentication details.

### SQLite persistence

`credential_records` stores `id`, `purpose`, `provider`,
`envelope_version`, `nonce` BLOB, `auth_tag` BLOB, `ciphertext` BLOB,
`created_at`, and `updated_at`. Store and delete operations use SQLite
transactions. Context reuse with a different purpose/provider is rejected.

### Key-file lifecycle

`apps/server/src/credentials/key-file.ts`:

- Derives the key path from `getCredentialKeyPath()`:
  `$QFAT_DATA_DIR/keys/credential.key` or `~/.qfat/keys/credential.key`.
- Creates the key directory with `0700` and the key file with `0600`.
- Verifies directory/file ownership and permission bits on Linux.
- Rejects symlinked or non-regular key paths.
- Generates the first key only when no encrypted records exist.
- Never regenerates a missing, malformed, truncated, unreadable, or
  wrong-permission key when encrypted records may exist.
- Writes a fully synced exclusive temporary file, then publishes it with
  `link()`, which fails with `EEXIST` instead of replacing an existing key.
  Concurrent first-time initialization therefore converges on one key.
- Fails provider construction on Windows with `WINDOWS_ACL_UNVERIFIED`; actual
  Windows ACL behavior is not claimed.

### Documentation

`docs/CREDENTIAL-STORAGE-QFAT-013.md` documents the threat model, Linux/Windows
paths, permissions, startup failure behavior, backup/restore dependency,
limitations, and the distinction from LSS/WCV and whole-database encryption.
`apps/server/README.md` links to it.

## Files Changed

| Path | Purpose |
|---|---|
| `apps/server/src/config.ts` | Added key-directory and key-file path derivation. |
| `apps/server/src/schema/index.ts` | Added `credential_records` schema and types. |
| `apps/server/migrations/0003_quiet_kabuki.sql` | Added the credential-record table. |
| `apps/server/migrations/meta/0003_snapshot.json` | Drizzle migration snapshot. |
| `apps/server/migrations/meta/_journal.json` | Recorded migration 0003. |
| `apps/server/src/credentials/errors.ts` | Typed credential-storage errors. |
| `apps/server/src/credentials/envelope.ts` | AES-256-GCM envelope, AAD, validation, and decryption. |
| `apps/server/src/credentials/key-file.ts` | Key generation/loading, exclusive creation, permissions, symlink checks. |
| `apps/server/src/credentials/provider.ts` | `CredentialProvider` contract and key-file implementation. |
| `apps/server/src/credentials/index.ts` | Credential module exports. |
| `apps/server/test/credentials.test.ts` | Focused credential, envelope, key-file, and error-hygiene tests. |
| `apps/server/test/connection.test.ts` | Updated migration-count and table assertions for migration 0003. |
| `apps/server/README.md` | Credential-storage location/status summary. |
| `docs/CREDENTIAL-STORAGE-QFAT-013.md` | Threat model, limitations, key locations, backup/restore. |
| `reports/QFAT-013-encrypted-local-credential-storage-report.md` | This report. |

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 — `CredentialProvider` abstraction and key-file implementation exist | PASS | Source inspection; provider round-trip and key-file tests. |
| AC-02 — Credential values are encrypted before SQLite persistence | PASS | Test checks every persisted row value plus the database, WAL, and SHM files for the raw dummy token; token is absent. |
| AC-03 — AES-256-GCM envelope uses fresh nonce, tag, version, and context-bound AAD | PASS | Crypto tests assert version 1, 12-byte nonce, 16-byte tag, distinct nonces/ciphertext, and distinct AAD per context. |
| AC-04 — Correct key/context decrypts the exact original dummy payload | PASS | Provider and direct envelope round-trip tests compare exact bytes. |
| AC-05 — Tampered ciphertext, nonce, tag, wrong key, or mismatched AAD fails closed | PASS | Negative tests assert `DECRYPT_FAILED`; invalid version/lengths assert `ENVELOPE_INVALID`; no plaintext is returned. |
| AC-06 — Key is generated once and stored separately from SQLite | PASS | Key-path test proves a separate `keys/` directory; repeated initialization preserves identical key bytes; default path test verifies the convention. |
| AC-07 — Existing key is never overwritten or silently regenerated | PASS | Repeated initialization and concurrent two-process initialization preserve one key; missing/corrupt key with records fails closed and is not recreated. |
| AC-08 — POSIX key directory/file permissions are restrictive and verified | PASS | Linux tests assert `0700` directory and `0600` file; unsafe directory/file modes and ownership mismatch fail closed. |
| AC-09 — Windows ACL restrictions verified, or Windows provider fails closed with documented limitation | PASS (fail-closed branch) | Provider construction with `platform: 'win32'` throws `WINDOWS_ACL_UNVERIFIED`; no key is created. Actual Windows ACL execution is **NOT RUN** (no Windows host in this environment) and is documented. |
| AC-10 — No plaintext fallback, machine-ID key, hardcoded key, or secret logging | PASS | Source review and grep found no fallback/machine-ID/hardcoded-key/logging path; negative tests assert error messages omit token, key, and ciphertext bytes. |
| AC-11 — No OAuth, real account connection, publishing, or frontend secret exposure | PASS | Diff contains only backend credential foundation, migration, tests, and documentation; no routes or frontend files changed. |
| AC-12 — Existing tests and required project checks remain green | PASS | Backend typecheck/test/build, frontend typecheck/build, and `git diff --check` passed. |

## Verification

Environment: Linux Mint/Ubuntu kernel 7.0.0-42-generic x86_64, Node.js
`v24.22.2`, npm `11.19.1`, `better-sqlite3@12.11.1`, `drizzle-orm@0.45.4`.
All tests use isolated temporary directories/databases and synthetic dummy
credentials. No network calls and no real credentials were used.

| Command / Check | Result | Notes |
|---|---|---|
| `cd apps/server && npm run typecheck` | PASS | `tsc --noEmit` completed with no errors. |
| `cd apps/server && npm test` | PASS | 145 tests, 145 pass, 0 fail, 0 skipped. |
| `cd apps/server && npm run build` | PASS | `tsc` emitted successfully. |
| `cd apps/web && npm run typecheck` | PASS | Both web TypeScript configurations passed. |
| `cd apps/web && npm run build` | PASS | Vite production build completed. |
| `git diff --check` | PASS | No whitespace errors. |
| `cd apps/server && npm run db:generate` | PASS | Generated `0003_quiet_kabuki.sql` and snapshot. |
| Credential tests | PASS | 26 focused tests in `apps/server/test/credentials.test.ts`. |
| `grep -R` fallback/logging review | PASS | No `QFAT_ALLOW_INSECURE`, machine-ID key, hardcoded key, or credential logging in the new module. |
| `find` for generated key files in the repository | PASS | No `credential.key` or generated key file present. |
| `npm run lint` | NOT RUN | The repository has no lint script. |
| Windows ACL execution | NOT RUN | No Windows host available; Windows provider construction fails closed and is not claimed as verified. |
| `npm audit --omit=dev` | NOT RUN | No dependency changes in this task; the existing dependency-audit gate is unchanged. |

Focused tests cover:

- default key path convention and separation from the database,
- store/retrieve/delete round trip,
- raw dummy token absent from SQLite rows, database, WAL, and SHM bytes,
- fresh nonce and ciphertext for repeated encryption,
- ciphertext, nonce, tag, wrong-key, and mismatched-AAD tampering,
- invalid envelope version/nonce/tag/key lengths and invalid context/payload,
- missing key with no records versus missing key with existing records,
- corrupt, truncated, wrong-length, and unreadable/insecure key files,
- repeated and concurrent two-process first-time initialization,
- symlinked key file and symlinked key directory rejection,
- non-regular key path rejection,
- POSIX directory/file permissions and ownership mismatch,
- Windows fail-closed construction,
- context-mismatch store/retrieve/delete without data loss,
- error messages excluding plaintext, key, and ciphertext bytes.

## Manual / API Evidence

- No HTTP API or frontend contract was added or changed.
- The default key path was asserted as
  `resolve(getKeyDir(), 'credential.key')`, i.e. a `keys/credential.key` file
  under the QFAT data directory, separate from `qfat.db`.
- A two-process test with a start barrier confirmed both first-time initializers
  converge on the same 32-byte key file with `0600` permissions.
- The concurrent test used a temporary TypeScript fixture and the repository's
  installed `tsx` CLI; it did not contact any external service.

## Findings and Limitations

1. **Windows ACL verification is NOT RUN/UNVERIFIED.** The provider fails closed
   at construction with `WINDOWS_ACL_UNVERIFIED`, and no key is created. This
   satisfies the task's fail-closed branch but does not establish Windows
   credential-storage readiness. Actual Windows ACL validation remains required
   before claiming cross-platform support.
2. **macOS and other non-Linux POSIX platforms are not supported** by this
   provider build; they fail with `UNSUPPORTED_PLATFORM`.
3. The provider is intentionally not wired into `buildServer` or any HTTP route.
   Account-management startup must instantiate it and treat
   `KEY_MISSING_WITH_RECORDS`, `KEY_INVALID`, `KEY_PERMISSIONS_UNSAFE`, and
   `WINDOWS_ACL_UNVERIFIED` as fatal.
4. The key is cached in the running provider process after a successful load.
   This is normal process memory exposure and is not protected against a
   compromised process or same-user attacker.
5. A hard crash during first-time key creation can leave an ignored temporary
   file in the key directory. The final `credential.key` path is only published
   after a complete, synced write, so a partial file is not treated as a valid
   key.
6. Deleting a credential record removes the logical SQLite row but is not a
   claim of secure physical erasure from SQLite or WAL.
7. This is not whole-database encryption, not SQLCipher, and not equivalent to
   LSS/WCV. Non-secret account metadata and other SQLite data remain plaintext.
8. No real credentials, OAuth flows, account connections, platform API calls,
   uploads, or publishing were performed.
9. No lint command exists in the repository; no lint result is claimed.
10. Windows execution, browser behavior, and frontend integration were not
    exercised because this task does not add or change them.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `972e490574709c71f54215c8098a46fc157a4911`
- Follow-up fix commit: N/A
- Report update commit: `bdb82e6182ffb9d93cbe3273abb29003cc925a1e`
- Push verification: `origin/main` confirmed at `bdb82e6182ffb9d93cbe3273abb29003cc925a1e` via `git ls-remote origin main` after push; report file present on the remote branch.

## Handoff

The implementation and this report are ready for GPT/owner audit. This is not
owner acceptance. Account Management, real OAuth, and publishing remain gated on
that audit and explicit owner approval.
