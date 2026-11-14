# QFAT Scope and Change Control

- Status: Active owner-directed product control
- Last updated: 2026-11-13

## Product identity and boundary
QFAT is the frontend/UI for the existing Spoolcast application. Spoolcast remains the application and publishing core: OAuth/provider integrations, publishing protocols, CLI/domain behavior, queue/manifest/state semantics, and scheduling. QFAT owns presentation, interaction, input collection/validation, and truthful result display.

A local browser-to-Node bridge/launcher/API is conditional and may be added only when source inspection proves it is the smallest necessary mechanism to invoke existing Spoolcast operations safely. It must not become a parallel backend or own a replacement engine, provider protocols, OAuth/account/token system, scheduler, queue/job orchestration, independent publishing ledger, generic adapter framework, or unrelated persistence/media/credential subsystem.


## Owner decisions — operating model and provider credentials — 2026-11-14

### D-024-01 — Single-owner MVP <badge-placeholder/>

The QFAT MVP is operated by one owner. Do not introduce multi-user registration, roles, per-user permissions, teams, or user/account ownership abstractions. The owner may use trusted LAN/Tailscale devices as browser clients; that operating intent does not establish that the current application authenticates the owner or enforces a trusted-device allowlist.

The current browser Origin/Host checks, bootstrap session, and CSRF synchronizer token are request-context protections, not human authentication or proof of owner identity. The Vite frontend listens on `0.0.0.0:5173`, accepts private IPv4 and Tailscale CGNAT origins, and the bootstrap route creates a session after Origin/Host validation without an owner login or device authorization step. A future publishing boundary must not be exposed on this basis alone.

**OPEN OWNER DECISION:** the minimum enforceable owner-only access control for publishing over LAN/Tailscale remains undefined. The Owner must decide and approve how trusted devices/network are identified and enforced (for example, whether an externally managed network allowlist is sufficient or whether an application-level owner proof is required). Do not invent a login, pairing flow, device registry, or firewall/Tailscale configuration in this documentation task.

### D-024-02 — Spoolcast is the sole provider OAuth/account/token authority

The Owner has decided that all provider OAuth authorization, provider account selection/aliases, refresh/page tokens, and app-level provider credentials remain managed by the existing Spoolcast application.

- Spoolcast `src/auth-youtube.ts` and `src/auth-facebook.ts` remain the authorization flows; Spoolcast `src/tokens.ts` remains the token-store and account-resolution authority.
- The authoritative store remains `SPOOLCAST_HOME/.secrets/tokens.json`; Google OAuth client credentials remain in `google-client.json`, and Facebook app credentials remain in `fb-app.json` or the existing environment variables.
- Reuse existing Spoolcast account resolution where a separately approved integration can technically consume it. Do not create a QFAT OAuth flow, QFAT provider-account source of truth, alias registry, token copy, migration, synchronization, or dual-write.
- QFAT's `CredentialProvider` and encrypted SQLite credential records are **not** the source of truth and must not be used to store Spoolcast provider tokens under this decision.
- Provider tokens, client secrets, and credential payloads must remain inside the trusted local Node/Spoolcast execution boundary. They must not enter browser state, HTTP responses, URLs, process arguments, logs, progress events, or user-visible error strings.

This decision settles credential ownership; it does not prove that QFAT can currently locate or access the Spoolcast home directory. `src/config.ts` computes its `PATHS` once at module initialization from `SPOOLCAST_HOME` or `process.cwd()`. A future in-process integration must establish the correct Spoolcast home before importing/using those modules, without changing token ownership. The current QFAT server has no configured Spoolcast-home contract. **OPEN OWNER DECISION:** deployment/configuration ownership and OS-level access to the existing Spoolcast home remain to be specified before runtime work.


## In scope
- Frontend screens and interactions presenting verified, owner-approved Spoolcast capabilities.
- Input collection, client-side validation/presentation, accessibility, and truthful status display.
- Minimal invocation boundary when demonstrably necessary and separately authorized.
- Small safe adaptations to existing Spoolcast entry points.
- Documentation/local verification authorized by a task.

## Out of scope
- Replacement/parallel publishing backend or engine.
- Parallel OAuth, account, credential, or token ownership.
- New QFAT scheduler, queue, job orchestrator, independent publishing ledger.
- Provider protocol reimplementation or generic adapter/plugin framework.
- New database, media platform, credential subsystem, runtime service, daemon, desktop shell, framework, or package restructuring by default.
- Hosted SaaS, teams, Rust rewrite, Tauri/Electron, unrelated infrastructure, platform expansion.
- Source/runtime changes under documentation-only tasks.

