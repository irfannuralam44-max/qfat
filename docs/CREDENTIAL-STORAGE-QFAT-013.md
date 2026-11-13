# QFAT Credential Storage Foundation (QFAT-013)

> **ACTIVE WORKSTREAM: LINUX ONLY. WINDOWS IS ON HOLD AND NOT AUTHORIZED.**
>
> AI agents and contributors must not start, plan as the next task, dispatch, implement,
> or test Windows credential storage merely because a Windows task/specification exists
> in this repository. The Windows task is a parked future specification, not an active
> work order. Do not infer authorization from task numbering, task-file presence, or
> earlier draft wording.
>
> Windows can be considered only after the owner explicitly confirms that Linux is
> 100% complete, Linux verification and independent audit are finished, the Linux
> stage is formally accepted, and the owner gives a separate explicit authorization
> to begin Windows work. Until then, Windows must remain fail-closed and untouched.

- **Status:** Temporary Linux implementation under ADR-004; not an OS credential store
- **Platform sequence:** Linux only for now; Windows explicitly deferred and unauthorized until Linux is 100% complete, independently audited, formally accepted, and separately authorized by the owner
- **Scope:** Local encrypted credential persistence foundation only
- **Related:** `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`

## What this provides

The backend can persist an opaque credential payload in SQLite as AES-256-GCM
authenticated ciphertext. The encryption key is a separate local key file. The
implementation is behind `CredentialProvider`, so a later Linux Secret Service
(LSS) or Windows Credential Vault (WCV) provider can replace the key-file
provider without changing account-management business logic.

This foundation does **not** implement OAuth, account connection, account APIs,
Account Management UI, platform API calls, or publishing.

## Storage layout

The existing QFAT data-directory convention is used: `QFAT_DATA_DIR` when set,
otherwise `~/.qfat`.

| Platform | Database | Key file | Effective status |
|---|---|---|---|
| Linux | `~/.qfat/qfat.db` (or `$QFAT_DATA_DIR/qfat.db`) | `~/.qfat/keys/credential.key` (or `$QFAT_DATA_DIR/keys/credential.key`) | Implemented and tested with POSIX permissions |
| Windows | `%USERPROFILE%\\.qfat\\qfat.db` (or `%QFAT_DATA_DIR%\\qfat.db`) | `%USERPROFILE%\\.qfat\\keys\\credential.key` (or `%QFAT_DATA_DIR%\\keys\\credential.key`) | **DEFERRED — after Linux completion**; remains fail-closed; Windows ACL verification is not implemented/validated |

The key file is deliberately in a separate directory from the SQLite database.
It is not stored in SQLite, source code, Git, environment variables, logs, API
responses, or browser storage.

## Platform delivery order

Linux is the only active platform target. Windows work (including ACL implementation and execution on a Windows host) is not automatically next and must not start when Linux implementation and verification appear complete. It requires, in order: explicit owner confirmation that Linux is 100% complete, completion of independent audit, formal owner acceptance of the Linux stage, and a separate explicit owner authorization for Windows. Until then, Windows remains unsupported by this provider and fails closed. The Windows task file is a parked specification only, not permission to execute.

## Key-file lifecycle and safety

1. On Linux, the QFAT data-directory path, `keys` directory, and key file are
   validated before use. The trust boundary is the QFAT data-directory leaf
   itself: it must be a real directory owned by the effective user and not
   group/world writable. Ancestors such as `/` or `/home` are intentionally not
   validated because those checks would be impractical and are outside QFAT's
   control. When QFAT creates the data directory, it uses owner-only mode
   `0700`; an existing data directory is accepted when it is not group/world
   writable, even if it is group/world readable or executable. The `keys`
   directory is owner-only (`0700`) and the key file is owner read/write only
   (`0600`). Symlink and unsafe ownership/permission states fail closed.
2. A key is 32 cryptographically random bytes from `node:crypto`.
3. First-time creation writes and syncs a temporary file with exclusive
   creation, then publishes it with a no-overwrite hard link. The containing
   `keys` directory must also be fsynced after publication before the provider
   can return the new key. A directory-sync failure fails closed; it must never
   be treated as successful key initialization, and the published key is not
   deleted merely because synchronization failed. `link()` fails with `EEXIST`
   instead of replacing an existing key, so concurrent first starts converge
   on one key.
4. Every key return path synchronizes the containing `keys` directory before
   returning key bytes: an already existing key, a newly created key, a loser of
   the creation race (`EEXIST`), and any retry after another process published
   the key. This closes the race where a competing process could observe a
   published key before the creator's directory fsync completed.
4. A missing key with no encrypted records is the only case that creates a key.
5. A missing, malformed, truncated, unreadable, symlinked, non-regular, or
   unsafe-permission key fails closed. It is never silently regenerated when
   credential records may exist.
