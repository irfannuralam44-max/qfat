# QFAT-024 — Record Owner Decisions and Refine Minimal Spoolcast Integration Design

- **Task ID:** QFAT-024
- **Status:** OWNER-AUTHORIZED FOR DOCUMENTATION WORK — 2026-11-14
- **Task type:** Documentation-only owner-decision recording and read-only technical refinement
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Predecessor:** QFAT-023; accepted documentation design with runtime integration still blocked
- **Owner-approved decisions:** single-owner operating model; Spoolcast remains the sole source of truth for provider OAuth/accounts/tokens
- **Expected report:** `reports/QFAT-024-owner-decisions-minimal-integration-design-report.md`

## 1. Objective

Record the Owner's explicit decisions and refine the smallest technically supportable QFAT-to-Spoolcast integration direction using current source evidence.

QFAT remains the browser frontend. Spoolcast remains the application and publishing core. This task is strictly documentation and read-only investigation. It does not authorize runtime implementation, package changes, credentials changes, or live provider operations.

The purpose is to prevent future work from reopening settled decisions or creating duplicate account/token ownership, while clearly identifying the remaining blockers before any implementation task can be written.

## 2. Owner decisions to record as settled

### D-024-01 — Single-owner MVP

The MVP is operated by one owner. Do not introduce multi-user registration, roles, per-user permissions, teams, or account ownership abstractions.

This is a product/operating-model decision, not proof that the current browser session is authenticated. Existing Origin/Host, bootstrap session, and CSRF protections must not be described as owner authentication.

Any future publishing boundary reachable over LAN/Tailscale must be limited to the owner's trusted devices/network. The current source does not establish that this access restriction or owner authentication is already enforced. Record the remaining minimum security requirement as OPEN OWNER DECISION if source inspection cannot prove it.

### D-024-02 — Spoolcast owns provider credentials and account authorization

Spoolcast's existing OAuth flows, token store, account aliases, and app-level credential files/environment remain authoritative.

- Reuse existing Spoolcast credential/account resolution where technically supported.
- QFAT must not create a second OAuth flow or provider-account source of truth.
- Do not copy, migrate, synchronize, or dual-write provider tokens into QFAT SQLite or QFAT's `CredentialProvider`.
- Do not expose tokens, client secrets, or credential payloads to browser code, HTTP responses, URLs, process arguments, logs, or progress events.
- QFAT's existing encrypted credential provider is not to be used for Spoolcast provider tokens under this decision.

This decision does not authorize changes to Spoolcast OAuth behavior or token storage.

## 3. Required source-grounded investigation