## ## Approved MVP publishing UX boundary — 2026-11-14

The Owner has approved QFAT frontend presentation of **Publish Now** and **Schedule**.

- Publish Now uses the existing Spoolcast adapter's immediate mode when a separately approved integration invokes it.
- Schedule submits a future publication request to each selected provider. After provider acceptance, the provider performs publication; QFAT/Spoolcast does not need a local timer or process running at publish time.
- MVP Schedule uses one shared date/time and one explicit timezone for the entire selected platform/account target set. Normalize once to one instant and serialize that instant per provider.
- Each target is attempted and reported independently. A failure for one target must not prevent remaining targets from being attempted. Existing Spoolcast CLI is sequential; no concurrency/simultaneity promise.
- Future different times per platform/account are a later enhancement, not MVP scope.
- Report provider acceptance separately from eventual public visibility. A successful scheduled request is **Scheduled**, not **Published/Live**.

This is approval of product UX only. It does not authorize implementation, a local scheduler/daemon/cron integration, a new queue/job orchestrator, bridge/API/process topology, OAuth/account ownership or mapping, credential changes, persistence/status schema, retry/cancellation orchestration, or new provider capabilities. Existing source caveats (including required manifest publishAt and Facebook schedule-window validation for immediate flows) remain unresolved; see the focused design note.

### Conditional — requires evidence and owner approval
Local bridge/launcher/process lifecycle; reuse/adaptation of QFAT server, SQLite, media, browser security, or credential code; UI exposure of queue/accounts/progress/history beyond the approved publishing-mode/shared-time/per-target-result contract; new Spoolcast capability; dependencies, runtime services, persistence/credential ownership, framework/package boundaries, or platforms. Conditional is not authorized merely because code/task/roadmap exists.

## Document authority and conflict resolution
1. Explicit current Owner decisions recorded in repository documentation.
2. This scope-control document for product boundary and approval gates.
3. Current owner-approved PRD and architecture, consistent with this boundary.
4. Accepted ADRs/approved addenda for their specific decisions.
5. Current task specification, limited to its stated scope and unable to silently change product identity.
6. Source as evidence of actual behavior/capability.
7. Historical tasks, reports, commits, upstream docs, and chat summaries as context only.

When documents conflict, do not choose the scope-expanding interpretation. Follow higher authority, record the conflict, and stop for owner clarification if material. Source proves what exists; it does not grant product authorization.

## Owner approval gates
Explicit owner approval and a new bounded task are required before changing product identity/responsibility; adding provider/platform capabilities; adding dependencies/frameworks/package boundaries; adding runtime services/daemons/launchers/process supervisors; creating persistence, queue, scheduler, job orchestration, publishing ledger, or source-of-truth ownership; changing credential/OAuth/account/token ownership; exposing scheduling in a new UI workflow; or deleting/migrating/retiring subsystems/data.

## Required task specification
Every task must state goal/user outcome; repository/target branch; exact allowed paths; forbidden paths/work; source-of-truth docs and verified baseline; observable acceptance criteria; local verification evidence/commands; security/data/network/API/credential permissions including live-call policy; explicit Not in Scope; dependencies and OPEN OWNER DECISION items; stop rule and report/handoff path. Documentation-only tasks must forbid source/runtime/dependency/schema/configuration changes.

## Mandatory stop-and-ask
If a required capability is missing, unclear, unsafe, or requires a new backend subsystem/ownership boundary: stop before implementation; record exact gap/evidence; explain why Spoolcast cannot satisfy it; mark OPEN OWNER DECISION; ask GPT/Owner for a separate decision and bounded task. Do not invent workarounds, infer permission from prior tasks, or broaden scope.

## Historical authorization
Historical tasks/reports/commits/code are evidence of work under earlier direction, not automatic authorization for future work. Do not delete or rewrite historical evidence. Add concise supersession/hold notes only where an old task could be mistaken for current authorization.

## Documentation-only integrity
A documentation-only task may inspect source read-only and edit only authorized documents. It must not modify source, tests, package manifests/lockfiles, dependencies, schema/migrations, credentials, media, build configuration, or runtime behavior.
