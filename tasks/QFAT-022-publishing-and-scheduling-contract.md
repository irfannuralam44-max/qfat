# QFAT-022 — Record the Approved Publishing and Scheduling Contract

- **Task ID:** QFAT-022
- **Status:** OWNER-AUTHORIZED FOR DOCUMENTATION WORK — 2026-11-14
- **Task type:** Documentation-only product-flow and source-capability alignment
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Base HEAD inspected by GPT:** `d34a4fd89669acf44129a77a2b60129edc682d08`
- **Expected report:** `reports/QFAT-022-publishing-and-scheduling-contract-report.md`
- **Owner decisions recorded from the current project conversation:** QFAT MVP offers Publish Now and Schedule; MVP scheduling uses one shared publication timestamp for every selected platform/account target; a failure for one target must not stop other targets; later evolution may allow per-platform/per-account times.

## 1. Objective

Record a precise, source-grounded product contract for the first QFAT publishing journey and correct the active product documents so the approved owner decisions are no longer described as open questions.

**QFAT remains the frontend for Spoolcast. Spoolcast remains the publishing core and provider-protocol authority.** This task does not implement publishing, scheduling, a bridge, OAuth, account management, or any runtime behavior.

The task must distinguish:
- immediate publishing from provider-side scheduled publishing;
- scheduling a post with a provider from running a local scheduler;
- one shared timestamp in MVP from future per-target timestamps;
- a successful provider submission/acceptance from the eventual time the post becomes publicly visible;
- per-target execution outcomes from an item-level aggregate status.

## 2. Verified repository baseline (must re-check after synchronization)

GPT inspected `main` at `d34a4fd89669acf44129a77a2b60129edc682d08` and observed:

### Existing Spoolcast behavior
- `src/manifest.ts` parses one `publishAt` value with a timezone offset and derives RFC 3339 UTC for YouTube and Unix seconds for Facebook.
- Facebook scheduling validation currently requires the time to be at least 10 minutes and no more than 6 months in the future.
- `src/upload-youtube.ts` defaults to scheduled upload (`privacyStatus: private` plus `publishAt`); QFAT-015 added `immediate: true`, which changes privacy to public and omits `publishAt`.
- `src/upload-facebook.ts` defaults to scheduled upload (`published=false` plus `scheduled_publish_time`); QFAT-015 added `immediate: true`, which sends `published=true` and omits the schedule field.
- `src/upload-facebook-reel.ts` defaults to scheduled Reels (`video_state=SCHEDULED` plus `scheduled_publish_time`); QFAT-015 added `immediate: true`, which sends `video_state=PUBLISHED` and omits the schedule field.
- These are provider-side scheduled publication requests: Spoolcast uploads/submits the post to the provider when invoked, and the provider is asked to publish it at the requested future time. The README/CLAUDE documentation says Spoolcast has no internal daemon/scheduler and is manually invoked (or externally invoked by cron/launchd). **Do not describe this as a local QFAT/Spoolcast timer that wakes up at publish time.** After the provider has accepted a scheduled post, local QFAT/Spoolcast does not need to remain running for the provider to publish it.
- `src/run.ts` is a one-shot CLI orchestrator. It currently invokes upload adapters without `immediate: true`, so the legacy CLI path is scheduled by default.
- `src/run.ts` iterates item × target pairs and catches errors inside the target loop; a failure is recorded with `markFailed` and does not stop later targets from being attempted.
- `src/state.ts` records per-item/per-raw-target outcomes, but its current statuses are only `posted` and `failed`. A scheduled provider submission is recorded as `posted` once the API call resolves, even though the provider publication time is in the future. QFAT must not mislabel this as already publicly live.
- The CLI target model supports multiple YouTube channels and Facebook Pages. Per-target `overrides` can override shared manifest fields, including `publishAt`, but the MVP UI decision is to use one shared time for all selected targets.
- QFAT-015 adapted the existing upload functions for explicit caller inputs, immediate mode, progress callbacks, structured results, and bounded-memory Reels streaming. It did not implement a QFAT HTTP route or frontend publishing flow.

