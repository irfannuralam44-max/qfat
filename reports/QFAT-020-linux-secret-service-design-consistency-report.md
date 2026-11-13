# QFAT-020 — Linux Secret Service Design Consistency Report

- **Status:** PASS — documentation-only remediation completed; GPT self-audit recorded below.
- **Task:** `tasks/QFAT-020-linux-secret-service-design-consistency.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Branch:** `main`
- **Implementation commit:** `f572416b38adabe4f82a97685bf6900438cb231e`
- **Execution:** GPT, directly at the Owner's explicit request; no coding agent used.
- **Scope:** Documentation only.

## 1. Files changed

1. `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
   - Rewritten to remove contradictory candidate-adoption language.
   - Adds deterministic reference IPC contract and conservative error taxonomy.
   - Makes backend selection a hard gate and retains the current key-file provider as the only active provider.
   - Clarifies ownership, migration, future scope, and platform restrictions.
2. `reports/QFAT-020-linux-secret-service-design-consistency-report.md`
   - This report.

The GPT-authored task is `tasks/QFAT-020-linux-secret-service-design-consistency.md`.

## 2. Acceptance criteria

| ID | Result | Evidence |
|---|---|---|
| AC-01 | PASS | Design §5.3–5.5 defines exact READY, operation request, and per-operation success/error response fields and allowlists. |
| AC-02 | PASS | Design §5.1, §5.6 defines strict UTF-8, NDJSON byte limits, LF/CRLF, truncated EOF, malformed input, and correlation outcomes. |
| AC-03 | PASS | Design §5.7–5.9 and §5.11 defines an 8-total-outstanding FIFO bound, backpressure, shutdown admission, active/queued outcomes, no replay, and state transitions. |
| AC-04 | PASS | Design §3.1 and §6 maps only evidenced conditions; generic/unmapped native errors fail closed; permission denied is not an emitted candidate category. |
| AC-05 | PASS | Design §1, §3, §8–11 consistently rejects `@napi-rs/keyring@2.1.2`, disallows cooperative-only substitution, and blocks migration/implementation absent a proven backend or separate Owner decision. |
| AC-06 | PASS | Design §7.1 assigns current key generation/first use to `KeyFileCredentialProvider`; all future Secret Service actors are unassigned/not authorized. |
| AC-07 | PASS | Design §2 and §7–8 preserves the provider contract, AES-GCM/SQLite boundaries, lazy future process concept, and migration gate. |
| AC-08 | PASS | Whole-document keyword/consistency review completed; no conditional candidate adoption, executable first-use sequence, or open cooperative-only acceptance path remains. |
| AC-09 | PASS | QFAT-020 changes only the design and its report; task file is the GPT-authored work order. No production files or secrets changed. |
| AC-10 | PASS | Documentation checks are recorded below. Code tests/build/typecheck were not run because no code changed. |
| AC-11 | PASS | Commits were published to `main`; final remote head verification is recorded below. |

## 3. Final IPC contract summary

The design's section 5 now specifies:
- exact READY record: `protocolVersion=1`, `messageType=ready`, `status=ready`, no extra fields;
- exact request field allowlists for store/retrieve/delete/shutdown;
- exact success response variants and one common error schema;
- strict UTF-8, NDJSON LF with optional CRLF, 16,384-byte payload limit, and truncated EOF rejection;
- matching request ID and operation, with mismatched/duplicate/late/unsolicited/pre-READY messages treated as protocol failures;
- FIFO queue maximum of eight outstanding requests including the in-flight request;
- deterministic queue-full and shutdown admission behavior;
- explicit active/queued failure outcomes and no automatic replay;
- indeterminate store outcome on timeout/child crash;
- bounded stderr and best-effort secret-buffer clearing;
- explicit STARTING/READY/BUSY/STOPPING/FAILED state transitions.

This is a proposed reference contract only. It is not implemented and does not authorize wrapping the rejected candidate.