Read the current versions of:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md`
- `reports/QFAT-023-spoolcast-invocation-boundary-design-report.md`
- `tasks/QFAT-023-spoolcast-invocation-boundary-design.md`

Re-fetch current source on synchronized `main`; do not rely solely on QFAT-023 baseline observations. At minimum inspect:
- `src/tokens.ts`: load/list/resolve account functions and token file behavior.
- `src/config.ts`: Spoolcast home and credential file locations.
- `src/auth-youtube.ts` and `src/auth-facebook.ts`: OAuth persistence ownership.
- `src/upload-youtube.ts`, `src/upload-facebook.ts`, `src/upload-facebook-reel.ts`: adapter inputs and credential requirements.
- `src/manifest.ts`: metadata requirements and immediate/scheduled validation.
- Root `package.json` / `tsconfig.json`, `apps/server/package.json` / `tsconfig.json`, and relevant lockfiles: determine whether a supported in-process package boundary already exists or what exact package/build changes would be required.
- `apps/server/src/index.ts`, security routes, `apps/web/vite.config.ts`, and browser security client: verify the current access/authentication boundary.
- Relevant existing tests for token resolution, adapters, and server security (read-only).

Compare only technically viable minimal options for invoking existing adapters. In particular:
1. Whether QFAT server can consume existing Spoolcast token/account resolver and adapters through a supported package boundary without importing CLI entrypoints or private source paths.
2. Whether a narrowly scoped one-shot Spoolcast command is simpler or safer, and what exact CLI contract would be missing.
3. Whether the current source proves any complete path; if not, state the blocker precisely.

Do not select a design merely because it appears shortest in code. Include production build/runtime behavior and package ownership in the comparison.

## 4. Required design outcomes

Update the existing invocation design to:
- Mark D-024-01 and D-024-02 as **OWNER-DECIDED**.
- Explain the existing Spoolcast alias-based account resolver and whether it can be reused directly without duplicating credentials.
- State clearly that QFAT `CredentialProvider` is not the provider-token source of truth.
- Recommend the minimum viable next technical direction only if current source evidence supports it.
- Preserve the QFAT-023 finding that in-process adapter invocation is only a candidate until package/build boundaries and runtime behavior are proven.
- Keep all unresolved issues visible, including publishing authorization over LAN/Tailscale, media handoff/extension/MIME compatibility, immediate-mode manifest validation, progress/request lifetime, cancellation uncertainty, duplicate submissions, and truthful Scheduled vs Published status.
- Provide a dependency-ordered list of decisions/tasks required before runtime implementation.
- Do not silently resolve remaining decisions or invent authentication, media, or invocation workarounds.

## 5. Exact allowed paths

Only these paths may be created or modified:
- `tasks/QFAT-024-owner-decisions-minimal-integration-design.md` (this task file; do not modify after execution starts)
- `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`
- `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md`
- `reports/QFAT-024-owner-decisions-minimal-integration-design-report.md`

All other files are read-only.

## 6. Strict exclusions

- Any runtime/source/test changes under `src/`, `apps/`, or elsewhere.
- Any package manifest, lockfile, dependency, build, TypeScript config, schema, migration, or database changes.
- Any OAuth/account/token/credential behavior changes, migration, copying, synchronization, or deletion.
- Any route, endpoint, IPC, child process, launcher, service, daemon, worker, queue, scheduler, job engine, retry, cancellation, history, or persistence implementation.
- Any frontend/UI changes or enabling publishing controls.
- Live OAuth, account authorization, provider API calls, uploads, or external network tests.
- Hosted CI/GitHub Actions.
- Figma work.
- Deleting, migrating, or refactoring existing QFAT subsystems.
- Treating private LAN/Tailscale reachability or CSRF as owner authentication without evidence.

## 7. Acceptance criteria

- [ ] AC-01: Safely synchronize `main`, verify remote HEAD, and preserve all pre-existing local work.
- [ ] AC-02: Read all required documents and inspect current source/tests relevant to the decisions.
- [ ] AC-03: Record single-owner MVP and Spoolcast-owned credentials as explicit Owner decisions in the scope-control document.
- [ ] AC-04: Document actual Spoolcast account alias resolution and OAuth/token ownership from current source.
- [ ] AC-05: Confirm that QFAT CredentialProvider is not a source of truth for Spoolcast provider tokens under the Owner decision.
- [ ] AC-06: Compare minimal in-process/package-boundary and one-shot CLI options using production build/runtime evidence; do not import CLI entrypoints as service APIs.
- [ ] AC-07: Explicitly assess LAN/Tailscale owner authorization; distinguish network reachability, Origin/Host, session, CSRF, and authentication.
- [ ] AC-08: Retain all QFAT-023 unresolved technical blockers and F-01 media extension/MIME compatibility finding.
- [ ] AC-09: Provide a dependency-ordered next-step recommendation and clearly state whether runtime implementation is still blocked.
- [ ] AC-10: Only paths in §5 changed; no runtime, tests, dependencies, configuration, schema, credentials, or provider behavior changed.
- [ ] AC-11: Report contains exact verification commands/environment/results, evidence paths, findings, limitations, and Git publication evidence.

## 8. Verification and publication

This is documentation-only and read-only with respect to implementation:
- Follow `AGENTS.md` and `docs/AI-DEVELOPMENT-WORKFLOW.md`.
- Run `git diff --check`.
- Review `git status --short`, staged paths, and the complete diff.
- Verify only the allowed documentation paths changed.
- Check Markdown links and consistency with PRD/architecture/ADR decisions.
- Do not run live provider calls or credential-dependent flows.
- Typecheck/build/application tests are NOT RUN unless a read-only reason exists; do not modify code to make them pass.
- Record exact commands, environment, and actual outcomes. If local working-tree inspection is unavailable, report it as NOT RUN; do not claim it passed.
- Commit and publish only the authorized documentation paths to `main`, then verify the remote commit and report.
- Stop after publication and hand off Branch, Commit message, Full SHA, and Report path only.

## 9. Stop rule

If current source reveals that the agreed credential ownership cannot be reused without changing Spoolcast token behavior, duplicating secrets, or adding an unapproved subsystem, stop and record **OPEN OWNER DECISION**. Do not implement a workaround.

If no complete safe invocation path exists, say so plainly. QFAT-024 does not authorize QFAT runtime integration.
