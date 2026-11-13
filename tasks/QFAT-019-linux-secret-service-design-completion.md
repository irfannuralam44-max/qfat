# QFAT-019 — Linux Secret Service Design Completion

- **Status:** READY FOR EXECUTION — design/documentation only
- **Task type:** Security design completion
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Depends on:** QFAT-018 — ACCEPTED WITH FINDINGS (documentation remediation only)
- **Primary design:** `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- **Audit record:** `reports/QFAT-018-linux-secret-service-design-remediation-report.md`
- **Expected deliverables:**
  - Update `docs/design/QFAT-017-linux-secret-service-process-boundary.md` in place.
  - Create `reports/QFAT-019-linux-secret-service-design-completion-report.md`.

## 1. Objective

Resolve all four outstanding findings from the GPT audit of QFAT-018 so that the Linux credential-storage design is internally consistent, evidence-based, and suitable for a future owner decision.

This task is **documentation-only**. It does not authorize selecting or installing a production dependency, implementing a provider/child/supervisor/lock, changing credential storage, migrating key material, or starting Windows work.

## 2. Binding project and security constraints

- Linux credential storage is the only active platform workstream. Windows remains deferred and unauthorized.
- The current `KeyFileCredentialProvider` remains active and unchanged.
- Preserve AES-256-GCM envelope behavior, SQLite ciphertext format, and the current `CredentialProvider` contract.
- Do not weaken the hard no-overwrite requirement.
- `@napi-rs/keyring@2.1.2` has been found unsuitable for that hard requirement because `setSecret()` replaces an existing item and no atomic create-if-absent primitive was established. Do not present this candidate as production-ready.
- A cooperative QFAT lock may be discussed only as a limited mitigation for cooperating instances sharing the same data directory. It does not protect against non-cooperating or external Secret Service writers and does not satisfy the hard no-overwrite guarantee.
- Any alternative backend/API must be supported by exact versioned source/API evidence. Do not assume an API supports create-if-absent based on its name or documentation wording alone.
- No real credentials, normal desktop keyring access, key material, OAuth, live accounts, uploads, publishing, UI, Figma, or hosted CI.
- All verification is local-only. Do not create, enable, trigger, or use GitHub Actions.

## 3. Required reading and inspection

Safely synchronize `main`, preserve all local work, then read:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- relevant `README.md` and `CLAUDE.md` guidance
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- QFAT-017 task, design, and report
- QFAT-018 task and report, including the GPT Independent Audit section and findings F-01 through F-04
- current credential provider, key-file implementation, error types, configuration, server startup/lifecycle, and relevant tests
- exact source/API evidence for any alternative candidate proposed.

Source is authoritative where documentation conflicts. Do not repeat prior inspection as if it were new evidence; identify exactly what was rechecked and what new evidence supports a decision.

## 4. Mandatory remediation

### 4.1 F-01 — Complete the IPC contract

Make the protocol deterministic and directly implementable. Specify all of the following:

1. Exact READY message fields, protocol version, allowed values, and whether any other fields are forbidden.
2. Exact request schemas for `store`, `retrieve`, `delete`, and `shutdown`, including required and forbidden fields, types, byte limits, and validation rules.
3. Exact success and error response schemas, including operation matching, request ID constraints, allowed optional fields, and unknown-field policy.
4. NDJSON framing: UTF-8 validation, newline requirements, CRLF policy, maximum line size measured in bytes, and behavior for invalid UTF-8/JSON, oversized lines, and truncated final lines.
5. Response correlation and behavior for mismatched IDs/operations, duplicate responses, late responses, unsolicited responses, and responses received before READY.
6. FIFO semantics, maximum pending queue size, whether the in-flight request counts toward the limit, immediate backpressure response, and whether ordering is preserved across child restart.
7. Shutdown admission: when new requests stop being accepted, treatment of active and queued work, shutdown handshake, grace periods, and behavior if child exit cannot be confirmed.
8. For timeout, malformed IPC, child exit, or forced termination, define the exact outcome for the active request and every queued request.
9. No automatic replay of a write with ambiguous completion. Explain how callers are prevented from assuming a timed-out write did not happen.
10. stderr capture limit, redaction rules, and which diagnostic categories may be logged.
11. Secret buffer lifetime, best-effort clearing, and the explicit limitation that JS/native copies may remain.

Include a compact state-transition table or sequence that removes ambiguity between STARTING, READY, BUSY, STOPPING, and FAILED states. Keep the selected lazy-first-use child lifecycle consistent.

### 4.2 F-02 — Evidence-based native error mapping

Create a mapping table from exact candidate native error values/conditions to parent-facing QFAT categories.

For every mapping:
- identify package/version and exact source/API file or symbol inspected;
- distinguish documented behavior from directly inspected implementation behavior;
- state whether the mapping is definitive or ambiguous;
- state what evidence is required before emitting `SECRET_SERVICE_PERMISSION_DENIED`.

At minimum retain distinct parent categories for:
- confirmed service/transport unavailable;
- inaccessible-or-locked/unknown collection state;
- confirmed permission denied only with supporting evidence;
- operation timeout;
- child crash/unavailable;
- protocol violation;
- unexpected or unmapped native failure.

If source evidence cannot distinguish locked, inaccessible, and permission-denied cases, map to an unknown/inaccessible category. Do not infer a locked state from generic D-Bus errors, `NoEntry`, or a generic native failure. Do not invent native error names. Unknown errors must fail closed and map to a safe generic category without leaking raw native details or secrets.

If the currently rejected candidate is not suitable for production, make clear that its error mapping is informational only and cannot be used to authorize adoption.

### 4.3 F-03 — Propagate candidate rejection through every future-flow section

Reconcile all sections of the design, including migration, threat/failure analysis, future implementation scope, and open decisions.

Mandatory changes:
- Remove any statement that implies adapter-level read-check-write plus conflict detection satisfies no-overwrite.
- Mark any cooperative lock as a limited mitigation only, not as a guarantee for the hard requirement.
- Migration must not instruct a future implementation to call an unavailable create-if-absent API on the rejected candidate.
- State that no Secret Service implementation or migration task may be authored until a viable backend/API with proven no-overwrite semantics is identified, or the owner explicitly changes the security requirement through a recorded decision.
- Do not treat a hypothetical future adapter/child implementation as authorized merely because a module list exists.
- State the safe current state: retain the existing Linux key-file provider; no production keyring dependency or provider is approved by QFAT-019.

If no viable alternative is established from exact evidence, explicitly record **NO APPROVED SECRET SERVICE BACKEND** and leave the workstream blocked at design/selection gate. Do not select a speculative alternative.

### 4.4 F-04 — Assign provider and process ownership

Add an explicit responsibility/ownership matrix covering at least:

- key generation and first-use initialization;
- the hard no-overwrite/single-writer guarantee;
- Secret Service create/read/delete operations;
- native package import and construction;
- parent-child IPC framing and validation;
- key bytes crossing IPC and memory lifetime;
- key caching (default must be no parent-side raw-key cache; any child cache requires separate owner approval);
- detection of encrypted records and fail-closed behavior when key is missing, malformed, inaccessible, or unavailable;
- AES-GCM envelope encryption/decryption;
- SQLite ciphertext persistence;
- migration and key-file retention.

Map each responsibility to an existing module or a clearly named proposed future module. Clearly label proposed modules as **not implemented and not authorized**. Do not duplicate envelope logic or change the business contract.

The ownership matrix must distinguish:
- parent server;
- child process;
- key-store adapter/backend;
- existing credential provider;
- SQLite repository/envelope layer;
- separately authorized migration operation.

## 5. Whole-document consistency review

After addressing F-01 through F-04, search the entire design for contradictory or stale claims, especially:
- read-check-write;
- create-if-absent;
- no-overwrite;
- concurrent first-run;
- locked/unavailable;
- startup vs lazy spawn;
- migration/cutover;
- cache;
- future implementation scope.

Ensure every mention of a rejected capability is explicitly qualified. Update the executive recommendation, threat table, residual risks, open decisions, and future implementation section to agree.

The resulting design must not imply that QFAT-018 accepted the candidate for implementation. QFAT-018 was accepted with findings for documentation remediation only.

## 6. Explicit exclusions — MUST NOT

- Do not edit production TypeScript/source, tests, package manifests, lockfiles, generated output, database schema, or migrations.
- Do not add/install/update dependencies.
- Do not implement a child process, supervisor, provider, lock, IPC protocol, or key-store adapter.
- Do not change the active key-file provider or its behavior.
- Do not access, unlock, enumerate, or modify the owner's normal desktop keyring.
- Do not read, create, rotate, migrate, overwrite, or delete real key material.
- Do not run live OAuth, account, upload, publishing, or platform API operations.
- Do not implement or test Windows credential storage.
- Do not use hosted CI/GitHub Actions.
- Do not use Figma.

## 7. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | Required workflow, QFAT-017/QFAT-018 records, current credential source/docs, and exact source/API evidence used for any alternative are inspected. |
| AC-02 | IPC READY, per-operation schemas, framing, UTF-8/truncation, correlation, queue/backpressure, shutdown admission, failure outcomes, and no-replay semantics are exact and deterministic. |
| AC-03 | Native error mapping is grounded in exact versioned source/API evidence; ambiguous errors map safely; permission-denied requires affirmative evidence. |
| AC-04 | Rejection of `@napi-rs/keyring@2.1.2` is propagated throughout migration, threat analysis, residual risks, open decisions, and future scope. |
| AC-05 | No alternative is selected without proven no-overwrite semantics; if none is proven, design explicitly states NO APPROVED SECRET SERVICE BACKEND and keeps key-file provider active. |
| AC-06 | Responsibility/ownership matrix covers all responsibilities listed in section 4.4 and clearly marks future modules as not implemented/unauthorized. |
| AC-07 | Lazy-first-use lifecycle, AES-GCM envelope, SQLite format, current `CredentialProvider` contract, and migration boundary remain consistent. |
| AC-08 | Whole-document search/review resolves contradictions and stale claims; unresolved owner decisions are explicit and do not weaken security requirements. |
| AC-09 | No production source, tests, dependency, lockfile, schema, migration, key material, or user keyring state is changed. |
| AC-10 | No hosted CI is used; report records exact inspected sources, document consistency checks, and why code tests were not run. |
| AC-11 | Updated design and report are committed and pushed to `main`; remote publication is verified. |

## 8. Stop conditions

Stop and report **BLOCKED** if:
- exact IPC behavior cannot be specified safely;
- native error behavior cannot be supported by evidence;
- no viable no-overwrite backend can be established (in that case document NO APPROVED SECRET SERVICE BACKEND; this is an acceptable safe outcome, not permission to weaken the requirement);
- current source conflicts with the proposed ownership model;
- a material owner decision would be required to proceed.

Do not resolve a material security decision by assumption. Do not proceed to implementation.

## 9. Deliverables and report

Update in place:
- `docs/design/QFAT-017-linux-secret-service-process-boundary.md`

Create:
- `reports/QFAT-019-linux-secret-service-design-completion-report.md`

The report must include:
- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Task path, repository, branch, commit message, full implementation SHA.
- Files changed and explicit documentation-only scope.
- AC table with concrete evidence.
- Exact package/version/source/API evidence for all native error claims and any alternative backend.
- Final IPC contract summary and state model.
- Final ownership matrix or precise section reference.
- Explicit candidate suitability decision and whether an approved backend exists.
- Whole-document consistency review findings.
- Exact verification commands and outcomes; no code tests are required for this documentation-only task.
- Git publication and remote verification.
- Handoff for GPT audit; never claim owner acceptance.

## 10. Handoff

After publishing the updated design and report to `main`, provide only:
- Branch
- Commit message
- Full SHA
- Report path

Stop for GPT audit. Do not begin implementation, dependency installation, migration, or another task.
