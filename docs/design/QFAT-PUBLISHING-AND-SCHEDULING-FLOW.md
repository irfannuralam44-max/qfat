# QFAT Publishing and Scheduling Flow

- **Document ID:** QFAT-DESIGN-PUBLISH-001
- **Status:** Owner-approved MVP UX contract; runtime integration not authorized
- **Last updated:** 2026-11-14
- **Related PRD:** [QFAT MVP PRD](../PRD-QFAT-MVP.md)
- **Architecture:** [QFAT MVP Architecture](../ARCHITECTURE-QFAT-MVP.md)
- **Scope control:** [QFAT Scope and Change Control](../QFAT-SCOPE-AND-CHANGE-CONTROL.md)
- **Source boundary:** [QFAT-015 report](../../reports/QFAT-015-spoolcast-upload-service-boundary-report.md)

## 1. Product boundary

QFAT is the frontend for Spoolcast. Spoolcast remains the application and publishing core, including provider protocols and scheduled upload behavior. This note records approved user-facing behavior and current source evidence; it does not specify or authorize implementation of a bridge, route, scheduler, queue, job engine, OAuth/account integration, or new persistence.

## 2. User journey — Publish Now

1. User prepares one content item in QFAT.
2. User selects one or more supported destinations (for example, a YouTube channel and/or Facebook Page).
3. User selects **Publish Now**.
4. The approved future integration invokes the existing Spoolcast adapter for each selected target with its explicit immediate option.
5. QFAT presents target-specific progress and the actual result returned for each target.
6. If one target fails, other selected targets are still attempted and their results remain visible.

A successful response means the provider upload/API operation succeeded to the extent confirmed by that response. It does not, by itself, guarantee final public visibility. Do not show Live/Published unless that state is actually confirmed.

**Current limitation:** QFAT has no publishing invocation route or enabled Publish action. Also, `readManifest` currently requires and parses `publishAt`; for Facebook it applies a future schedule window even when an adapter immediate mode would omit scheduling fields. No immediate-mode manifest fix or invocation design is selected here.

## 3. User journey — Schedule

1. User prepares one content item and selects one or more supported destinations.
2. User selects **Schedule**.
3. User enters one date/time and explicitly chooses the timezone for the entire selected destination set.
4. The chosen local date/time is normalized once to one unambiguous instant (UTC epoch/time point).
5. The same intended instant is passed for every selected target. Provider-specific formatting is applied only at serialization:
   - YouTube: RFC 3339 UTC timestamp.
   - Facebook Page video and Reels: Unix seconds.
6. Spoolcast submits each target's upload/schedule request to its provider. Each target has its own success/failure result.
7. Once a provider accepts the scheduled post, show **Scheduled** (or equivalent). The provider performs publication at the accepted future time. QFAT/Spoolcast need not stay open or running until then.

This is **provider-side scheduled publishing**, not a local QFAT/Spoolcast scheduler. Spoolcast's README describes a manually invoked, one-shot CLI with no internal daemon/scheduler; cron/launchd references describe external invocation of that CLI, not a QFAT timer that publishes a queued post at the scheduled timestamp.

## 4. Shared timestamp and timezone contract

- MVP has exactly one schedule timestamp for the selected target set.
- The UI requires one explicit timezone so a local wall-clock time is not ambiguous.
- Normalize the chosen date/time + timezone once to one instant.
- All targets receive the same intended instant. YouTube and Facebook may receive different serialized formats, but not different instants.
- Do not allow existing per-target manifest overrides to silently create distinct target times in the MVP UI flow.
- Future per-platform/per-account timestamps are a later enhancement only. They are not part of MVP and require a future product/task decision.

The contract does not promise that provider API requests start or complete simultaneously, that providers process at identical speed, or that content becomes publicly visible at precisely the same millisecond.

## 5. Independent target execution and results

Treat each selected platform/account as its own outcome unit. One target's error must not abort or suppress attempts for other targets. Report progress/result per target, not only one aggregate state.

The existing Spoolcast CLI demonstrates **sequential** isolation: it loops through targets, catches an error inside each target attempt, records failure, and proceeds. It does not demonstrate concurrent fan-out. The approved QFAT contract requires independent outcomes, not a concurrency model.

A later item-level aggregate may summarize target outcomes, but it must not hide individual successes/failures. Do not introduce automatic whole-item retries or a new retry engine under this contract. A failed target may be considered for an independently authorized retry flow later.

## 6. Status vocabulary and user-visible truth

| State/label | Meaning | Must not imply |
|---|---|---|
| Preparing | Local input/metadata validation | Provider request has started |
| Uploading / In progress | Actual upload activity measured by the adapter | Provider has accepted the post |
| Accepted / Upload succeeded | Provider API request returned success according to adapter checks | Public visibility is guaranteed |
| Scheduled | Provider accepted the future scheduled post | QFAT has a local pending timer or post is already live |
| Failed | That specific target attempt returned an error | Other targets failed too |
| Published / Live | Provider response or later verified provider state confirms public visibility | Do not infer from generic successful upload or ledger status `posted` |

