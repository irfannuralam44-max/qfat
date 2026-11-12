# Implementation Report — QFAT-013L2

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-013L2-linux-secret-service-crud-persistence-validation.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Commit message:** `docs(QFAT-013L2): add isolated Secret Service CRUD and persistence validation report`
- **Commit SHA:** `0ea316e05efb6f54846b11824ac59a16bb19b2f2`

## Scope

Investigation only. No QFAT production source, package manifest, lockfile, database,
key file, credential record, or user credential data was changed. No Windows work
was performed. No production LSS provider or migration was implemented.

## 1. Isolation proof

A genuinely isolated Secret Service environment was created and destroyed for this
task. It did not use the owner's normal `login` or `session` collections.

Isolation method:
- Temporary home directory: `/tmp/opencode/lss-iso/home`
- Temporary runtime directory: `/tmp/opencode/lss-iso/run` (mode 0700)
- A dedicated D-Bus session bus on
  `unix:path=/tmp/opencode/lss-iso/run/bus`
- A dedicated GNOME Keyring daemon started with `--login` and an isolated
  keyring under the temporary home
- A known non-production password was supplied only to the disposable daemon
  through stdin; it was not written to any QFAT file or report
- All test entries used the unique service namespace `qfat-lss-iso-*`

Proof of isolation:
- The dedicated bus socket was under the temporary runtime directory, not
  `/run/user/1000/bus`.
- The disposable daemon was started and stopped within the test commands.
- Candidate operations used `DBUS_SESSION_BUS_ADDRESS` pointing only to the
  temporary bus.
- The owner's normal daemon at `/run/user/1000` was not restarted or modified.
- The temporary home, runtime directory, bus, and keyring files were deleted
  after verification.

Cleanup verification:
- `/tmp/opencode/lss-iso` was removed after testing.
- `ls /tmp/opencode/lss-iso` returned "No such file or directory".
- Disposable Secret Service entries were deleted before environment destruction.

## 2. Environment and package details

- Distribution: Linux Mint 22.3 (Zena)
- Kernel: Linux 7.0.0-42-generic
- Architecture: x86_64
- Node.js: v24.22.2
- npm: 11.19.1
- Session type: SSH/TUI, no desktop session
- Secret Service implementation: GNOME Keyring 46.1
- Candidate package: `@napi-rs/keyring` version `2.1.2`
- Native binary loaded: `@napi-rs/keyring-linux-x64-gnu` (prebuilt `.node`)
- Backend selection in all candidate tests:
  `{ linux: { store: 'secret-service' } }`

Sources:
- Package metadata and README, accessed 2026-11-12:
  https://www.npmjs.com/package/@napi-rs/keyring
- Repository: https://github.com/Brooooooklyn/keyring-node
- Installed package README and TypeScript declarations in the isolated spike
  workspace

## 3. Candidate CRUD validation

All operations used the explicit `secret-service` backend and synthetic values.
Secret values were not printed; only SHA-256 hashes and boolean equality were
recorded.

Executed test: store, retrieve, update, delete, and absence verification.

Sanitized output:

```text
{"step":"constructed","backend":"secret-service-required"}
{"step":"set","ok":true}
{"step":"get1","present":true,"hashMatch":true,"len":35}
{"step":"update","ok":true}
{"step":"get2","present":true,"newMatch":true,"oldMatch":false,"len":35}
{"step":"delete","deleted":true}
{"step":"get3","present":false}
{"step":"done"}
```

Result: PASS.

## 4. Process-restart persistence

A synthetic value was stored in one Node.js process, that process exited, and a
separate Node.js process retrieved it in the same isolated Secret Service
session.

Sanitized output:

```text
process 1: {"step":"set","ok":true,"hash":"4dc623ff180d2f6a772aa6cb099d7dbf4ba21f672c32a408f4df1df89bbc9729"}
process 2: {"step":"get","present":true,"hash":"4dc623ff180d2f6a772aa6cb099d7dbf4ba21f672c32a408f4df1df89bbc9729","len":40}
```

The retrieved hash exactly matched the stored hash. Result: PASS.

## 5. Daemon restart persistence

The disposable daemon was stopped and restarted with the same keyring password.
A previously stored value was retrieved successfully by a new process.

Sanitized output:

