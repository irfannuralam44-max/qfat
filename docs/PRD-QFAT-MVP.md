# QFAT MVP — Product Requirements Document

- Document ID: QFAT-PRD-001
- Status: OWNER-DIRECTED PRODUCT SCOPE — FRONTEND FOR SPOOLCAST
- Last updated: 2026-11-13
- Supersedes earlier wording that framed QFAT as a standalone publishing app with its own backend. Historical tasks/reports remain evidence, not authorization.

## 1. Product identity
**QFAT is the user-facing frontend for the existing Spoolcast application. Spoolcast remains the application and publishing core.** QFAT provides a browser UI for preparing inputs, presenting supported choices, and invoking existing Spoolcast operations. It must not become a parallel publishing product or replacement backend.

The browser cannot execute Node.js Spoolcast or safely access local provider credentials. A small local integration boundary may be necessary; it is an enabling bridge only, not a new product backend. Its runtime shape remains undecided until source inspection proves the minimum mechanism.

## 2. Responsibility boundary
### Spoolcast core (verified)
- YouTube OAuth and Google API upload integration.
- Facebook authorization/token exchange and Page upload integrations.
- Facebook long-form video and separate Facebook Reels protocols.
- Existing CLI/domain behavior, queue/manifest discovery, and per-target upload state ledger.
- Existing scheduling semantics: YouTube scheduled uploads use RFC 3339 UTC; Facebook video/Reels use Unix-second schedule values and provider-specific validation.
- Provider request/protocol behavior.

QFAT-015 adapted existing YouTube, Facebook video, and Reels upload functions for caller-supplied inputs, immediate-publish invocation, progress callbacks, structured results, and bounded-memory Reels streaming. This adapts Spoolcast; it does not create another engine.

### QFAT frontend
Navigation, presentation, interaction, accessibility, responsive UI, user input, client-side validation, honest limitation display, collecting user intent, invoking supported Spoolcast operations through an approved local boundary, and displaying truthful returned progress/results. The frontend must not implement provider protocols, store provider secrets, or create publishing rules.

### Minimum integration boundary
A local bridge/launcher/API is permitted only where needed for browser-to-Node invocation and credential isolation. If needed, it may validate boundary input, invoke an existing Spoolcast entry point, relay measured progress/results, and apply necessary process/security controls. It must not own a second engine, provider protocol, OAuth/account/token system, scheduler, queue/job orchestration, independent publishing ledger, or unrelated persistence/media subsystem. Do not select process/API/framework design without source evidence and owner approval.

## 3. Product goal
Make existing Spoolcast capabilities understandable and operable without requiring users to learn internal CLI details. UI screens must map to actual supported operations, not assumed backend features. Build a flow only when its required Spoolcast operation and safe invocation path are verified.

## 4. Capability coverage and gaps

| UI capability | Existing Spoolcast evidence | QFAT treatment |
|---|---|---|
| YouTube OAuth/account authorization | src/auth-youtube.ts, src/tokens.ts | Reuse through approved boundary; no second OAuth/token owner |
| Facebook authorization/Page selection | src/auth-facebook.ts, src/tokens.ts | Reuse through approved boundary; no duplicate token ownership |
| YouTube video/Shorts upload | src/upload-youtube.ts; QFAT-015 adaptation | Reuse existing path; UI exposure needs task scope |
| Facebook long-form video | src/upload-facebook.ts; QFAT-015 adaptation | Reuse existing path |
| Facebook Reels | src/upload-facebook-reel.ts; QFAT-015 adaptation | Reuse existing protocol; bounded-memory adaptation exists |
| Scheduling | Existing manifest, CLI, provider upload semantics | Capability exists. QFAT UI exposure/constraints are OPEN OWNER DECISION |
| Queue, manifests, per-target ledger | src/run.ts, src/manifest.ts, src/state.ts | Spoolcast-owned; QFAT presentation is OPEN OWNER DECISION |
| Facebook single-image publishing | Not found in inspected Spoolcast source/QFAT-015 boundary | CAPABILITY GAP / OPEN OWNER DECISION; UI selection is not publishing support |
| Facebook albums | Not found; earlier UI task excluded them | Not in current scope; future approval required |
| QFAT media library/intake | Existing apps/server/src/media and web UI | Existing work; reuse only if needed and approved |
| Independent QFAT jobs/history/SSE | Not found in Spoolcast; current server registers health/security/media routes | Not authorized as parallel subsystem; OPEN OWNER DECISION if required |
| QFAT SQLite/account/credential subsystems | Existing implementation | Not automatically mandatory; disposition needs evidence/owner decision |

Code or an old task does not itself make a capability accepted for UI exposure.

## 5. Existing work disposition
- **Keep:** Spoolcast provider protocols, OAuth behavior, CLI/domain behavior and attribution; existing QFAT frontend foundation/components.
- **Adapt:** QFAT screens and only the smallest invocation boundary proven necessary.
- **Conditional/undecided:** media intake/library, browser security bridge, QFAT server framework, SQLite records, credential provider, upload callable boundary, progress display.
- **Not part of frontend MVP by default:** independent publishing engine, account/token ownership, job scheduler/orchestrator, independent publishing ledger, broad backend architecture, generic adapter framework, album publishing.

## 6. Explicit non-goals
Replacement/parallel publishing backend; parallel OAuth/account/credential/token ownership; new QFAT queue/scheduler/job orchestration/independent ledger; generic adapter/plugin framework; backend/database/credential/media subsystem not strictly required for an approved bridge; provider protocol reimplementation; broad package restructuring; desktop shell, Tauri/Electron, Rust rewrite, hosted SaaS, unrelated infrastructure, platform expansion; Facebook albums unless later approved.

## 7. Inherited publishing behavior and owner decisions
Spoolcast supports scheduled publishing. Earlier QFAT drafts requiring immediate-only publishing are superseded as product direction. QFAT must not remove, rewrite, or assume away Spoolcast scheduling. Whether QFAT UI exposes scheduling, which controls/constraints it presents, and whether UI limits invocation to immediate publishing are OPEN OWNER DECISIONS.

Spoolcast supports multiple YouTube channels and Facebook Pages; do not impose arbitrary caps. Preserve distinctions between YouTube uploads, Facebook long-form video, and Facebook Reels. Facebook single-image publishing is not a verified Spoolcast capability.

## 8. Security and operations
Browser code must not receive provider secrets or call provider APIs. Use the minimum local bridge necessary; do not expose it to LAN/public networks without approved security design. No live authorization/publishing without explicit approval. Verification is local-only; no hosted CI. Linux is active credential-storage workstream; Windows deferred. Preserve MIT attribution. Figma cancelled.

## 9. Change gates
Changes to product identity, responsibility boundary, provider/platform capability, scheduling exposure, credential/persistence ownership, backend runtime, dependencies, or architecture require explicit owner decision and new bounded task. If a capability is absent or uncertain, stop and record OPEN OWNER DECISION. Do not invent a substitute.