Current `src/state.ts` only stores `posted` and `failed`. The CLI records a successful scheduled submission as `posted` when the provider request resolves. Do not change schema or reinterpret old ledger data as part of this task. A durable distinction between immediate acceptance, scheduled acceptance, and public visibility remains a future status-model design issue.

## 7. Source evidence

All evidence below was re-fetched from `main` HEAD `157ed53729568ae69541482b8a708c3320e78d0b` on 2026-11-14. This is source inspection, not execution or live provider verification.

| Path | Verified behavior | QFAT implication |
|---|---|---|
| `src/manifest.ts` | `RawMeta.publishAt` is required. `readManifest` parses it and derives `publishAtUTC` and `publishAtUnix`. For a Facebook target it validates minimum 10 minutes and maximum 6 months in the future. | Immediate flow still hits required timestamp parsing; Facebook validation is not mode-aware. Must not blindly reuse this path for Publish Now. |
| `src/upload-youtube.ts` | `immediate: true` sets `privacyStatus: public` and omits `publishAt`; default mode sets private plus `publishAtUTC`. | Existing adapter supports both request modes. |
| `src/upload-facebook.ts` | Immediate mode sends `published=true`; scheduled mode sends `published=false` and `scheduled_publish_time` Unix seconds. | Existing adapter supports both request modes for Page video. |
| `src/upload-facebook-reel.ts` | Immediate mode sends `video_state=PUBLISHED`; scheduled mode sends `SCHEDULED` plus Unix `scheduled_publish_time`. | Existing adapter supports both request modes for Reels. |
| `src/run.ts` | One-shot target loop. Calls adapters without `immediate: true`; catches per-target errors, calls `markFailed`, and continues. | Existing CLI defaults to scheduled mode and processes sequentially; no QFAT invocation. |
| `src/state.ts` | `UploadStatus = 'posted' | 'failed'`; target-specific entries store one of those statuses. | Scheduled acceptance is currently persisted as `posted`; this is not proof of public-live status. |
| `README.md` and Spoolcast section of `CLAUDE.md` | No built-in scheduler/daemon; manual one-shot execution, optionally externally invoked by cron/launchd. | No local timer is part of provider-side scheduled publication. |
| `reports/QFAT-015-spoolcast-upload-service-boundary-report.md` | QFAT-015 reports callable adapter options, immediate mode, progress, structured results and bounded-memory Reels; explicitly no HTTP routes/OAuth/database/UI. | Adapter capability exists; QFAT end-to-end publishing flow does not. |
| `apps/server/src/index.ts` | Registers health, security and media routes. | No publishing/OAuth bridge route currently exists. |
| `apps/web/src/pages/CreateContentPage.tsx` | Publish button disabled; account/destination selection and publishing actions described as future. | Current screen is preparation-only. |
| `apps/web/src/App.tsx` | Accounts, Queue, History navigation entries disabled. | These product surfaces are not implemented. |

## 8. Known gaps and OPEN OWNER DECISIONS

1. **Immediate manifest validation gap:** required `publishAt` and Facebook schedule-window validation still apply before the immediate adapter option can be used through the existing manifest path. No code-level solution selected.
2. **Invocation boundary/process lifecycle:** QFAT server does not invoke Spoolcast. The minimum safe local browser-to-Node mechanism remains undecided.
3. **OAuth/account mapping:** no approved mapping between QFAT encrypted credential records and Spoolcast's explicit account input is verified.
4. **Progress/result transport:** adapter callbacks/results exist, but no QFAT route/UI relay is present.
5. **Durable status semantics:** existing ledger lacks a `scheduled` state and does not represent eventual public visibility. No schema/semantic change approved.
6. **Media and supported target matrix:** existing UI media intents do not prove all are supported by Spoolcast; Facebook single-image/album publishing is not verified and excluded.
7. **History, cancellation, editing/rescheduling, retries:** no approved ownership or runtime contract. No new orchestration may be inferred.

Each is recorded as **OPEN OWNER DECISION** or a source-proven capability/integration gap. If future implementation needs one, stop and obtain a separate bounded task and required owner decision. Do not create a workaround backend.

## 9. Approval gates before runtime integration

Before any implementation task:
- define the minimal safe local invocation boundary/process lifecycle and allowed request/result contract;
- resolve OAuth/account mapping without duplicating credential/token ownership;
- decide how immediate mode bypasses scheduled-only manifest validation safely;
- define how one normalized shared instant is passed to all targets without per-target overrides diverging;
- define target-level result/progress transport without introducing an independent job engine;
- decide whether/how scheduled acceptance is represented without corrupting existing ledger semantics;
- confirm exact supported content/media/target combinations;
- retain the mandatory no-live-provider-call rule unless a task explicitly authorizes a controlled test.

No QFAT-023 or follow-on implementation task is created by this note.
