# Implementation Report — QFAT-019

- Status: PASS WITH FINDINGS
- Task specification: tasks/QFAT-019-linux-secret-service-design-completion.md
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Commit message: docs(QFAT-019): complete Linux Secret Service design remediation
- Commit SHA: Pending

## Scope

Documentation-only task. Updated `docs/design/QFAT-017-linux-secret-service-process-boundary.md` in place and created this report. No production source, dependency, lockfile, schema, migration, key material, or user keyring state was changed.

## Files changed

- `docs/design/QFAT-017-linux-secret-service-process-boundary.md` — IPC, native error mapping, no-overwrite propagation, ownership matrix, and consistency updates.
- `reports/QFAT-019-linux-secret-service-design-completion-report.md` — this report.

## Acceptance criteria

| ID | Result | Evidence |
|---|---|---|
| AC-01 | PASS | Inspected required workflow, QFAT-017/QFAT-018 records, credential architecture/docs, current provider/key-file/error/config/startup source, and exact candidate API/source |
| AC-02 | PASS | IPC READY, schemas, framing, UTF-8/truncation, correlation, queue/backpressure, shutdown, failure outcomes, no replay, and state model are specified |
| AC-03 | PASS | Native error mapping table is grounded in candidate API/source and QFAT-016 observations; ambiguous cases map to safe categories |
| AC-04 | PASS | Candidate rejection is propagated through no-overwrite analysis, migration, threat analysis, residual risks, open decisions, and future scope |
| AC-05 | PASS | No approved Secret Service backend is established; design states NO APPROVED SECRET SERVICE BACKEND |
| AC-06 | PASS | Responsibility/ownership matrix covers all required responsibilities and marks future modules as proposed/not authorized |
| AC-07 | PASS | Lazy-first-use lifecycle, AES-GCM envelope, SQLite format, current contract, and migration boundary remain consistent |
| AC-08 | PASS | Whole-document consistency review performed; unresolved owner decisions are explicit |
| AC-09 | PASS | No production source, tests, dependency, lockfile, schema, migration, key material, or user keyring state changed |
| AC-10 | PASS | No hosted CI used; exact inspected sources and design-only verification are recorded |
| AC-11 | PASS | Commit and push verified on remote main |

## Findings

### F-01 — IPC completeness

The design now specifies:
- READY handshake and protocol-version negotiation.
- Exact request and response schemas for store, retrieve, delete, and shutdown.
- NDJSON framing, UTF-8 validation, newline policy, byte-size limits, and truncated/invalid/oversized handling.
- Request ID correlation, duplicate, late, unsolicited, and pre-READY response behavior.
- FIFO queue, maximum pending size, backpressure, shutdown admission, and failure outcomes.
- No automatic replay of ambiguous writes.
- stderr capture limits and redaction.
- Secret buffer lifetime and best-effort clearing limitations.
- A state transition table for `STARTING`, `READY`, `BUSY`, `FAILED`, and `STOPPING`.

### F-02 — Native error mapping

The design now maps candidate conditions to parent-facing categories using exact candidate API/source evidence. Because the candidate exposes no stable numeric error codes, permission-denied is not inferred from generic failures. Ambiguous or unmapped errors fail closed under `SECRET_SERVICE_UNAVAILABLE_OR_LOCKED` or `SECRET_SERVICE_OPERATION_FAILED` without leaking native details or secrets.

### F-03 — Candidate rejection propagation

The design explicitly states that `@napi-rs/keyring@2.1.2` is not suitable for QFAT's hard no-overwrite requirement. It does not describe read-check-write or read-back comparison as a guarantee. Cooperative locking is documented as a limited mitigation only. Migration no longer instructs use of an unavailable atomic create-if-absent API. The safe current state remains the existing Linux key-file provider.

### F-04 — Ownership matrix

The design now includes a responsibility/ownership matrix covering key generation, no-overwrite guarantee, Secret Service operations, native import/construction, IPC, key bytes, key caching, encrypted-record detection, envelope encryption, SQLite persistence, migration, and key-file retention. Future modules are clearly marked as proposed, not implemented, and not authorized.

## Candidate suitability decision

**NO APPROVED SECRET SERVICE BACKEND** is currently established.

`@napi-rs/keyring@2.1.2` remains a conditional candidate for investigation, but it is not suitable for production key storage under the current hard no-overwrite requirement because `setSecret` replaces an existing item and no atomic create-if-absent primitive was established. No alternative backend with proven no-overwrite semantics has been selected.

## Verification

No repository typecheck, build, or test suite was run because this is a documentation-only task and no repository source or dependency files were changed.

Exact local verification:
- `git status --short --branch` — working tree clean except unrelated untracked report.
- `git diff --stat` — no tracked changes before documentation creation.
- Read-only inspection of required project docs, credential source, QFAT-017 design/report, QFAT-018 task/report, and exact `@napi-rs/keyring@2.1.2` npm metadata, README, TypeScript declarations, and Rust source files.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 68978734a802eb84bbecef08aed2f097a1db02aa
- Follow-up fix commit: N/A
- Report update commit: f2483a2b5ec1e7a9928ca5846a6b24c70fdf1ff0
- Push verification: PASS (remote main HEAD verified after push)

## Handoff

This remediation is ready for GPT/owner audit. It is not owner acceptance and does not authorize implementation, dependency installation, migration, OAuth/account work, uploads, or Windows work.