6. The key is cached in the running provider process after a successful load.
   The key is never exposed by the provider interface.

## Envelope format

Each row in `credential_records` stores:

- envelope version (`1`),
- 12-byte nonce,
- 16-byte authentication tag,
- ciphertext,
- non-secret record context (`id`, `purpose`, `provider`) and timestamps.

AES-256-GCM AAD is derived from the envelope version, record ID, purpose, and
provider discriminator. A ciphertext copied to another record or purpose fails
authentication. Envelope shape and lengths are validated before decryption.
Authentication failures return no partial plaintext.

## Startup and failure behavior

- On Windows, constructing `KeyFileCredentialProvider` throws
  `WINDOWS_ACL_UNVERIFIED` before any key is created or read. Windows work is
  deferred until all Linux work is complete; the provider does not claim Windows
  support based on POSIX `chmod`.
- On Linux, the provider constructor checks platform support. Key loading and
  permission verification happen on the first operation that needs the key.
- If encrypted records exist and the key file is missing or invalid, the
  operation throws a typed `CredentialStorageError` (`KEY_MISSING_WITH_RECORDS`
  or `KEY_INVALID`). Account-management startup must treat this as fatal and
  must not continue with a replacement key.
- Error messages are actionable but do not include key bytes, plaintext,
  ciphertext, or absolute filesystem paths.

## Backup and restore

The SQLite database and key file are **separately stored but jointly required**
artifacts.

- Back up the database (including WAL sidecars when live) and the key file.
- Restore the key file to the owner-only key directory with mode `0600`; the
  directory must be owner-only (`0700`).
- Losing the key makes existing encrypted credential values unrecoverable.
- Restoring a different key causes authentication failure; QFAT does not
  replace the key automatically.
- Do not copy only the database and assume credentials are recoverable.

## Threat model and limitations

This protects credential values in a copied or exposed SQLite database when the
separate key file is not also compromised.

It does **not** protect against:

- malware or an attacker who can read both the QFAT data directory and key file,
- compromise of the logged-in OS user,
- inspection of a running QFAT process or its memory,
- a compromised backend process,
- whole-database compromise that includes the key file.

It is **not** whole-database encryption, not SQLCipher, and not equivalent to
LSS/WCV. Non-secret account metadata and other SQLite records remain plaintext
under their existing data-protection requirements. SQLite deletion removes the
logical row but is not a claim of secure physical erasure from SQLite/WAL.

Additional limitations:

- POSIX mode bits do not establish Windows ACL protection.
- Windows ACL verification is **DEFERRED — NOT RUN** until all Linux work is
  complete; Windows provider construction remains fail-closed.
- A crash can leave an ignored `.tmp` file in the key directory; the final key
  path is only published after a complete, synced write.
- The provider does not implement key rotation, LSS/WCV migration, or a password
  prompt.

## Verification

Focused automated tests use synthetic dummy credentials and isolated temporary
directories/databases. They cover round trip, plaintext absence in SQLite and
database files, fresh nonces, ciphertext/nonce/tag/wrong-key/AAD tampering,
envelope validation, missing/corrupt/truncated/unreadable keys, missing key with
existing records, repeated and concurrent initialization, symlink/non-regular
paths, POSIX permissions and ownership, Windows fail-closed behavior, and error
hygiene.

Actual Windows ACL execution is **DEFERRED — NOT RUN** until all Linux work is
complete. Linux POSIX behavior is tested on the repository's Linux environment;
it is not evidence of Windows ACL support.


## Owner direction — Linux MVP (2026-11-13)

The owner selected the lightweight Linux-first direction for MVP:

- Use the Secret Service implementation already available on the owner's Linux Mint machine (GNOME Keyring).
- `@napi-rs/keyring` is the preferred **conditional candidate**, not an unconditional production dependency. Pin the explicit `secret-service` backend; do not allow keyutils fallback.
- Use the Linux default collection after verifying actual storage and persistence behavior. Do not build custom collection management for MVP.
- When the keyring is locked/unavailable, instruct the user to unlock it through Linux and retry; fail closed. Never fall back to plaintext, keyutils, or the old key file after cutover.
- Test and mitigate the candidate's D-Bus blocking risk before production integration. If it cannot be made safe, stop and present the smallest alternative for an owner decision.
- Keep the existing AES-256-GCM envelope and SQLite ciphertext format. Migration from the current key-file provider is explicit and separately verified; do not automatically move or delete real key material.
- Windows credential storage remains deferred.

This direction favors using the facilities of the owner's Linux environment rather than implementing a new keyring backend. It does not authorize dependency installation, production wiring, migration, or key-file retirement by itself; those require a narrowly scoped task and the normal owner acceptance gate.
