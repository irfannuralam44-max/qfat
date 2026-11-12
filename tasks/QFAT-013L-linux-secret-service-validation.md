# Task QFAT-013L — Linux Secret Service Feasibility Validation

- **Status:** OWNER-AUTHORIZED FOR EXECUTION — Linux feasibility validation only
- **Task type:** Linux-only credential-store investigation and isolated feasibility spike
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Parent workstream:** QFAT-013 Linux credential storage
- **Accepted prerequisite:** QFAT-013R2 (owner acceptance: PASS)
- **Primary candidate:** `@napi-rs/keyring` using Linux Secret Service
- **Report path:** `reports/QFAT-013L-linux-secret-service-validation-report.md`

## 1. Objective

Determine whether Linux Secret Service can become QFAT's OS-protected credential backend in a reliable, fail-closed way on the owner's Linux environment.

The current QFAT-013 implementation stores AES-256-GCM ciphertext in SQLite and keeps its encryption key in a separate local key file under ADR-004. This was explicitly approved as a temporary bridge, not as equivalent to an OS-protected credential store.

This task is investigation only. It must establish the real behavior and limitations of the proposed Linux Secret Service integration before a separate implementation/migration task is written.

## 2. Authority and platform boundary

- Linux is the only active platform workstream.
- Windows remains DEFERRED and NOT AUTHORIZED. Do not inspect, implement, or test Windows credential storage or ACLs.
- This task itself is **not authorized for execution yet**. The owner must explicitly authorize it after reviewing this task specification.
- Do not infer authorization from this file's presence, task ID, roadmap order, or an agent prompt.
- Even after execution is authorized, this task authorizes feasibility validation only—not production integration or credential migration.

## 3. Required reading

