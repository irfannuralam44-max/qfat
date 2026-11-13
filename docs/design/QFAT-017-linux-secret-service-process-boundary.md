# QFAT — Linux Secret Service Evaluation and Process-Boundary Design

**Status: DESIGN ONLY — NOT IMPLEMENTED — BACKEND SELECTION BLOCKED**  
**Current active provider:** Linux `KeyFileCredentialProvider` only  
**Secret Service decision:** **NO APPROVED SECRET SERVICE BACKEND**  
**Related remediation:** QFAT-020  
**Platform scope:** Linux only. Windows remains deferred and unauthorized.

## 1. Executive decision

The current Linux `KeyFileCredentialProvider` remains the only active and approved credential provider. It stores AES-256-GCM envelope ciphertext in SQLite and obtains its 32-byte encryption key from the separate owner-only key file.

**No Linux Secret Service backend is approved. No production Secret Service integration or migration is authorized.**

The previously evaluated `@napi-rs/keyring@2.1.2` candidate is **REJECTED for production key storage under the current hard no-overwrite requirement**. Its `setSecret()` operation replaces an existing item; the inspected API did not establish an atomic create-if-absent/no-overwrite primitive. Read-check-write, read-back comparison, and a cooperative QFAT lock cannot provide the required guarantee against all writers.

This is a hard selection gate, not an unresolved invitation to accept a weaker cooperative-only guarantee. Do not create an implementation or migration task for this candidate. Do not install it in the QFAT repository.

A future Secret Service option can be reconsidered only when:
1. a specific backend and exact version are identified;
2. exact versioned source/API evidence establishes an enforceable no-overwrite create operation under the threat model, including concurrent and external writers;
3. the evidence is independently reviewed; and
4. the Owner separately approves a new, narrowly scoped task.

Alternatively, the Owner may change the hard no-overwrite requirement through an explicit recorded decision. Until one of those gates is met, the workstream remains blocked and the key-file provider remains active.

## 2. Current architecture and invariants

### 2.1 Existing provider contract

The existing business boundary remains:

```ts
interface CredentialProvider {
  store(context: CredentialContext, payload: Buffer): Promise<void>;
  retrieve(context: CredentialContext): Promise<Buffer | null>;
  delete(context: CredentialContext): Promise<boolean>;
}
```

`CredentialStorageError` remains the typed error boundary. No change to this contract is proposed or authorized.

### 2.2 Existing Linux key-file provider