## 4. Error mapping and candidate decision

The only current Secret Service decision is **NO APPROVED SECRET SERVICE BACKEND**.

`@napi-rs/keyring@2.1.2` remains rejected for production under the hard no-overwrite requirement because `setSecret()` replaces an existing item and no atomic create-if-absent primitive was established. The error table is explicitly informational/non-authorizing. Generic or unmapped native failures map to `SECRET_SERVICE_OPERATION_FAILED`; the design does not infer locked or permission-denied states from generic errors.

No alternative candidate is selected.

## 5. Ownership result

Design §7.1 confirms:
- existing `KeyFileCredentialProvider` is the only active owner of key generation and first-use initialization;
- no Secret Service actor is authorized to generate/store production key material;
- no future child, adapter, supervisor, key-store, or migration module is implemented or authorized;
- existing provider/envelope/SQLite ownership is preserved.

## 6. Whole-document consistency review

Read the entire published design and searched for:
- `cooperative-only`;
- `conditional candidate`;
- `read-check-write`;
- `create-if-absent`;
- `setSecret`;
- `NOT AUTHORIZED`;
- `NO APPROVED SECRET SERVICE BACKEND`;
- `SECRET_SERVICE_PERMISSION_DENIED`;
- first-time key creation and migration references.

Results:
- Cooperative-only language appears only to explicitly reject it as insufficient.
- `read-check-write`, `create-if-absent`, and `setSecret` appear only to explain why the candidate is rejected and why migration is blocked.
- No conditional production-adoption statement remains.
- No future executable key-generation/first-use flow remains.
- Migration is consistently blocked behind backend selection and explicit Owner authorization.
- Windows remains deferred and unauthorized.
- The existing key-file provider remains active and unchanged.

## 7. Verification

- Read QFAT-019 task, report, and GPT audit record.
- Read the prior design, QFAT-013 credential-storage documentation, and ADR-004.
- Read the complete updated design after publication.
- Performed whole-document keyword/consistency scan as listed in section 6.
- Confirmed the design file's update changed documentation only.
- No `npm` commands, typecheck, build, code tests, dependency installation, runtime keyring operation, key-material access, OAuth, upload, hosted CI, or Windows operation was performed. These are not applicable and were not authorized.

## 8. Git publication

- Task creation commit: `15caa84065b9513316a0530342967930a5acb3f7`
- Design update commit: `f572416b38adabe4f82a97685bf6900438cb231e`
- Report creation commit: 24bed744f81affaee2ce62d5a1e9a59696c5befc
- Report publication-metadata commit: e62e6bb57c2e7046b0c2900135bcbf912bc1651e
- Final remote `main` head: verified after report metadata publication; final handoff SHA is provided in the project chat.

## 9. GPT independent documentation audit

**Result: PASS — QFAT-020 documentation scope accepted by GPT.**

The revised design resolves the QFAT-019 audit findings at the documentation level:
- IPC schemas and framing are deterministic.
- Shutdown, queue, failure, and no-replay semantics are explicit.
- Native error mapping is conservative and non-authorizing.
- Candidate rejection is consistent across design sections.
- Ownership and current-provider boundaries are explicit.
- No production implementation or migration is authorized.

This acceptance applies only to the QFAT-020 documentation update. It does not approve a Secret Service backend, dependency, provider, migration, key-file retirement, or Windows work.

## 10. Current project state and next gate

- Active Linux credential provider: existing `KeyFileCredentialProvider`.
- Secret Service backend: **NO APPROVED SECRET SERVICE BACKEND**.
- `@napi-rs/keyring@2.1.2`: rejected for production under current hard no-overwrite requirement.
- Production integration/migration: not authorized.
- Windows credential storage: deferred and unauthorized.

No implementation task should follow automatically. The next possible work is a separately authorized backend research/evaluation task that seeks a versioned API with proven hard no-overwrite semantics. If no such backend is found, retain the current provider.

---
