# QFAT MVP — Product Requirements Document

- Document ID: QFAT-PRD-001
- Status: OWNER-DIRECTED PRODUCT SCOPE — FRONTEND FOR SPOOLCAST
- Last updated: 2026-11-14
- Product identity: [QFAT Scope and Change Control](./QFAT-SCOPE-AND-CHANGE-CONTROL.md)

## 1. Product identity

**QFAT is the user-facing frontend for the existing Spoolcast application. Spoolcast remains the application and publishing core.** QFAT provides a browser UI for preparing inputs, presenting supported choices, and invoking existing Spoolcast operations through a separately approved local integration boundary. It must not become a parallel publishing product or replacement backend.

The browser cannot execute Node.js Spoolcast or safely access local provider credentials. A small local integration boundary may be necessary; it is an enabling bridge only, not a new product backend. Its runtime shape remains undecided until source inspection proves the minimum mechanism and the Owner separately authorizes implementation.

## 2. Responsibility boundary

### Spoolcast core (verified)
- YouTube OAuth and Google API upload integration.
- Facebook authorization/token exchange and Page upload integrations.
- Facebook long-form video and separate Facebook Reels protocols.
- Existing CLI/domain behavior, queue/manifest discovery, and per-target upload state ledger.
- Provider-side scheduled publication semantics: Spoolcast submits the upload/request; YouTube or Facebook performs the future publication after provider acceptance.
- Provider request/protocol behavior and provider-specific timestamp representation.

QFAT-015 adapted existing YouTube, Facebook video, and Reels upload functions for caller-supplied inputs, immediate-publish invocation, progress callbacks, structured results, and bounded-memory Reels streaming. This adapts Spoolcast; it does not create another engine or QFAT invocation route.

### QFAT frontend
Navigation, presentation, interaction, accessibility, responsive UI, user input, client-side validation, collecting publishing intent, selecting supported targets, and truthful display of target-specific progress/results. The frontend must not implement provider protocols, store provider secrets, or create its own publishing rules.

### Minimum integration boundary
A local bridge/launcher/API is permitted only where needed for browser-to-Node invocation and credential isolation, and only after a source-grounded design and separate approval. If authorized, it may validate boundary input, invoke existing Spoolcast entry points, relay measured progress/results, and apply necessary process/security controls.

It must not own a second engine, provider protocol, OAuth/account/token system, scheduler, queue/job orchestration, independent publishing ledger, or unrelated persistence/media subsystem. This PRD does not select a process, API, route, service framework, queue, scheduler, or new state owner.

## 3. Approved MVP publishing journey

The Owner has approved two publishing modes:

1. **Publish Now:** submit each selected target for immediate publication using the existing Spoolcast adapter's immediate mode.
2. **Schedule:** submit each selected target to its provider with a future publication timestamp. The provider performs the scheduled publication after accepting the request; QFAT does not wake up at that time to publish it.

For a content item, the user selects one or more supported platform/account targets. The MVP schedule editor exposes **one date/time and one explicit timezone for the entire selected target set**. Normalize that user-entered value once to one unambiguous instant, then serialize that same instant for each provider (YouTube RFC 3339 UTC; Facebook Unix seconds). Per-target manifest overrides must not result in different MVP target times.

The same user action applies to every selected target, but target execution and outcomes remain independent. A failure on one target must not cancel or prevent attempts to remaining targets. Show each target's actual outcome separately. Existing CLI behavior is sequential; neither this contract nor the UI promises concurrent, millisecond-simultaneous provider calls, equal processing duration, or identical public-visibility time.

A future enhancement may allow different times per platform/account target. That is explicitly **future direction only**, not MVP behavior or implementation authorization.

### Status language
- Publish Now: distinguish upload in progress, provider acceptance/upload success, and failure. Do not claim publicly live unless the provider response actually confirms that state.
- Schedule: after a successful provider response accepting the scheduled request, display **Scheduled** (or equivalent), not **Published/Live**.
- Provider acceptance is not the same as public visibility. Provider processing and distribution can occur later.
- A provider-accepted scheduled post is not a local pending job; the provider publishes it at the requested time without QFAT/Spoolcast remaining active.

## 4. Capability coverage and gaps

