# QFAT MVP — Spoolcast Frontend Architecture

- Document ID: QFAT-ARCH-001
- Status: OWNER-DIRECTED RESPONSIBILITY MODEL — INTEGRATION IMPLEMENTATION NOT AUTHORIZED
- Last updated: 2026-11-14
- Product requirements: [PRD-QFAT-MVP](./PRD-QFAT-MVP.md)
- Scope control: [QFAT Scope and Change Control](./QFAT-SCOPE-AND-CHANGE-CONTROL.md)
- Publishing flow: [QFAT Publishing and Scheduling Flow](./design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md)
- Upstream baseline: [Spoolcast](../UPSTREAM.md)

## 1. Settled direction

**Spoolcast is the core application and publishing authority. QFAT is the browser frontend.** Reuse existing Spoolcast OAuth/provider integrations, upload protocols, CLI/domain behavior, queue/manifest/state semantics, and provider-side scheduling. Do not create a parallel QFAT publishing backend.

The Owner approved two frontend publishing modes: Publish Now and Schedule. MVP Schedule uses one shared date/time and timezone for every selected target. Each target has an independent execution outcome. Future per-platform/per-account timestamps are a later enhancement only.

A browser cannot execute Node.js Spoolcast or safely access local provider credentials. A local bridge/launcher/API may be necessary, but only the minimum boundary demonstrated by source inspection is permitted and it requires separate authorization. This document does not select a process model, framework, endpoint design, persistence model, or launcher.

## 2. Responsibility matrix

| Component | Responsibility | Must not own |
|---|---|---|
| Spoolcast core (`src/`) | Existing OAuth/provider integrations, upload protocols, CLI/domain behavior, manifest/queue/state semantics, provider-side scheduled request | QFAT UI |
| Provider | Performs future publication after accepting scheduled request | QFAT local scheduler |
| QFAT frontend (`apps/web/`) | Mode choice, one shared time/timezone in MVP, target selection intent, presentation, target-specific progress/outcome display | Provider protocols, secrets, publishing rules, scheduler/job engine |
| Local bridge (conditional) | If separately approved, safely invoke existing Spoolcast entry points; validate boundary input; relay measured progress/results/errors | OAuth/token ownership, scheduler, queue, independent ledger, replacement engine |
| Existing QFAT server (`apps/server/`) | Current health/security/media bridge; possible host for a minimal invocation boundary only if justified and approved | Assumed full publishing backend |
| Existing QFAT persistence | Existing records retained as implementation history; new use only for proven need and owner approval | Parallel publishing source of truth |

## 3. Approved logical publishing flow (product contract, not implementation)

1. User prepares one content item and selects one or more supported platform/account targets.
2. User chooses **Publish Now** or **Schedule**.
3. For Schedule, user enters one date/time and one explicit timezone for the entire selected target set. Normalize it once to one unambiguous instant. Do not create one timestamp per target in MVP.
4. The approved logical request is applied to each selected target. Provider-specific formatting is derived from the same instant: YouTube RFC 3339 UTC; Facebook Unix seconds.
5. Each target is attempted independently. One target's failure must not stop attempts for other targets. Existing Spoolcast CLI behavior is sequential, not concurrent; no simultaneity guarantee is made.
6. For each target, report its own progress and actual result. A successful Publish Now response means the upload/provider operation succeeded to the extent confirmed by that response. A successful Schedule response means the provider accepted a future scheduled post.
7. The provider performs future publication at the accepted time. No local QFAT/Spoolcast timer needs to wake up; no QFAT scheduler/daemon is implied.

This is a product contract for future integration. It does not define a transport, API, route, process lifecycle, queue, job engine, persistence mechanism, cancellation/retry protocol, or implementation sequence.

## 4. Publish modes and timing semantics

