# Task QFAT-013 — Encrypted Local Credential Storage Foundation

- **Status:** OWNER-AUTHORIZED FOR EXECUTION
- **Task type:** Bounded backend implementation and verification
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Baseline commit:** `3e1210ad34132b4cb416b3cb49ba608500bcdd7d`
- **Approved decision:** `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- **Report path:** `reports/QFAT-013-encrypted-local-credential-storage-report.md`

## 1. Objective

Implement the temporary QFAT credential persistence foundation approved in ADR-004.

Credential values must be encrypted before they are written to SQLite. The encryption key must be generated randomly and stored in a separate local key file in an OS-user-specific QFAT configuration directory. The design must be behind a `CredentialProvider` abstraction so a later LSS/WCV implementation can replace the key-file provider without changing account-management business logic.

This task authorizes only the local credential-storage foundation. It does not authorize OAuth, connecting real YouTube/Facebook accounts, account-management UI/API, or publishing.

## 2. Authoritative documents and constraints

Read completely before editing:
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md` — especially §4.2, §6.4, and §7
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`
- `docs/decisions/ADR-002-local-browser-security-design.md`
- `docs/decisions/ADR-003-beta-network-access-and-pwa.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `reports/QFAT-002R2-final-audit-correction.md`
- Current SQLite schema, migration conventions, server module conventions, and relevant tests.

Owner-approved decisions:
- SQLite remains the local application database.
- Credential values are encrypted at the application layer before persistence.
- Encryption: Node.js built-in `node:crypto`, AES-256-GCM, 32-byte cryptographically random key, fresh 12-byte nonce per encryption, and 16-byte authentication tag.
- The key is stored separately from the SQLite database in a user-specific local QFAT configuration directory.
- Fail closed on missing, inaccessible, malformed, or invalid key material. Never silently replace a key if encrypted records may exist.
- LSS/WCV validation and migration are later, separate work.

## 3. Scope

### 3.1 Credential-provider contract

- Define a typed `CredentialProvider` abstraction consistent with existing backend architecture.
- Provide a local key-file-backed implementation.
- The interface must support storing, retrieving, and deleting opaque credential payloads by stable internal identifier.
- Callers must not receive or persist raw key material.
- Keep provider-specific filesystem and cryptographic logic out of account-management/domain code.
- Do not expose any credential value through HTTP routes or frontend contracts.

### 3.2 Encryption envelope

- Use AES-256-GCM through Node.js built-in crypto; do not add a native crypto dependency.
- Generate the 32-byte key with a cryptographically secure random generator.
- Generate a fresh 12-byte nonce for every encryption operation.
- Persist the ciphertext, nonce, authentication tag, and an explicit envelope/version marker. Use SQLite BLOB columns where appropriate.
- Bind stable record context (at minimum credential record ID and purpose/provider discriminator) as authenticated additional data (AAD), so ciphertext cannot be silently moved between records or purposes.
- Validate envelope shape and lengths before decryption.
- Authentication failure, wrong key, altered ciphertext, altered nonce/tag, or mismatched AAD must fail closed. Never return partial/plaintext data after an authentication error.
- Do not log plaintext, key bytes, ciphertext payloads, authorization headers, or token-bearing metadata.

### 3.3 Key-file lifecycle and filesystem safety

- Derive the key-file location from the existing QFAT OS-specific user configuration/data-directory conventions after inspecting the repository. Document the exact resolved location for Linux and Windows.
- Keep the key file separate from the SQLite database path.
- Create the parent directory with restrictive permissions where supported; create the key file exclusively so concurrent starts cannot overwrite an existing key.
- On POSIX, enforce and verify private directory/file permissions (directory owner-only; key file owner read/write only, normally 0700/0600).
- On Windows, do not assume POSIX `chmod` enforces an ACL. Verify the effective ACL on the user-specific directory/key file using a reliable Windows-supported method. If the implementation cannot establish and verify an owner-restricted ACL, fail closed on Windows and document the blocker; do not claim Windows support based on an unverified assumption.
- Reject symlink/non-regular-file key paths and unsafe ownership/permission states where the platform exposes reliable checks.
- Use safe exclusive creation and atomic persistence. Handle interrupted creation without leaving a valid-looking partial key.
- Never regenerate or replace a missing, malformed, or unreadable key when credential records exist. Return a typed, actionable error without disclosing sensitive filesystem details to an untrusted caller.
- Do not provide environment-variable, machine-ID, hardcoded, plaintext, or alternate-file fallback modes.

### 3.4 SQLite persistence

- Follow the existing Drizzle/better-sqlite3 schema and migration conventions.
- Add only the minimal credential-record persistence needed to exercise the provider contract. Keep secret fields encrypted only.
- Use transactions for record writes/deletes where needed.
- Ensure deletion removes the encrypted credential record; do not claim secure physical erasure from SQLite/WAL.
- Do not add account tables, OAuth state tables, account APIs, or UI in this task unless an existing schema contract makes a minimal dependency unavoidable; stop and report if so.

### 3.5 Documentation

