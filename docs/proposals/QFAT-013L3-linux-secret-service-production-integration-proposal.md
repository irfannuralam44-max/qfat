# QFAT-013L3 — Linux Secret Service Production Integration Proposal

- **Document status:** DRAFT — OWNER REVIEW REQUIRED
- **Execution status:** NOT AUTHORIZED — proposal/design only
- **Date:** 2026-11-13
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Parent workstream:** QFAT-013 Linux credential storage
- **Prerequisite:** QFAT-013L2 accepted by owner as PASS WITH FINDINGS on 2026-11-13
- **Related:** ADR-004, `docs/CREDENTIAL-STORAGE-QFAT-013.md`, QFAT-013L, QFAT-013L2

> This document is a technical proposal for owner review. Its creation does not authorize implementation, dependency installation, migration, or changes to application source. A separate implementation task and explicit owner approval are required.

## 1. Objective

Propose a Linux Secret Service (LSS) integration that replaces the temporary local credential key file as the at-rest location for QFAT's 32-byte AES-256-GCM data-encryption key, while preserving the existing encrypted SQLite credential envelope and the `CredentialProvider` business contract.

The proposed design does **not** store OAuth access tokens or refresh tokens directly in Secret Service. The existing application-layer envelope remains responsible for encrypting credential payloads; Secret Service protects the envelope's master key.

## 2. Evidence and constraints

QFAT-013L2 reported successful isolated CRUD, separate-process retrieval, daemon-restart persistence, and fail-closed behavior for `@napi-rs/keyring` 2.1.2 when Linux backend selection is explicitly pinned to `secret-service`. The owner later ran the tracked runner-safety harness successfully (syntax and harness exit codes 0), and accepted QFAT-013L2 as PASS WITH FINDINGS.

Important limits remain:

- QFAT-013L2's owner-run harness does not repeat the historical isolated CRUD/persistence tests.
- AC-08 remains PARTIAL; the harness-only emergency cleanup helper has a post-SIGKILL verification hardening finding.
- The candidate library's collection selection/default-collection behavior is not configurable.
- License, native packaging, maintenance, and supply-chain review remain open.
- The isolated daemon restart result is not a host-reboot test.
- No production integration or dependency adoption has yet been authorized.

The current Linux provider is `KeyFileCredentialProvider`. It encrypts credential payloads with AES-256-GCM and stores envelope fields in SQLite; the 32-byte key is loaded from a separate owner-only file. Its provider contract is `store(context, payload)`, `retrieve(context)`, and `delete(context)`.

## 3. Proposed architecture

### 3.1 Keep the current envelope and SQLite format

Retain the existing:
- `CredentialProvider` interface and opaque payload contract;
- AES-256-GCM envelope format, nonce/tag sizes, and AAD binding to record context;
- SQLite `credential_records` schema and ciphertext rows;
- typed error boundary, extended only with reviewed LSS-specific error codes.

The LSS integration should protect the existing 32-byte encryption key, not redesign or replace the credential envelope. This avoids decrypting/re-encrypting every stored credential merely to change the key's storage location.

### 3.2 Add a key-material storage boundary

Introduce a narrow internal abstraction (exact names to be finalized during implementation design), conceptually:

- `CredentialKeyStore.get()`: retrieve the existing 32-byte key or return a well-defined not-found result.
- `CredentialKeyStore.create(key)`: create only if absent; never overwrite an existing item.
- `CredentialKeyStore.delete()`: only for a separately authorized cleanup/migration operation; never part of normal startup recovery.

The existing encrypted SQLite provider remains responsible for envelope encryption/decryption. A Linux-specific key-store adapter supplies key material through the new boundary. Avoid duplicating the CRUD implementation or introducing platform branching throughout application/domain code.

### 3.3 Secret Service item identity

Use a stable, application-owned service identifier and account/item identifier with a versioned schema. The exact identifiers and attributes must be finalized before implementation. Do not include usernames, platform account IDs, OAuth scopes, or secret material in item labels unless a documented requirement justifies it.

The item must be created with an explicit Secret Service backend. No automatic backend selection and no keyutils fallback are permitted. If the pinned backend is unavailable, locked, or cannot retrieve the expected item, credential operations fail closed.

### 3.4 Backend selection