### Publish Now
Use the existing Spoolcast adapter's explicit immediate option for each target. The current adapter mode maps to provider-specific immediate request fields:
- YouTube: `privacyStatus: public`; omit `publishAt`.
- Facebook Page video: `published=true`; omit `scheduled_publish_time`.
- Facebook Reels: `video_state=PUBLISHED`; omit `scheduled_publish_time`.

This is adapter capability only. The current CLI orchestrator does not pass `immediate: true`, and the current manifest resolver has validation dependencies that make immediate invocation unsafe to assume.

### Schedule
Use existing Spoolcast scheduled adapter behavior:
- YouTube: private upload with `publishAt` in RFC 3339 UTC.
- Facebook Page video: `published=false` with `scheduled_publish_time` in Unix seconds.
- Facebook Reels: `video_state=SCHEDULED` with `scheduled_publish_time` in Unix seconds.

These are provider-side scheduled publication requests. The provider owns the eventual publication after accepting the scheduled request. Spoolcast itself is a manually invoked, one-shot CLI with no internal scheduler/daemon; QFAT must not add one under this product decision.

### Shared timestamp and target isolation
One user-selected timezone-aware local date/time is normalized exactly once to an instant. All selected targets receive that same intended instant, converted only for provider-specific serialization. Do not use per-target `publishAt` overrides to create different MVP times.

Target execution is independent but existing `src/run.ts` processes targets sequentially. A target failure is caught and persisted before the loop continues. The frontend must show per-target outcomes; an item-level aggregate, if later designed, cannot hide the individual results. No parallel execution or exact simultaneity is promised.

## 5. Truthful status and state boundary

- **Uploading / In progress:** only while measured upload activity is actually in progress.
- **Accepted / Upload succeeded:** the provider request completed successfully according to the adapter's response.
- **Scheduled:** provider accepted the future publication request. Do not label it Published or Live.
- **Failed:** the target attempt returned an error.
- **Public / Live:** only show if a provider response or later verified provider state actually confirms public visibility.

A provider acceptance response does not prove final public visibility. Processing, moderation, and distribution may happen later.

Current `src/state.ts` supports only `posted` and `failed`. A scheduled provider submission is recorded as `posted` when the API call resolves. This task does not authorize schema/status changes or a reinterpretation of historical ledger entries. Durable scheduled-vs-immediate status and item-level aggregate semantics remain a design concern.

## 6. Verified repository topology

- `src/` contains Spoolcast CLI, OAuth, token-store, manifest, queue orchestration/state, YouTube upload, Facebook video, and Facebook Reels modules.
- QFAT-015 adapted existing YouTube, Facebook video and Reels upload functions for explicit caller inputs, immediate-publish invocation, progress callbacks, structured results, and bounded-memory Reels streaming.
- `apps/web/` contains React/Vite frontend, Overview, Create Content, platform editors, media selector, and Media Library. Create Content currently remains preparation/editor UI; publishing is disabled/coming soon.
- `apps/server/src/index.ts` registers health, browser-security, and media routes; it does not invoke Spoolcast OAuth/upload operations or publishing-job orchestration.
- Accounts, Queue, and History navigation remain disabled.
- Existing QFAT SQLite, media library, key-file credential provider, and browser-security code do not prove that every subsystem belongs in the target product.

These are source observations, not authorization to expand or delete code.

## 7. Source caveats and integration gaps

