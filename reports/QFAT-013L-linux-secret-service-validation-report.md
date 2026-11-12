# Implementation Report — QFAT-013L

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-013L-linux-secret-service-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Commit message:** `docs(QFAT-013L): add Linux Secret Service feasibility validation report`
- **Commit SHA:** `f23d57b970c271f86c9f50894e2e24402a9e130a`

## Scope

Investigation only. No QFAT production source, package manifest, lockfile, database,
key file, credential record, or user credential data was changed. No Windows work
was performed.

## 1. Linux host environment

Sanitized environment details:

- Distribution: Linux Mint 22.3 (Zena), ID_LIKE ubuntu/debian
- Kernel: Linux 7.0.0-42-generic
- Architecture: x86_64
- Node.js: v24.22.2
- npm: 11.19.1
- Session type: SSH login (`SSH_CLIENT` present), TTY, no `XDG_CURRENT_DESKTOP`
- D-Bus session bus: available at `unix:path=/run/user/1000/bus`
- Secret Service implementation: GNOME Keyring 46.1 daemon is installed and active
  for the user session; `org.freedesktop.secrets` is present on the session bus
- Keyring collections observed:
  - `/org/freedesktop/secrets/collection/session` — `Locked=false`
  - `/org/freedesktop/secrets/collection/login` — `Locked=true`
- No `secret-tool` CLI installed; `gnome-keyring-daemon` present

Relevant inspection commands and results:

```text
uname -a
Linux irfan-A10N-8800E 7.0.0-42-generic ... x86_64

cat /etc/os-release
Linux Mint 22.3 (Zena)

node --version
v24.22.2

npm --version
11.19.1

echo "$DBUS_SESSION_BUS_ADDRESS"
unix:path=/run/user/1000/bus

busctl --user get-property org.freedesktop.secrets /org/freedesktop/secrets/collection/login org.freedesktop.Secret.Collection Locked
b true

busctl --user get-property org.freedesktop.secrets /org/freedesktop/secrets/collection/session org.freedesktop.Secret.Collection Locked
b false
```

No system keyring configuration, unlock operation, daemon restart, or desktop
session change was performed.

## 2. Candidate library evaluation

Candidate: `@napi-rs/keyring` version `2.1.2`.

Sources:
- npm package metadata and README, accessed 2026-11-12:
  https://www.npmjs.com/package/@napi-rs/keyring
- Repository: https://github.com/Brooooooklyn/keyring-node
- Installed package README and TypeScript declarations in the isolated spike
  workspace (see Section 3)

Findings:

- Node support: package declares `engines.node >= 10`; tested with Node v24.22.2.
- Linux architecture support: prebuilt optional package for
  `linux-x64-gnu` was installed successfully; optional dependencies cover
  arm64, musl, riscv64, and other targets.
- No native build step was required in the spike; a prebuilt `.node` binary was
  used.
- API:
  - `new Entry(service, account, options?)`
  - `Entry.withTarget(target, service, account, options?)`
  - `setPassword`, `setSecret`, `getPassword`, `getSecret`,
    `deleteCredential`/`deletePassword`
  - Async variants exist (`AsyncEntry`)
- Linux backend selection:
  - Default behavior tries Secret Service first and silently falls back to the
    kernel keyutils keyring if no Secret Service is available.
  - The options bag supports
    `{ linux: { store: 'secret-service' | 'keyutils' } }`.
  - Requiring a store makes the constructor throw if that store is unavailable;
    there is no silent fallback in that mode.
- Error behavior observed:
  - Missing/unreachable D-Bus socket: `GenericFailure`,
    `DBus error: Failed to connect to socket ...: No such file or directory`
  - Locked Secret Service collection / dismissed unlock prompt:
    `GenericFailure`, `Couldn't access platform storage: Secret Service: unlock prompt was dismissed`
  - Unavailable keyutils store: `GenericFailure`, `Couldn't access platform storage: KeyRevoked`
- Secret values are passed as strings or `Uint8Array`/`Buffer`; the API does not
  require logging values. Error messages observed did not include the dummy
  secret.