| UI capability | Existing Spoolcast evidence | QFAT treatment |
|---|---|---|
| YouTube OAuth/account authorization | `src/auth-youtube.ts`, `src/tokens.ts` | Reuse through approved boundary; account mapping/invocation remains unresolved |
| Facebook authorization/Page selection | `src/auth-facebook.ts`, `src/tokens.ts` | Reuse through approved boundary; no duplicate token ownership |
| YouTube video/Shorts upload | `src/upload-youtube.ts`; QFAT-015 adaptation | Existing adapter supports immediate and scheduled request modes; QFAT invocation not implemented |
| Facebook long-form video | `src/upload-facebook.ts`; QFAT-015 adaptation | Existing adapter supports immediate and scheduled request modes; QFAT invocation not implemented |
| Facebook Reels | `src/upload-facebook-reel.ts`; QFAT-015 adaptation | Existing adapter supports immediate and scheduled request modes; QFAT invocation not implemented |
| Shared-time scheduling UX | `src/manifest.ts`, provider adapters | Owner-approved MVP contract; one shared instant for all selected targets |
| Provider-side publication | Provider upload adapters | Provider is responsible after scheduled request acceptance; no local QFAT/Spoolcast timer |
| Independent per-target outcomes | `src/run.ts`, `src/state.ts` | Core CLI sequentially isolates target failures; frontend target-specific reporting/invocation remains unimplemented |
| Facebook single-image publishing | Not found in inspected Spoolcast publishing adapters/QFAT-015 report | **CAPABILITY GAP / OPEN OWNER DECISION**; exclude from publishing MVP |
| Facebook albums | Not found; earlier UI task excluded them | Not in current scope; future approval required |
| QFAT media library/intake | Existing `apps/server/src/media` and web UI | Existing work; reuse only if required and separately approved |
| QFAT OAuth/account mapping and bridge | Server routes currently health/security/media only | **OPEN OWNER DECISION**; not implemented or authorized by this task |
| Durable scheduled status/history | `src/state.ts` only has `posted` and `failed` | Semantics/presentation need future design; no schema change here |

Code or an old task does not itself make a capability accepted for UI exposure.

## 5. Existing work disposition

- **Keep:** Spoolcast provider protocols, OAuth behavior, CLI/domain behavior and attribution; existing QFAT frontend foundation/components.
- **Adapt conditionally:** QFAT screens and only the smallest invocation boundary proven necessary and separately approved.
- **Conditional/undecided:** media intake/library, browser security bridge, QFAT server framework, SQLite records, credential provider, upload invocation, progress transport, status/history presentation.
- **Not part of frontend MVP by default:** independent publishing engine, account/token ownership, local scheduler, job orchestrator, independent publishing ledger, broad backend architecture, generic adapter framework, Facebook image/album publishing.

## 6. Explicit non-goals

Replacement/parallel publishing backend; parallel OAuth/account/credential/token ownership; new QFAT scheduler/daemon/cron integration/queue/job orchestration/independent ledger; generic adapter/plugin framework; backend/database/credential/media subsystem not strictly required for an approved bridge; provider protocol reimplementation; broad package restructuring; desktop shell, Tauri/Electron, Rust rewrite, hosted SaaS, unrelated infrastructure, platform expansion; Facebook single-image or album publishing unless separately supported and approved.

## 7. Source-level caveats and retained owner decisions

The source caveats are recorded in the focused [Publishing and Scheduling Flow](./design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md). In particular, `readManifest` requires `publishAt` and applies Facebook's future schedule window validation whenever a Facebook target is resolved, including a potential immediate flow. The existing CLI does not pass QFAT-015's immediate option. The current ledger stores successful scheduled submissions as `posted`; do not change or silently reinterpret it.

The approved publishing/scheduling UX decisions above replace the previous open question about whether QFAT should expose scheduling. They do not resolve:
- the smallest local browser-to-Node invocation boundary and process lifecycle;
- OAuth/account mapping to explicit Spoolcast adapter inputs;
- media handoff and target selection integration;
- how progress is transported to the UI;
- durable scheduled-vs-immediate status/history representation;
- cancellation, editing/rescheduling accepted provider posts, or retry orchestration;
- whether Facebook single-image publishing is required despite the verified gap.

Spoolcast supports multiple YouTube channels and Facebook Pages; do not impose arbitrary caps.

## 8. Security and operations

Browser code must not receive provider secrets or call provider APIs. Use the minimum local bridge necessary; do not expose it to LAN/public networks without approved security design. No live authorization/publishing without explicit approval. Verification is local-only; no hosted CI. Linux is active credential-storage workstream; Windows deferred. Preserve MIT attribution. Figma cancelled.

## 9. Change gates

The Owner's approval of Publish Now + Schedule and the shared-time MVP UX is limited to this product contract. It does not authorize implementation, a local scheduler, new backend orchestration, bridge/process topology, OAuth/account ownership, a new persistence/state schema, or provider capability expansion. Those require separate bounded tasks and any required owner decisions. If a required Spoolcast capability is absent or an unresolved ownership/architecture decision is encountered, stop and record **OPEN OWNER DECISION**. Do not invent a substitute.
