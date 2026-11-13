# QFAT-017 — Linux Secret Service Process Boundary Design

Status: DESIGN ONLY — NOT IMPLEMENTED  
Task: `tasks/QFAT-017-linux-secret-service-process-boundary-design.md`  
Repository: `irfannuralam44-max/qfat`  
Scope: Linux credential storage only. Windows remains deferred.

## 1. Executive recommendation and assumptions

### Recommendation

Use a **persistent, supervised child process** as the only process that imports and constructs `@napi-rs/keyring@2.1.2`. The parent QFAT server must never construct `Entry` or `AsyncEntry` directly. All Secret Service operations cross a versioned, size-limited JSON IPC boundary over stdin/stdout pipes.

Recommended model for the MVP:

- One dedicated child process per running QFAT server process.
- A serial operation queue in the parent; no concurrent native calls.
- Explicit `secret-service` backend pinning on every `Entry`.
- Startup timeout and per-operation timeout.
- Termination escalation: SIGTERM, bounded grace period, SIGKILL, then bounded wait.
- Fail closed on timeout, crash, malformed IPC, unavailable/locked Secret Service, or key conflict.
- No key caching in the parent. The child may retrieve the key per operation; no long-lived parent-side key cache.
- Keep the existing AES-256-GCM envelope and SQLite ciphertext format unchanged.
- Keep migration as a separate, explicitly invoked future task.

### Binding assumptions

- Linux is the only active credential-storage platform.
- `@napi-rs/keyring@2.1.2` is a conditional candidate, not approved for unconditional production adoption.
- The candidate's Linux backend must be pinned to `secret-service`; auto-fallback to keyutils is prohibited.
- The candidate exposes no collection selection. QFAT-016 observed successful CRUD in an unlocked default/login collection.
- The current provider contract is:

```ts
interface CredentialProvider {
  store(context: CredentialContext, payload: Buffer): Promise<void>;
  retrieve(context: CredentialContext): Promise<Buffer | null>;
  delete(context: CredentialContext): Promise<boolean>;
}
```

- `CredentialStorageError` is the existing typed error boundary.
- The current provider is `KeyFileCredentialProvider`, which stores AES-256-GCM envelope fields in SQLite and loads a 32-byte key from a separate owner-only key file.
- No production Secret Service provider exists today.

## 2. Candidate package facts used by this design

Package: `@napi-rs/keyring@2.1.2`

Relevant API facts:

- `new Entry(service, username, options?)`
- `Entry.withTarget(target, service, username, options?)`
- `AsyncEntry` has the same construction and method shape
- `setPassword(password: string)`
- `setSecret(secret: Uint8Array)`
- `getPassword(): string | null`
- `getSecret(): Array<number> | null`
- `deleteCredential(): boolean`
- `deletePassword(): boolean`
- `EntryOptions.linux.store?: 'secret-service' | 'keyutils'`

Behavior facts:

- On Linux, omitting `linux.store` auto-selects Secret Service first and falls back to keyutils.
- `{ linux: { store: 'secret-service' } }` requires Secret Service and throws if it is unavailable; there is no silent fallback.
- `{ linux: { store: 'keyutils' } }` requires the kernel keyring.
- `getSecret()` returns `null` when no credential exists.
- `getSecret()` throws when the store cannot be read, for example when locked or inaccessible.
- `deleteCredential()` returns `true` when deleted, `false` when absent, and throws on failed deletion.
- Errors include `NoEntry`, `Ambiguous`, and platform access failures.
- The README documents that `new Entry()`/`new AsyncEntry()` may perform D-Bus setup and that a wedged session bus can block indefinitely.

QFAT-016 facts:

- A separate child process can contain the blocking behavior.
- A 1000 ms timeout terminated a deliberately hung child.
- The parent remained responsive.
- Synthetic 32-byte CRUD and persistence across child-process restart succeeded in an unlocked disposable `login` collection.
- Explicit Secret Service pinning prevented keyutils fallback.
- No secret bytes appeared in child stdout/stderr.