- Native/packaging risks:
  - Prebuilt binaries with optional platform packages.
  - Linux binaries statically link `libdbus`, licensed under
    `AFL-2.1 OR GPL-2.0-or-later`; the package license is MIT.
  - A future production dependency would require license review and supply-chain
    review.
  - The keyutils fallback is in-memory and does not persist across reboot, so it
    must never be accepted as a credential backend.

Conclusion: the candidate can explicitly require Secret Service, which is
mandatory for QFAT. It cannot be safely used with default auto-fallback.

## 3. Isolated feasibility spike

The spike was created in `/tmp/opencode/lss-spike`, outside the QFAT repository
and outside the tracked dependency graph. The candidate package was installed
only in that temporary workspace. No QFAT file was modified.

Synthetic dummy value used in tests: a fixed non-sensitive string. The value
was never printed; only SHA-256 hashes and boolean equality were recorded.

### Executed tests

1. Missing/unreachable D-Bus session bus with required Secret Service store:
   - Command: `DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/opencode/nonexistent-bus node ...`
   - Result: constructor threw `GenericFailure` /
     `DBus error: Failed to connect to socket ...: No such file or directory`
   - Status: PASS (fail-closed behavior characterized)

2. Required Secret Service store with the actual locked login collection:
   - Result: `setSecret` threw `GenericFailure` /
     `Couldn't access platform storage: Secret Service: unlock prompt was dismissed`
   - Status: PASS (locked/unavailable collection fails closed)

3. Default auto-fallback store with the actual locked Secret Service:
   - Result: `setSecret` threw the same Secret Service unlock error instead of
     silently using keyutils
   - Status: PASS (no silent fallback in this host state)

4. Required keyutils store:
   - Result: constructor threw `GenericFailure` / `KeyRevoked`
   - Status: PASS (keyutils is unavailable in this environment; not a viable
     fallback)

5. Absent-entry read with required Secret Service:
   - `getPassword()` returned `null`
   - Status: PASS

### NOT RUN tests

The following were NOT RUN because the only writable Secret Service collection
(`login`) is locked and the task prohibits unlocking, enabling, or reconfiguring
system keyring services:

- Set/get/update/delete with synthetic data against a writable Secret Service
  collection.
- Retrieval after process restart.
- Locked-collection transition testing beyond the observed unlock-prompt
  dismissal.
- Concurrent access behavior.
- Cleanup verification of a disposable Secret Service entry.

Reason: unlocking the login collection would modify host keyring state and is
explicitly prohibited by the task. The session collection is unlocked, but the
candidate library does not allow selecting a specific collection, so a safe
isolated write through the candidate API could not be performed without changing
system state or bypassing the library.

No Secret Service entry was created, and no cleanup was required.

## 4. Architecture and migration assessment

A future Linux Secret Service provider could implement the existing
`CredentialProvider` contract without changing account-management business
logic:

- `store(context, payload)` would serialize the opaque payload and call
  `setSecret` with a stable service/account identifier derived from the
  internal record ID and provider discriminator.
- `retrieve(context)` would call `getSecret` and return the exact bytes.
- `delete(context)` would call `deleteCredential`.

Required future decisions:

- Secret Service collection selection is not exposed by the candidate library;
  QFAT would need to decide whether the default collection behavior is
  acceptable or whether a direct D-Bus implementation is required.
- A migration from the temporary key-file provider must:
  1. Read and decrypt using the existing provider.
  2. Write the equivalent payload to Secret Service.
  3. Read back and compare exact bytes without logging values.
  4. Record migration state before deleting old material.
  5. Retry safely on interruption.
  6. Preserve rollback by retaining the old encrypted SQLite row and key file
     until migration is confirmed.
- Partial migration must not leave ambiguous active sources; a migration state
  record and idempotent retry are required.
- Backup/restore must account for OS keyring data, which is outside QFAT's
  filesystem backup.
- Fail-closed behavior must treat any Secret Service read/write/delete error as
  a hard failure, with typed diagnostics that do not leak paths, SIDs, or
  secret values.

