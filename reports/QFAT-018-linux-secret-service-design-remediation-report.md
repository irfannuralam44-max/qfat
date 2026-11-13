# Implementation Report — QFAT-018

- Agent status: PASS WITH FINDINGS
- GPT audit: ACCEPTED WITH FINDINGS — documentation remediation only; design is NOT implementation-ready
- Task specification: tasks/QFAT-018-linux-secret-service-design-remediation.md
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Commit message: docs(QFAT-018): remediate Linux Secret Service design no-overwrite analysis
- Commit SHA: 133e8e055631a13aeb34185dc53c07568864ad42

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
| AC-05 | PARTIAL | Generic locked-state misclassification was corrected, but exact native-error-to-parent-category mappings and evidence for permission-denied classification are not specified |
| AC-06 | PARTIAL | READY/version, limits, queue, and several failure cases are described, but exact per-message schemas and required/forbidden fields, invalid UTF-8/truncated-line/unsolicited-response handling, and shutdown admission semantics remain underspecified |
| AC-07 | PARTIAL | Envelope, SQLite format, and migration boundary are preserved, but the ownership map for key creation/single-writer enforcement/IPC/fail-closed behavior is incomplete and the migration sequence still assumes unavailable create-if-absent semantics |
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
- Report update commit: 9d2febf35ba2e6aca2a95ad49abd71a5f9b11007 (agent publication-metadata update)
- Push verification: PASS (remote main HEAD verified after push)

## Handoff

This remediation is ready for GPT/owner audit. It is not owner acceptance and does not authorize implementation, dependency installation, migration, OAuth/account work, uploads, or Windows work.


## GPT Independent Audit

- Audit result: **ACCEPTED WITH FINDINGS — QFAT-018 documentation remediation only**.
- Audit branch head verified: `main` at `9d2febf35ba2e6aca2a95ad49abd71a5f9b11007`.
- Implementation commit verified: `133e8e055631a13aeb34185dc53c07568864ad42`.
- Agent report-publication metadata commit: `9d2febf35ba2e6aca2a95ad49abd71a5f9b11007`.
- This audit does **not** authorize production implementation, dependency adoption, migration, or keyring cutover.

### Confirmed strengths

1. The design correctly rejects `@napi-rs/keyring@2.1.2` as currently specified for the hard no-overwrite requirement. It explicitly explains that `setSecret()` replaces an existing item and that read-back cannot undo an overwrite.
2. The race interleavings and actor boundary for a cooperative QFAT lock are accurately described. The document does not claim that such a lock protects external Secret Service writers.
3. The child lifecycle is consistently selected as lazy first-use spawn in the main lifecycle description and server-startup section.
4. The design removes a definitive generic `SECRET_SERVICE_LOCKED` classification and introduces an inaccessible-or-locked/unknown category.
5. The implementation and report changes are documentation-only; the reported scope contains no source, dependency, key material, schema, or user keyring changes.

### Findings that remain before any implementation task

**F-01 — IPC contract is not yet implementation-ready (AC-06 partial).**

The design describes a READY line and broad request/response shapes, but it does not define exact READY fields or complete per-operation schemas with required and forbidden fields. It also omits deterministic behavior for invalid UTF-8, a truncated final NDJSON line, unsolicited responses, and admission of new work while shutdown is in progress. These cases were explicitly required by QFAT-018. Do not implement the supervisor from this contract yet.

**F-02 — Native error mapping is not evidence-complete (AC-05 partial).**

The parent-facing categories are listed, but the design does not map specific candidate native error values to those categories with source-backed evidence, nor define a sufficiently explicit unknown/unmapped fallback. In particular, permission-denied must only be emitted when a specific native condition proves it; otherwise use the unknown/inaccessible category.

**F-03 — Candidate rejection is not propagated through every future-flow section (AC-07 partial).**

The executive recommendation correctly says the package is NOT SUITABLE for the hard no-overwrite requirement. However:
- Section 8 still lists “adapter-level read-check-write plus conflict detection” as the mitigation for concurrent first-run initialization.
- Section 7.1 still describes migration using create-if-absent semantics without clearly stating that this candidate cannot perform that step.
- Section 11 proposes a future Secret Service adapter/child implementation without a mandatory prior gate to select a different API with proven no-overwrite semantics (or to obtain an explicit owner decision that does not weaken the security requirement).

These statements must be reconciled. Until then, keep the existing key-file provider active and do not install or implement this candidate for production key storage.

**F-04 — Provider ownership map is incomplete (AC-07 partial).**

The design proposes a `CredentialKeyStore` interface and parent/child modules, but it does not explicitly assign ownership for the no-overwrite/single-writer guarantee, create/read/delete semantics, key bytes crossing IPC, and fail-closed handling when encrypted rows exist but the key is missing or inaccessible. Because the current candidate is rejected, a future design must first identify a viable backend and then assign these responsibilities without changing the existing envelope or SQLite format.

### Acceptance boundary and next gate

QFAT-018 successfully corrected the central unsafe race claim and resolved the lifecycle inconsistency. It is accepted with findings as a **design-remediation deliverable**, not as a complete implementation specification. The remaining findings must be resolved in a separately scoped documentation task before any Secret Service implementation task is authored. The safe current state remains the existing Linux key-file provider; Windows remains deferred and unauthorized.
