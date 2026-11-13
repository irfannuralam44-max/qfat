# Implementation Report — QFAT-017

- Status: PASS WITH FINDINGS
- Task specification: tasks/QFAT-017-linux-secret-service-process-boundary-design.md
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Commit message: docs(QFAT-017): add Linux Secret Service process boundary design
- Commit SHA: 910efc5fbdb7ad5e39b26c18f638750d82003ef9

## Scope

Design-only task. Two deliverables were created:
- `docs/design/QFAT-017-linux-secret-service-process-boundary.md`
- `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md`

No production source, dependency, manifest, lockfile, schema, migration, key material, or user keyring state was changed. No code was implemented and no migration was performed.

## Files changed

- `docs/design/QFAT-017-linux-secret-service-process-boundary.md` — process-boundary and migration design.
- `reports/QFAT-017-linux-secret-service-process-boundary-design-report.md` — this report.

## Acceptance criteria

| ID | Result | Evidence |
|---|---|---|
| AC-01 | PASS | Inspected current provider source, envelope, errors, server index/config, QFAT-016 task/report, and exact `@napi-rs/keyring@2.1.2` API/source |
| AC-02 | PASS | Design recommends persistent supervised child with startup/operation timeouts, SIGTERM/SIGKILL escalation, crash handling, shutdown, serial queue, and orphan prevention |
| AC-03 | PASS | Minimal versioned NDJSON IPC contract with validation, size limits, typed responses, malformed/late handling, and secret hygiene is documented |
| AC-04 | PASS | Explicit `secret-service` pinning and no-keyutils fallback are specified; fail-closed error categories are defined |
| AC-05 | PASS | Design maps to existing `CredentialProvider` and preserves AES-256-GCM envelope and SQLite ciphertext format |
| AC-06 | PASS | Explicit migration/cutover sequence, verification, recovery, interruption, and retention design is documented; not executed |
| AC-07 | PASS | Threat/failure table and residual risks are documented; unproven lock-state behavior is not overstated |
| AC-08 | PASS | Future implementation files and bounded follow-up scope are listed; no implementation performed |
| AC-09 | PASS | No source, dependency, manifest, lockfile, schema, migration, key material, or user keyring state changed |
| AC-10 | PASS | No hosted CI used; source inspection and prior QFAT-016 evidence are cited |
| AC-11 | PENDING PUBLICATION | Commit and push verification will be recorded after publication |

## Findings and limitations

- The design is intentionally documentation-only.
- `@napi-rs/keyring@2.1.2` remains a conditional candidate, not an approved production dependency.
- The candidate has no atomic create-if-absent primitive and no collection selection. The design documents these limitations.
- Production adoption, migration, key-file retirement, timeout values, key caching, and first-run UX remain owner decisions.
- The design does not implement any process, provider, route, OAuth, account, upload, publishing, UI, or Windows work.

## Verification

No repository typecheck, build, or test suite was run because no repository files other than documentation were changed. Source inspection was performed read-only.

Exact local verification:
- `git status --short --branch` — working tree clean except unrelated untracked report.
- `git diff --stat` — no tracked changes before documentation creation.
- Read-only inspection of `apps/server/src/credentials/*`, `apps/server/src/index.ts`, `apps/server/src/config.ts`, and referenced docs.
- Read-only inspection of exact `@napi-rs/keyring@2.1.2` npm metadata, README, TypeScript declarations, and Rust source files.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 910efc5fbdb7ad5e39b26c18f638750d82003ef9
- Follow-up fix commit: N/A
- Report update commit: Pending
- Push verification: PASS (remote main HEAD verified after push)

## Handoff

This design is ready for GPT/owner audit. It is not owner acceptance and does not authorize implementation, dependency installation, migration, OAuth/account work, uploads, or Windows work.

## GPT Audit — 2026-11-13

- **Audit result: ACCEPTED WITH FINDINGS for the QFAT-017 design scope only.**
- Reviewed the QFAT-017 task, the implementation commit and its complete design artifact, the publication-metadata commit, the current credential provider/error/config source, and the accepted-with-findings QFAT-016 validation report.
- The design covers the requested process boundary, supervised child lifecycle, bounded timeouts and termination escalation, versioned IPC, message limits, secret hygiene, explicit Secret Service backend pinning, fail-closed behavior, current provider integration, migration boundary, threat analysis, and owner decisions. The implementation commit changes documentation only; no production source or dependency changes were present in its diff.
- Findings retained before any implementation:
  1. **Non-atomic key creation:** the proposed read-then-setSecret-then-read sequence is not an atomic create-if-absent operation. A concurrent QFAT process or external writer can race between the read and write, and the design does not yet establish a mechanism that guarantees the other key is never overwritten. The design acknowledges this residual risk; implementation must not proceed on an assumption of race safety. Resolve with an enforceable single-writer/instance-lock strategy or a keyring API with suitable atomic semantics, and test the selected guarantee.
  2. **Child lifecycle inconsistency:** the process-startup sequence says to spawn the child during parent server startup, while the provider integration section says the child is spawned lazily on the first credential operation (or via a future startup check). Choose one lifecycle and specify readiness/failure semantics consistently.
  3. **Error classification:** SECRET_SERVICE_LOCKED must not be emitted merely because the default collection is inaccessible. Preserve an UNAVAILABLE_OR_LOCKED/unknown category unless the provider exposes reliable evidence of the actual locked state. User guidance may still instruct unlocking the Linux keyring and retrying.
  4. **Protocol and operational details remain design-level:** the NDJSON contract and timeout recommendations are suitable starting points, but implementation must explicitly define the child READY handshake, exact per-operation request/response validation, queue bound/backpressure, and what happens to queued requests after a child failure. These must be testable and must not permit a timed-out request to be replayed ambiguously.
- The report's top-level implementation SHA was corrected from Pending to the published implementation SHA in this audit update.
- **Boundary:** this acceptance is for the design deliverables only. It does not approve production dependency adoption, child/provider implementation, key-file migration/cutover, startup wiring, key-file retirement, OAuth/account work, publishing, or Windows work. The race-safety issue is a mandatory design resolution before any implementation task is authorized. Windows remains deferred and unauthorized.
