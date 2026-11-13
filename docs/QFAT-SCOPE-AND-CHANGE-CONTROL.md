# QFAT Scope and Change Control

- Status: Active owner-directed product control
- Last updated: 2026-11-13

## Product identity and boundary
QFAT is the frontend/UI for the existing Spoolcast application. Spoolcast remains the application and publishing core: OAuth/provider integrations, publishing protocols, CLI/domain behavior, queue/manifest/state semantics, and scheduling. QFAT owns presentation, interaction, input collection/validation, and truthful result display.

A local browser-to-Node bridge/launcher/API is conditional and may be added only when source inspection proves it is the smallest necessary mechanism to invoke existing Spoolcast operations safely. It must not become a parallel backend or own a replacement engine, provider protocols, OAuth/account/token system, scheduler, queue/job orchestration, independent publishing ledger, generic adapter framework, or unrelated persistence/media/credential subsystem.

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