## 3. Process architecture and lifecycle

### 3.1 Recommended model

Use a **single persistent child process** supervised by the parent server. Do not use worker threads as the containment mechanism.

Rationale:

- The native constructor can block synchronously. A process boundary is the only reliable containment mechanism.
- A persistent child avoids repeated process startup overhead and provides stable request ordering.
- A serial operation queue prevents concurrent native Secret Service calls.
- A fresh child can be created after a crash.
- Key bytes do not need to be cached in the parent; the child can retrieve them per operation.

### 3.2 Process lifecycle sequence

```text
Parent server startup
  -> validate platform = linux
  -> create SecretServiceKeyStore
  -> spawn child with isolated/normal environment as applicable
  -> wait for READY handshake with startup timeout
  -> mark key store available or fail closed

Operation request
  -> parent validates context and request shape
  -> enqueue operation
  -> serialize request to child over stdin
  -> wait for response with operation timeout
  -> validate response shape and size
  -> return typed result or fail closed

Timeout
  -> mark operation failed with timeout error
  -> SIGTERM child
  -> wait grace period
  -> SIGKILL if still alive
  -> wait bounded final period
  -> if child exited: allow one supervised restart for a later operation
  -> if child did not exit: mark key store fatal/unavailable

Child crash
  -> detect exit before response
  -> return child crash error
  -> allow at most one supervised restart
  -> if restart fails or timeout occurred previously: fail closed

Parent shutdown
  -> stop accepting new operations
  -> send SHUTDOWN request
  -> wait bounded grace period
  -> SIGTERM, then SIGKILL if needed
  -> close pipes
```

### 3.3 Child process rules

- The child is the only module that imports `@napi-rs/keyring`.
- The child must not import QFAT server, database, media, or platform publishing code.
- The child must not read QFAT's SQLite database.
- The child receives only the operation request and returns only the operation result.
- The child must not print diagnostics containing secrets.
- The child's environment must not contain QFAT credentials or key material.
- The child must use the same Node runtime as the parent or a explicitly configured compatible runtime.

### 3.4 Timeout policy

Recommended initial values, subject to owner approval:

- Startup timeout: 2000 ms
- Operation timeout: 5000 ms
- SIGTERM grace period: 2000 ms
- SIGKILL final wait: 2000 ms
- Restart backoff: no automatic retry for a timed-out child during the same process lifetime

A JavaScript `Promise` timeout cannot interrupt synchronous native blocking. The OS process is the containment boundary. If the child does not exit after SIGKILL, the parent must mark Secret Service unavailable and require a server restart.

### 3.5 Concurrency and ordering

- All Secret Service operations for one QFAT server process are serialized through a FIFO queue.
- One in-flight operation at a time.
- No operation starts while a previous operation is pending.
- The queue depth should be bounded to prevent unbounded memory growth under overload.
- A timed-out operation cancels its queue slot and marks the child unusable.

## 4. IPC contract and secret hygiene

### 4.1 Transport

Use newline-delimited JSON (NDJSON) over stdin/stdout pipes.

Rationale:

- Simple and dependency-free.
- Natural request/response correlation with request IDs.
- Easy to validate and size-limit.
- Avoids network exposure and temporary files.

stderr is reserved for non-secret diagnostics and must never contain key material, tokens, base64/hex encodings, plaintext, or absolute QFAT data paths.

### 4.2 Protocol version

Protocol version: `1`.

Every request and response includes `protocolVersion`.

### 4.3 Request shapes

```ts
interface SecretServiceRequest {
  protocolVersion: 1;
  requestId: string;
  operation: 'store' | 'retrieve' | 'delete' | 'shutdown';
}
```

Store request:

```ts
{
  protocolVersion: 1,
  requestId: string,
  operation: 'store',
  service: string,
  account: string,
  secretBase64: string
}
```

Retrieve request:

```ts
{
  protocolVersion: 1,
  requestId: string,
  operation: 'retrieve',
  service: string,
  account: string
}
```

Delete request:

```ts
{
  protocolVersion: 1,
  requestId: string,
  operation: 'delete',
  service: string,
  account: string
}
```

Shutdown request:

```ts
{
  protocolVersion: 1,
  requestId: string,
  operation: 'shutdown'
}
```

### 4.4 Response shapes

Success:

```ts
{
  protocolVersion: 1,
  requestId: string,
  ok: true,
  operation: 'store' | 'retrieve' | 'delete' | 'shutdown',
  found?: boolean,
  deleted?: boolean,
  secretBase64?: string
}
```

Error:

```ts
{
  protocolVersion: 1,
  requestId: string,
  ok: false,
  code: string,
  message: string
}
```

For retrieve, `secretBase64` is permitted only in the IPC response to the parent. It must never be logged or returned through HTTP.

### 4.5 Validation and limits

- Maximum request size: 16 KiB.
- Maximum response size: 16 KiB.
- `requestId` must be a non-empty string no longer than 128 bytes.
- `service` and `account` must be non-empty strings no longer than 256 bytes.
- `secretBase64` must decode to exactly 32 bytes.
- Unknown fields are rejected.
- Missing required fields are rejected.
- Only one JSON object per line is permitted.
- Responses with an unknown or mismatched `requestId` are rejected.
- Late responses after timeout are ignored and logged as protocol events without secret data.
- Duplicate responses for the same `requestId` are rejected.

### 4.6 Secret hygiene

- Secret bytes cross the boundary only as a base64 field in the IPC JSON.
- Secret bytes must not appear in:
  - command-line arguments;
  - environment variables;
  - logs;
  - stdout/stderr except the designated IPC response;
  - temporary files;
  - HTTP responses or frontend state.
- The child must not echo secrets.
- The parent must validate and then clear request/response buffers as soon as possible.
- Node.js and native copies cannot be guaranteed to be zeroed. The design must state this limitation honestly.
- Error messages must be sanitized and must not include secret values, raw D-Bus payloads, native stack traces, absolute QFAT paths, or token material.

### 4.7 Malformed and unexpected IPC

| Condition | Parent behavior |
|---|---|
| Invalid JSON | Fail operation with `SECRET_SERVICE_PROTOCOL_ERROR`; terminate child |
| Oversized message | Fail operation and terminate child |
| Missing/mismatched requestId | Fail operation and terminate child |
| Unknown operation | Fail operation; child returns typed error |
| Child exits before response | Fail operation with `SECRET_SERVICE_CHILD_CRASH` |
| Child stdout closes unexpectedly | Fail operation and mark child unusable |
| Late response after timeout | Ignore; mark protocol anomaly |
| Duplicate response | Ignore duplicate; record protocol anomaly |
| Child stderr output | Capture bounded, secret-scanned diagnostic only; never fail solely because stderr is non-empty unless policy requires it |

## 5. Backend selection and fail-closed behavior

### 5.1 Explicit pinning

Every `Entry` or `AsyncEntry` must be constructed with:

```ts
{ linux: { store: 'secret-service' } }
```

The design must not use the default auto-fallback path. The child must never construct an entry without the explicit option.

### 5.2 Stable error categories

Proposed parent-facing error codes:

| Code | Meaning |
|---|---|
| `SECRET_SERVICE_UNAVAILABLE` | D-Bus or Secret Service is unavailable |
| `SECRET_SERVICE_LOCKED` | Default/login collection is unavailable or locked |
| `SECRET_SERVICE_OPERATION_FAILED` | Provider returned an unexpected failure |
| `SECRET_SERVICE_OPERATION_TIMEOUT` | Operation exceeded its timeout |
| `SECRET_SERVICE_CHILD_CRASH` | Child exited before responding |
| `SECRET_SERVICE_CHILD_UNAVAILABLE` | Child could not be started or is marked unusable |
| `SECRET_SERVICE_PROTOCOL_ERROR` | Malformed or invalid IPC |
| `SECRET_SERVICE_PERMISSION_DENIED` | Provider rejected access |
| `SECRET_KEY_MISSING_WITH_RECORDS` | Secret Service item missing while encrypted records exist |
| `SECRET_KEY_INVALID` | Retrieved key is malformed or wrong length |
| `SECRET_KEY_CONFLICT` | A Secret Service item already exists with different key material |
| `SECRET_MIGRATION_REQUIRED` | Migration has not been completed or is required |
| `SECRET_MIGRATION_FAILED` | Migration verification failed |

Existing `CredentialStorageError` codes remain valid for the encrypted envelope and key-file provider. The follow-up implementation may extend the union with the codes above.

### 5.3 Fail-closed rules

- No automatic fallback to keyutils.
- No automatic fallback to the key file after a future Secret Service cutover.
- No plaintext storage.
- No environment-variable key.
- No regenerated key when encrypted records exist.
- No continued account-management startup if the active key source is unavailable.
- If the default collection is unavailable, return an actionable error instructing the user to unlock Secret Service through Linux and retry.
- Do not claim a specific lock state unless the provider exposes reliable evidence. An unavailable default collection is reported as unavailable/locked, not as a definitively diagnosed lock.

## 6. CredentialProvider integration

### 6.1 Existing contract

The existing contract is:

```ts
interface CredentialProvider {
  store(context: CredentialContext, payload: Buffer): Promise<void>;
  retrieve(context: CredentialContext): Promise<Buffer | null>;
  delete(context: CredentialContext): Promise<boolean>;
}
```

The Secret Service integration should protect the existing 32-byte AES key, not replace the envelope. SQLite remains the ciphertext store.

### 6.2 Future key-store boundary

Introduce a narrow internal boundary:

```ts
interface CredentialKeyStore {
  get(): Promise<Buffer | null>;
  create(key: Buffer): Promise<void>;
  delete(): Promise<void>;
}
```

`create()` must be create-if-absent. Because `@napi-rs/keyring` does not expose an atomic create-if-absent primitive, the adapter must:

1. Call `get()`.
2. If absent, call the native `setSecret`.
3. Call `get()` again.
4. Compare the retrieved bytes to the generated key.
5. If they differ, return `SECRET_KEY_CONFLICT` and never overwrite either side.

This is not an atomic primitive. Concurrent QFAT processes or external Secret Service writers can create a race. The risk must be documented and tested.

### 6.3 Provider mapping

Current `KeyFileCredentialProvider` directly:

- checks whether encrypted records exist;
- loads or creates the 32-byte key;
- encrypts/decrypts the envelope;
- stores envelope fields in SQLite.

Future design:

- Keep envelope encryption and SQLite repository unchanged.
- Replace key acquisition with `CredentialKeyStore`.
- Either:
  - generalize `KeyFileCredentialProvider` to accept a `CredentialKeyStore`, or
  - add a separate `SecretServiceCredentialProvider` implementing the same `CredentialProvider`.

Recommended future approach: generalize the existing provider to accept a `CredentialKeyStore`, avoiding duplicate envelope logic.

Future likely files:

- `apps/server/src/credentials/key-store.ts` — `CredentialKeyStore` interface
- `apps/server/src/credentials/secret-service-key-store.ts` — parent-side adapter and child supervisor
- `apps/server/src/credentials/secret-service-child.ts` — child entry point that imports `@napi-rs/keyring`
- `apps/server/src/credentials/provider.ts` — provider integration
- `apps/server/src/credentials/errors.ts` — error code extension
- `apps/server/src/config.ts` — any Secret Service identity constants
- Tests under `apps/server/test/` for IPC, timeout, error mapping, and provider behavior