### Existing QFAT integration state
- `apps/server/src/index.ts` currently registers health, security, and media routes only; it does not invoke Spoolcast upload functions.
- `apps/web/src/pages/CreateContentPage.tsx` and platform editors are preparation/editor UI; the current page notes that account selection and publishing actions are future work.
- `apps/web/src/App.tsx` has Accounts, Queue, and History navigation entries disabled.
- QFAT credential storage exists, but OAuth/account integration and ownership of the mapping between QFAT's encrypted credential records and Spoolcast upload account inputs remain unresolved.
- The minimum browser-to-Node invocation boundary/process lifecycle remains undecided and is not authorized by this task.

These are a starting point, not substitutes for re-inspecting the exact current source on the synchronized branch.

## 3. Owner-approved product contract to record

### MVP publishing modes
1. **Publish Now:** submit each selected target for immediate publication using the existing Spoolcast adapter's immediate mode.
2. **Schedule:** submit each selected target to its provider with one shared publication timestamp.
3. The user selects one or more supported platform/account targets for the same content item.
4. The MVP schedule editor exposes one date/time and one explicit timezone for the whole selected target set.
5. All selected targets receive the same intended publication instant. Normalize the timestamp once to an unambiguous instant; provider-specific formats may differ (YouTube RFC 3339 UTC; Facebook Unix seconds).
6. The same user action applies to all selected targets, but the UI must not promise millisecond-simultaneous provider execution or public visibility. Upload/API calls may complete at different times, and provider processing may introduce small differences.
7. Each target is processed independently. A failure for one target must not cancel or prevent attempts for the remaining targets. The UI reports each target's actual result separately.
8. A failed target may be retried independently later; no automatic whole-item retry or new retry engine is authorized here.
9. Later product evolution may add different timestamps per platform/account target. This is a future direction only; it is not part of MVP implementation scope.

### Truthful status language
- For Publish Now, distinguish submission/upload in progress, provider acceptance/success, and failure. Do not invent a guaranteed final public state if the provider response only confirms upload/acceptance.
- For Schedule, a successful adapter result means the provider accepted the scheduled post (subject to the actual provider response); display **Scheduled** or equivalent, not **Published/Live**.
- A future scheduled post is not a local pending job that requires the computer/browser to stay on after provider acceptance.
- Current Spoolcast ledger uses `posted` for successful submission and has no explicit `scheduled` or `publishing` status. Do not silently change that schema or reinterpret its durable semantics in this documentation task. Record any status-model requirement as a future design concern.

### Important source-level caveats to document
- `readManifest` currently requires `publishAt` even when a caller may want immediate publishing.
- `readManifest` currently applies Facebook's future schedule window validation whenever a Facebook target is resolved, including a potential immediate flow. The future integration must not blindly reuse this validation for Publish Now without an explicitly reviewed design.
- `src/run.ts` is sequential per target and independent on caught target errors; do not claim concurrent fan-out.
- The QFAT-015 immediate option exists in adapter functions, but the existing CLI orchestrator does not expose it.
- The QFAT-015 report documents YouTube, Facebook Page video, and Facebook Reels only. Facebook single-image publishing is not verified and must remain excluded from the publishing MVP.
- Do not infer that account selection, OAuth, local bridge invocation, persistence, cancellation, editing an already-submitted provider schedule, or status/history UI is implemented.

## 4. Required deliverables

### A. Update `docs/PRD-QFAT-MVP.md`
- Record the approved Publish Now + Schedule MVP.
- Record one shared timestamp for all selected targets in MVP.
- Record per-target independent processing and result display.
- Record future per-target scheduling as a later direction, not current MVP scope.
- Replace the obsolete OPEN OWNER DECISION for whether QFAT exposes scheduling.
- Explain provider-side scheduling versus a local scheduler.
- Preserve other unresolved decisions (bridge/process lifecycle, OAuth/account mapping, media handoff, status/history ownership, etc.).

### B. Update `docs/ARCHITECTURE-QFAT-MVP.md`
- Add the approved logical flow and responsibility mapping.
- State that Spoolcast/provider APIs own actual scheduled publication; QFAT does not create a scheduler/daemon.
- State that per-target isolation is required at the invocation boundary and that QFAT must show target-specific outcomes.
- Do not choose an unapproved bridge, API route, process model, queue, scheduler, job engine, or persistence owner.
- Record the source caveats and unresolved integration dependencies.

### C. Update `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`
- Record the owner-approved MVP publishing/scheduling UX boundary.
- Clarify that this approval does not authorize a local scheduler, new backend orchestration, OAuth/account ownership, or new persistence/state schema.
- Preserve the mandatory stop-and-ask rule.