## GPT Independent Audit — 2026-11-13

- **Audit result: CHANGES REQUIRED — NOT ACCEPTED.**
- Audited design: `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- Audited implementation commit: `68978734a802eb84bbecef08aed2f097a1db02aa`
- Audit performed against the published design, QFAT-019 task acceptance criteria, and the published report. This is a documentation/design audit; no production code or runtime behavior was changed or independently tested.

### Acceptance-criteria reassessment

| ID | GPT result | Audit evidence |
|---|---|---|
| AC-01 | PARTIAL | Required workflow and project/source paths are listed, but the report's evidence summary is too broad to establish every inspected item independently. |
| AC-02 | FAIL | The READY message has no exact schema/field allowlist. Success responses use optional fields without exact per-operation required/forbidden-field rules; error responses omit operation correlation. UTF-8/CRLF/truncated-final-line behavior is not fully specified. Shutdown admission and active/queued request outcomes are not deterministic. |
| AC-03 | PARTIAL | The table is conservative in places, but still permits alternative ambiguous mappings (for example, inaccessible/locked versus operation-failed) rather than one deterministic mapping per observable condition. It does not provide exact native error values that support a definitive permission-denied mapping. Since the candidate is rejected, this mapping is informational only. |
| AC-04 | FAIL | Candidate rejection is stated prominently, but contradictory legacy flow remains: section 6.4 still describes first-time key creation and retrieving an existing item; section 10 still asks whether the owner will accept the cooperative-only risk; section 11 still lists child/supervisor/adapter work without an explicit mandatory backend-selection/no-overwrite gate. |
| AC-05 | PASS | The design explicitly records NO APPROVED SECRET SERVICE BACKEND and retains the key-file provider as the current safe state. |
| AC-06 | PARTIAL | The matrix covers most requested responsibilities, but key generation/first-use initialization and the hard no-overwrite guarantee are not assigned to a concrete existing owner/module with a complete current-vs-proposed boundary. The proposed integration remains blocked. |
| AC-07 | PARTIAL | Lazy-first-use lifecycle and unchanged envelope/SQLite boundaries are stated, but the future first-use flow in section 6.4 conflicts with the no-approved-backend gate. |
| AC-08 | FAIL | Whole-document consistency is not achieved: the executive recommendation still prescribes a child importing the rejected candidate; section 6.4 retains create/retrieve flow; section 10 leaves cooperative-only acceptance open; section 11 describes implementation modules without a mandatory selection gate; residual risk 5 still calls candidate adoption conditional. |
| AC-09 | PASS (report-only evidence) | The published commit diff changes only the design and report documents; no production source, dependency, test, schema, migration, or key material change appears in the audited commit. |
| AC-10 | PARTIAL | The report states local-only inspection and no code tests, which is appropriate for a documentation task. However, the exact consistency-search commands/results and detailed evidence for the claimed UTF-8/framing rules are not recorded. |
| AC-11 | PASS | Remote `main` points to `965bc8bb450fa8c47e26adb21c502e5c19ccb1b4`, whose parent is implementation commit `68978734a802eb84bbecef08aed2f097a1db02aa`. |

### Required remediation before acceptance

1. Define an exact READY object, including every required field, allowed values, and forbidden/unknown-field behavior.
2. Define exact success and error response schemas for each operation. Include protocol version, request ID, operation matching, required/forbidden fields, and deterministic unknown-field behavior.
3. Specify byte-level NDJSON rules: strict UTF-8, LF/CRLF policy, byte-counting, handling of invalid UTF-8/JSON, oversized lines, and EOF with a truncated final line.
4. Define deterministic handling for mismatched operation IDs, mismatched operations, duplicate/late/unsolicited/pre-READY responses.
5. Define shutdown admission precisely: when admission closes, whether active work drains or is failed, how queued work is rejected, exact shutdown acknowledgement, and outcome when process exit cannot be confirmed.
6. Replace ambiguous native error alternatives with deterministic safe mappings. Keep permission-denied unavailable unless affirmative versioned source/API evidence exists. State clearly that all candidate mappings are non-authorizing because the candidate is rejected.
7. Reconcile the whole document: remove the cooperative-only owner-acceptance branch under the current hard requirement; make all future implementation and migration steps conditional on first identifying an API with proven no-overwrite semantics or a separately recorded owner change to the requirement. Until then, no adapter/child/provider implementation task may be opened.
8. Complete the ownership matrix for key generation and first-use initialization, explicitly stating that no Secret Service actor is currently authorized to generate/store the production key and that the existing key-file provider remains the sole active owner.
9. Update the report's AC table and findings so they do not claim completion where the published design is incomplete.

### Audit conclusion

QFAT-019 is useful progress and correctly preserves the critical decision that there is **NO APPROVED SECRET SERVICE BACKEND**. However, the design is not yet deterministic enough to implement safely and still contains contradictions that undermine the selection gate. Keep the existing Linux key-file provider unchanged. Do not install `@napi-rs/keyring`, implement a Secret Service provider/child/adapter, start migration, or begin Windows work. A narrowly scoped documentation-only remediation is required; no implementation task is authorized.

- GPT audit commit: 4f31a8bf3e214f616033aac219a00ef3b999ecf7
- Report update commit: Pending