```text
store: {"step":"set","ok":true,"hash":"3a1eeb5bb497b24abee6e959202577feb543fd1c428a6c3ecdef4e97b4cb911e"}
retrieve: {"step":"get","present":true,"hash":"3a1eeb5bb497b24abee6e959202577feb543fd1c428a6c3ecdef4e97b4cb911e","len":46}
cleanup: {"deleted":true,"absent":true}
```

Result: PASS. This proves persistence across daemon restart in the isolated
environment; it does not by itself prove persistence across host reboot.

## 6. Fail-closed and fallback negative tests

### 6.1 Unavailable Secret Service endpoint

With `DBUS_SESSION_BUS_ADDRESS` pointing to a nonexistent socket and the backend
explicitly pinned to `secret-service`:

Sanitized output:

```text
constructor error code: GenericFailure
constructor error message: Platform failure: DBus error: Failed to connect to socket /tmp/opencode/nonexistent-bus: No such file or directory
```

Result: PASS (fail-closed; no successful storage occurred).

### 6.2 Keyutils fallback unavailability

With the backend explicitly pinned to `keyutils` in the isolated environment:

Sanitized output:

```text
keyutils constructor error: GenericFailure | Couldn't access platform storage: KeyRevoked
```

Result: PASS (keyutils is unavailable in this environment and cannot be used as
a fallback).

## 7. Collection/default-collection limitation

The candidate library does not expose collection selection. In the isolated
environment, a `login` collection had to be created and unlocked through the
disposable daemon before candidate operations succeeded. This confirms that
default collection behavior remains a deployment and operability limitation for
a future QFAT provider.

## 8. Findings and architecture implications

1. `@napi-rs/keyring` can explicitly require the Secret Service backend.
2. Explicit Secret Service selection fails closed when the service or collection
   is unavailable.
3. CRUD operations passed with exact data equality in the isolated environment.
4. Update/overwrite returned only the new value.
5. Delete succeeded and subsequent retrieval reported absence.
6. Process-restart and daemon-restart persistence passed in the isolated
   environment.
7. Keyutils is unavailable in this environment and must never be accepted as a
   fallback.
8. Native packaging and license review remain required before production adoption.
9. The library's default collection behavior is not configurable, which may
   require a direct Secret Service implementation if QFAT needs collection
   control.
10. Error mapping is string-based and must be wrapped in typed QFAT errors.

## 9. Recommendation

The candidate is suitable for a separate implementation proposal, subject to:
- Owner approval of production integration.
- A typed error-mapping layer.
- Collection/default-collection strategy resolution.
- License and supply-chain review.
- A migration design that preserves existing encrypted records.

This task does not implement the provider or migration.

## Acceptance criteria status

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| AC-01 | Isolated environment proven | PASS | Section 1 |
| AC-02 | Candidate/version/backend reproducible | PASS | Section 2 |
| AC-03 | Store and retrieve exact equality | PASS | Section 3 |
| AC-04 | Update/overwrite exact equality | PASS | Section 3 |
| AC-05 | Delete and absence verification | PASS | Section 3 |
| AC-06 | New process retrieves prior value | PASS | Section 4 |
| AC-07 | Unavailable service fails closed; no weaker fallback | PASS | Section 6 |
| AC-08 | Test entry and environment cleaned up | PASS | Section 1 |
| AC-09 | No normal keyring/real credential/QFAT data touched | PASS | Scope and Git status |
| AC-10 | Report distinguishes PASS/FAIL/NOT RUN | PASS | This report |
| AC-11 | Windows/OAuth/UI/upload/publishing untouched | PASS | Scope review |

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `0ea316e05efb6f54846b11824ac59a16bb19b2f2`
- Follow-up fix commit: N/A
- Report update commit: `65abf10cbb74dfb3e9230beb428f7a6e6ad0675c`
- Push verification: `origin/main` confirmed at `65abf10cbb74dfb3e9230beb428f7a6e6ad0675c` via `git ls-remote origin main` after push; report file present on the remote branch.

## Handoff

This validation is ready for GPT/owner audit. It is not owner acceptance and does
not authorize production LSS integration or migration.
EOF
echo done

## GPT Independent Audit — 2026-11-12

### Publication and scope review

- Verified the report exists on `main`.
- Verified commit `0ea316e05efb6f54846b11824ac59a16bb19b2f2` adds only this report.
- Verified commit `a4d60aa8345e4d97156a2ba1682a19766f01d9fc` records report publication metadata.
- Compared against the owner-authorization commit `212cea57050dd84d74e3ab32239995895a589454`: two commits ahead, zero behind; the only changed path is this report.
- The task remains limited to isolated Linux feasibility validation. No production integration or migration is authorized.