Read completely after synchronizing to the latest `origin/main`:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md` — credential and security requirements
- `docs/ARCHITECTURE-QFAT-MVP.md` — credential layer and Linux Secret Service expectations
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `reports/QFAT-002R2-final-audit-correction.md` — credential-store recommendation and outstanding Linux validation
- `tasks/QFAT-013-encrypted-local-credential-storage.md`
- `tasks/QFAT-013R-linux-credential-storage-hardening.md`
- `tasks/QFAT-013R2-credential-key-concurrent-durability.md`
- The QFAT-013, QFAT-013R, and QFAT-013R2 reports.
- Current credential provider implementation, package manifests, lockfile, and test conventions.

The PRD and fail-closed security requirements are authoritative. Historical technical recommendations are candidates to validate, not automatic approval to install a dependency.

## 4. Scope

### 4.1 Validate the Linux runtime environment

On the actual Linux development host, record:

- Distribution and version, kernel, architecture, Node.js and npm versions.
- Desktop/session type where relevant (for example, GNOME/KDE/headless), without collecting personal or unrelated system data.
- Whether a D-Bus session bus is available.
- Whether a Secret Service implementation is present and running (for example, GNOME Keyring or KWallet Secret Service compatibility).
- Whether the service is locked, unlocked, unavailable, or not configured, and how each state can be detected reliably.
- Whether the environment is a normal user session, headless session, container, or SSH session, where relevant to reproducibility.

Do not install, enable, unlock, reconfigure, or change the user's system keyring or desktop services. Report missing prerequisites rather than modifying the host.

### 4.2 Evaluate the candidate library

Evaluate the current maintained release and official documentation for `@napi-rs/keyring` and its Linux Secret Service behavior.

Verify, with sources and executable evidence where possible:

- Supported Node.js versions, Linux architectures, native binary availability, and installation/runtime requirements.
- The exact API used for create/set, get, update, and delete operations.
- Whether the library can explicitly select or require the Secret Service backend.
- Whether it can silently choose Linux kernel keyutils or another backend; determine how to prevent that.
- Behavior when the D-Bus session bus is missing, the Secret Service daemon is absent, the collection is locked, the service is unavailable, or a request fails.
- Error types/codes and whether they are sufficiently distinguishable for actionable fail-closed diagnostics.
- Whether secret values are returned only to backend process memory and whether the library logs or serializes secret values.
- Native dependency, packaging, ABI, and operational maintenance risks.

Compare a direct Secret Service D-Bus implementation or another credible maintained option only if the candidate cannot meet a mandatory requirement. Do not broaden into a general credential-manager survey.

### 4.3 Isolated feasibility spike

Only after the task is explicitly authorized:

- Build a disposable, isolated test harness outside the tracked QFAT application dependency graph, or use an equivalently isolated temporary workspace.
- Do not add the candidate package to QFAT's `package.json` or lockfile.
- Use synthetic, non-sensitive dummy values only.
- Test set, retrieve, overwrite/update, delete, and retrieval after process restart.
- Test service unavailable and locked/unavailable collection behavior where the host allows it.
- Test backend selection and prove that keyutils or another non-Secret-Service backend is not silently used.
- Capture exact commands, sanitized outputs, and exit codes. Never print dummy secret values in logs or reports; use hashes or boolean equality checks.
- If the actual host cannot exercise a condition, mark it NOT RUN and explain why. Do not simulate a result and label it as host validation.

The spike must not touch QFAT's real credential database, key file, configuration, or user keyring entries. Use a uniquely named disposable test entry and remove it at the end; verify cleanup. If safe cleanup cannot be guaranteed, stop before writing any entry.

### 4.4 Architecture and migration assessment

Document how a future LSS provider could satisfy the existing backend-only `CredentialProvider` boundary.

Assess—but do not implement—the safe migration from the current temporary key-file provider:

- Existing encrypted SQLite credential records must remain recoverable throughout migration.
- Read/decrypt using the existing provider, write to Secret Service, read back and verify exact payload equivalence without logging values, then record/confirm migration state before any deletion of old material.
- Define interruption/retry behavior so partial migration cannot lose credentials or create ambiguous active sources.
- Define rollback and backup implications.
- Do not delete the key file, encrypted rows, or any existing data during this task.
- Do not invent a migration schema or edit production code; list decisions a future implementation task must resolve.

### 4.5 Documentation and report

Create the report at:

`reports/QFAT-013L-linux-secret-service-validation-report.md`

Include source links and access dates for current library/runtime claims. Distinguish:
- Official documentation/source review.
- Host environment inspection.
- Executed isolated spike tests.
- Untested assumptions or NOT RUN cases.

Do not update ADR-004, PRD, architecture, production source, dependencies, or existing historical reports in this investigation task. Recommend precise documentation/ADR changes for a later owner decision if needed.

## 5. Acceptance criteria

| ID | Criterion | Required evidence |
|---|---|---|
| AC-01 | Actual Linux host and session prerequisites are recorded | Sanitized environment details and exact inspection commands |
| AC-02 | Candidate library API, support matrix, native requirements, and maintenance status are evaluated | Official source links, access dates, source review |
| AC-03 | Secret Service backend can be explicitly selected/required, or inability is conclusively documented | Source/API evidence and isolated runtime test where possible |
| AC-04 | No silent keyutils or weaker-backend fallback can occur | Configuration/source evidence and negative test |
| AC-05 | Set/get/update/delete and process-restart persistence work with synthetic data | Exact isolated test results |
| AC-06 | Missing bus, missing daemon, locked collection, and service failure behavior is characterized | Executed tests where possible; otherwise NOT RUN with reason |
| AC-07 | Errors support fail-closed behavior without leaking secrets | Error mapping review and sanitized negative-test evidence |
| AC-08 | No tracked QFAT source, production dependency, lockfile, database, key file, or user credential data is changed | Git diff/status and explicit filesystem/data boundary confirmation |
| AC-09 | Future provider integration and loss-safe migration risks are documented without implementation | Migration sequence, interruption/retry analysis, unresolved decisions |
| AC-10 | Report is complete, evidence-based, and distinguishes PASS/FAIL/NOT RUN | Report review |
| AC-11 | Windows, OAuth, real credentials, account UI/API, uploads, and publishing remain untouched | Diff and scope review |

## 6. Explicit exclusions

- Production LSS provider implementation or factory wiring.
- Adding `@napi-rs/keyring` or any other package to QFAT manifests/lockfiles.
- Modifying QFAT source code, database schema, migrations, credential records, or key files.
- Migrating, deleting, rotating, or rewriting existing credentials or encryption keys.
- Accessing real Google/YouTube/Meta credentials or connecting accounts.
- OAuth, account management UI/API, platform API calls, uploads, or publishing.
- Installing/enabling/configuring system keyring services or changing desktop/session configuration.
- Windows Credential Vault, Windows ACLs, Windows host checks, or any Windows implementation.
- Figma, unrelated frontend work, or any later QFAT task.

If Secret Service cannot be safely tested on the available Linux host, stop at source/environment analysis and report the limitation. Do not weaken the acceptance criteria or substitute keyutils/file storage to obtain a green result.

## 7. Verification and publication

After explicit owner authorization:

1. Verify repository identity, origin, branch `main`, HEAD, and clean working tree.
2. Preserve all pre-existing local changes; stop if synchronization is unsafe.
3. Run `git pull --ff-only origin main`, then verify this exact task exists and read it completely.
4. Use one OpenCode main agent serially.
5. Keep the spike isolated and ensure no tracked application changes or dependency modifications.
6. Run `git diff --check` and inspect `git status` and the complete diff.
7. Commit only the report (and any explicitly task-related evidence artifact that contains no secrets or personal system data) to `main`.
8. Push and verify the remote commit and report path.
9. Use the report structure and exact `## Git Publication` format in `docs/AI-DEVELOPMENT-WORKFLOW.md`.
10. Return the required four-line handoff only.

Agent completion is not owner acceptance. GPT independently audits the report and evidence. A separate owner decision is required before creating or authorizing production LSS integration/migration work.

## 8. Required final handoff

After successful remote verification, return exactly:

Branch:
Commit message:
Full SHA:
Report path:

Stop after handoff. Do not begin production integration or another QFAT task.
