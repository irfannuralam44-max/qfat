# QFAT-020 — Finalize Linux Secret Service Design Consistency

- **Status:** GPT-AUTHORED DOCUMENTATION REMEDIATION — EXECUTED BY GPT
- **Repository:** irfannuralam44-max/qfat
- **Target branch:** main
- **Type:** Documentation only
- **Depends on:** QFAT-019 — GPT audit result CHANGES REQUIRED — NOT ACCEPTED
- **Primary design:** `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- **Report:** `reports/QFAT-020-linux-secret-service-design-consistency-report.md`

## Objective

Resolve the outstanding QFAT-019 audit findings by making the Linux Secret Service design deterministic, internally consistent, and explicitly blocked from implementation while no backend satisfies the hard no-overwrite requirement.

This task is executed directly by GPT as documentation maintenance at the Owner's explicit request. No coding agent is involved.

## Binding decisions and constraints

1. The existing Linux `KeyFileCredentialProvider` remains the only active and approved provider.
2. **NO APPROVED SECRET SERVICE BACKEND.**
3. `@napi-rs/keyring@2.1.2` is rejected for production use under the current hard no-overwrite requirement. Its `setSecret()` replaces an existing item and no atomic create-if-absent primitive has been established.
4. Do not weaken the hard no-overwrite requirement. Do not offer cooperative-only locking as an owner-acceptable substitute.
5. No Secret Service provider, child, adapter, supervisor, dependency, migration, or key-store implementation may be implemented or separately tasked until a candidate API has proven no-overwrite semantics from exact versioned source/API evidence, or the Owner changes the requirement through a separate explicit recorded decision.
6. Linux only. Windows remains deferred and unauthorized.
7. Preserve the existing `CredentialProvider` contract, AES-256-GCM envelope, SQLite ciphertext format, and current key-file provider behavior.
8. No production source, tests, dependencies, lockfiles, schema, migrations, key material, user keyring, OAuth, account, upload, publishing, hosted CI, or Figma changes.

## Required documentation changes

### 1. Deterministic IPC contract
- Exact READY object and allowed/forbidden fields.
- Exact store/retrieve/delete/shutdown request and success/error response schemas.
- Exact required and forbidden fields per operation.
- Strict UTF-8 and NDJSON byte framing, LF/CRLF, line-size, invalid JSON/UTF-8, oversized line, and truncated EOF behavior.
- Correlation and deterministic handling of mismatched ID/operation, duplicate, late, unsolicited, and pre-READY messages.
- FIFO queue limit explicitly including the in-flight operation.
- Exact backpressure behavior.
- Shutdown admission, active operation, queued operation, shutdown acknowledgement, process exit, and forced termination outcomes.
- No replay of ambiguous writes; explicit indeterminate outcome.
- stderr limits/redaction/logging rules and best-effort secret-buffer clearing limitation.
- One coherent state model and lifecycle.

### 2. Conservative native error mapping
- Use only evidenced observations/API behavior.
- Exact deterministic safe parent category per observable condition.
- Never infer locked or permission denied from generic errors, `NoEntry`, or undocumented text.
- Do not emit `SECRET_SERVICE_PERMISSION_DENIED` without affirmative versioned evidence.
- Mark the entire candidate mapping informational only and non-authorizing because the candidate is rejected.

### 3. Propagate backend rejection throughout the document
- Remove cooperative-only acceptance path and stale conditional-adoption wording.
- Remove any implied implementation sequence using `setSecret`, read-check-write, or read-back as no-overwrite.
- Migration and all future implementation steps must be blocked behind backend-selection gate.
- Keep **NO APPROVED SECRET SERVICE BACKEND** prominent and consistent.
- Retain key-file provider as the sole active provider.

### 4. Complete ownership map
- Assign key generation and first-use initialization to the existing key-file provider only.
- Explicitly state no Secret Service actor is authorized to generate/store the production key today.
- Cover parent, child, native backend, IPC, key bytes, cache, encrypted-row detection/fail-closed, AES-GCM, SQLite, and separately authorized migration.
- Proposed modules remain not implemented and not authorized.

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | Design defines exact READY, operation request/response schemas, field allowlists, and validation. |
| AC-02 | Design defines deterministic NDJSON byte framing and all malformed/truncated/correlation cases. |
| AC-03 | Queue, backpressure, shutdown, active/queued failure, and no-replay semantics are deterministic. |
| AC-04 | Native error mapping is conservative, evidence-bounded, and cannot emit unsupported permission/locked claims. |
| AC-05 | No-overwrite rejection is consistent across recommendation, first-use, migration, threats, residual risks, open decisions, and future scope. |
| AC-06 | Ownership matrix assigns every responsibility and preserves the current provider as sole active owner. |
| AC-07 | Lazy lifecycle, provider contract, AES-GCM, SQLite, and migration boundaries are consistent. |
| AC-08 | Whole-document review finds no contradictory approval or implementation language. |
| AC-09 | Only the design and QFAT-020 report are changed. |
| AC-10 | Report records actual documentation checks and explicitly states that code tests were not run/not applicable. |
| AC-11 | Documentation and report are published to main and remote head is verified. |

## Verification

- Read the complete QFAT-019 design, task, audit report, credential-storage documentation, and ADR-004.
- Inspect the final design for stale terms and contradictions: cooperative-only acceptance, conditional candidate adoption, read-check-write, create-if-absent, key generation, migration, and implementation authorization.
- No code tests, build, typecheck, dependency install, or runtime keyring operations are permitted or required.

## Deliverables

- Update `docs/design/QFAT-017-linux-secret-service-process-boundary.md` in place.
- Create `reports/QFAT-020-linux-secret-service-design-consistency-report.md`.
- GPT records its own audit result in the report after publication.

## Stop condition

Stop after documentation publication and report. Do not implement Secret Service, select/install a dependency, migrate credentials, or begin Windows work.