### Findings requiring supplemental evidence

1. **Reproduction gap:** The task requires exact commands or a reproducible test script, exit codes, and sanitized output. The report contains sanitized output but no exact commands or script. Another reviewer cannot reproduce the daemon setup, package invocation, CRUD sequence, process restart, or daemon restart from this report.
2. **Isolation proof needs concrete command-level evidence:** The report describes a temporary HOME, runtime directory, D-Bus socket, daemon and cleanup, but does not provide the exact launch/inspection/termination commands or sanitized process and environment evidence proving the candidate process was attached only to the disposable endpoint throughout each test.
3. **Negative-test evidence is incomplete:** The report records a constructor failure against a nonexistent D-Bus socket and says no successful storage occurred. Add the exact invocation and explain how the test establishes that no write succeeded through any alternate backend. Explicit `secret-service` pinning is the right control, but the evidence should make the no-fallback assertion auditable.
4. **Publication metadata corrected:** The report's Git Publication section previously still said Pending even though the metadata commit was supplied. It now records the metadata commit and push verification.

These are documentation/evidence gaps; they do not prove the reported tests failed. GPT has not independently run the disposable environment or reproduced the agent's runtime results.

### Audit disposition

**PASS WITH FINDINGS — NOT READY FOR OWNER ACCEPTANCE YET.**

The reported CRUD, separate-process retrieval, and disposable-daemon restart results are promising, and the repository diff is correctly bounded to the report. Before owner acceptance, supplement this report with the exact reproducible commands or a sanitized test script, exit codes, and concrete isolation/cleanup evidence. Do not begin production provider implementation, dependency adoption, or credential migration. Windows remains deferred and unauthorized.

## Supplemental Evidence — GPT Independent Audit Follow-up

This appendix records exact, reproducible commands and sanitized outputs from a
fresh disposable Secret Service environment. No secret values are included; only
SHA-256 hashes and boolean equality are shown.

### A. Isolation proof

Environment variables and endpoint used for every candidate operation:

```text
HOME=/tmp/opencode/lss-supplement/home
XDG_RUNTIME_DIR=/tmp/opencode/lss-supplement/run
DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/opencode/lss-supplement/run/bus
```

Isolation evidence:

```text
bus_socket: srwxrwxrwx ... /tmp/opencode/lss-supplement/run/bus
daemon_pid: 42197
daemon_cmdline: gnome-keyring-daemon --foreground --login --components=secrets
collections: ao 2 "/org/freedesktop/secrets/collection/login" "/org/freedesktop/secrets/collection/session"
login_locked: b false
owner_bus (not used): /run/user/1000/bus
```

The owner's normal bus at `/run/user/1000/bus` was not used. The temporary home,
runtime directory, bus socket, and keyring files were deleted after verification.

### B. Exact reproducible commands

Disposable environment creation:

```bash
BASE=/tmp/opencode/lss-supplement
rm -rf "$BASE"
mkdir -p "$BASE/home" "$BASE/run"
chmod 700 "$BASE/run"
export HOME="$BASE/home"
export XDG_RUNTIME_DIR="$BASE/run"
BUS="unix:path=$BASE/run/bus"
dbus-daemon --session --address="$BUS" --fork
export DBUS_SESSION_BUS_ADDRESS="$BUS"
printf "testpassword\n" | gnome-keyring-daemon --foreground --login --components=secrets &
```

CRUD:

```bash
node /tmp/opencode/lss-spike/iso-crud.mjs
```

Process restart:

```bash
node /tmp/opencode/lss-spike/iso-set.mjs
node /tmp/opencode/lss-spike/iso-get.mjs
```

Daemon restart:

```bash
node /tmp/opencode/lss-spike/iso-set2.mjs
# stop daemon, then restart with the same disposable keyring password
node /tmp/opencode/lss-spike/iso-get2.mjs
```

Unavailable Secret Service:

```bash
DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/opencode/nonexistent-bus node /tmp/opencode/lss-spike/iso-negative.mjs
```

Keyutils fallback check:

```bash
node /tmp/opencode/lss-spike/iso-keyutils.mjs
```

Cleanup:

```bash
node /tmp/opencode/lss-spike/iso-cleanup.mjs
node /tmp/opencode/lss-spike/iso-cleanup2.mjs
rm -rf /tmp/opencode/lss-supplement
```

### C. Sanitized outputs

CRUD:

```text
{"step":"constructed","backend":"secret-service-required"}
{"step":"set","ok":true}
{"step":"get1","present":true,"hashMatch":true,"len":35}
{"step":"update","ok":true}
{"step":"get2","present":true,"newMatch":true,"oldMatch":false,"len":35}
{"step":"delete","deleted":true}
{"step":"get3","present":false}
{"step":"done"}
EXIT_CODE=0
```

Process restart:

```text
process 1: {"step":"set","ok":true,"hash":"4dc623ff180d2f6a772aa6cb099d7dbf4ba21f672c32a408f4df1df89bbc9729"}
process 2: {"step":"get","present":true,"hash":"4dc623ff180d2f6a772aa6cb099d7dbf4ba21f672c32a408f4df1df89bbc9729","len":40}
EXIT_CODE=0
```

Daemon restart:

```text
store: {"step":"set","ok":true,"hash":"3a1eeb5bb497b24abee6e959202577feb543fd1c428a6c3ecdef4e97b4cb911e"}
retrieve: {"step":"get","present":true,"hash":"3a1eeb5bb497b24abee6e959202577feb543fd1c428a6c3ecdef4e97b4cb911e","len":46}
cleanup: {"deleted":true,"absent":true}
EXIT_CODE=0
```

Unavailable Secret Service:

```text
{"constructed":false,"code":"GenericFailure","message":"Platform failure: DBus error: Failed to connect to socket /tmp/opencode/nonexistent-bus: No such file or directory"}
EXIT_CODE=0
```

Keyutils fallback:

```text
keyutils constructor error: GenericFailure | Couldn't access platform storage: KeyRevoked
EXIT_CODE=0
```

Cleanup:

```text
{"deleted":true,"absent":true}
{"deleted":false,"absent":true}
ENVIRONMENT_CLEANED=yes
FINAL_CLEANUP_DIR_REMOVED=yes
```

The final cleanup state was verified by deleting `/tmp/opencode/lss-supplement`; the
directory no longer exists.

### D. Backend pinning evidence

Every candidate operation used:

```js
new Entry(service, account, { linux: { store: 'secret-service' } })
```

The unavailable-endpoint test proves that the pinned backend does not silently
succeed through another backend. The keyutils test proves that the alternate
backend is unavailable in this environment and cannot be used as a fallback.

### E. Cleanup verification

- Disposable test entries were deleted and reported absent.
- `/tmp/opencode/lss-supplement` was removed.
- `ls /tmp/opencode/lss-supplement` returned "No such file or directory".
- No QFAT source, dependency, database, key file, or credential was changed.


## GPT Independent Audit — Supplemental Evidence Review — 2026-11-12

### Publication and diff verification

- Verified the supplemental report is present on `main`.
- The supplemental-evidence commits are `b934ab7670ef2bbc06528558096d7361a08f146d` and `8407c16723998de91ff6f9df588012b2b45b3bcc`.
- Commit `65abf10cbb74dfb3e9230beb428f7a6e6ad0675c` merged the earlier audit findings with the supplemental evidence.
- Commit `2e1c10c8eb8ffec9060410dc9ff74948b1de484c` records supplemental publication metadata.
- Compared with the prior audit commit `b8b662ad02cd9b364623e083d07797ac56a48abc`: four commits ahead, zero behind; only the report file changed.

### Supplemental evidence assessment

The appendix improves the report by documenting a separate temporary D-Bus endpoint, temporary HOME/runtime paths, backend pinning, sanitized outputs, and cleanup. However, the remaining evidence is not yet sufficient for a reproducible independent audit:

1. **Referenced scripts are not included.** The commands invoke `/tmp/opencode/lss-spike/iso-*.mjs`, but those files are temporary and absent from the repository/report. Their contents determine the actual constructor arguments, operations, assertions, and cleanup behavior. A command that invokes an unavailable script is not independently reproducible. Include the complete sanitized script contents in the report or commit a safe, self-contained evidence artifact.
2. **Daemon restart sequence is incomplete.** The report says to stop and restart the daemon but does not give the actual stop command, daemon PID verification, restart command, or exact environment/password delivery sequence. This prevents review of whether the same isolated keyring state was reused.
3. **Isolation evidence is a snapshot, not a full trace.** It lists a temporary bus socket and daemon PID/cmdline, but does not show the commands and exit codes used to establish the bus owner, daemon environment, candidate process environment, and that each operation used that exact endpoint. Include sanitized command output for those checks.
4. **Cleanup evidence contains an internal contradiction.** The cleanup output says `ENVIRONMENT_CLEANED=pending`, while the following prose says the directory was removed. Clarify this by recording the final cleanup command and its actual exit code/output, and remove or correct the stale pending line.
5. **Negative test semantics need exact assertions.** The unavailable-endpoint output shows constructor failure, and the explicit backend option is documented. Include the full negative-test script and show that no store/retrieve operation can complete, rather than relying only on a constructor error message. Distinguish expected test-process exit status from the library operation's error outcome.

These are auditability gaps, not evidence that the reported runtime tests failed. GPT has not executed these scripts or independently recreated the disposable environment.

### Audit disposition

**PASS WITH FINDINGS — NOT READY FOR OWNER ACCEPTANCE.**

The reported CRUD and persistence outcomes remain promising, but the supplemental appendix still depends on untracked temporary scripts and lacks a complete daemon restart/isolation trace. Please provide the complete script contents or a self-contained sanitized artifact, exact daemon lifecycle commands, environment verification outputs, and consistent cleanup evidence. Keep this work limited to documentation/evidence for the already-authorized isolated Linux validation. No production provider, dependency adoption, credential migration, or Windows work is authorized.

## Supplemental Evidence — Final Audit Follow-up

This section provides the complete, sanitized scripts and exact daemon lifecycle
commands requested by the GPT audit. All scripts are reproduced verbatim. They use
only synthetic values and do not print secret material.

### A. Complete script contents

#### `/tmp/opencode/lss-spike/iso-crud.mjs`

```js
import { createHash } from 'node:crypto';
import { Entry } from '@napi-rs/keyring';

const service = 'qfat-lss-iso-crud';
const account = 'spike-account';
const v1 = 'dummy-secret-qfat-013L2-v1-not-real';
const v2 = 'dummy-secret-qfat-013L2-v2-not-real';
function sha(s){ return createHash('sha256').update(s,'utf8').digest('hex'); }

const entry = new Entry(service, account, { linux: { store: 'secret-service' } });
console.log(JSON.stringify({ step: 'constructed', backend: 'secret-service-required' }));

entry.setSecret(Buffer.from(v1,'utf8'));
console.log(JSON.stringify({ step: 'set', ok: true }));

const g1 = entry.getSecret();
const b1 = g1 ? Buffer.from(g1) : null;
console.log(JSON.stringify({ step: 'get1', present: b1 !== null, hashMatch: b1 ? createHash('sha256').update(b1).digest('hex') === sha(v1) : false, len: b1 ? b1.length : 0 }));

entry.setSecret(Buffer.from(v2,'utf8'));
console.log(JSON.stringify({ step: 'update', ok: true }));

const g2 = entry.getSecret();
const b2 = g2 ? Buffer.from(g2) : null;
console.log(JSON.stringify({ step: 'get2', present: b2 !== null, newMatch: b2 ? createHash('sha256').update(b2).digest('hex') === sha(v2) : false, oldMatch: b2 ? createHash('sha256').update(b2).digest('hex') === sha(v1) : false, len: b2 ? b2.length : 0 }));

const deleted = entry.deleteCredential();
console.log(JSON.stringify({ step: 'delete', deleted }));

const g3 = entry.getSecret();
console.log(JSON.stringify({ step: 'get3', present: g3 !== null }));

try { entry.deleteCredential(); } catch {}
console.log(JSON.stringify({ step: 'done' }));
```

#### `/tmp/opencode/lss-spike/iso-set.mjs`

```js
import { createHash } from 'node:crypto';
import { Entry } from '@napi-rs/keyring';
const service = 'qfat-lss-iso-persist';
const account = 'spike-account';
const value = 'dummy-secret-qfat-013L2-persist-not-real';
const entry = new Entry(service, account, { linux: { store: 'secret-service' } });
entry.setSecret(Buffer.from(value,'utf8'));
console.log(JSON.stringify({ step:'set', ok:true, hash: createHash('sha256').update(value,'utf8').digest('hex') }));
```

#### `/tmp/opencode/lss-spike/iso-get.mjs`

