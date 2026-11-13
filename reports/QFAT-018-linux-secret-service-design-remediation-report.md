# Implementation Report — QFAT-018

- Status: PASS WITH FINDINGS
- Task specification: tasks/QFAT-018-linux-secret-service-design-remediation.md
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Commit message: docs(QFAT-018): remediate Linux Secret Service design no-overwrite analysis
- Commit SHA: Pending

## Scope

Documentation-only remediation. Updated `docs/design/QFAT-017-linux-secret-service-process-boundary.md` in place and created this report. No production source, dependency, manifest, lockfile, schema, migration, key material, or user keyring state was changed.

## Files changed

- `docs/design/QFAT-017-linux-secret-service-process-boundary.md` — no-overwrite analysis, lifecycle consistency, error classification, IPC/supervisor details, and residual risk updates.
- `reports/QFAT-018-linux-secret-service-design-remediation-report.md` — this report.

## Acceptance criteria

| ID | Result | Evidence |
|---|---|---|
| AC-01 | PASS | Inspected required workflow, QFAT-017 task/design/report, credential architecture/docs, current provider/key-file/error/config/startup source, and exact candidate API/source |
| AC-02 | PASS | Candidate is explicitly marked not suitable for the hard no-overwrite requirement unless owner accepts residual external-writer risk; read-back comparison is not claimed as a guarantee |
| AC-03 | PASS | Race interleavings, protected-actor table, deterministic test requirements, and crash/stale-lock/uncertain-ownership scenarios are documented |
| AC-04 | PASS | Exactly one lifecycle is selected: lazy spawn on first credential operation; startup, readiness, failure, restart, and shutdown are aligned |
| AC-05 | PASS | `SECRET_SERVICE_LOCKED` was removed; `SECRET_SERVICE_UNAVAILABLE_OR_LOCKED` is used when the provider cannot distinguish states |
| AC-06 | PASS | READY handshake, exact schemas, bounded framing, queue/backpressure, late/duplicate handling, no ambiguous write replay, and shutdown behavior are specified |
| AC-07 | PASS | Design preserves AES-GCM envelope, SQLite format, current contract, and explicit migration boundary |
| AC-08 | PASS | Candidate suitability and residual owner decisions are explicitly stated |
| AC-09 | PASS | No production source, dependency, lockfile, schema, migration, key material, or user keyring state changed |
| AC-10 | PASS | No hosted CI used; report records inspected sources and design-only verification |
| AC-11 | PASS | Commit and push verified on remote main |

## Findings

### No-overwrite strategy

`@napi-rs/keyring@2.1.2` provides `setSecret`, which replaces an existing item. It does not expose an atomic create-if-absent or no-overwrite operation. Therefore, a read-then-write-then-read-back sequence is not race-safe and cannot be described as a guarantee.

A QFAT-owned cross-process file lock can serialize cooperating QFAT processes sharing the same data directory, but it does not protect against non-cooperating or external Secret Service writers. The design therefore states that the candidate is not suitable for the hard no-overwrite requirement unless the owner explicitly accepts that residual risk or selects a different client/API.

### Child lifecycle

The design now selects exactly one lifecycle: lazy spawn on the first credential operation. Server startup does not import or spawn the child. Secret Service errors surface only when credential storage is actually needed.

### Error classification

The design no longer emits a definitive `SECRET_SERVICE_LOCKED` category from generic failure. It uses `SECRET_SERVICE_UNAVAILABLE_OR_LOCKED` when the provider cannot distinguish inaccessible from locked state, while still allowing actionable unlock/retry guidance.

### IPC and supervisor completeness

The design now specifies the READY handshake, protocol version negotiation, exact request/response shapes, bounded NDJSON framing, queue size and backpressure, timeout behavior, malformed/late/duplicate handling, no ambiguous write replay, stderr policy, and secret buffer lifetime limitations.

## Source inspection and verification

Read-only inspection performed:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `tasks/QFAT-018-linux-secret-service-design-remediation.md`
- `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md`
- `apps/server/src/credentials/provider.ts`
- `apps/server/src/credentials/envelope.ts`
- `apps/server/src/credentials/errors.ts`
- `apps/server/src/credentials/index.ts`
- `apps/server/src/index.ts`
- `apps/server/src/config.ts`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `reports/QFAT-013L3A-linux-secret-service-dependency-security-evaluation.md`
- `reports/QFAT-016-linux-secret-service-isolation-validation-report.md`
- Exact `@napi-rs/keyring@2.1.2` npm metadata, README, TypeScript declarations, and Rust source files `entry_builder.rs`, `linux_credential_builder.rs`, `result.rs`, and `options.rs`.

No code tests were run because this is a documentation-only task. No repository source or dependency files were changed.

## Remaining owner decisions

1. Accept the residual external-writer risk with a cooperative QFAT lock, or reject `@napi-rs/keyring@2.1.2` for production key storage.
2. Approve the default/login collection limitation or require another Secret Service client.
3. Approve first-run behavior: fail closed with unlock instructions versus an explicit user-driven unlock/setup flow.
4. Approve migration invocation and key-file retention policy.
5. Approve timeout and termination values.
6. Approve whether the child may cache the key for its process lifetime.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 133e8e055631a13aeb34185dc53c07568864ad42
- Follow-up fix commit: N/A
- Report update commit: Pending
- Push verification: PASS (remote main HEAD verified after push)

## Handoff

This remediation is ready for GPT/owner audit. It is not owner acceptance and does not authorize implementation, dependency installation, migration, OAuth/account work, uploads, or Windows work.
