# QFAT-017 — Design Linux Secret Service Process Boundary

- **Status:** READY FOR EXECUTION — design only
- **Task type:** Linux credential-storage implementation design / security review
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Previous accepted task:** QFAT-016 — Linux Secret Service isolation validation (ACCEPTED WITH FINDINGS)
- **Expected report:** `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md`
- **Design artifact:** `docs/design/QFAT-017-linux-secret-service-process-boundary.md`

## 1. Objective

Produce a concrete, reviewable implementation design for using Linux Secret Service through the conditionally validated `@napi-rs/keyring@2.1.2` candidate while containing native/D-Bus blocking in a dedicated child process.

QFAT-016 demonstrated the candidate's disposable-environment CRUD and child-process timeout behavior, but did not approve production adoption. This task must turn that evidence into a design that can be independently audited before any production code or dependency is changed.

## 2. Current owner decisions — binding constraints

- Linux is the only active credential-storage platform. Windows is deferred and unauthorized.
- Linux Secret Service (GNOME Keyring on the owner's Linux Mint environment) is the intended MVP key-storage interface.
- `@napi-rs/keyring@2.1.2` is a conditional candidate only; production adoption is not yet approved.
- Explicitly pin the `secret-service` backend. Never permit keyutils fallback.
- Use the default/login collection; custom collection management is not required for MVP.
- If Secret Service is locked or unavailable, fail closed and instruct the user to unlock it through Linux and retry.
- Do not fall back to plaintext, keyutils, or the old key file after a future cutover.
- Preserve the existing AES-256-GCM envelope and SQLite ciphertext format.
- Migration from the existing key-file provider must be explicit, separately authorized, and verified. Never migrate, overwrite, or delete real key material implicitly.
- No real credentials, desktop keyring contents, OAuth tokens, Page tokens, or app secrets may be used in design validation.
- All verification is local-only. Do not create, enable, trigger, or use GitHub Actions/hosted CI.
- Figma is cancelled and is not part of this work.

## 3. Required reading and inspection

Read the current versions on `main` after safely synchronizing:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `README.md` and relevant `CLAUDE.md` guidance
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `tasks/QFAT-016-linux-secret-service-isolation-validation.md`
- `reports/QFAT-016-linux-secret-service-isolation-validation-report.md`
- `apps/server/src/credentials/provider.ts`
- `apps/server/src/credentials/envelope.ts`
- Credential provider consumers, startup wiring, tests, and relevant server lifecycle code.
- Exact upstream source/API for `@napi-rs/keyring@2.1.2`, including Linux backend selection, constructor behavior, fallback behavior, errors, and object lifecycle.

Verify every referenced path exists. If actual source differs from documentation, document the discrepancy; source is authoritative for current behavior.

## 4. Required design coverage

### 4.1 Process boundary and lifecycle

Compare viable process models (for example, one child per operation versus a supervised persistent child). Recommend one for the QFAT MVP and justify it against:
- native constructor/D-Bus blocking;
- startup and per-operation timeout;
- child crash, hang, restart, and shutdown;
- concurrency and serialization;
- memory lifetime of key bytes;
- server shutdown and orphan-process prevention;
- operational complexity and reliability.

Specify:
- which process imports and constructs the native keyring package;
- exactly when the child is spawned;
- whether the child is reused or replaced;
- timeout start point and finite timeout policy (startup and operation);
- termination escalation (graceful signal, bounded grace period, force kill);
- how the parent confirms child exit and avoids orphan processes;
- behavior when the child cannot be terminated;
- concurrency limits and request ordering.

Do not assume a timeout around a Promise can interrupt synchronous native blocking. The OS process boundary must remain the containment mechanism.

### 4.2 IPC contract and secret hygiene

Define a minimal, versioned IPC protocol for the operations actually required by `CredentialProvider` (for example, load/create key, read existing key, or equivalent). Do not expose a generic arbitrary keyring API.

Specify:
- request/response message shapes and protocol version;
- correlation/request IDs if needed;
- validation and maximum message sizes;
- success and typed error responses;
- malformed, truncated, duplicate, late, or unexpected responses;
- child exit before response;
- stdout/stderr policy (no secret-bearing diagnostics);
- whether IPC uses stdin/stdout pipes or another local mechanism and why;
- how secret bytes cross the boundary without entering args, environment variables, logs, temp files, or browser/API responses;
- buffer handling and best-effort zeroing where feasible, with realistic limitations for JS/native copies.

Never log secret bytes, base64/hex encodings, plaintext, tokens, or key material. Do not claim guaranteed memory erasure where Node/native runtime semantics cannot guarantee it.

### 4.3 Backend selection and fail-closed behavior

Define how the child pins `{ linux: { store: 'secret-service' } }` for every relevant entry and makes keyutils fallback impossible.

Define stable parent-facing error categories for:
- keyring locked or default collection unavailable;
- D-Bus/service unavailable;
- native operation timeout;
- child crash/abnormal exit;
- malformed IPC/protocol mismatch;
- permission or unexpected provider failure.

Keep messages actionable but secret-free and avoid exposing absolute filesystem paths. Do not misclassify an unavailable collection as proof of a specific lock state unless the provider exposes reliable evidence.

### 4.4 CredentialProvider integration

Map the design to the existing `CredentialProvider` contract and current key-file implementation. Identify:
- exact future files/modules likely to change;
- how existing AES envelope and SQLite records remain untouched;
- how first-time key creation remains race-safe;
- how key caching works (parent, child, or neither) and its security/reliability trade-off;
- how missing key with existing encrypted records remains fatal;
- how server startup and request handling react to unavailable Secret Service;
- how test doubles preserve current tests.

Do not change the interface or implementation in this task. If the current interface cannot safely support the proposed design, explain the smallest required future change.

### 4.5 Migration and cutover boundary

Document a separate future migration sequence from the current key-file provider to Secret Service:
- explicit user/owner invocation and preconditions;
- verify existing encrypted records before migration;
- move the same 32-byte AES key without exposing it;
- verify Secret Service read-back and decryptability of existing records;
- atomicity/recovery if migration is interrupted;
- behavior when Secret Service is locked/unavailable;
- how the old key file is retained until verified cutover;
- when and how explicit retirement/deletion could occur.

This is design only. Do not perform migration or access real key material.

### 4.6 Security and failure analysis

Include a concise threat/failure table covering:
- parent and child compromise boundaries;
- child hang during constructor and during CRUD;
- repeated timeout/restart loops;
- malicious or malformed IPC;
- oversized messages;
- child stdout/stderr leakage;
- parent shutdown and orphan child;
- Secret Service unavailable/locked;
- default collection missing;
- concurrent first-run initialization;
- migration interruption;
- key loss and existing encrypted records.

State residual risks and which require owner decisions rather than silently choosing.

## 5. Explicit exclusions — MUST NOT

- Do not add `@napi-rs/keyring` to any package manifest or lockfile.
- Do not implement a production Secret Service provider or child process.
- Do not change `CredentialProvider`, the key-file provider, AES envelope, SQLite schema, migrations, or server startup.
- Do not wire the candidate into the app or change the default provider.
- Do not migrate, rotate, replace, read, or delete any real key or credential.
- Do not access, unlock, enumerate, or modify the owner's normal desktop keyring.
- Do not implement OAuth, account management, publishing, upload, or UI work.
- Do not test against real Google/Meta accounts or APIs.
- Do not implement or test Windows credential storage or Windows ACLs.
- Do not create or use hosted CI/GitHub Actions.
- Do not create Figma files or use Figma.

## 6. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | Required repository workflow, architecture, credential docs, QFAT-016 task/report, current provider source, and exact candidate package source/API are inspected. |
| AC-02 | A justified MVP process model is recommended, with startup/operation timeouts, termination escalation, crash handling, shutdown, concurrency, and orphan prevention specified. |
| AC-03 | A minimal versioned IPC contract is documented, including validation, typed responses, malformed/late messages, size limits, and secret hygiene. |
| AC-04 | Explicit Secret Service pinning/no-keyutils-fallback and fail-closed error mapping are specified. |
| AC-05 | Design maps to the existing CredentialProvider without changing AES-GCM envelope or SQLite ciphertext format. |
| AC-06 | Explicit, recoverable key-file-to-Secret-Service migration/cutover is designed but not executed. |
| AC-07 | Security/failure analysis and residual risks are documented; unproven lock-state behavior is not overstated. |
| AC-08 | Design clearly lists future implementation files and a bounded follow-up task proposal, without implementing it. |
| AC-09 | No production source, dependencies, lockfiles, schema, migration, key material, or user keyring state is changed. |
| AC-10 | No hosted CI is used; report records inspected sources and any checks performed. |
| AC-11 | Design artifact and report are committed and pushed to `main`; remote publication is verified. |

## 7. Deliverables

Create:
- `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md`

The design document must contain:
1. Executive recommendation and explicit assumptions.
2. Process architecture and lifecycle sequence diagram.
3. IPC protocol examples with synthetic, non-secret placeholders only.
4. Timeout/termination and error mapping tables.
5. CredentialProvider integration mapping.
6. Migration/cutover sequence and recovery behavior.
7. Threat/failure analysis and residual risks.
8. Exact future implementation scope and exclusions.
9. Open decisions requiring owner approval (if any).

The report must contain:
- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Task path, repository, branch, implementation commit message and full SHA.
- Files changed and scope.
- AC table with evidence.
- Source inspection and any verification performed.
- Findings, limitations, and open owner decisions.
- Required `## Git Publication` section using full SHAs and push verification.
- Handoff for GPT audit; do not claim owner acceptance.

No code tests are required because this is a documentation/design-only task. Do not run broad test suites unnecessarily.

## 8. Stop conditions

Stop and report BLOCKED if:
- current provider contract/source cannot be inspected;
- the candidate's exact backend selection or fallback behavior cannot be established from source/API evidence;
- the design would require weakening fail-closed behavior or changing the approved encryption format;
- a required design decision materially conflicts with existing owner decisions.

Do not resolve material owner decisions by assumption.

## 9. Handoff

After committing and pushing both documents to `main`, verify the remote commit and report only:
- Branch
- Commit message
- Full SHA
- Report path

Stop for GPT audit. Do not begin implementation, dependency installation, migration, OAuth, or another task.