## 5. Findings and limitations

1. Secret Service is installed and activatable on this host, but the default
   `login` collection is locked. Writes through the candidate fail closed with a
   typed error.
2. The candidate can be pinned to Secret Service, preventing silent fallback.
3. Default auto-fallback is unsafe for QFAT because it can select keyutils,
   whose storage is in-memory and non-persistent. Any production use must require
   `secret-service`.
4. Keyutils is unavailable in this environment (`KeyRevoked`), so it cannot be
   used as a fallback even if desired.
5. The candidate's error messages are actionable but are string-based; a
   production wrapper must map them to typed QFAT errors without leaking details.
6. The candidate adds a native binary and a GPL/AFL-licensed statically linked
   D-Bus library; license and supply-chain review is required before adoption.
7. This investigation does not establish writable Secret Service behavior,
   process-restart persistence, concurrency, or performance.
8. Windows remains deferred and was not inspected.

## 6. Recommendation

Do not migrate to Linux Secret Service yet. The candidate is promising because it
supports explicit Secret Service selection and fails closed when unavailable,
but the writable-collection behavior and restart persistence could not be
verified on this host due to the locked login collection. A separate owner
decision is required before any production integration or migration task.

Recommended next step: perform the same isolated spike on a Linux host with an
unlocked Secret Service collection, or define and test a controlled collection
unlock procedure that does not weaken security. Only after that should a
production provider implementation be authorized.

## Acceptance criteria status

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Linux host/session prerequisites recorded | PASS | Section 1 |
| AC-02 | Candidate API/support/native requirements evaluated | PASS | Section 2 and npm source |
| AC-03 | Explicit Secret Service selection possible | PASS | README/API and required-store tests |
| AC-04 | No silent keyutils fallback | PASS | Required-store and default-store tests |
| AC-05 | Set/get/update/delete and restart persistence | NOT RUN | Locked login collection; no unlock performed |
| AC-06 | Missing bus/daemon/locked/failure behavior characterized | PASS/PARTIAL | Missing bus and locked collection tested |
| AC-07 | Errors support fail-closed without leaking secrets | PASS | Error mapping review and sanitized tests |
| AC-08 | No tracked QFAT source/dependency/database/key/credential changed | PASS | `git status` clean before report |
| AC-09 | Future provider/migration risks documented | PASS | Section 4 |
| AC-10 | Report complete and distinguishes PASS/FAIL/NOT RUN | PASS | This report |
| AC-11 | Windows/OAuth/real credentials untouched | PASS | Scope review |

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `f23d57b970c271f86c9f50894e2e24402a9e130a`
- Follow-up fix commit: N/A
- Report update commit: `a8bfd665990aaa785b8b17a70a0b7031963a3199`
- Push verification: PASS (report and metadata commit verified on origin/main)

## Handoff

This investigation is ready for GPT/owner audit. It is not owner acceptance and
does not authorize production LSS integration or migration.
EOF
echo done

## GPT Post-Publication Audit — 2026-11-12

- Remote report presence and branch publication were verified on `main`; the latest verified branch HEAD at audit start was `a8bfd665990aaa785b8b17a70a0b7031963a3199`.
- The candidate's documented Linux backend behavior was cross-checked against the package's published README: default selection may fall back to kernel keyutils; explicit `{ linux: { store: 'secret-service' } }` pins Secret Service and fails if unavailable. The README also documents keyutils as in-memory and non-persistent across reboots.
- The report's NOT RUN status for writable CRUD and process-restart persistence is material. This audit does not treat AC-05 as demonstrated and does not authorize adoption or migration.
- Host-specific spike execution and the reported runtime errors were not independently reproduced by GPT; those remain agent-reported evidence.
- Audit disposition: **PASS WITH FINDINGS for the bounded investigation only; NOT READY for production LSS adoption**.
- Required follow-up before any implementation decision: obtain safe, controlled evidence for Secret Service set/get/update/delete and process-restart persistence on a writable collection, without modifying the owner's normal keyring or weakening host security.