If `@napi-rs/keyring` is selected, every Linux construction must explicitly pin `secret-service` using the verified API for the exact version. A package upgrade must not silently change backend selection. Dependency adoption is blocked until license, provenance, maintenance, native binary distribution, and vulnerability review are completed and recorded.

Because collection selection is not exposed by the candidate library, the design must explicitly document which collection is used and the behavior when the default/login collection is missing or locked. Do not unlock, create, or modify the owner's desktop keyring silently. Any first-run collection setup or unlock interaction needs an owner-approved UX/security decision.

## 4. Key lifecycle and fail-closed behavior

### First initialization

- Generate exactly 32 cryptographically random bytes using Node.js crypto.
- Attempt create-if-absent in Secret Service.
- If an item already exists, retrieve and validate its length; do not overwrite it with a newly generated key.
- Never log, print, return through HTTP, or persist the key in SQLite, environment variables, reports, or browser storage.
- If Secret Service is unavailable or locked, fail closed. Do not create a key-file fallback.

### Existing encrypted records

- If encrypted credential rows exist but the Secret Service item is missing, malformed, inaccessible, or cannot be authenticated/validated, fail closed with an actionable typed error.
- Never generate a replacement key when encrypted records exist.
- Do not delete or rewrite encrypted rows on a key-store error.
- Do not silently fall back to the old key file after LSS has become the configured active provider.

### Runtime behavior

- Cache key bytes only in process memory as currently done by the key-file provider, with lifecycle/zeroization limitations documented honestly.
- Do not claim memory zeroization unless it is implemented and tested; Node.js Buffer copies and garbage collection limit guarantees.
- Errors returned to UI/API must not expose secret values, raw DBus payloads, native stack traces, absolute paths, or key material.
- API responses must not reveal whether a particular account's secret exists beyond the minimum needed by the authorized local UI.

## 5. Migration proposal — existing key-file installations

Migration is a separate, explicit operation and must not happen implicitly during application startup.

Proposed safe sequence:

1. Detect the existing key-file state and count of encrypted credential rows without exposing values.
2. Require the current key file to pass all existing ownership, permission, symlink, length, and durability checks.
3. Read the existing 32-byte key into memory; never print or serialize it.
4. Create the Secret Service item using create-if-absent semantics. If an item already exists with different key material, stop; do not overwrite either side.
5. Retrieve the Secret Service item in a separate process and compare equality in memory without logging either key.
6. With the LSS key selected, decrypt every existing credential envelope using its original context. This is a verification pass only; do not modify ciphertext.
7. Verify row counts and per-row authentication success. If any row fails, stop and preserve the original key file and database unchanged.
8. Switch the configured provider to LSS only after the entire verification pass succeeds.
9. Keep the original key file unchanged until the owner-approved rollback/retention policy is satisfied. Do not automatically delete it as part of migration.
10. A separate cleanup action may retire the old key file only after explicit owner approval, backup policy confirmation, and a documented recovery plan.

No dual-write or silent dual-read fallback is proposed for normal operation. During a controlled migration command only, both stores may be read for verification, but the application must have one clearly selected active key source.

### Migration decisions still required

- How the user initiates migration and confirms the Secret Service collection is available.
- Whether the old key file is retained as a protected backup, and for how long.
- How rollback is performed if LSS becomes unavailable after cutover.
- Whether the app supports a documented export/restore/recovery path without weakening normal fail-closed behavior.
- How migration status is stored without introducing a second source of truth or leaking sensitive state.

## 6. Typed error model proposal

Map native/library errors into stable QFAT error codes. Candidate categories:

- `SECRET_SERVICE_UNAVAILABLE`
- `SECRET_SERVICE_LOCKED`
- `SECRET_ITEM_NOT_FOUND`
- `SECRET_ITEM_CONFLICT`
- `SECRET_ITEM_INVALID`
- `SECRET_SERVICE_PERMISSION_DENIED`
- `SECRET_SERVICE_OPERATION_FAILED`
- `CREDENTIAL_KEY_MISSING_WITH_RECORDS`
- `CREDENTIAL_KEY_INVALID`
- `CREDENTIAL_MIGRATION_REQUIRED`
- `CREDENTIAL_MIGRATION_FAILED`

The implementation task must define which native errors map to each code based on verified behavior of the exact pinned library. Do not classify errors by brittle message matching alone if the library exposes stable codes/types. If only strings are available, isolate and test the mapping layer and preserve a generic fail-closed fallback.

