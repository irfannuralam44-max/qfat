# Implementation Report — QFAT-016

- Status: PASS WITH FINDINGS
- Task specification: tasks/QFAT-016-linux-secret-service-isolation-validation.md
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Commit message: docs(QFAT-016): add Linux Secret Service isolation validation report
- Commit SHA: Pending

## Scope

Validation/spike only. No production source, package manifest/lockfile, schema, migration, OAuth, account, upload, or publishing code was changed. No real desktop keyring or QFAT credential/key material was accessed. All checks were local on Linux.

## Environment

- OS: Linux Mint 22.3 (Ubuntu 24.04 base), kernel 7.0.0-42-generic, x86_64
- Node.js: v24.22.2
- npm: 11.19.1
- D-Bus: 1.14.10
- GNOME Keyring: 46.1 (testing enabled)
- Xvfb: used for the disposable daemon unlock prompt
- Candidate package: `@napi-rs/keyring@2.1.2`
  - Installed only in `/tmp/qfat-lss-package` (outside repository)
  - npm license: MIT
  - npm shasum: `da11e544fa4dcade4c046aa60d0a7c4f2f0072e8`
  - npm integrity: `sha512-9i1SR6tYeQ3o1beLeVMxhN6Fq513m9TZlTs+46+4JgvSNkaFoW9S4WrpV5MjzE+0CzVoC+dZ4RfZDIgW6+afnQ==`
  - npm gitHead: `52184fbebffeef8a061234f60f313c479b954f9f`
  - Repository: `https://github.com/Brooooooklyn/keyring-node`

## Disposable environment setup

```bash
rm -rf /tmp/qfat-lss-runtime /tmp/qfat-lss-home/.local/share/keyrings
mkdir -p /tmp/qfat-lss-runtime /tmp/qfat-lss-home/.local/share/keyrings
chmod 700 /tmp/qfat-lss-runtime
Xvfb :99 -screen 0 1024x768x24 >/tmp/qfat-xvfb.log 2>&1 &
export DISPLAY=:99
HOME=/tmp/qfat-lss-home XDG_RUNTIME_DIR=/tmp/qfat-lss-runtime DBUS_SESSION_BUS_ADDRESS= DBUS_SYSTEM_BUS_ADDRESS= \
dbus-run-session -- bash -c '
  out=$(printf "<temporary-unlock-password>" | gnome-keyring-daemon --login --components=secrets --control-directory=/tmp/qfat-lss-runtime)
  eval "$out"
  sleep 1
  printf "<temporary-unlock-password>" | gnome-keyring-daemon --unlock --control-directory=/tmp/qfat-lss-runtime
  sleep 1
  export GNOME_KEYRING_CONTROL=/tmp/qfat-lss-runtime
  node /tmp/qfat-lss-validation/parent.mjs
'
```

The temporary unlock password was used only for the disposable daemon and is not a QFAT credential. The owner's normal keyring was not accessed: `HOME`, `XDG_RUNTIME_DIR`, D-Bus session, and GNOME Keyring control directory were all isolated under `/tmp`.

## Validation harness

Temporary files only (outside repository):
- `/tmp/qfat-lss-validation/parent.mjs`
- `/tmp/qfat-lss-validation/child.mjs`
- `/tmp/qfat-lss-observe.py`

The child process:
- imported `@napi-rs/keyring@2.1.2`;
- constructed every entry with `{ linux: { store: 'secret-service' } }`;
- performed store/retrieve/delete through JSON IPC over stdin/stdout;
- never logged secret bytes.

The parent:
- generated a synthetic 32-byte secret in memory;
- passed it only through the child IPC channel;
- enforced a 1000 ms timeout;
- terminated the deliberately hung child;
- remained responsive afterward.

## Acceptance criteria