No such files are created by this task.

### 6.4 First-time key creation

- Generate exactly 32 cryptographically random bytes using Node.js crypto.
- Call `CredentialKeyStore.create(key)`.
- If an item already exists, retrieve it and validate its length.
- Never overwrite an existing item.
- Never generate a replacement key when encrypted credential records exist.
- If Secret Service is unavailable or locked, fail closed and do not create a key-file fallback.

### 6.5 Existing encrypted records

- If encrypted rows exist and the Secret Service item is missing, malformed, inaccessible, or has the wrong length, fail closed.
- Return `SECRET_KEY_MISSING_WITH_RECORDS` or `SECRET_KEY_INVALID`.
- Do not delete or rewrite encrypted rows.
- Do not silently fall back to the old key file after Secret Service becomes the configured active provider.

### 6.6 Key caching

Recommended MVP behavior:

- The parent does not cache the raw key.
- The child retrieves the key from Secret Service per operation.
- The child may hold the key only for the duration of one operation.

Trade-off:

- This increases D-Bus calls but reduces key lifetime in parent memory and avoids stale-key behavior.
- If performance requires caching, the child may cache the key for its process lifetime, but this must be documented and tested. Parent caching of raw key bytes is not recommended.

### 6.7 Server startup and request handling

- Server startup must not import `@napi-rs/keyring`.
- The Secret Service child is spawned lazily on first credential operation or during a future explicit startup check.
- If Secret Service is unavailable, credential operations fail closed.
- The server should not expose whether a specific account secret exists beyond the minimum required by the authorized local UI.

## 7. Migration and cutover boundary

Migration is a separate, explicitly invoked future task. This design does not authorize it.

### 7.1 Proposed migration sequence

1. Detect the existing key-file state and count encrypted credential rows without exposing values.
2. Require the current key file to pass all existing ownership, permission, symlink, length, and durability checks.
3. Read the existing 32-byte key into memory; never print or serialize it.
4. Create the Secret Service item using create-if-absent semantics.
5. If an item already exists with different key material, stop and do not overwrite either side.
6. Retrieve the Secret Service item in a separate process and compare equality in memory.
7. With the Secret Service key selected, decrypt every existing credential envelope using its original context. This is a verification pass only; do not modify ciphertext.
8. Verify row counts and per-row authentication success. If any row fails, stop and preserve the original key file and database unchanged.
9. Switch the configured provider to Secret Service only after the entire verification pass succeeds.
10. Keep the original key file unchanged until the owner-approved rollback/retention policy is satisfied.
11. A separate cleanup action may retire the old key file only after explicit owner approval, backup policy confirmation, and a documented recovery plan.

### 7.2 Recovery and interruption

- If migration is interrupted before cutover, the key file remains active.
- If migration is interrupted after cutover, the server must fail closed rather than silently fall back to the key file.
- If Secret Service becomes unavailable after cutover, credential operations fail closed.
- No dual-write or silent dual-read fallback is proposed for normal operation.

### 7.3 Open migration decisions

- How the user initiates migration and confirms the Secret Service collection is available.
- Whether the old key file is retained as a protected backup, and for how long.
- How rollback is performed if Secret Service becomes unavailable after cutover.
- Whether a documented export/restore/recovery path is needed.
- How migration status is stored without introducing a second source of truth or leaking sensitive state.

## 8. Threat and failure analysis

