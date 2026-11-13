# ADR-006: QFAT Is the Frontend for Spoolcast

- Status: Accepted — corrected owner direction
- Decision date: 2026-11-13
- Decision owner: Project owner
- Scope: QFAT product identity and frontend integration boundary
- Supersedes: Earlier ADR-006 framing of Spoolcast as merely a platform engine beneath a separate QFAT publishing application.

## Context
The repository contains imported Spoolcast Node.js/TypeScript application and CLI code in src/, alongside QFAT frontend/server work in apps/web/ and apps/server/. Earlier QFAT documents described a standalone local-first publishing application with its own account, credential, media, job, scheduler, persistence, and backend responsibilities.

The Owner clarified on 2026-11-13 that QFAT is to provide the frontend for Spoolcast. Spoolcast remains the existing application and publishing core; QFAT must not become a parallel publishing product or replacement backend. Historical implementation work/reports remain evidence, but their existence does not make every previously proposed subsystem part of the corrected product.

## Decision
1. QFAT is the user-facing browser frontend for Spoolcast.
2. Spoolcast retains existing OAuth/provider integrations, upload protocols, CLI/domain behavior, queue/manifest/state semantics, and scheduling behavior.
3. QFAT owns presentation, user interaction, input collection/validation, and display of truthful outcomes.
4. A small local bridge/launcher/API may be used only where source inspection proves it necessary for browser-to-Node invocation and safe credential isolation. This ADR does not select its process/runtime design.
5. Prefer existing Spoolcast entry points/modules and the smallest safe adaptation. No replacement engine, parallel OAuth/token owner, scheduler, queue, publishing ledger, or generic adapter framework.
6. Existing QFAT server, SQLite, media library, credential provider, and upload boundary are not automatically mandatory. Retain code; classify each as keep/adapt/defer/open decision based on evidence. This ADR does not authorize deletion/refactoring.
7. If a required UI flow needs a capability Spoolcast lacks, stop and record OPEN OWNER DECISION. Do not implement a substitute backend.
8. On 2026-11-14 the Owner approved QFAT MVP Publish Now and Schedule UX: one shared date/time/timezone for all selected targets, independent per-target outcomes, and provider-side scheduled publication. Future per-target times are later direction only. This UX approval does not authorize a local scheduler, bridge, runtime implementation, or new persistence/status schema.
9. Preserve existing YouTube and Facebook video/Reels integrations. Facebook single-image publishing is not verified in Spoolcast and needs a separate owner decision/task.
10. Preserve MIT attribution. Verification is local-only; no hosted CI. Linux credential work remains active; Windows held. Figma cancelled.

## Historical context and supersession
The earlier ADR treated Spoolcast as a reusable upload engine inside a distinct QFAT local-first publishing application. It endorsed QFAT-owned server responsibilities for account operations, media, jobs, persistence, progress, and credentials, and listed immediate-only publishing as product rule.

That was the direction in force when earlier tasks were authored. This corrected decision does not erase history, invalidate commits, or claim the work was wasted. It supersedes earlier statements as current product authority wherever they conflict with the frontend-for-Spoolcast boundary.

## Consequences
- PRD and architecture define QFAT as frontend and Spoolcast as core.
- Agent instructions require stop-and-ask for missing core capabilities or new backend subsystems.
- Existing QFAT code is audited for relevance before further use; it is not automatically expanded or deleted.
- The Publish Now + shared-time Schedule UX is settled. Local bridge/process lifecycle, immediate manifest validation path, OAuth/account mapping, media handoff, progress/result transport, durable status/history semantics, cancellation/retry behavior, and image publishing remain unresolved where not separately established.
- New implementation requires a bounded task with exact allowed paths, forbidden work, acceptance evidence, and stop rule, plus explicit owner authorization.