- Document the temporary threat model, limitations, key-file locations, startup failure behavior, and backup/restore dependency on both database and key file.
- Clearly state this is not whole-database encryption and is not equivalent to LSS/WCV.
- Record any OS-specific validation that was not possible as NOT RUN / UNVERIFIED, not PASS.

## 4. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | CredentialProvider abstraction and key-file implementation exist | Source inspection and focused tests |
| AC-02 | Credential values are encrypted before SQLite persistence | Test proves raw dummy token is absent from stored DB values |
| AC-03 | AES-256-GCM envelope uses fresh nonce, tag, version, and context-bound AAD | Unit tests and source inspection |
| AC-04 | Correct key/context decrypts exact original dummy payload | Round-trip test |
| AC-05 | Tampered ciphertext, nonce, tag, wrong key, or mismatched AAD fails closed | Negative tests |
| AC-06 | Key is generated once and stored separately from SQLite | Filesystem tests and path documentation |
| AC-07 | Existing key is never overwritten or silently regenerated | Missing/corrupt key tests with existing credential records |
| AC-08 | POSIX key directory/file permissions are restrictive and verified | Linux test evidence |
| AC-09 | Windows ACL restrictions are verified, or Windows provider startup fails closed with a documented limitation | Windows evidence or explicit NOT RUN/BLOCKED finding |
| AC-10 | No plaintext fallback, machine-ID-derived key, hardcoded key, or secret logging exists | Search/review and negative tests where practical |
| AC-11 | No OAuth, real account connection, publishing, or frontend secret exposure is introduced | Diff and route/API review |
| AC-12 | Existing tests and required project checks remain green | Exact commands and exit results in report |

## 5. Test requirements

Use only synthetic dummy credentials. Tests must be offline and must use isolated temporary directories/databases.

At minimum cover:
- Store/read/delete round trip.
- Raw dummy token is not present in SQLite persisted values.
- Fresh nonce is generated for separate encryptions of the same payload.
- Ciphertext, nonce, tag, AAD, and key tampering.
- Missing key with no records (safe first-time creation) versus missing key with existing records (fail closed).
- Corrupt, truncated, unreadable, and wrong-length key file.
- Existing key is not overwritten on repeated initialization or concurrent initialization.
- Symlink/non-regular key-file path rejection where supported.
- POSIX directory/file permissions.
- Windows ACL verification or fail-closed behavior; do not infer from Linux tests.
- No key/token values in logs or error responses.

Run the repository's applicable test, typecheck, build, and lint commands only after inspecting the package scripts and task-specific guidance. Record exact commands and results. Do not claim checks that were not executed.

## 6. Explicit exclusions

- No Google/YouTube or Meta/Facebook OAuth flow.
- No live credentials, real accounts, platform API calls, uploads, or publishing.
- No account-management UI or account HTTP endpoints.
- No changes to browser session, Origin/Host, proxy, or CSRF behavior.
- No LSS or WCV integration in this task.
- No migration of real existing tokens; there should be no production credential payloads to migrate.
- No whole-database encryption or SQLCipher adoption.
- No machine-ID-derived key, password prompt, plaintext fallback, or insecure development bypass.
- No broad refactor, package replacement, or unrelated UI changes.
- Do not modify the PRD. ADR-004 records the explicitly approved temporary alternative.
- Do not start QFAT-014 or any other task.

If Windows ACL enforcement cannot be implemented safely with available supported mechanisms, do not weaken the requirement to get a green result. Complete safe platform-independent/Linux work only if the task remains coherent, report Windows as BLOCKED/NOT RUN, and stop for owner review before claiming cross-platform credential-storage readiness.

## 7. Safe repository procedure

1. Verify repository identity and `origin` is `https://github.com/irfannuralam44-max/qfat.git`.
2. Verify branch `main`, HEAD, and working-tree status.
3. Confirm baseline `3e1210ad34132b4cb416b3cb49ba608500bcdd7d` is reachable and that ADR-004 is present.
4. Preserve all pre-existing local changes. Stop if the working tree is dirty or the repository/remote/branch differs.
5. If safe, run `git pull --ff-only origin main`. Stop if fast-forward synchronization is not possible.
6. Read this task after synchronization and inspect current source/schema/tests before planning.
7. Use one OpenCode main agent serially; no parallel agents.
8. Keep changes within this task's scope.

## 8. Verification and publication gate

- Review the full diff, staged paths, and `git status`.
- Run `git diff --check` and all applicable checks identified in §5.
- Verify no real secrets or generated key files are included in the repository.
- Verify no OAuth/account/publishing/frontend behavior was introduced.
- Commit and push to `main` only after scope and verification review.
- Verify the remote branch points to the expected commit and the report is present on GitHub.
- Write the report at `reports/QFAT-013-encrypted-local-credential-storage-report.md` using the report structure in `docs/AI-DEVELOPMENT-WORKFLOW.md`, including exact test evidence and the required Git Publication section.
- Distinguish Linux/Windows execution, source inspection, and unverified assumptions.

## 9. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Agent completion is not owner acceptance. GPT will independently audit the pushed implementation and report. Account Management and real OAuth work remain gated on that audit and explicit owner approval.