| Threat or failure | Effect | Mitigation |
|---|---|---|
| Parent process compromise | Parent can request Secret Service operations through the child, but child remains the only native caller | Keep child minimal; validate all IPC; no generic keyring API |
| Child process compromise | Child holds native Secret Service access and transient key bytes | Keep child minimal; no QFAT DB or publishing code; terminate on protocol failure |
| Constructor hang | D-Bus setup blocks child only | Process boundary, startup timeout, SIGTERM/SIGKILL escalation |
| CRUD hang | Native operation blocks child only | Per-operation timeout and termination escalation |
| Repeated timeout/restart loop | Could consume resources | Circuit breaker; fail closed after repeated failures |
| Malformed IPC | Could crash or confuse parent | Strict schema, size limits, terminate child on protocol violation |
| Oversized message | Memory exhaustion | Hard 16 KiB limits |
| Child stdout/stderr leakage | Secrets or paths may leak | No secret-bearing diagnostics; bounded, sanitized diagnostics only |
| Parent shutdown | Orphan child may remain | SHUTDOWN request, bounded wait, SIGTERM/SIGKILL, pipe closure |
| Secret Service unavailable | Credential operations cannot proceed | Fail closed with actionable guidance |
| Default collection locked/unavailable | Candidate cannot access the expected `login` collection | Fail closed; do not claim a specific lock state without reliable evidence |
| Concurrent first-run initialization | Race in create-if-absent | Adapter-level read-check-write plus conflict detection; document non-atomic limitation |
| Migration interruption | Partial migration state | Verification pass before cutover; preserve key file; fail closed |
| Key loss | Existing encrypted records become unrecoverable | Preserve key file until approved retirement; document recovery limits |
| Node/native memory copies | Secret bytes may remain in memory | Best-effort clearing only; no guaranteed erasure claim |

## 9. Residual risks

1. `@napi-rs/keyring` does not expose atomic create-if-absent or collection selection.
2. The default `login` collection must be unlocked and available. QFAT-016 observed failure when it was unavailable.
3. Child-process termination after a native hang depends on OS signal delivery; a permanently stuck native thread may leave an orphan until process exit.
4. Secret bytes cross IPC and exist in multiple process memories; Node.js cannot guarantee erasure.
5. Production adoption of the candidate remains conditional.
6. Migration and key-file retirement remain separate owner decisions.

## 10. Open decisions requiring owner approval

1. Approve or reject `@napi-rs/keyring@2.1.2` for production implementation after reviewing this design.
2. Approve the default/login collection limitation or require another Secret Service client.
3. Approve the first-run behavior: fail closed with unlock instructions versus an explicit user-driven unlock/setup flow.
4. Approve the migration invocation model and key-file retention policy.
5. Approve the timeout and termination values.
6. Approve whether the child may cache the key for its process lifetime.

## 11. Exact future implementation scope

A future implementation task should be limited to:

- Add the child process and parent supervisor.
- Add the `CredentialKeyStore` boundary.
- Add Secret Service adapter with explicit `secret-service` pinning.
- Add typed errors and secret-sanitizing logging.
- Add unit tests with mocked child behavior.
- Add isolated Secret Service tests in a disposable environment.
- Preserve envelope, SQLite schema, key-file provider, and server startup behavior until a separate cutover task.

It must not include:

- production dependency installation without owner approval;
- migration execution;
- OAuth or account APIs;
- upload/publishing;
- UI;
- Windows work;
- hosted CI.

## 12. Source inspection performed

Inspected:
- `apps/server/src/credentials/provider.ts`
- `apps/server/src/credentials/envelope.ts`
- `apps/server/src/credentials/errors.ts`
- `apps/server/src/credentials/index.ts`
- `apps/server/src/index.ts`
- `apps/server/src/config.ts`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/proposals/QFAT-013L3-linux-secret-service-production-integration-proposal.md`
- `reports/QFAT-013L3A-linux-secret-service-dependency-security-evaluation.md`
- `reports/QFAT-016-linux-secret-service-isolation-validation-report.md`
- Exact `@napi-rs/keyring@2.1.2` npm metadata, README, TypeScript declarations, and Rust source files `entry_builder.rs`, `linux_credential_builder.rs`, `result.rs`, and `options.rs`

No repository source or dependency files were changed by this task.
