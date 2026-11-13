# Agent Instructions — QFAT

# QFAT PRODUCT BOUNDARY — OWNER DIRECTION 2026-11-13

**QFAT is the frontend/UI for the existing Spoolcast application. Spoolcast remains the application and publishing core.** QFAT is not a parallel publishing product, publishing engine, or replacement backend.

- `src/` contains Spoolcast CLI/core, OAuth/provider integrations, upload protocols, queue/manifest/state behavior, and scheduling.
- `apps/web/` is the QFAT browser frontend.
- `apps/server/` currently provides QFAT health, browser-security, and media-intake routes; its existence does not authorize a full publishing backend.
- Browser code must never receive provider secrets or implement provider protocols.
- A local bridge/launcher/API is conditional: use only the smallest mechanism proven necessary to invoke existing Spoolcast operations.
- Existing QFAT SQLite, media library, credential provider, and upload boundary are not automatically mandatory merely because they exist.
- Owner-approved QFAT MVP UX: **Publish Now** and **Schedule**. Schedule uses one shared date/time and explicit timezone for all selected targets; target outcomes are independent; provider-side scheduled publication is not a local scheduler. Future per-platform/per-account times are later direction only. This does not authorize runtime implementation or a bridge/backend.
- Facebook single-image publishing is not verified in Spoolcast. Prior UI/media selection is not proof of publishing support.
- If a task reveals a missing Spoolcast capability or requires a new backend subsystem, STOP, record **OPEN OWNER DECISION** with source evidence, and ask the Owner. Never implement an assumed workaround.
- Historical tasks/reports are evidence, not ongoing authorization. A task authorizes only its exact scope and paths.
- Linux is the only active credential-storage workstream; Windows is deferred. Verification is local-only; no hosted CI. No live OAuth/account authorization/uploads without explicit approval. Figma is cancelled. Preserve upstream MIT attribution.

Read `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md` for authority order, in/out/conditional scope, approval gates, and required task fields.


## Mandatory workflow
1. Confirm repository, target branch, remote HEAD, recent commits, and local working-tree state.
2. Preserve pre-existing local changes; never reset, clean, stash, overwrite, or discard user work.
3. Safely synchronize the exact authorized branch before reading the task. Never force synchronization or overwrite a remote advance.
4. Verify/read the complete task, this file, workflow, relevant PRD/architecture/decisions, and affected source/tests.
5. Map acceptance criteria to bounded changes and evidence.
6. Implement only authorized scope. Documentation-only tasks must not change source, dependencies, configuration, schema, or runtime.
7. Stop and ask when a missing Spoolcast capability or scope gap appears.
8. Run required checks only; record actual commands/environment/outcomes and mark unavailable checks NOT RUN.
9. Review full diff/paths, report, commit, push, and verify remote publication.

## Verification and publication
Verification is local-only; never create, enable, trigger, or rely on hosted CI. Run `npm run typecheck` after TypeScript changes. No live uploads or credential-dependent tests without approval. Distinguish source inspection from executed checks.

Use only the task's target branch. No unauthorized branch creation/switch/merge/delete, force-push, history rewrite, or amendment of published commits. Commit only task-related files, push, and verify remote commit/report. If publication fails, report BLOCKED.

Reports must state status, task, repo/branch, commit message/full SHA, scope, changed files, acceptance evidence, exact verification, findings, and Git publication. State ready for GPT/Owner audit, not owner acceptance. After publication, handoff contains only Branch, Commit message, Full SHA, and Report path. Stop after the authorized task.
