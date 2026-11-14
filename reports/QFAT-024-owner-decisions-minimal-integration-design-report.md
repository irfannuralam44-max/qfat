# Implementation Report — QFAT-024

- **Status:** PASS WITH FINDINGS (documentation criteria completed; runtime integration remains blocked)
- **Task specification:** `tasks/QFAT-024-owner-decisions-minimal-integration-design.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Synchronized remote HEAD before task work:** `a81ee20acb68875f8ea5e39c4e284297e378eca5`
- **Primary design commit:** `77065717d668c5efb7891de3d93c4e8ecfeff08e`
- **Commit message:** `docs(QFAT-024): refine invocation design with owner decisions`
- **Report:** `reports/QFAT-024-owner-decisions-minimal-integration-design-report.md`

## Scope

Recorded the two Owner decisions from QFAT-024 and refined the existing Spoolcast invocation-boundary design using current `main` source and read-only tests inspection.

This task changed only the two existing authorized documents and this report. No runtime integration was implemented or selected. The in-process adapter path remains a preferred direction for further technical investigation, not an approved topology. The existing one-shot `spoolcast run` CLI is not a safe selected-item invocation interface.

## Implementation

### Owner decisions recorded

**D-024-01 — OWNER-DECIDED: single-owner MVP**

- The MVP is operated by one owner.
- No multi-user registration, roles, per-user permissions, teams, or per-user account ownership abstractions.
- Browser clients on LAN/Tailscale are devices used by that owner, not separate application users.
- The decision does not claim current owner authentication. Current Origin/Host checks, bootstrap sessions, and CSRF do not prove human identity.
- **OPEN OWNER DECISION:** source does not establish an enforceable trusted-device/network allowlist or owner-only publishing authorization. The Owner must define how the intended trusted LAN/Tailscale boundary is enforced before a publishing route is exposed.

**D-024-02 — OWNER-DECIDED: Spoolcast owns all provider OAuth/accounts/tokens**

- Existing Spoolcast OAuth flows, account aliases, token store, Google client credentials, and Facebook app credentials remain the only source of truth.
- QFAT must not create OAuth, copy/migrate/synchronize/dual-write tokens, create a second provider account registry, or use its encrypted `CredentialProvider` for Spoolcast provider tokens.
- Existing `loadTokens()`, `getYouTubeAccount()`, `getFacebookAccount()`, and `listAccountKeys()` are the source-supported account-resolution primitives. A future trusted Node caller can conceptually resolve an alias and pass the returned account object to the existing adapter without copying tokens.
- **OPEN OWNER DECISION:** the Spoolcast home path and least-privilege process access are not configured by the current QFAT server. `src/config.ts` captures `SPOOLCAST_HOME` or `process.cwd()` at module evaluation.

### Refined invocation assessment

- In-process resolver/adapter reuse is the preferred technical investigation direction because the existing primitives can operate in the same trusted Node process and avoid inventing a new CLI request protocol.
- It is not implementation-ready: root Spoolcast has no public service export, no `exports` map, no generated declaration files, no workspace/package dependency from `@qfat/server`, and independent lockfiles/build roots. Production packaging and module resolution are not solved by both packages being ESM.
- Current `spoolcast run` is queue-wide and side-effecting; it does not accept one selected media item, a bounded target set, structured request/result data, or a QFAT progress protocol. It could publish unrelated pending queue items if used as a QFAT one-shot command.
- Persistent child/IPC has no existing implementation or source-proven need and is not the minimal direction.
- No invocation topology is selected or authorized.

### Re-verified blockers

1. LAN/Tailscale Origin/Host + bootstrap session + CSRF are not owner authentication. Vite listens on `0.0.0.0:5173`; the API binds to `127.0.0.1:3001`; bootstrap creates sessions after allowed Origin/Host checks without an owner identity or device-pairing proof.
2. Media handoff remains incompatible/unproven (QFAT-023 F-01): QFAT stores uploaded files under UUID storage keys without extensions; Spoolcast scans only `.mp4` and `.mov`; adapter MIME inference uses the path extension. QFAT also accepts images and WebM, neither of which is a verified Spoolcast video input. QuickTime stored under a UUID path would not be inferred as `video/quicktime` by the current adapter helper.
3. `src/manifest.ts` requires/parses `publishAt` and applies Facebook's future schedule window validation for Facebook targets; the current CLI does not pass QFAT-015's immediate option.
4. Progress callbacks exist in adapters, but no QFAT transport or request-lifetime policy exists. The adapter APIs do not expose a common AbortSignal.
5. Browser disconnect/child termination cannot prove provider cancellation; duplicate submission behavior is undefined.
6. Spoolcast's durable ledger has only `posted` and `failed`; scheduled provider acceptance is not proof of Published/Live.
7. Facebook single-image and album publishing remain unverified/not found in the inspected adapter set.

### Dependency-ordered recommendation

1. Resolve and verify owner-only publishing access for trusted LAN/Tailscale devices.
2. Define the existing Spoolcast home path and least-privilege OS access while retaining Spoolcast credential ownership.
3. If separately authorized, prove a supported Spoolcast package/build/service boundary in production packaging; do not import CLI entrypoints or private source paths.
4. Decide and prove QFAT media-record to Spoolcast `.mp4/.mov` path/MIME handoff.
5. Resolve immediate-mode manifest input without dummy timestamps or bypassing Facebook validation.
6. Only after those gates, select and authorize invocation topology, progress/request lifetime, cancellation, error redaction, and duplicate-submit behavior.
7. Define truthful per-target Scheduled versus Published/Live results without silently reusing `posted` as public status or creating a second ledger.

This ordering is a recommendation for future Owner decisions, not authorization to create or start another task.

## Files Changed

Only paths permitted by QFAT-024 §5 are changed in the final net diff:

| Path | Purpose |
|---|---|
| `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md` | Records D-024-01 and D-024-02 as Owner-decided and distinguishes settled credential ownership from unresolved access/security requirements |
| `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md` | Updates QFAT-023 design with actual alias resolver reuse, package/build evidence, LAN/Tailscale authorization assessment, F-01 media compatibility, and dependency-ordered gates |
| `reports/QFAT-024-owner-decisions-minimal-integration-design-report.md` | This report |

The QFAT-024 task file was read and not modified. All source, tests, package manifests, lockfiles, TypeScript configuration, schema, credentials, media, and runtime paths remain unchanged.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 Safely synchronize main, verify remote HEAD, preserve pre-existing work | PASS WITH FINDINGS | Confirmed remote `main` and HEAD `a81ee20acb68875f8ea5e39c4e284297e378eca5`; compared against QFAT-023 final SHA `7ed230dd9860e755b68a3e4715c29220bf0bc746` (6 commits ahead, 0 behind). Remote task-definition commit adds only the QFAT-024 task file. No local checkout is available, so local working-tree state cannot be inspected; no remote changes were overwritten. |
| AC-02 Read all required documents and inspect current source/tests | PASS | Read AGENTS, workflow, scope control, PRD, architecture, QFAT-023 design/report/task, README, CLAUDE, ADR-002, and current token/config/auth/adapter/manifest/package/server/security/media/frontend/test sources. |
| AC-03 Record single-owner and Spoolcast-owned credentials in scope control | PASS | D-024-01 and D-024-02 added under dated Owner decisions section in `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`. |
| AC-04 Document actual Spoolcast alias resolution and OAuth/token ownership | PASS | Design §13.2 records `loadTokens`, `saveTokens`, `getYouTubeAccount`, `getFacebookAccount`, `listAccountKeys`, alias resolution rules, OAuth flows, and credential files. |
| AC-05 Confirm QFAT CredentialProvider is not provider-token source of truth | PASS | Scope control and design §§13.2 / 13.6 explicitly prohibit using QFAT CredentialProvider for Spoolcast provider tokens. |
| AC-06 Compare in-process and one-shot CLI with production build/runtime evidence | PASS | Design §13.3 records ESM package metadata, missing exports/workspaces/dependency, independent lockfiles, TS rootDir/outDir/declaration settings, Node engine overlap, and exact CLI queue-wide behavior. No CLI entrypoint is treated as a service API. |
| AC-07 Assess LAN/Tailscale owner authorization | PASS WITH FINDINGS | Design §§13.1 and 13.4 distinguish network reachability, Origin/Host, bootstrap session, CSRF, and authentication. Owner-only enforcement remains OPEN OWNER DECISION because source does not prove it. |
| AC-08 Retain QFAT-023 blockers and F-01 media extension/MIME compatibility | PASS | Design §13.4 explicitly records media UUID storage key/no extension, original filename/MIME metadata, Spoolcast .mp4/.mov scan, adapter extension-based MIME, WebM/image exclusion, immediate manifest, progress/lifetime, cancellation, duplicate submission, status, and provider capability gaps. |
| AC-09 Provide dependency-ordered recommendation and state runtime status | PASS | Design §§13.5–13.6; runtime integration remains BLOCKED and no topology selected. |
| AC-10 Only exact allowed paths changed; no runtime/source/test/dependency/config/schema/credential/provider changes | PASS | Final remote compare from synchronized HEAD lists only the two allowed documentation paths plus this report. Task path and all implementation paths are unchanged. |
| AC-11 Report contains exact verification, evidence, findings, limitations, Git evidence | PASS | This report §§2–8. Local-only checks unavailable through GitHub repository interface are explicitly NOT RUN. |

## Verification

Environment: GitHub repository connector / remote GitHub file and commit operations. No local repository checkout or shell is exposed in this execution environment.

| Command / Check | Result | Notes |
|---|---|---|
| Fetch/resolve `main` | PASS | Remote HEAD before task edits: `a81ee20acb68875f8ea5e39c4e284297e378eca5`. |
| Compare QFAT-023 final to current task baseline | PASS | `7ed230dd9860e755b68a3e4715c29220bf0bc746...main`: 6 ahead, 0 behind. |
| Fetch required docs and task | PASS | Full task and required active docs fetched from synchronized `main`; PRD, architecture, QFAT-023 documents, README/CLAUDE and ADR-002 also read. |
| Read-only source/test inspection | PASS | Current Spoolcast token/auth/config/CLI/adapter/manifest/state, root/server package+TS configs and lockfiles, QFAT server/security/media, Vite/browser client, upload/security/media tests inspected. No live code executed. |
| Remote changed-path inventory | PASS | Final compare lists only `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`, `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md`, and this report. |
| Markdown links and cross-document consistency | PASS WITH FINDINGS | Reviewed links and consistency against PRD, architecture, scope control, and ADR-002. Owner decisions are recorded as an addendum; PRD/architecture do not conflict with the new boundary. No automatic local Markdown linter was available. |
| `git diff --check` | NOT RUN | No local checkout/shell available through repository connector. |
| `git status --short`, staged-path list, full local diff | NOT RUN | No local working tree available. Remote commit diffs and final compare used to inspect the published path set. |
| Typecheck/build/application tests | NOT RUN | Documentation-only task; no code changed and QFAT-024 says these are not required. |
| Live OAuth/provider API/upload tests | NOT RUN | Explicitly prohibited. |
| GitHub Actions / hosted CI | NOT RUN | Explicitly prohibited by repository workflow. |

## Findings and Limitations

1. **Runtime integration remains blocked.** Existing token resolver and adapters can be reused conceptually in-process, but the current production package/build contract and Spoolcast-home configuration are insufficient to support a production server import safely.
2. **Owner-only publishing security is unresolved.** The single-owner product decision is settled; enforceable authorization for trusted LAN/Tailscale devices is not established by current Origin/Host/session/CSRF behavior.
3. **Media handoff remains a capability/compatibility gap.** UUID storage paths lack Spoolcast-recognized extensions, MIME inference differs for QuickTime, and images/WebM are outside verified Spoolcast support.
4. **Immediate-mode manifest behavior, progress transport/request lifetime, cancellation uncertainty, duplicate submission, and Scheduled vs Published persistence remain open.**
5. **No invocation topology was selected.** In-process is only the preferred technical investigation direction; current `spoolcast run` is not an item-scoped one-shot service interface.
6. **Local Git verification is unavailable.** `git diff --check`, `git status --short`, and local full diff/staged-path review are honestly NOT RUN. Remote GitHub compare/commit diffs were used instead.

No source, test, package, dependency, configuration, database/schema, credential, media, OAuth, route, endpoint, process, queue, scheduler, job engine, UI, or runtime behavior was changed. No live provider operation or follow-on task was started.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 77065717d668c5efb7891de3d93c4e8ecfeff08e
- Follow-up fix commit: 5b6e23449dc304fd1eab7ac51c7004c22e8a8deb
- Report update commit: 8279aeb59a9d2898d967b502510adcccbba4ed05
- Push verification: PASS

The report-creation commit above was re-fetched from remote `main`. The final remote compare from the synchronized task HEAD confirms only the two authorized documentation paths and this report changed. The report and design files are present and readable on GitHub. This verifies source publication only, not CI.

Additional documentation commit sequence:
- Scope-control Owner decision: `d6a091f1508c926397e76eabbe1c77e158733abf`
- Scope heading correction: `510e63b3d0bd13dbe7e06f374cef4555c4a8b972`
- Invocation design refinement: `77065717d668c5efb7891de3d93c4e8ecfeff08e`
- Design consistency follow-up: `5b6e23449dc304fd1eab7ac51c7004c22e8a8deb`

## Handoff

Documentation work is ready for GPT/Owner audit. D-024-01 and D-024-02 are recorded as Owner-decided. Owner-only publishing access and the remaining technical blockers stay open. Runtime integration is not authorized or ready; no follow-on task was created.
