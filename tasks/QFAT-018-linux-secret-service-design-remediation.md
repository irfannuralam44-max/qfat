# QFAT-018 — Linux Secret Service Design Remediation

- **Status:** READY FOR EXECUTION — design/documentation only
- **Task type:** Security design remediation
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Depends on:** QFAT-017 — ACCEPTED WITH FINDINGS (design scope only)
- **Primary design:** `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- **Audit record:** `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md`
- **Expected deliverables:**
  - Update `docs/design/QFAT-017-linux-secret-service-process-boundary.md` in place.
  - Create `reports/QFAT-018-linux-secret-service-design-remediation-report.md`.

## 1. Objective

Resolve every mandatory QFAT-017 audit finding in the existing Linux Secret Service process-boundary design. Produce one internally consistent, security-reviewable design before any production implementation is considered.

This is a **design-only** task. It does not authorize production dependency adoption, provider/child-process implementation, startup wiring, migration, key-file retirement, or any Windows work.

## 2. Binding owner constraints

- Linux credential storage only. Windows remains deferred and unauthorized.
- `@napi-rs/keyring@2.1.2` remains a conditional candidate, not an approved production dependency.
- Every candidate keyring entry must explicitly pin `{ linux: { store: 'secret-service' } }`; keyutils fallback is prohibited.
- Use the default/login collection; do not add custom collection management for MVP.
- If Secret Service is inaccessible, fail closed and give actionable unlock/retry guidance without falsely claiming a confirmed locked state.
- Preserve the current AES-256-GCM envelope, SQLite ciphertext format, and `CredentialProvider` business contract unless a future separately authorized task proves a minimal interface change is necessary.
- The current key-file provider remains active and unchanged. Never read, move, overwrite, or delete real key material in this task.
- No real credentials, normal desktop keyring access, OAuth, live accounts, uploads, publishing, UI, Figma, or hosted CI.
- All verification is local-only. Do not create, enable, trigger, or use GitHub Actions.

## 3. Required reading and inspection

After safely synchronizing `main`, read:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- relevant `README.md` and `CLAUDE.md` guidance
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `tasks/QFAT-017-linux-secret-service-process-boundary-design.md`
- `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md`
- current credential provider, key-file implementation, error types, configuration, server startup/lifecycle, and relevant tests.
- exact upstream `@napi-rs/keyring@2.1.2` source/API for item creation/replacement semantics, Linux Secret Service calls, backend pinning, errors, and any available atomic/no-overwrite behavior.

Verify referenced paths and inspect current source; source is authoritative. The current key-file implementation uses exclusive publication/no-overwrite semantics (including hard-link publication) to converge concurrent first starts. Compare the Secret Service design against that established safety property.

## 4. Mandatory remediation

### 4.1 Key creation race — blocking security finding

The QFAT-017 proposal `get() → setSecret() → get()` is not an atomic create-if-absent operation. It must not be described as race-safe merely because a read-back comparison follows the write.

Investigate and compare viable strategies, including (but not limited to):
- a Secret Service API operation that provides a proven create-with-replace-disabled/no-overwrite guarantee;
- an enforceable cross-process single-writer lock for all QFAT instances sharing the same data directory, including acquisition, ownership, process identity, release, crash recovery, stale-lock handling, permissions, symlink/path safety, and behavior if lock ownership cannot be proven;
- an OS-level primitive or existing repository mechanism that can provide the required guarantee without an unapproved dependency;
- rejecting the candidate/package if no safe guarantee can be established.

For each strategy, state precisely which actors it protects against (QFAT processes sharing one data directory, multiple QFAT data directories, other local applications/users, or external Secret Service writers). A cooperative QFAT lock does not protect against non-cooperating writers; do not overclaim.

The selected design must guarantee that QFAT never silently overwrites a pre-existing or concurrently-created different key. If that guarantee cannot be established with the candidate and approved constraints, mark the candidate **NOT SUITABLE** and recommend a safe alternative or BLOCKED decision for owner review. Do not weaken the requirement to “best effort”.

Include a concrete interleaving/race analysis and deterministic test plan covering two simultaneous first-start processes, an already-existing item, a competing external writer where relevant, process crash while holding the lock, stale lock, and uncertain lock ownership. Do not execute against real keyring data.

### 4.2 Child lifecycle consistency

Choose exactly one MVP lifecycle:
- child spawned and READY-checked during server startup; or
- child spawned lazily on the first credential operation.

Align every diagram, narrative, readiness rule, failure behavior, and shutdown rule with that choice. Explain why it is appropriate for the current server lifecycle and when Secret Service unavailability should surface. Do not leave alternative lifecycle modes open-ended.

Specify behavior for startup timeout, first-use timeout, child crash, restart policy, server shutdown, and child that cannot be confirmed exited.

### 4.3 Error classification

Define stable parent-facing categories that distinguish:
- confirmed service/transport unavailable;
- inaccessible-or-locked/unknown collection state when the provider cannot distinguish;
- confirmed permission denial (only when evidence supports it);
- operation timeout;
- child crash/unavailable;
- protocol violation;
- unexpected native failure.

Do not emit a definitive `SECRET_SERVICE_LOCKED` category based solely on a generic failure or unavailable collection. Actionable user guidance may say to unlock the Linux keyring and retry, while the recorded cause remains unknown/inaccessible.

Map candidate native errors to parent categories only where source/API evidence supports the mapping. Include unknown/unmapped fallback behavior.

### 4.4 IPC and supervisor operational completeness

Make the protocol implementable and testable by specifying:
- exact READY handshake and protocol-version negotiation;
- exact allowed request/response schema for each operation, including required/forbidden fields;
- request/response ID and operation matching;
- bounded NDJSON line framing and behavior for truncated final lines, invalid UTF-8/JSON, oversized lines, duplicate, late, and unsolicited responses;
- queue maximum, backpressure/rejection behavior, FIFO semantics, and shutdown admission behavior;
- exact fate of the active request and queued requests after timeout, malformed IPC, child exit, or forced termination;
- no automatic replay of a write whose completion is ambiguous;
- stderr capture limits and safe diagnostic policy;
- secret buffer lifetime and best-effort clearing limitations.

A timeout around a Promise is not a mechanism for interrupting synchronous native blocking. Keep OS process termination as the containment boundary.

### 4.5 Provider mapping and migration boundary

Reconcile the design with the actual current `KeyFileCredentialProvider`, key-file race-safe initialization, existing error union, server startup behavior, and `CredentialProvider` contract.

State exactly which future module owns:
- the single-writer guarantee;
- Secret Service create/read/delete;
- key bytes crossing IPC;
- key cache (if any);
- fail-closed behavior when encrypted records exist but the key is missing or inaccessible.

Keep migration a separate explicit task. Preserve the old key file until a separately authorized, verified cutover and rollback/retention policy. Do not perform migration.

## 5. Explicit exclusions — MUST NOT

- Do not edit production TypeScript/source, tests, package manifests, lockfiles, generated output, database schema, or migrations.
- Do not add/install/update dependencies.
- Do not implement a child process, supervisor, provider, lock, or key-store adapter.
- Do not change the current key-file provider or its active behavior.
- Do not access, unlock, enumerate, or modify the owner's normal desktop keyring.
- Do not read, create, rotate, migrate, overwrite, or delete real key material.
- Do not run live OAuth, account, upload, publishing, or platform API operations.
- Do not implement or test Windows credential storage.
- Do not use hosted CI/GitHub Actions.
- Do not use Figma.

## 6. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | Required workflow, QFAT-017 task/design/report, credential architecture/docs, current provider/key-file/error/config/startup source, and exact candidate API/source are inspected. |
| AC-02 | The non-atomic key creation issue is resolved with a proven no-overwrite design, or the candidate is explicitly rejected/BLOCKED. No best-effort race claim is accepted. |
| AC-03 | Race/interleaving analysis identifies the protected actors and limitations; deterministic tests cover simultaneous first start, pre-existing key, competing writer where applicable, crash/stale lock, and uncertain ownership. |
| AC-04 | Exactly one child lifecycle is selected and consistently specified across startup, readiness, failure, restart, and shutdown. |
| AC-05 | Error mapping does not misclassify generic unavailability as a confirmed locked state; mapping is grounded in candidate evidence. |
| AC-06 | IPC READY/version/schema/framing/size/queue/backpressure/late/duplicate/crash/timeout/shutdown behavior is fully specified, including no ambiguous write replay. |
| AC-07 | Provider integration matches current source and preserves AES-GCM envelope, SQLite format, current provider contract, and explicit migration boundary. |
| AC-08 | Updated design clearly identifies any unresolved owner decision and whether the candidate is suitable for a future bounded implementation task. |
| AC-09 | No production source, dependency, lockfile, schema, migration, key material, or user keyring state is changed. |
| AC-10 | No hosted CI is used; report records exact source/API inspected and verification performed (design review only; no code tests required). |
| AC-11 | Updated design and report are committed and pushed to `main`; remote publication is verified. |

## 7. Deliverables and report

Update in place:
- `docs/design/QFAT-017-linux-secret-service-process-boundary.md`

Create:
- `reports/QFAT-018-linux-secret-service-design-remediation-report.md`

The report must include:
- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Task path, repository, branch, commit message, full implementation SHA.
- Files changed and explicit documentation-only scope.
- AC table with concrete evidence.
- Exact candidate source/API files and version inspected.
- Race strategy comparison, selected guarantee, and residual limitations.
- Child lifecycle choice and complete IPC/supervisor decisions.
- Findings and owner decisions still open.
- Git Publication section with full SHA and remote push verification.
- Handoff for GPT audit; never claim owner acceptance.

No code tests are required because this is a documentation-only task. Do not run broad suites.

## 8. Stop conditions

Stop and report BLOCKED if:
- a no-overwrite guarantee cannot be established without weakening the security requirement;
- candidate source/API semantics cannot be verified;
- safe cross-process lock ownership/recovery cannot be specified;
- the proposed design conflicts with owner constraints;
- a material owner decision is required.

Do not resolve a material security decision by assumption. If the candidate is unsuitable, document why and present the smallest safe alternative for owner review; do not implement it.

## 9. Handoff

After updating the design and publishing the report to `main`, provide only:
- Branch
- Commit message
- Full SHA
- Report path

Stop for GPT audit. Do not begin implementation, dependency installation, migration, or another task.