## 7. Security and operational requirements

- Linux only; no Windows source changes, tests, or dependency branches.
- Explicit Secret Service backend pinning; no keyutils or plaintext fallback.
- Never touch/unlock/reconfigure the owner's keyring during automated tests.
- Use synthetic secrets and disposable isolated D-Bus/keyring environments in tests.
- Unit tests must mock the key-store boundary and verify all error mappings.
- Integration tests must use a disposable Secret Service session and prove endpoint/process/home provenance before writes.
- Test create-if-absent races, missing item with existing rows, locked/unavailable service, malformed key length, permission errors, restart persistence, and no fallback.
- Verify existing SQLite ciphertext rows remain byte-for-byte unchanged during migration verification.
- Verify no key material appears in logs, stdout/stderr, HTTP responses, test snapshots, or reports.
- Never use live Google/YouTube/Meta credentials or authorize accounts as part of this work.
- Do not implement OAuth, account management UI/API, upload, publishing, jobs, or scheduling in this stage.

## 8. Proposed delivery phases

| Phase | Scope | Exit gate |
|---|---|---|
| A — Dependency/security decision | License, provenance, maintenance, native package matrix, vulnerability review, exact API/error behavior | Owner approves dependency and collection strategy |
| B — Key-store adapter | Internal key-store abstraction and Linux Secret Service adapter; no migration or app cutover yet | Unit + isolated integration tests pass |
| C — Provider wiring | Select LSS key store for Linux while preserving envelope and SQLite schema; fail-closed startup/operations | Independent audit and owner acceptance |
| D — Migration utility | Explicit key-file-to-LSS migration and verification, no ciphertext rewrite | Separate task and explicit owner approval |
| E — Retirement/cleanup | Retire old key file only under approved backup/recovery policy | Separate task and explicit owner approval |

Do not bundle all phases into one broad implementation task. Each phase receives a separate task specification and owner gate where the change affects credential availability or recovery.

## 9. Proposed acceptance criteria for implementation planning

These are draft criteria, not currently authorized work:

1. No change to AES-256-GCM envelope format, AAD, or SQLite credential schema.
2. LSS adapter explicitly requires the Secret Service backend on Linux.
3. No keyutils, key-file, plaintext, environment-variable, or other automatic fallback after LSS is active.
4. Existing key material is never overwritten or regenerated when encrypted records exist.
5. Missing/locked/unavailable Secret Service produces typed, sanitized, fail-closed errors.
6. Key bytes never appear in logs, API responses, test output, or repository files.
7. CRUD, create-if-absent concurrency, process restart, and isolated daemon restart tests pass.
8. Migration verification leaves every encrypted SQLite row unchanged.
9. Linux tests run locally only; no GitHub Actions or hosted CI.
10. Windows remains untouched and unauthorized.
11. Report includes exact local commands, environment, exit codes, diff scope, and evidence.
12. GPT independently audits the pushed implementation and report; owner formally accepts before next phase.

## 10. Open decisions for owner review

No implementation task should be created until these decisions are answered:

1. **Candidate dependency:** Approve further evaluation of `@napi-rs/keyring@2.1.2` only after license/supply-chain review, or require a different Secret Service client.
2. **Collection behavior:** Accept the candidate's default/login collection limitation, or require explicit collection selection (which may require another library or direct D-Bus integration).
3. **First-run UX:** Should QFAT stop with clear instructions when the login collection is locked, or is an explicit user-driven unlock/setup flow required?
4. **Migration:** Should key-file migration be a separately invoked maintenance action after provider integration, with the old key file retained until owner-approved retirement?
5. **Phase sequencing:** Approve Phase A dependency/security evaluation as the next bounded task, without authorizing provider implementation.

## 11. Explicit exclusions and authority

This proposal does not authorize:
- adding any dependency or changing package manifests/lockfiles;
- editing application source, database schema, or migrations;
- implementing or wiring an LSS provider;
- moving, deleting, rotating, or rewriting any real credential/key;
- automatically migrating or retiring the key file;
- OAuth, account UI/API, platform API integration, uploads, publishing, jobs, or scheduling;
- Windows work of any kind;
- GitHub Actions or hosted CI.

**Current status: DRAFT — OWNER REVIEW REQUIRED.** The only next action requested is owner review of the open decisions above.