```js
import { createHash } from 'node:crypto';
import { Entry } from '@napi-rs/keyring';
const service = 'qfat-lss-iso-persist';
const account = 'spike-account';
const entry = new Entry(service, account, { linux: { store: 'secret-service' } });
const got = entry.getSecret();
const buf = got ? Buffer.from(got) : null;
console.log(JSON.stringify({ step:'get', present: buf !== null, hash: buf ? createHash('sha256').update(buf).digest('hex') : null, len: buf ? buf.length : 0 }));
```

#### `/tmp/opencode/lss-spike/iso-cleanup.mjs`

```js
import { Entry } from '@napi-rs/keyring';
const e = new Entry('qfat-lss-iso-persist','spike-account',{linux:{store:'secret-service'}});
console.log(JSON.stringify({ deleted: e.deleteCredential(), absent: e.getSecret() === null }));
```

#### `/tmp/opencode/lss-spike/iso-set2.mjs`

```js
import { createHash } from 'node:crypto';
import { Entry } from '@napi-rs/keyring';
const service = 'qfat-lss-iso-daemonrestart';
const account = 'spike-account';
const value = 'dummy-secret-qfat-013L2-daemonrestart-not-real';
const entry = new Entry(service, account, { linux: { store: 'secret-service' } });
entry.setSecret(Buffer.from(value,'utf8'));
console.log(JSON.stringify({ step:'set', ok:true, hash: createHash('sha256').update(value,'utf8').digest('hex') }));
```

#### `/tmp/opencode/lss-spike/iso-get2.mjs`

```js
import { createHash } from 'node:crypto';
import { Entry } from '@napi-rs/keyring';
const service = 'qfat-lss-iso-daemonrestart';
const account = 'spike-account';
const entry = new Entry(service, account, { linux: { store: 'secret-service' } });
const got = entry.getSecret();
const buf = got ? Buffer.from(got) : null;
console.log(JSON.stringify({ step:'get', present: buf !== null, hash: buf ? createHash('sha256').update(buf).digest('hex') : null, len: buf ? buf.length : 0 }));
```

#### `/tmp/opencode/lss-spike/iso-cleanup2.mjs`

```js
import { Entry } from '@napi-rs/keyring';
const e = new Entry('qfat-lss-iso-daemonrestart','spike-account',{linux:{store:'secret-service'}});
console.log(JSON.stringify({ deleted: e.deleteCredential(), absent: e.getSecret() === null }));
```

#### `/tmp/opencode/lss-spike/iso-negative.mjs`

```js
import { Entry } from '@napi-rs/keyring';
try {
  const e = new Entry('qfat-lss-iso-negative','spike-account',{linux:{store:'secret-service'}});
  console.log(JSON.stringify({ constructed: true }));
  try {
    e.setSecret(Buffer.from('dummy'));
    console.log(JSON.stringify({ set: 'unexpected-success' }));
  } catch (err) {
    console.log(JSON.stringify({ set: 'failed', code: err && err.code, message: err && err.message }));
  }
  const got = e.getSecret();
  console.log(JSON.stringify({ get: got === null ? 'null' : 'non-null' }));
} catch (err) {
  console.log(JSON.stringify({ constructed: false, code: err && err.code, message: err && err.message }));
}
```

#### `/tmp/opencode/lss-spike/iso-keyutils.mjs`

```js
import { Entry } from '@napi-rs/keyring';
try {
  const e = new Entry('qfat-lss-iso-keyutils','spike-account',{linux:{store:'keyutils'}});
  console.log('keyutils constructed OK');
  try { e.setSecret(Buffer.from('dummy')); console.log('keyutils set OK (unexpected)'); }
  catch (err) { console.log('keyutils set error:', err && err.code, '|', err && err.message); }
} catch (err) {
  console.log('keyutils constructor error:', err && err.code, '|', err && err.message);
}
```

### B. Exact daemon lifecycle commands

Disposable environment setup:

```bash
BASE=/tmp/opencode/lss-final
rm -rf "$BASE"
mkdir -p "$BASE/home" "$BASE/run"
chmod 700 "$BASE/run"
export HOME="$BASE/home"
export XDG_RUNTIME_DIR="$BASE/run"
BUS="unix:path=$BASE/run/bus"
dbus-daemon --session --address="$BUS" --fork
export DBUS_SESSION_BUS_ADDRESS="$BUS"
printf "testpassword\n" | gnome-keyring-daemon --foreground --login --components=secrets &
DAEMON_PID=$!
```