### D. Synchronize concise active instruction overlays
Update only the relevant QFAT product-direction statements in:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`

Replace statements that say scheduling UI exposure is still an OPEN OWNER DECISION with the approved decision. Do not otherwise rewrite universal workflow instructions or unrelated Spoolcast documentation.

### E. Add one focused design note
Create `docs/design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md` containing:
- user journey for Publish Now and Schedule;
- shared timestamp behavior and timezone normalization;
- per-target execution and error isolation;
- provider-side schedule semantics and realistic status vocabulary;
- source evidence table (path, current behavior, QFAT implication);
- known gaps/caveats;
- explicit unresolved decisions and approval gates before runtime integration.

### F. Create report
Create `reports/QFAT-022-publishing-and-scheduling-contract-report.md` with the repository's required report format and evidence.

## 5. Strict scope boundaries

### Allowed
- Read-only inspection of current source, tests, docs, and existing reports.
- Markdown-only changes to the exact paths listed in §4.
- Create the focused design note and report.
- Local Markdown/link checks that require no new dependencies.

### Forbidden
- Any source/runtime changes under `src/`, `apps/`, or other runtime paths.
- Changes to tests, package manifests/lockfiles, dependencies, configuration, database schema/migrations, credentials, media, or build settings.
- Implementing Publish Now, Schedule, account selection, OAuth, publishing endpoints, progress streaming, queue/history, cancellation, retry orchestration, or any UI behavior.
- Adding a local scheduler, daemon, cron integration, worker, queue, job orchestrator, or publishing ledger.
- Selecting/implementing a local bridge, launcher, IPC/API, process supervisor, or new runtime topology.
- Changing Spoolcast's provider protocols or upload adapters.
- Implementing Facebook single-image or album publishing.
- Live OAuth, account authorization, provider API calls, or uploads.
- Hosted CI/GitHub Actions.
- Creating QFAT-023 or another follow-on task.

If the source inspection identifies a capability gap or an unresolved ownership/architecture decision, document exact evidence and mark **OPEN OWNER DECISION**. Do not implement a workaround.

## 6. Required acceptance criteria

- [ ] AC-01: Agent safely synchronizes `main`, verifies current HEAD, and reads this task, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, PRD, architecture, scope-control doc, relevant ADRs, and QFAT-015 source/report.
- [ ] AC-02: PRD, architecture, scope-control, and instruction overlays consistently record the approved MVP publishing/scheduling decisions.
- [ ] AC-03: Documentation accurately distinguishes provider-side scheduled publication from a local scheduler/daemon.
- [ ] AC-04: Documentation records one shared intended timestamp for all selected targets in MVP and future per-target times as later direction only.
- [ ] AC-05: Documentation records per-target independent processing and does not claim simultaneous API execution.
- [ ] AC-06: Source caveats in §3 are re-verified against current source and accurately recorded, including immediate-mode manifest validation caveats.
- [ ] AC-07: Design note contains source evidence, user journeys, status semantics, gaps, and unresolved decisions.
- [ ] AC-08: No runtime/source/test/dependency/configuration/schema changes occurred.
- [ ] AC-09: Markdown links and changed references are checked where practical; limitations are reported honestly.
- [ ] AC-10: Report is committed and pushed to `main`, with full SHA and remote publication verification.

## 7. Verification

Documentation-only:
- `git diff --check`
- `git status --short` and full diff/path review
- Verify only §4 paths changed
- Check changed internal links/references
- Search active docs for stale wording that says scheduling UI exposure remains an open decision
- Application typecheck/build/tests and live provider operations: **NOT RUN — documentation-only task**

Do not install dependencies or use hosted CI.

## 8. Git and handoff

Follow `AGENTS.md` and `docs/AI-DEVELOPMENT-WORKFLOW.md`. Use `main` only. Preserve all pre-existing local work. No branch creation/switch, force-push, history rewrite, or unrelated edits.

Suggested commit message:
`docs(QFAT-022): record publishing and scheduling contract`

After push and remote verification, stop. Agent chat handoff must contain only:
- Branch
- Commit message
- Full SHA
- Report path

The work is ready for GPT/Owner audit; it is not owner-accepted until independently audited.
