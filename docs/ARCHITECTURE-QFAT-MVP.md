# QFAT MVP — Spoolcast Frontend Architecture

- Document ID: QFAT-ARCH-001
- Status: OWNER-DIRECTED RESPONSIBILITY MODEL — IMPLEMENTATION SHAPE NOT PRESELECTED
- Last updated: 2026-11-13
- Product requirements: [PRD-QFAT-MVP](./PRD-QFAT-MVP.md)
- Scope control: [QFAT Scope and Change Control](./QFAT-SCOPE-AND-CHANGE-CONTROL.md)
- Upstream baseline: [Spoolcast](../UPSTREAM.md)

## 1. Settled direction
**Spoolcast is the core application and publishing authority. QFAT is the browser frontend.** Reuse existing Spoolcast OAuth/provider integrations, upload protocols, CLI/domain behavior, queue/manifest/state semantics, and scheduling behavior. Do not create a parallel QFAT publishing backend.

A browser cannot execute Node.js Spoolcast or safely access local provider credentials. A local bridge/launcher/API may be necessary, but only the minimum boundary demonstrated by source inspection is permitted. This document does not select an unverified process model, framework, endpoint design, persistence model, or launcher.

## 2. Responsibility matrix

| Component | Responsibility | Must not own |
|---|---|---|
| Spoolcast core (src/) | OAuth/provider integrations, publishing protocols, CLI/domain behavior, queue/manifest/schedule/state semantics | QFAT UI |
| QFAT frontend (apps/web/) | Screens, interaction, input/presentation validation, user intent, truthful result display | Provider protocols, secrets, publishing rules, independent job engine |
| Local bridge (conditional) | Safely invoke existing Spoolcast entry point; validate boundary input; relay actual progress/results/errors | OAuth/token ownership, scheduler, queue, publishing ledger, replacement engine |
| Existing QFAT server (apps/server/) | Current health/security/media bridge; possible host for minimal invocation boundary if justified | Assumed full product backend |
| Existing QFAT persistence | Existing records retained as implementation history; new use only for proven need and owner approval | Parallel publishing source of truth |

## 3. Verified repository topology
- src/ contains Spoolcast CLI, OAuth, token-store, manifest, queue orchestration/state, YouTube upload, Facebook video, and Facebook Reels modules.
- QFAT-015 adapted existing YouTube, Facebook video and Reels upload functions for explicit caller inputs, immediate-publish invocation, progress callbacks, structured results, and bounded-memory Reels streaming.
- apps/web/ contains React/Vite frontend, Overview, Create Content, platform editors, media selector, and Media Library.
- apps/server/ initializes SQLite/migrations and registers health, browser-security, and media routes. Its inspected entry point does not register Spoolcast OAuth/upload operations or publishing-job orchestration.
- QFAT SQLite, media library, key-file credential provider, and browser-security code exist. Their presence does not prove every subsystem belongs in the target product.

These are observations, not authorization to expand or delete code.

## 4. Minimal logical interaction flow
1. User interacts with QFAT browser UI.
2. UI collects intent/input; it never reads credentials or calls provider APIs.
3. If browser-to-Node invocation is needed, UI sends a bounded request to an approved local bridge.
4. Bridge validates request and invokes an existing Spoolcast entry point/module.
5. Spoolcast performs its existing provider/domain operation and remains authoritative.
6. Bridge relays measured progress, structured outcomes, and sanitized errors.
7. UI renders those facts; it does not invent job state, progress, or outcomes.

This is a logical flow, not a committed transport/process design. Future work must prove each bridge responsibility and specify exact paths/tests.

## 5. Runtime/process relationship
A local mechanism is required if browser UI is to invoke Node.js Spoolcast. Whether it is an existing server extension, launcher/IPC process, or another minimal local boundary is OPEN OWNER DECISION until a source-grounded design compares viable options.

Do not assume a permanent second backend, full publishing server, child process, daemon, scheduler, worker pool, replacement queue, or SQLite publishing source of truth is required.

## 6. Existing QFAT subsystem disposition

| Subsystem | Classification | Evidence/constraint |
|---|---|---|
| Fastify server | Adapt conditionally | Currently health/security/media routes; extend only if smallest bridge is proven and authorized |
| SQLite/migrations | Keep existing records; new use undecided | Server initializes DB; Spoolcast owns queue/state semantics; no parallel publishing ledger |
| Media intake/library | Keep/adapt conditionally | Existing QFAT slice; reuse only if required for frontend-to-Spoolcast handoff |
| Key-file credential provider | Existing implementation; ownership decision needed | Spoolcast owns OAuth/token conventions; avoid competing credential authority |
| Linux Secret Service | Defer/blocked | No approved backend meets hard no-overwrite requirement; QFAT-020 retains key-file provider |
| Windows credential storage | Held/unauthorized | Platform sequencing gate |
| QFAT-015 upload boundary | Reuse existing callable adaptations | Existing Spoolcast upload functions adapted; no replacement engine |
| QFAT job/SSE orchestration | Defer / OPEN OWNER DECISION | Not found in current Spoolcast core/server registration |
| Facebook single-image publishing | Capability gap / OPEN OWNER DECISION | Not found in inspected Spoolcast upload modules |

## 7. Settled facts and OPEN OWNER DECISIONS
Settled: Spoolcast is core/publishing authority; QFAT is frontend; reuse provider protocols; browser never receives secrets or calls provider APIs; bridge must be minimal; preserve MIT attribution; local-only verification/no hosted CI; Linux-only active credential work; Windows held; Figma cancelled.

OPEN OWNER DECISIONS:
1. Which Spoolcast operations/user journeys should first QFAT release expose?
2. Should QFAT expose scheduling, and what controls/constraints?
3. What is the smallest acceptable local invocation boundary and process lifecycle?
4. Must QFAT retain its media library, or should selected files hand off to Spoolcast's existing input/queue model?
5. Which QFAT SQLite/media/credential records remain necessary?
6. How should account UI invoke existing Spoolcast OAuth flows without duplicating token ownership?
7. Is Facebook single-image publishing required despite the current Spoolcast capability gap?
8. Which progress/status/history views can be presented without a parallel job engine?

This document does not resolve these decisions.

## 8. Change control
New backend services, persistence/credential owners, schedulers, queues, job orchestrators, dependencies, frameworks, package boundaries, provider integrations, or runtime topology require explicit owner approval. If a required Spoolcast capability is missing, stop and document the gap; do not build a workaround backend. Historical tasks/reports are evidence, not current authorization.