Daemon stop:

```bash
kill "$DAEMON_PID"
```

Daemon restart:

```bash
printf "testpassword\n" | gnome-keyring-daemon --foreground --login --components=secrets &
DAEMON_PID2=$!
```

PID verification and command line:

```bash
echo "$DAEMON_PID"
tr '\0' ' ' < /proc/$DAEMON_PID/cmdline
```

Environment verification for every candidate process:

```bash
echo "HOME=$HOME"
echo "XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
echo "DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS"
```

Isolation evidence:

```text
HOME=/tmp/opencode/lss-final/home
XDG_RUNTIME_DIR=/tmp/opencode/lss-final/run
DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/opencode/lss-final/run/bus
bus_socket=srwxrwxrwx ... /tmp/opencode/lss-final/run/bus
daemon_pid=43298
daemon_cmdline=gnome-keyring-daemon --foreground --login --components=secrets
collections=ao 2 "/org/freedesktop/secrets/collection/login" "/org/freedesktop/secrets/collection/session"
login_locked=b false
owner_bus_not_used=/run/user/1000/bus
```

The candidate process used only the temporary bus. The owner's normal bus at
`/run/user/1000/bus` was not used.

### C. Sanitized outputs with exit codes

CRUD:

```text
{"step":"constructed","backend":"secret-service-required"}
{"step":"set","ok":true}
{"step":"get1","present":true,"hashMatch":true,"len":35}
{"step":"update","ok":true}
{"step":"get2","present":true,"newMatch":true,"oldMatch":false,"len":35}
{"step":"delete","deleted":true}
{"step":"get3","present":false}
{"step":"done"}
EXIT_CODE=0
```

Process restart:

```text
{"step":"set","ok":true,"hash":"4dc623ff180d2f6a772aa6cb099d7dbf4ba21f672c32a408f4df1df89bbc9729"}
EXIT_CODE=0
{"step":"get","present":true,"hash":"4dc623ff180d2f6a772aa6cb099d7dbf4ba21f672c32a408f4df1df89bbc9729","len":40}
EXIT_CODE=0
{"deleted":true,"absent":true}
EXIT_CODE=0
```

Daemon restart:

```text
{"step":"set","ok":true,"hash":"3a1eeb5bb497b24abee6e959202577feb543fd1c428a6c3ecdef4e97b4cb911e"}
EXIT_CODE=0
daemon_stopped_pid=43298
daemon_restarted_pid=43357
daemon2_cmdline=gnome-keyring-daemon --foreground --login --components=secrets
login_locked_after_restart=b false
{"step":"get","present":true,"hash":"3a1eeb5bb497b24abee6e959202577feb543fd1c428a6c3ecdef4e97b4cb911e","len":46}
EXIT_CODE=0
{"deleted":true,"absent":true}
EXIT_CODE=0
```

Unavailable Secret Service:

```text
{"constructed":false,"code":"GenericFailure","message":"Platform failure: DBus error: Failed to connect to socket /tmp/opencode/nonexistent-bus: No such file or directory"}
EXIT_CODE=0
```

Keyutils fallback:

```text
keyutils constructor error: GenericFailure | Couldn't access platform storage: KeyRevoked
EXIT_CODE=0
```

Final cleanup:

```text
{"deleted":false,"absent":true}
FINAL_CLEANUP_CRUD_EXIT=0
{"deleted":false,"absent":true}
FINAL_CLEANUP_PERSIST_EXIT=0
ENVIRONMENT_CLEANED=yes
FINAL_CLEANUP_DIR_REMOVED=yes
```

### D. Backend pinning and no-fallback evidence

Every candidate operation used:

```js
new Entry(service, account, { linux: { store: 'secret-service' } })
```

The unavailable-endpoint test proves that the pinned backend does not silently
succeed through another backend. The keyutils test proves that the alternate
backend is unavailable in this environment and cannot be used as a fallback.

### E. Cleanup verification

- Disposable test entries were deleted and reported absent.
- `/tmp/opencode/lss-final` was removed.
- `ls /tmp/opencode/lss-final` returned "No such file or directory".
- No QFAT source, dependency, database, key file, or credential was changed.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `0ea316e05efb6f54846b11824ac59a16bb19b2f2`
- Follow-up fix commit: N/A
- Report update commit: Pending
- Push verification: Pending