The current `KeyFileCredentialProvider` remains active and unchanged. Its relevant properties are documented in:
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`

The current provider:
- generates a 32-byte cryptographically random key only for first initialization when no encrypted credential records exist;
- publishes the key file with exclusive/no-overwrite filesystem semantics and the required durability checks;
- stores encrypted credential envelopes in SQLite;
- fails closed when key material is missing, malformed, unreadable, or unsafe while encrypted records may exist;
- retains its existing process-local key caching behavior.

These responsibilities are not transferred to a hypothetical Secret Service component.

### 2.3 Invariants for any future design

- Preserve the current `CredentialProvider` business contract.
- Preserve AES-256-GCM envelope semantics and AAD.
- Preserve SQLite ciphertext schema and repository behavior.
- Never regenerate a key when encrypted records exist.
- Never fall back to plaintext, keyutils, an environment variable, or another unapproved key source.
- Never silently fall back to the key file after a future cutover.
- Migration must be a separate, explicit, owner-approved operation.
- Linux is the only active credential-storage platform. Windows work is not authorized.

## 3. Previously evaluated candidate — evidence and rejection

Candidate evaluated: `@napi-rs/keyring@2.1.2`.

Inspected API/source references in the prior evaluation:
- npm package metadata and README for version 2.1.2;
- `index.d.ts`;
- `src/entry_builder.rs`;
- `src/linux_credential_builder.rs`;
- `src/result.rs`;
- `src/options.rs`;
- QFAT-016 isolated runtime validation report.

Relevant exposed API includes `Entry`/`AsyncEntry`, `setSecret`, `getSecret`, and `deleteCredential`. Linux backend selection can be pinned to `secret-service`; omitting the selection may permit fallback behavior and is not acceptable for a future implementation.

The critical limitation is that `setSecret()` replaces an existing item. The inspected API does not expose a proven atomic create-if-absent operation. Therefore:
- read then set is a race;
- read-back only observes state after the write;
- read-back cannot restore a value that was overwritten;
- a QFAT-only lock coordinates only cooperating QFAT processes using that lock;
- a QFAT-only lock does not exclude external Secret Service clients or non-cooperating writers.

**Decision: NOT SUITABLE for production under the current hard no-overwrite requirement.**

No alternative backend has been selected or proven. **NO APPROVED SECRET SERVICE BACKEND.**

### 3.1 Informational error behavior only

The error observations below describe the rejected candidate for audit/history. They are not an implementation specification and do not authorize adopting the package.

- `getSecret()` returning `null` represents an absent item according to the API declaration.
- `deleteCredential()` returning `false` represents an absent item according to the API declaration.
- The candidate exposes JavaScript errors and messages rather than a stable, documented native error-code contract suitable for exhaustive semantic classification.
- QFAT-016 observed a D-Bus connection failure and an inaccessible/unavailable default/login collection in its isolated environment.
- QFAT-016 did not establish a reliable distinction between a locked collection, inaccessible collection, permission denial, or every possible native failure.

No exact native permission-denied error value has been established. The design therefore does not authorize emitting a confirmed permission-denied or confirmed-locked classification from generic candidate errors.

## 4. Future process-boundary concept — conditional and unauthorized

A process boundary may be useful if a future approved native client can block synchronously during D-Bus setup or operations. The following is a **non-binding design constraint only**. It is not a recommendation to implement a child process around the rejected candidate.

If, and only if, a backend passes the no-overwrite selection gate and receives separate Owner authorization, a future design may use:
- a parent-owned supervisor;
- one isolated child as the sole native API caller;
- bounded, versioned IPC;
- FIFO serialization and bounded queueing;
- operation/startup timeouts;
- fail-closed handling of child failure;
- no raw-key cache in the parent.

No child, supervisor, adapter, dependency, or provider is currently approved or implemented.

## 5. Deterministic reference IPC contract

This section records a protocol shape for future evaluation of a backend that has first passed the no-overwrite gate. It is not authorization to build or use the rejected candidate. It must be reviewed again against the selected backend before any future implementation.

### 5.1 Transport and byte framing

- Transport: one JSON object per line (NDJSON) over child stdin/stdout.
- Encoding: strict UTF-8. Invalid UTF-8 is a protocol error; replacement-character decoding is forbidden.
- Delimiter: LF byte (`0x0A`). CRLF is accepted by removing exactly one CR byte immediately before LF. A bare CR elsewhere is ordinary JSON whitespace only where JSON permits it; it is not a record delimiter.
- Maximum line payload: 16,384 bytes, excluding the LF delimiter and excluding the single optional CR immediately before LF. The limit is measured on raw bytes, not JavaScript character count.
- Every complete record must contain exactly one JSON object. Empty lines, arrays, scalars, multiple objects on one line, invalid JSON, and unknown fields are rejected.
- At EOF, a non-empty unterminated byte buffer is a truncated final record and is a protocol error. The receiver must not parse or accept it as a complete message.
- An over-limit record is rejected immediately; the receiver terminates the child and fails the active request.
- The child stdout is protocol-only. No logs, warnings, banners, or debug output may be written to stdout.
- stderr is not part of the protocol.

### 5.2 Common field rules

- `protocolVersion` is the integer `1`; no other value is accepted.
- `requestId` is an ASCII string of 1–128 bytes matching `^[A-Za-z0-9._:-]+$`. IDs are unique for the lifetime of one child process.
- Object keys are case-sensitive.
- Unknown fields are forbidden on every message.
- Missing required fields, fields with the wrong type, non-finite numbers, and `null` where not explicitly allowed are protocol errors.
- No message may contain credentials other than the designated `secretBase64` field in a store request or successful retrieve response.

### 5.3 READY handshake

The first stdout record after child spawn must be exactly:

```json
{
  "protocolVersion": 1,
  "messageType": "ready",
  "status": "ready"
}
```

Required fields: `protocolVersion`, `messageType`, `status`. No other fields are allowed.

Allowed values are exactly `1`, `"ready"`, and `"ready"` respectively. READY has no request ID and is not an operation response.

The parent sends no request before receiving and validating READY. Any other first record, additional stdout record before READY, invalid framing, timeout, or child exit before READY fails startup. The parent terminates the child. A child that cannot become ready is not used.

### 5.4 Requests

Every request includes exactly `protocolVersion`, `requestId`, and `operation`, plus only the operation-specific fields below.

**Store**

```json
{
  "protocolVersion": 1,
  "requestId": "unique-id",
  "operation": "store",
  "service": "qfat",
  "account": "credential-key",
  "secretBase64": "canonical-base64"
}
```

Required fields: common request fields plus `service`, `account`, `secretBase64`. Forbidden: every other field. `service` and `account` are non-empty UTF-8 strings, each at most 256 bytes, with no NUL byte. `secretBase64` must be canonical standard Base64 and decode to exactly 32 bytes.

**Retrieve**

```json
{
  "protocolVersion": 1,
  "requestId": "unique-id",
  "operation": "retrieve",
  "service": "qfat",
  "account": "credential-key"
}
```

Required fields: common request fields plus `service`, `account`. Forbidden: `secretBase64` and every other extra field. Service/account validation is identical to store.

**Delete**

```json
{
  "protocolVersion": 1,
  "requestId": "unique-id",
  "operation": "delete",
  "service": "qfat",
  "account": "credential-key"
}
```

Required fields: common request fields plus `service`, `account`. Forbidden: `secretBase64` and every other extra field.

**Shutdown**

```json
{
  "protocolVersion": 1,
  "requestId": "unique-id",
  "operation": "shutdown"
}
```

Required fields: common request fields only. `service`, `account`, `secretBase64`, and every other extra field are forbidden.

### 5.5 Responses

Every operation response includes exactly `protocolVersion`, `requestId`, `operation`, and `ok`, plus the fields specified below. The response `requestId` and `operation` must exactly match the single in-flight request.

**Successful store**

```json
{"protocolVersion":1,"requestId":"unique-id","operation":"store","ok":true}
```

No additional fields are allowed.

**Successful retrieve — item absent**

```json
{"protocolVersion":1,"requestId":"unique-id","operation":"retrieve","ok":true,"found":false}
```

Exactly one additional field, `found:false`, is required. `secretBase64` is forbidden.

**Successful retrieve — item present**

```json
{"protocolVersion":1,"requestId":"unique-id","operation":"retrieve","ok":true,"found":true,"secretBase64":"canonical-base64"}
```

Exactly `found:true` and `secretBase64` are required. The Base64 value must be canonical and decode to exactly 32 bytes.

**Successful delete**

```json
{"protocolVersion":1,"requestId":"unique-id","operation":"delete","ok":true,"deleted":true}
```

Exactly one additional field, `deleted`, is required and must be boolean. `false` means the item was absent. No other fields are allowed.

**Successful shutdown acknowledgement**

```json
{"protocolVersion":1,"requestId":"unique-id","operation":"shutdown","ok":true}
```

No additional fields are allowed. After this acknowledgement the child closes stdout and exits with code 0 within the shutdown grace period.

**Error response**

```json
{
  "protocolVersion": 1,
  "requestId": "unique-id",
  "operation": "retrieve",
  "ok": false,
  "code": "SECRET_SERVICE_OPERATION_FAILED",
  "message": "Credential operation failed"
}
```

Required fields are exactly `protocolVersion`, `requestId`, `operation`, `ok:false`, `code`, and `message`. `code` must be one of the generic child-operation codes defined in section 6. `message` is a short sanitized, non-secret string no longer than 256 UTF-8 bytes. Raw native messages, stack traces, D-Bus payloads, paths, secret material, and tokens are forbidden.

An error response must match the active request ID and operation. An error response with a mismatched operation is a protocol violation, not an operation error.

### 5.6 Correlation and unsolicited messages

- At most one operation is in flight. A response with an unknown ID, wrong operation, reused ID, or no active request is unsolicited/mismatched and causes a protocol failure.
- A second response for a completed request is a duplicate and causes a protocol failure.
- A response arriving after the active request timed out is late. The parent has already failed and terminated that child; it must not accept the late response.
- Any operation response before READY is a protocol failure.
- The parent never attempts to correlate by arrival order alone; both ID and operation must match.
- On any protocol violation, the child is marked FAILED, the active request fails with `SECRET_SERVICE_PROTOCOL_ERROR`, queued requests fail with `SECRET_SERVICE_CHILD_UNAVAILABLE`, and the child is terminated.

### 5.7 Queue, backpressure, and ordering

- The parent owns a FIFO queue.
- Maximum outstanding operations: 8 total, **including the in-flight operation**. Thus at most one is active and at most seven wait.
- The ninth outstanding request is rejected immediately with `SECRET_SERVICE_CHILD_UNAVAILABLE`; it is not queued.
- Requests are dispatched in FIFO order. A child restart begins a new process session; requests from the failed session are never carried over or replayed.
- No request is dispatched until READY has been validated.
- The parent validates all request data before admission to the queue.
- A queue admission failure is returned to the caller synchronously as a typed unavailable error.

### 5.8 Shutdown admission and outcomes

Shutdown is initiated only by parent lifecycle code.

1. The parent atomically closes admission. Every new operation is immediately rejected with `SECRET_SERVICE_CHILD_UNAVAILABLE`.
2. If one operation is active, it is allowed to finish within its already-running operation timeout. No queued operation is started.
3. Every queued-but-not-started operation is rejected with `SECRET_SERVICE_CHILD_UNAVAILABLE`.
4. After the active operation completes or fails, the parent sends the exact shutdown request with a fresh request ID.
5. The parent requires the exact successful shutdown acknowledgement, then requires child exit code 0 and closed stdout within 2,000 ms.
6. If acknowledgement is missing, malformed, late, or mismatched, or exit is not confirmed within 2,000 ms, the parent sends SIGTERM, waits up to 2,000 ms, then sends SIGKILL and waits up to a further 2,000 ms.
7. If exit still cannot be confirmed, the supervisor enters FAILED/FATAL and reports `SECRET_SERVICE_CHILD_UNAVAILABLE`. It must not spawn another child in that server lifetime.

If shutdown begins while an active operation times out, that operation receives its timeout result; the child is terminated and no shutdown request is sent to the failed child.

### 5.9 Failure outcomes and no replay

| Event | Active request | Queued requests | Child/session |
|---|---|---|---|
| Operation timeout | `SECRET_SERVICE_OPERATION_TIMEOUT`; for store, outcome is indeterminate | All fail `SECRET_SERVICE_CHILD_UNAVAILABLE` | Terminate; no restart in same server lifetime |
| Malformed/invalid/oversized/truncated IPC | `SECRET_SERVICE_PROTOCOL_ERROR` | All fail `SECRET_SERVICE_CHILD_UNAVAILABLE` | Terminate; no restart in same server lifetime |
| Child exits before response | `SECRET_SERVICE_CHILD_CRASH`; store outcome is indeterminate | All fail `SECRET_SERVICE_CHILD_UNAVAILABLE` | A later new caller may cause at most one fresh child start only if exit was confirmed and no timeout/protocol failure occurred |
| Child cannot start or READY fails | No operation admitted; startup caller gets `SECRET_SERVICE_CHILD_UNAVAILABLE` | All fail `SECRET_SERVICE_CHILD_UNAVAILABLE` | Mark unavailable |
| Forced termination cannot be confirmed | Active gets its original failure or child-unavailable result | All fail `SECRET_SERVICE_CHILD_UNAVAILABLE` | FATAL; no restart this server lifetime |
| Graceful shutdown | Active operation may finish normally | All queued requests fail `SECRET_SERVICE_CHILD_UNAVAILABLE` | Shutdown acknowledgement then exit |

A store timeout or child crash after dispatch has an **indeterminate outcome**: the operation may or may not have reached the backend. The parent must not retry it automatically and must not report that the item is absent or that the write definitely failed. The caller receives a typed failure whose message explicitly says the write outcome is unknown. Any later reconciliation is a separate retrieve/read operation initiated by higher-level logic; it is not a replay of the write.

### 5.10 stderr and secret memory

- stderr capture is bounded to 4 KiB per child lifetime. Excess output is truncated and counted; it does not enter stdout.
- Only fixed diagnostic categories may be logged: child start/exit, timeout, protocol failure, queue full, sanitized backend category, and forced termination.
- Never log raw stderr, arbitrary native error text, request/response bodies, Base64, hex, tokens, key bytes, plaintext, database paths, or account identifiers.
- Redact URL query strings and secret-like substrings before any permitted diagnostic is emitted. Prefer fixed category messages over pattern-based sanitization.
- Raw key bytes may cross IPC only in the designated Base64 field when a future authorized protocol requires it. They must never be placed in argv, environment variables, temporary files, logs, or non-protocol stdout/stderr.
- Parent and child clear mutable buffers/references on a best-effort basis immediately after use. JavaScript strings are immutable and native/runtime copies may remain; guaranteed zeroization must never be claimed.

### 5.11 State model

| State | Event | Next state | Required behavior |
|---|---|---|---|
| STOPPED | First credential operation | STARTING | Spawn one child; start READY timeout |
| STARTING | Exact READY received | READY | Admit queued operations |
| STARTING | Invalid/missing/late READY or child exit | FAILED | Fail admission; terminate child |
| READY | Dispatch one queued operation | BUSY | Exactly one in flight |
| BUSY | Valid matching success/error response | READY | Resolve active request; dispatch next FIFO item |
| BUSY | Timeout, protocol violation, child exit | FAILED | Fail active and all queued; terminate child |
| READY | Parent shutdown begins | STOPPING | Close admission; reject queued work |
| BUSY | Parent shutdown begins | STOPPING | Close admission; let active operation finish within its existing timeout |
| STOPPING | Active settles | STOPPING | Send shutdown request if child remains healthy |
| STOPPING | Ack and confirmed exit | STOPPED | Close pipes and release supervisor |
| STOPPING | Shutdown/termination cannot confirm exit | FAILED | Mark fatal; no restart |
| FAILED | Parent shutdown | STOPPING | Best-effort terminate/close only |

No operation may be dispatched in STARTING, STOPPING, or FAILED. A protocol failure or timeout is terminal for that child session.

## 6. Conservative error taxonomy — informational, non-authorizing

The following parent-facing categories are a future design vocabulary only. They do not authorize the rejected candidate.

| Observable condition | Safe category | What may be concluded |
|---|---|---|
| Parent-side operation deadline expires | `SECRET_SERVICE_OPERATION_TIMEOUT` | The request exceeded the parent deadline; write outcome may be indeterminate |
| Child exits before a matching response | `SECRET_SERVICE_CHILD_CRASH` | Child exited; native operation outcome may be indeterminate |
| Child fails to spawn or READY handshake fails | `SECRET_SERVICE_CHILD_UNAVAILABLE` | No usable child session was established |
| Invalid framing, UTF-8, JSON, schema, ID, or operation | `SECRET_SERVICE_PROTOCOL_ERROR` | IPC contract was violated |
| Queue limit reached or admission closed | `SECRET_SERVICE_CHILD_UNAVAILABLE` | Request was not admitted |
| Explicitly observed D-Bus socket/transport connection failure (as in QFAT-016) | `SECRET_SERVICE_UNAVAILABLE` | Transport connection failed in that observed case only |
| Default/login collection inaccessible with no reliable state discriminator (as in QFAT-016) | `SECRET_SERVICE_UNAVAILABLE_OR_LOCKED` | Collection state is unknown/inaccessible; do not claim confirmed locked |
| Candidate `getSecret()` returns `null` | Not an error; item absent | API declaration describes absence |
| Candidate `deleteCredential()` returns `false` | Not an error; item absent | API declaration describes absence |
| Candidate `Ambiguous` failure | `SECRET_SERVICE_OPERATION_FAILED` | Operation did not produce a usable result; do not infer permissions or lock state |
| Any other native error, generic access failure, or unmapped condition | `SECRET_SERVICE_OPERATION_FAILED` | Exact cause is unknown; fail closed |

`SECRET_SERVICE_PERMISSION_DENIED` is **not an approved emitted category** for this candidate. It may be introduced only if a future selected backend's exact versioned source/API exposes an affirmative, stable permission-denied signal and tests establish its mapping. Generic D-Bus failures, collection access failures, `NoEntry`, and free-form error text are insufficient.

The candidate exposes no stable exhaustive native error-code contract in the inspected material. Message-string matching is brittle and is not accepted as proof of a semantic category. Unknown errors map to the generic operation-failed category and are never returned raw to callers.

**All candidate-specific mappings in this section are informational only. They cannot authorize dependency selection, implementation, or migration.**

## 7. Provider ownership and data boundaries

### 7.1 Responsibility matrix

| Responsibility | Current owner | Future Secret Service owner if separately approved | Current status |
|---|---|---|---|
| Key generation | Existing `KeyFileCredentialProvider` using Node crypto | Not assigned; no Secret Service actor approved | Existing provider only |
| First-use initialization | Existing `KeyFileCredentialProvider`, including encrypted-row check and atomic no-overwrite file publication | Not assigned | Existing provider only |
| Hard no-overwrite guarantee | Existing key-file implementation's exclusive/no-overwrite filesystem publication | Must be proven by selected backend/API before any task | No backend approved |
| Secret Service create/read/delete | None | A minimal native child after backend approval | Not implemented/not authorized |
| Native package import/construction | None | Child process only, after backend approval | Not implemented/not authorized |
| Parent supervision and lifecycle | None | Proposed parent adapter/supervisor | Not implemented/not authorized |
| IPC framing/schema/queue | None | Proposed parent adapter validates both directions | Not implemented/not authorized |
| Key bytes crossing IPC | None | Parent and child only, through explicitly authorized protocol fields | Not implemented/not authorized |
| Raw-key caching | Existing provider's current process-local cache | No parent raw-key cache; child cache prohibited unless separately approved | No future cache approved |
| Encrypted-record detection and fail-closed decision | Existing `KeyFileCredentialProvider` | Existing provider remains semantic owner; any future key-store seam must preserve it | Existing provider only |
| AES-256-GCM envelope and AAD | Existing envelope/provider layer | Same existing layer; no duplicate implementation | Existing, unchanged |
| SQLite ciphertext persistence | Existing SQLite repository/schema | Same existing repository/schema | Existing, unchanged |
| Migration and key-file retention | No migration actor currently authorized | Separate explicit migration operation after backend approval | Not authorized |

The current key-file provider is the sole owner of key generation and first-use initialization today. No hypothetical Secret Service parent, child, adapter, or backend is authorized to generate or store the production key.

### 7.2 Proposed module names are not authorization

The following names are placeholders only. They do not constitute an implementation plan or permission to create the files:

- `apps/server/src/credentials/key-store.ts`
- `apps/server/src/credentials/secret-service-key-store.ts`
- `apps/server/src/credentials/secret-service-child.ts`

They are **not implemented and not authorized**. Do not create a task to implement them until the backend-selection gate in section 1 has passed.

## 8. Migration and cutover gate

Migration is **not authorized** and cannot be planned as an executable sequence while no backend is approved.

A future migration task may be authored only after:
1. a backend passes the hard no-overwrite selection gate;
2. exact versioned API/source evidence and independent review are recorded;
3. the Owner explicitly approves the backend and migration task; and
4. the migration task defines backup, recovery, interruption, verification, rollback, and key-file retention.

Any future migration must preserve the current key-file provider and key file until all verification and owner-approved retention conditions are satisfied. It must not call an unavailable create-if-absent method, use read-check-write as a substitute, or overwrite an existing Secret Service item. If the no-overwrite property cannot be guaranteed, migration remains blocked.

The existing key-file provider remains active before, during, and after this design-only stage. No dual-write, silent dual-read, fallback, or cutover behavior is introduced here.

## 9. Threats, failure handling, and residual risks

| Threat/failure | Safe response or current limitation |
|---|---|
| No backend satisfies hard no-overwrite | Keep key-file provider; do not implement Secret Service |
| Candidate replaces existing item | Candidate rejected; do not install or call it for production key storage |
| External Secret Service writer races with QFAT | No cooperative lock can prove protection; backend selection remains blocked |
| D-Bus constructor/operation blocks | A future approved backend may require a process boundary; no child is currently authorized |
| Child protocol violation | Future reference protocol fails active and queued requests closed |
| Child crash/timeout during store | Report indeterminate write outcome; never replay automatically |
| Secret Service unavailable/inaccessible | No active impact: current key-file provider remains in use |
| Encrypted records exist but current key is missing/invalid | Existing provider fails closed; never regenerate a replacement key |
| Migration interrupted | No migration exists; future migration must be separately designed and authorized |
| Key bytes remain in JS/native memory | Best-effort clearing only; no guaranteed zeroization claim |
| Key-file loss | Existing encrypted credentials may be unrecoverable; preserve documented backup/restore requirements |

Residual risks for the current approved state remain those documented in QFAT-013 and ADR-004. This design does not reduce or replace them.

## 10. Open decisions and future gate

There is one blocking technical gate: identify a Secret Service client/API with a proven hard no-overwrite primitive, supported by exact versioned source/API evidence and independent review.

The Owner may separately decide to change the hard no-overwrite requirement, but no such change is assumed or requested by this design. A cooperative-only lock is not an acceptable substitute under the current requirement.

After the technical gate is satisfied, separate Owner decisions will still be needed for:
- backend/dependency approval;
- default collection behavior and user unlock experience;
- process lifecycle/timeouts based on the selected backend;
- migration invocation, backup/recovery, rollback, and key-file retention;
- any child cache (default: none).

None of these decisions is made by this document.

## 11. Future work authorization boundary

No future implementation task is currently authorized.

In particular, do not:
- install or add `@napi-rs/keyring@2.1.2` or another unapproved dependency;
- implement a Secret Service provider, adapter, child, supervisor, lock, or IPC;
- change the active key-file provider;
- create or execute a migration;
- read, unlock, enumerate, create, rotate, migrate, overwrite, or delete real key material;
- perform OAuth, account connection, upload, or publishing operations;
- implement or test Windows credential storage;
- use hosted CI/GitHub Actions or Figma.

The next permissible action is **backend research/evaluation only**, after a separate task is authored and approved. It must seek exact evidence of hard no-overwrite semantics. If no candidate meets the requirement, retain the key-file provider and report the blocker; do not weaken the requirement by assumption.

## 12. Evidence and verification boundary

This design consolidates the following repository evidence:
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`;
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`;
- `reports/QFAT-016-linux-secret-service-isolation-validation-report.md`;
- QFAT-017/QFAT-018/QFAT-019 design and audit history;
- the prior inspection of `@napi-rs/keyring@2.1.2` npm metadata, README, TypeScript declarations, and Rust source listed in section 3.

The deterministic IPC rules in section 5 are a proposed protocol contract authored for clarity. They are not claims about behavior already implemented or tested by the candidate package.

No production source, test, dependency, lockfile, database schema, migration, key material, or user keyring state is changed or authorized by this design. No typecheck, build, or code test is applicable to this documentation-only update.