| Source | Verified current behavior | QFAT implication |
|---|---|---|
| `src/manifest.ts` | Raw metadata requires `publishAt`; `readManifest` always parses it and derives UTC/Unix values. For Facebook targets it enforces at least 10 minutes and no more than 6 months in the future. | Immediate flow still encounters required publishAt parsing; Facebook target resolution still encounters future schedule-window checks even when adapter immediate mode would omit schedule fields. **OPEN OWNER DECISION / design gap:** safe immediate-mode manifest validation path. No fix selected here. |
| `src/upload-youtube.ts` | `immediate: true` sends public privacy and omits `publishAt`; default sends private plus UTC publishAt. | Adapter supports both modes, but caller must deliberately choose mode. |
| `src/upload-facebook.ts` | `immediate: true` sends `published=true`; default sends `published=false` and Unix `scheduled_publish_time`. | Existing adapter supports immediate and provider-side scheduling for Page video. |
| `src/upload-facebook-reel.ts` | `immediate: true` sends `video_state=PUBLISHED`; default sends `SCHEDULED` and Unix `scheduled_publish_time`. | Existing adapter supports immediate and provider-side scheduling for Reels. |
| `src/run.ts` | One-shot sequential target loop. Calls upload adapters without `immediate: true`; catches target errors, records failure, and continues to later targets. | Existing CLI remains scheduled by default and isolates failures sequentially. It is not the QFAT publishing invocation. |
| `src/state.ts` | Per-item/per-raw-target ledger, statuses only `posted` and `failed`. | Scheduled provider acceptance is currently stored as `posted`; do not equate this with public live. New status model needs separate design. |
| `README.md`, Spoolcast section of `CLAUDE.md` | Manual one-shot CLI; no built-in daemon/scheduler; unattended invocation can be externally orchestrated (cron/launchd). | This is external invocation of the CLI, not provider-side scheduled publication. QFAT MVP must not add local scheduling infrastructure. |
| QFAT-015 report | Immediate callable adapter options and scheduled defaults verified for YouTube, Facebook Page video, and Facebook Reels; no HTTP routes/OAuth/UI. | Reuse capability; no end-to-end QFAT publishing flow exists. |
| `apps/server/src/index.ts` | Health, security, and media route registration only. | No existing QFAT publishing route or bridge. |
| `apps/web/src/pages/CreateContentPage.tsx` | Publish button disabled; account/destination selection and publishing actions described as future. | UI is preparation-only; this task does not implement it. |
| `apps/web/src/App.tsx` | Accounts, Queue, History nav entries disabled. | Account/result/history screens are not implemented. |

### Specific unresolved integration decisions

1. **Immediate manifest validation:** `publishAt` is required and parsed before adapter invocation; Facebook schedule-window validation is target-based, not mode-aware. Existing code therefore does not yet provide a verified immediate-flow path through the full manifest resolver.
2. **Invocation boundary/process lifecycle:** server does not currently invoke Spoolcast; smallest safe local browser-to-Node mechanism remains undecided.
3. **OAuth/account mapping:** QFAT encrypted credential records and Spoolcast's explicit account inputs have no verified approved mapping/owner.
4. **Progress/result transport:** adapters expose progress callbacks and structured results, but no QFAT route/UI relays them.
5. **Durable status semantics:** current ledger does not distinguish scheduled acceptance from immediate upload acceptance or eventual public visibility.
6. **Media/target scope:** existing QFAT editor/media selection does not establish end-to-end media handoff or provider publishing for every visible media intent.
7. **Facebook single image/albums:** no verified Spoolcast adapter capability; exclude unless separately decided and supported.

Each item is an **OPEN OWNER DECISION** or source-proven integration gap. Stop before designing or implementing a workaround. A separate owner-approved task must define any required follow-up.

## 8. Decisions intentionally not made

This architecture does not select a bridge, HTTP route, IPC/launcher, process supervisor, queue, scheduler, daemon, job engine, concurrency model, retry/cancellation mechanism, OAuth/account owner, new credential mapping, persistence schema, or status ledger. The shared-time MVP contract does not authorize per-target times in the first release. These decisions require source-grounded design and explicit owner approval where they change runtime or ownership boundaries.

## 9. Change control

New backend services, persistence/credential owners, schedulers, queues, job orchestrators, dependencies, frameworks, package boundaries, provider integrations, or runtime topology require explicit owner approval. The approved Publish Now + Schedule UX is a bounded product decision only. If a required Spoolcast capability is missing, stop and document the gap; do not build a workaround backend. Historical tasks/reports are evidence, not current authorization.