| ID | Result | Evidence |
|---|---|---|
| AC-01 | PASS | Isolated `HOME`, `XDG_RUNTIME_DIR`, D-Bus session, and GNOME Keyring control directory under `/tmp`; no owner keyring access |
| AC-02 | PASS | `@napi-rs/keyring@2.1.2`; every entry pinned with `{ linux: { store: 'secret-service' } }`; unavailable backend test returned `GenericFailure` without keyutils fallback |
| AC-03 | PASS | Synthetic 32-byte secret stored, retrieved, and deleted; equality verified; absent after delete |
| AC-04 | PASS | Hung child terminated at 1000 ms; parent returned bounded `TIMEOUT`; parent then completed a normal operation |
| AC-05 | PASS (unavailable/locked state) | Without an unlocked login collection, the candidate returned `Secret Service: no result found` / `GenericFailure`; unavailable bus address returned connection failure. Locked-collection behavior was observed as an unavailable default collection, not a successful locked-state unlock flow |
| AC-06 | PASS (with limitation) | Direct observation: successful CRUD occurred in the unlocked `login` collection. Before validation: 0 items; after store/retrieve/delete: 0 items. The item was stored in the default/login collection because the candidate API exposes no collection selection |
| AC-07 | PASS | Child stdout/stderr byte counts were 0; harness output contained no secret value or base64 secret. Secret bytes were passed only through IPC |
| AC-08 | PASS | No repository source, manifest, lockfile, schema, migration, or production file changed |
| AC-09 | PASS | Direct observations, source-based inferences, limitations, and risks are separated below |
| AC-10 | PASS | All checks were local; exact commands and results are recorded; no hosted CI was used |

## Observed harness result

```text
PASS: store - {"ok":true}
PASS: retrieve - length=32
PASS: delete - {"ok":true,"deleted":true}
PASS: absent after delete - {"ok":true,"found":false,"length":0,"secretBase64":null}
PASS: first child exited - stderr_bytes=0
PASS: store in second child - {"ok":true}
PASS: persist across restart - length=32
PASS: delete after restart - {"ok":true,"deleted":true}
PASS: timeout returns bounded error - elapsed_ms=1000
PASS: timeout under limit - elapsed_ms=1000
PASS: parent responsive after timeout - {"ok":true,"found":false,"length":0,"secretBase64":null}
PASS: malformed IPC handled - {"ok":false,"code":"MALFORMED_IPC","message":"Child returned malformed JSON"}
PASS: unavailable backend fails closed - {"ok":false,"code":"GenericFailure","message":"Platform failure: DBus error: Failed to connect to socket /tmp/qfat-lss-nonexistent-bus: No such file or directory"}
PASS: no secret printed by harness - secret value not logged
HARNESS_RESULT=PASS failures=0
```

Collection observation:
- Before validation: 0 items in `/org/freedesktop/secrets/collection/login`
- After store/retrieve/delete: 0 items in `/org/freedesktop/secrets/collection/login`

## Direct observations

1. A separate child process can contain `@napi-rs/keyring@2.1.2` Secret Service operations.
2. Explicit `secret-service` pinning works and does not fall back to keyutils.
3. Synthetic 32-byte secret CRUD succeeds in an unlocked disposable `login` collection.
4. The secret persists across child-process restart in the same disposable session.
5. A deliberately hung child is terminated at the 1000 ms timeout; the parent remains responsive.
6. Malformed child IPC is converted into a bounded `MALFORMED_IPC` error.
7. An unavailable backend returns a bounded `GenericFailure` without fallback.
8. No secret bytes appeared in harness output, child stdout/stderr, command arguments, environment variables, or temporary files.
9. The candidate API exposes no collection selection. In this environment, successful CRUD used the unlocked `login` collection.

## Source-based inferences

1. The candidate's underlying Secret Service store requests the `login` collection. This was inferred from the failure path when that collection was unavailable.
2. The candidate's default auto-fallback would use keyutils if Secret Service construction fails. This is documented in the README and source.
3. A wedged D-Bus session can block constructor/setup synchronously, so process isolation remains necessary for QFAT.

## Limitations and remaining risks

1. The disposable daemon required an unlocked `login` collection. Without that setup, the candidate returns `Secret Service: no result found`.
2. This validation did not repeat Secret Service CRUD after a host reboot; it only proved persistence across child-process restart.
3. A locked collection was not exercised as a successful unlock flow. The unavailable state was tested by using an unset/locked default collection and a nonexistent bus address.
4. The package's collection behavior is fixed to the default/login collection. QFAT cannot select a dedicated collection through this API.
5. Native blocking remains a risk if child-process containment is bypassed or mishandled.
6. No production provider, migration, OAuth, account persistence, upload, or Windows work was performed.

## Recommendation

Process-isolated Linux Secret Service access using `@napi-rs/keyring@2.1.2` is **READY for a narrowly scoped implementation-design task**, subject to owner approval of the collection limitation and timeout strategy. It is not approved for production adoption by this report.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: Pending
- Follow-up fix commit: N/A
- Report update commit: Pending
- Push verification: Pending

## Handoff

This validation is ready for GPT/owner audit. It is not owner acceptance and does not authorize production provider implementation, migration, OAuth/account work, uploads, or Windows work.
