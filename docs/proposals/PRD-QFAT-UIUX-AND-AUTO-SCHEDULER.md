# QFAT UI/UX and Auto-Run Scheduler — Product Requirements Document

- **Document ID:** QFAT-PRD-002
- **Status:** PROPOSED — pending Owner approval
- **Last updated:** 2026-11-14
- **Product:** QFAT frontend for Spoolcast
- **Related documents:**
  - [QFAT Scope and Change Control](../QFAT-SCOPE-AND-CHANGE-CONTROL.md)
  - [QFAT MVP PRD (QFAT-PRD-001)](../PRD-QFAT-MVP.md)
  - [Publishing and Scheduling Flow](../design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md)
  - [QFAT MVP Architecture](../ARCHITECTURE-QFAT-MVP.md)
  - [Repository workflow](../../docs/AI-DEVELOPMENT-WORKFLOW.md)
  - [QFAT-015 Spoolcast upload boundary report](../../reports/QFAT-015-spoolcast-upload-service-boundary-report.md)

> This proposal adds no authority to implement. QFAT-PRD-001 and the active scope-control decisions remain authoritative. Part A proposes a frontend presentation direction; it does not approve new Accounts, Queue, History, Overview, diagnostics, or other operational read surfaces. Those surfaces remain conditional on an Owner-approved, source-authoritative read contract and the applicable access-control, ownership, freshness, and redaction gates. Part B is a separate, explicitly unapproved proposal for a capability in Spoolcast Core only. Every unresolved product, ownership, or runtime question is an **OPEN OWNER DECISION**.

## 0. Authority and conflicts

The authority order is defined in [QFAT Scope and Change Control](../QFAT-SCOPE-AND-CHANGE-CONTROL.md): current explicit Owner decisions, scope control, consistent approved PRD/architecture, approved addenda, task scope, source evidence, then historical context. This proposal cannot silently override any higher-authority source.

| Authority / existing fact | Source | Relationship to this proposal | Conflict handling |
|---|---|---|---|
| QFAT identity: frontend/UI for the existing Spoolcast application; Spoolcast remains publishing and application core | Scope control §Product identity; QFAT-PRD-001 §§1–2 | Part A describes presentation and interaction only. Part B places any runner in Spoolcast Core. | No parallel QFAT backend, publishing engine, provider adapter, or scheduler is proposed. |
| Owner-approved Publish Now + Schedule UX: one shared date/time/timezone for all selected targets; independent target outcomes; no simultaneity promise | Scope control §Approved MVP publishing UX boundary; QFAT-PRD-001 §3; Publishing Flow §§2–5 | Part A specifies this flow and its honest results. | The UX approval is not implementation or bridge authorization. |
| Provider-side scheduling: provider publishes after accepting a future request; QFAT/Spoolcast need not remain running at publish time | Publishing Flow §3; QFAT-PRD-001 §§2–3; Spoolcast README scheduling semantics | Part A uses “Scheduled” only after provider acceptance. | Provider-side scheduling is distinct from Part B Auto-Run, which decides when Spoolcast submits. |
| New QFAT scheduler, queue, job orchestrator, and independent ledger are out of scope | Scope control §Out of scope; QFAT-PRD-001 §6 | Part B would conflict if implemented in QFAT. It therefore proposes Auto-Run in Spoolcast Core only. | Part B remains PROPOSED and requires explicit Owner approval plus a separate bounded task. QFAT may only present Spoolcast-owned state through a separately approved read/request boundary. |
| Spoolcast currently has no internal scheduler/daemon; it is manually invoked one-shot, with optional external cron/launchd invocation | Spoolcast `CLAUDE.md` “Known limitations”; README “Run model”; Publishing Flow §3 | Auto-Run is a proposed new Spoolcast capability, not an existing feature. | No claim that a runner, lock, durable pause state, or run log exists today. |
| Different per-platform/per-account schedule times are future direction only | Scope control approved UX boundary; QFAT-PRD-001 §3; Publishing Flow §4 | Part A retains one shared instant. | Per-target time overrides do not create distinct times in MVP. Any future expansion requires a separate Owner decision. |

### 0.1 Source-grounded constraints retained

The following are current Spoolcast invariants or limitations, not optional design suggestions:

- The immutable ledger key is the queue-relative video-stem path; do not rename, move, or delete queue folders or video files.
- Idempotency is per target and keyed by the exact raw target string, not a resolved account alias.
- Ledger and token writes are atomic (temporary file then rename).
- `--dry-run` remains fully offline: no token load and no network/provider calls.
- A failed upload is recorded as `failed`, never `posted`.
- Facebook scheduled video/Reel eligibility is 10 minutes through 6 months ahead.
- YouTube schedule serialization is RFC 3339 UTC; Facebook schedule serialization is Unix seconds.
- `queue/state.json` retains its existing `posted` / `failed` schema for this proposal; this PRD does not authorize schema changes.
- QFAT never renames, moves, or deletes Spoolcast queue files.
- Provider secrets remain inside the trusted Node/Spoolcast boundary and never enter browser state, HTTP responses, URLs, process arguments, logs, progress events, or user-visible errors.

Sources: Spoolcast root `CLAUDE.md` “Invariants” and “Secrets & git”; [Publishing and Scheduling Flow](../design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md) §§6–8; [Scope and Change Control](../QFAT-SCOPE-AND-CHANGE-CONTROL.md) §§D-024-01–02.

## 1. Background and problem

QFAT currently has an application shell, Overview, Media Library, and Create Content preparation surfaces. The navigation also names Accounts, Queue, History, and Settings, but those routes are marked “Soon” in `apps/web/src/App.tsx`. The current frontend is therefore not yet a complete operational workspace.

Spoolcast supplies the provider integrations, account/token authority, queue discovery, per-target idempotency, upload protocols, and provider-side scheduling. Its current run model is manual and one-shot. There is no internal scheduler or daemon; external cron/launchd may invoke the CLI, but that is not a built-in scheduling service (Spoolcast README; root `CLAUDE.md`, “Known limitations”).

This creates two separate user problems:

1. **Frontend usability:** the Owner needs a clear browser workflow to prepare content, select explicit platform/account targets, choose Publish Now or one shared Schedule instant, inspect existing operational information, and understand independent per-target outcomes. The UI must not imply that an unimplemented integration is available.
2. **Unattended submission:** manual CLI invocation does not automatically notice when a queue item becomes eligible for submission. Facebook's scheduled window (10 minutes to 6 months) can make an item too early to submit, requiring the operator to revisit it later. The current manifest path enforces this window for Facebook; it does not provide a persistent Held-until-eligible workflow (Spoolcast `src/manifest.ts`, `src/config.ts`, and Publishing Flow §7).

**Important distinction:** provider-side Schedule already asks a provider to publish later after acceptance. Proposed Auto-Run would instead decide when Spoolcast submits an item to a provider. These are different clocks and responsibilities.

This document describes a target product experience and proposed requirements. It does not claim that the current QFAT frontend, bridge, or Spoolcast runner implements them.

## 2. Goals, non-goals, and success measures

### 2.1 Goals

- **G-1 — Truthful frontend:** provide a coherent, accessible QFAT workspace over approved and verified Spoolcast capabilities.
- **G-2 — Shared-time publishing UX:** specify Publish Now and Schedule with one explicit timezone and one normalized instant across selected targets.
- **G-3 — Independent outcomes:** keep each `platform:alias` result visible; one target failure never hides or suppresses another target's outcome.
- **G-4 — Proposed read-only operational visibility:** describe potential Accounts, Queue, and History experiences without treating them as approved or available; any real operational data requires a separately approved Spoolcast-owned read contract and security gates.
- **G-5 — Proposed unattended submission:** evaluate an opt-in Spoolcast Core runner that can hold an item until provider constraints permit submission.
- **G-6 — Safe evolution:** preserve existing Spoolcast invariants and keep all missing ownership/capability decisions explicit.

### 2.2 Non-goals

- QFAT-owned scheduler, daemon, cron service, queue, job orchestrator, publishing ledger, retry engine, or backend.
- Reimplementing OAuth, provider protocols, upload adapters, token storage, or Spoolcast domain rules in the browser or QFAT server.
- Changing `queue/state.json` `posted` / `failed` schema in this proposal.
- QFAT renaming, moving, deleting, reordering, editing, or mutating Spoolcast queue files.
- Browser access to provider secrets or credentials.
- Per-target different Schedule timestamps in the MVP.
- Facebook single-image or album publishing; these are not verified by the current Spoolcast publishing adapters (QFAT-PRD-001 §4).
- Automatic retries, cancel/edit/reschedule of accepted provider posts, or a claim that a provider-accepted post is publicly visible.
- Multi-user roles, teams, registration, or an invented trusted-device authentication model. D-024-01 defines a single-owner MVP but leaves enforceable owner-only access OPEN.
- Any implementation, dependency, persistence/schema migration, live provider call, or hosted CI under this documentation-only proposal.

### 2.3 Observable success measures

| ID | Measure | Observable acceptance signal |
|---|---|---|
| SM-1 | Truthful per-target publishing | Every selected target has its own visible state/result; no aggregate hides a target failure; “Published/Live” appears only with provider-confirmed visibility input. |
| SM-2 | Shared schedule correctness | One explicit IANA timezone is required; all selected targets derive from one normalized UTC instant; DST gaps/overlaps block submission; provider formats differ only in serialization. |
| SM-3 | Safe account and queue visibility | Accounts expose aliases only; Queue/History are read-only; browser/network payloads contain no provider secrets; queue paths and ledger identity remain unchanged. |
| SM-4 | Responsive and accessible UI | Core Create Content flow is operable by keyboard and screen reader at 360 px width and meets WCAG 2.2 AA criteria in the approved implementation task. |
| SM-5 | Safe Auto-Run proposal outcome | If separately approved and implemented, offline plan mode causes no provider calls, single-instance execution is enforced, Held items are not submitted early, and each tick is auditable without secrets. |

Measures are product acceptance targets, not claims of current implementation or test results.

## 3. User and context

- **Primary user:** one Owner/operator (D-024-01); no multi-user role model is implied.
- **Devices:** desktop and phone browsers on the Owner's local network or Tailscale-connected devices. This is an intended access context, not proof of authenticated owner identity.
- **Runtime context:** QFAT is the browser frontend; Spoolcast Core owns provider integrations and queue semantics. A minimal invocation/read boundary remains conditional and must be separately designed and approved.
- **Network/security:** current Origin/Host checks, bootstrap session, and CSRF protections are not human authentication. The minimum enforceable owner-only access control for publishing over LAN/Tailscale remains OPEN OWNER DECISION (scope control D-024-01).
- **Credentials:** Spoolcast exclusively owns provider OAuth, account aliases, tokens, and provider app credentials. QFAT must not copy, synchronize, or expose them (scope control D-024-02).
- **Operating system:** Linux is the active credential-storage workstream; Windows is deferred. Any proposed runner is Linux-first, subject to confirmation of the Spoolcast home directory and OS access model.

# PART A — QFAT UI/UX

## 4. Information architecture

Reuse the existing navigation labels and order from `apps/web/src/App.tsx`; do not invent a parallel information architecture.

| Navigation / route | Proposed deliverable | Data and interaction boundary | Availability principle |
|---|---|---|---|
| Overview `/` | Proposed operational summary cards, recent target outcomes, clear service/read freshness | Would require read-only summaries from an approved Spoolcast data contract; no fabricated counts | Proposal only; real data remains gated by P2 and applicable Owner approvals |
| Accounts `/accounts` | Proposed read-only account alias inventory grouped by platform | Would expose platform + alias only; no token, credential, secret, or fake Connect flow | Proposal only; real data remains gated by P2; provider authorization remains in Spoolcast CLI |
| Media Library `/media` | Existing QFAT media library surface retained | Existing media behavior only; supported publishing formats/targets must be verified separately | Do not infer publishing support from media selection |
| Create Content `/create` | Content preparation, target selection, shared Publish Now/Schedule, review, per-target results | UI collects intent; a separately approved boundary invokes Spoolcast | Provider-touching controls remain disabled with an accessible explanation until integration and security gates are approved |
| Queue `/queue` | Proposed read-only queue discovery by channel and item with per-target ledger status | Would require an approved read-only Spoolcast queue/ledger contract; no mutations | Proposal only; real data remains gated by P2; show freshness; never reorder/edit |
| History `/history` | Proposed read-only ledger history keyed by channel/video and raw target | Would use only an approved read-only contract for existing `posted` / `failed` ledger; no mutations | Proposal only; real data remains gated by P2; do not imply visibility or immediate-vs-scheduled certainty |
| Settings `/settings` | Appearance, default timezone preference, read-only diagnostics | Local presentation preferences and safe diagnostics | No credential, scheduler, or provider-account administration unless separately approved |

**Gating principle:** this information architecture is a proposal, not approval to expose every named route or data source. P1 may create navigation/screen shells and local interactions using clearly labeled, non-live fixtures only. Accounts, Queue, History, operational Overview summaries, and diagnostics must not display or imply real operational data until P2 has a separately approved read contract covering source authority, permitted fields, access control, Spoolcast-home/process ownership where relevant, freshness, failure/stale behavior, and redaction. If that contract is absent, unavailable, stale beyond its approved threshold, or cannot authoritatively answer a requested field, render an explicit **Unknown / unavailable** state—not an empty result, a guessed value, or a locally hardcoded substitute. Any control that can authorize or trigger provider activity remains disabled until the invocation boundary, owner-only access control, credential isolation, media handoff, and result contract have separate approval and implementation. Disabled controls need visible, accessible explanatory text; do not rely on a tooltip or color alone.

## 5. Cross-cutting UX rules

### 5.1 Status vocabulary

| UI state | Meaning | Must never imply |
|---|---|---|
| Preparing | Local content and metadata validation | Provider request started |
| Uploading | Actual upload progress reported by Spoolcast adapter | Provider accepted the post |
| Accepted | Provider API request succeeded according to adapter checks | Public visibility is guaranteed |
| Scheduled | Provider accepted a future scheduled post | QFAT has a local timer, or the post is already public |
| Failed | This specific target attempt failed | Other targets failed |
| Published / Live | Provider response or later provider verification explicitly confirms public visibility | Must not be inferred from generic success or ledger `posted` |
| Not submitted | No provider submission was attempted | A failure occurred |

Legacy ledger mapping is strict:

- `posted` is displayed as **Submitted to provider** (with a note that the ledger cannot establish whether the accepted request was immediate or scheduled). It is never labeled Published/Live.
- `failed` is displayed as **Failed** for that raw target.
- No ledger entry is displayed as **Not submitted**.
- **Scheduled** is reserved for a provider-accepted future scheduled request with reliable evidence that it was scheduled. The existing `posted` ledger alone is insufficient to distinguish that outcome.
- **Published/Live** requires provider-confirmed visibility, not a local inference.

The existing `src/state.ts` status union is `posted | failed`; this proposal does not change its schema or reinterpret existing entries (Publishing Flow §6).

### 5.2 Truthfulness and copy

- Distinguish local validation, upload activity, provider acceptance, provider scheduling, and confirmed public visibility.
- Use explicit target names in the form `platform:alias`; if the source target is a bare platform, show the resolved alias only when Spoolcast safely provides it. Do not invent aliases.
- A summary may aggregate counts but never replace the per-target result panel.
- State whether a time is local to the selected IANA timezone or UTC. Show both when relevant.
- State whether data is live, cached, stale, unavailable, or not yet connected. Never render a failed read as an empty queue/account list.
- Do not promise simultaneous execution, exact public visibility time, guaranteed provider processing, or cancellation on browser disconnect.
- Error text is actionable but redacted; never echo secrets, token fragments, provider credential payloads, or sensitive process arguments.

### 5.3 Accessibility

Target WCAG 2.2 AA for the implemented frontend. Requirements include:

- Full keyboard operation, logical focus order, visible focus, skip link, and no keyboard trap.
- Semantic headings, landmarks, form labels, fieldset/legend for grouped controls, and accessible names for icon-only controls.
- Validation errors associated with fields; focus moves to an error summary when submission is blocked.
- Progress and per-target result updates announced through appropriately scoped `aria-live` regions without excessive repeated announcements.
- Status is never conveyed by color alone; pair text/icon with meaning.
- Sufficient text and non-text contrast, scalable text, target sizes, and usable focus visibility.
- Respect `prefers-reduced-motion`; do not make animation necessary to understand status.
- Accessible disabled-state explanations and instructions for screen-reader users.

### 5.4 Responsive behavior

- Support a 360 CSS-pixel viewport without horizontal page scrolling for core workflows.
- Desktop may use persistent navigation and multi-column panels; narrow layouts stack sections and target results.
- Tables become readable stacked rows or contained horizontal-scroll regions with an accessible label; do not clip essential actions or status.
- Date/time/timezone controls remain usable on touch devices and do not depend on hover.
- Confirmation and result views fit the viewport, preserve focus, and expose all target outcomes.

### 5.5 Empty, loading, and error states

Every data-driven screen must define:
- **Loading:** what is being read and a non-blocking progress affordance.
- **Empty:** a verified zero-result state with a next step; never use for failed/unavailable reads.
- **Error:** safe message, retry only for a read operation where appropriate, and a correlation/reference value that contains no secret.
- **Stale:** last successful read time and explicit stale marker when a source is unreachable.
- **Partial:** identify which source/target succeeded and which did not; do not collapse partial success into total success.
- **Disabled/unavailable:** explain that the integration or approval gate is not complete.

## 6. Screen specifications

### 6.1 Create Content

**Purpose:** prepare one content item and collect a single publishing intent for one or more explicit platform/account targets.

**Required section order:**

1. **Content** — select a supported media item and show its title/file identity, duration/format where verified, and any validation warnings. UI selection does not establish provider support. Facebook single-image and album publishing remain excluded.
2. **Targets** — select supported destinations, each displayed as `platform:alias` (for example, `youtube:studio` or `facebook:brandpage`). Do not impose an arbitrary cap on the number of accounts/targets; actual provider/API limits must be surfaced from authoritative Spoolcast/provider validation rather than invented in the browser.
3. **When** — select **Publish Now** or **Schedule**.
4. **Review** — show content, exact target list, shared timestamp (if scheduled), and all eligibility results before confirmation.
5. **Results** — retain one result panel per target; never replace the panels with only an aggregate.

**Schedule editor**

- Require date, time, and an explicit IANA timezone identifier (for example, `Asia/Jakarta`), even when a default timezone is preselected in Settings.
- Normalize the local wall-clock input exactly once into one UTC instant; every selected target receives that same instant.
- Show the entered local date/time with timezone, normalized UTC timestamp, and a relative-time description.
- Reject nonexistent local times during DST spring-forward transitions.
- Reject ambiguous local times during DST fall-back transitions unless the UI can collect an explicit disambiguation choice. For this proposal, block submission rather than silently choosing an offset.
- YouTube serialization uses RFC 3339 UTC. Facebook Page video/Reels serialization uses Unix seconds. These are representations of the same instant, not independent times (Publishing Flow §§3–4).
- Preview each target's eligibility independently. YouTube must be a future instant and serialized RFC 3339 UTC. Facebook video/Reel must satisfy the 10-minute–6-month window and serialize as Unix seconds.
- **Rule source:** eligibility constraints must be supplied by Spoolcast as authoritative capability/rule data; do not hardcode a second browser copy of mutable provider limits. The source currently defines Facebook's window in `src/config.ts` and validates it in `src/manifest.ts`. **OPEN OWNER DECISION:** approved rule/read contract and freshness semantics are not defined.
- **Unknown-rule fallback:** if authoritative rule data is missing, unreadable, stale beyond its approved freshness limit, contradictory, or unavailable for any selected target, show that target's eligibility as **Unknown / cannot verify** and block confirmation for the entire selected target set. Do not infer eligibility from browser constants, cached examples, prior results, or provider assumptions; do not silently omit the target. Allow the Owner to retry the authoritative read or deselect the affected target.
- If authoritative data confirms a target is ineligible, flag that target and block confirmation until the Owner either changes the one shared time or deselects the target. Never silently shift, clamp, or substitute its time.
- Per-target manifest overrides must not produce different Schedule instants. The integration must either preserve the shared instant or reject conflicting input; it must not silently honor divergent per-target timestamps.
- Publish Now must not be forced through the current scheduled-only manifest path with a fabricated timestamp. The current `src/manifest.ts` requires `publishAt` and applies Facebook's schedule window even when an adapter immediate option exists. Resolution is an OPEN OWNER DECISION and a separate implementation gate (Publishing Flow §§7–9).

**Confirmation sheet**

Before any provider-touching action, show the content, all selected `platform:alias` targets, mode, and shared scheduled instant (if applicable). Include this exact semantic notice:

> Targets are attempted one after another. A failure for one target does not stop attempts for the others. This does not promise simultaneous requests or identical provider processing times.

The user must explicitly confirm. A browser refresh, navigation, or disconnect must not be represented as provider cancellation.

**Per-target result panel**

- Preserve one panel for every selected target, including targets not yet attempted.
- Show measured progress only when supplied by Spoolcast; otherwise show a neutral waiting/unknown state.
- Show Accepted, Scheduled, Failed, or Published/Live only when the corresponding evidence exists.
- Do not automatically retry. A retry control is not part of this proposal's authorized MVP.
- Keep a durable distinction between per-target outcome and any optional item-level summary.
- A provider-accepted scheduled request displays Scheduled only if the response contract identifies scheduled acceptance; legacy ledger `posted` is insufficient.

**Acceptance criteria**

- **AC-A1:** user can prepare a supported content item and see a validation summary without a provider call.
- **AC-A2:** targets are explicit `platform:alias` entries, no arbitrary UI cap is imposed, and target-level validation remains visible.
- **AC-A3:** Schedule requires date, time, and IANA timezone; one normalized instant is displayed in local and UTC forms and is shared across all selected targets.
- **AC-A4:** DST nonexistent/ambiguous times and target eligibility violations block confirmation; no target time is silently changed or overridden.
- **AC-A5:** confirmation explains sequential attempts and independent outcomes; every target retains its own result and no automatic retry occurs.
- **AC-A6:** keyboard and screen-reader users can complete preparation, understand blocked reasons, confirm only when integration is approved, and inspect every result; Published/Live is impossible without provider-confirmed state.

Until invocation/security/credential/media/result approvals exist, all provider-touching controls remain disabled and the screen is a preparation-only experience.

### 6.2 Accounts

- Read-only account inventory grouped by platform.
- Display explicit `platform:alias` identifiers and non-secret descriptive metadata only when Spoolcast provides it.
- Never display tokens, token expiry secrets, OAuth client secrets, Page access tokens, credential file paths, or raw provider payloads.
- Do not offer a fake **Connect** button or QFAT OAuth. Show the copyable command `spoolcast auth youtube` or `spoolcast auth facebook` with a note that authorization is performed by Spoolcast in its trusted environment.
- Spoolcast remains the sole OAuth/account/token authority under D-024-02.
- If no approved read path exists, show an explanatory unavailable state rather than a simulated account list.

### 6.3 Queue

- Read-only view grouped first by channel, then by video item.
- Show the queue-relative channel/video identity without changing its path.
- Show each raw target string and its own ledger state; preserve per-target `posted` / `failed` semantics.
- Show discovery warnings for missing/invalid channel metadata, missing video metadata, unsupported media, or unavailable queue source only when returned by Spoolcast.
- Never reorder, edit, rename, move, or delete queue items. No drag-and-drop or queue-management controls.
- Explain that a queue item may contain multiple videos and that ledger identity is video-stem based (root `CLAUDE.md`; README queue layout).
- If source discovery is stale/unavailable, show last successful read and stale state rather than empty.

### 6.4 History

- Read-only ledger view keyed by `<channel>/<video>` plus the exact raw target string.
- Filters may include channel, target/platform, ledger status, and date range only when those fields are actually present in the source data.
- Display `posted` as **Submitted to provider**, `failed` as **Failed**, and missing entry as **Not submitted**.
- Include a persistent limitation banner: the current ledger cannot distinguish immediate acceptance from scheduled acceptance and cannot confirm public visibility. It stores only `posted` and `failed` (Spoolcast `src/state.ts`; Publishing Flow §6).
- Do not infer Published/Live, scheduled time, provider URL, or visibility from a ledger timestamp unless the authoritative source explicitly supplies and defines it.

### 6.5 Overview

Cards may summarize:
- Account aliases by platform (only if read path is approved).
- Queue item counts and discovery warnings (only if Spoolcast supplies them).
- Recent per-target submissions/failures (only from source data).
- Integration health, source freshness, and Auto-Run status (Auto-Run card only after Part B is approved and available).

Each card links to its read-only detail view. Show unavailable, stale, and zero states distinctly. Never fabricate a count or infer provider visibility from `posted`.

### 6.6 Settings

- Appearance: System / Light / Dark, matching the current application shell.
- Default timezone: a presentation preference only; Create Content still requires explicit timezone confirmation for each scheduled submission.
- Read-only diagnostics: QFAT/Spoolcast reachability, last successful read, source freshness, and safe version/status metadata where available.
- No token editing, OAuth management, queue path mutation, provider policy override, scheduler configuration, or credential administration in Part A.
- Do not expose local filesystem paths or secrets in browser diagnostics.

## 7. UX for provider-accepted scheduled posts

- Show **Scheduled** only after a provider-accepted scheduled request is explicitly known.
- Explain that the provider controls publication at the accepted future time; QFAT/Spoolcast need not remain running.
- Do not claim that QFAT monitors publication or verifies visibility unless a separately approved provider read/verification capability exists.
- No cancel, edit, or reschedule controls are specified or authorized.
- No per-target retry control is specified or authorized.
- Existing `posted` ledger state alone maps to **Submitted to provider**, not Scheduled or Published/Live.
- A later provider-confirmed visibility signal may support Published/Live only if its source, freshness, and semantics are defined and approved.

# PART B — AUTO-RUN SCHEDULER (PROPOSED; NOT AUTHORIZED)

> **Proposal status:** This capability is proposed for **Spoolcast Core only**. It is not a QFAT-owned scheduler, daemon, queue, job orchestrator, or publishing backend. No implementation may begin until the Owner approves the architecture and the required separate bounded task. All items below are proposed requirements, not statements of current capability.

## 8. Definition and user stories

**Auto-Run decides WHEN SPOOLCAST SUBMITS a queue item to a provider.** A provider's accepted `publishAt` / scheduled-publication request still decides when the content becomes public. Auto-Run is not provider-side scheduling and does not guarantee public visibility.

- **US-1 — Automatic queue processing:** As the Owner, I want Spoolcast to inspect eligible queue items on a controlled cadence and submit those due for processing, so manual CLI runs are not required for every item.
- **US-2 — Hold until eligible:** As the Owner, I want items outside a provider's accepted scheduling window to remain Held until they enter the eligible window, so an early submission attempt does not fail unnecessarily.
- **US-3 — Operational control:** As the Owner, I want to pause, resume, or request one immediate run, so I can control unattended processing without editing queue files.
- **US-4 — Run visibility:** As the Owner, I want to see current and previous run outcomes, held reasons, and missed ticks, so automation is observable and diagnosable.
- **US-5 — Safety:** As the Owner, I want Auto-Run disabled by default, previewed offline before first enable, single-instance protected, and free of automatic retries by default, so enabling it cannot silently create duplicate or unintended submissions.

## 9. Proposed requirements

### 9.1 Spoolcast Core runner — FR-SC-01 through FR-SC-12

| ID | Proposed requirement |
|---|---|
| FR-SC-01 | Provide a runner entry point that supports either a long-running process or a single-tick invocation suitable for an OS timer. The exact mode and supported interface are an OPEN OWNER DECISION. |
| FR-SC-02 | Enforce a single active runner instance with a lock. Define lock ownership, process identity, timeout, and safe stale-lock recovery; never remove a lock solely because it appears old while its owner may still be active. |
| FR-SC-03 | Reuse existing Spoolcast discovery, manifest validation, target iteration, adapter, and ledger run logic unchanged wherever possible. The runner must not fork a parallel upload engine. Any required change to current run logic or manifest semantics is a separate approval gate. |
| FR-SC-04 | Provide an offline plan mode that reports the next actions, target eligibility, Held reasons, and proposed submission times without loading tokens or making network/provider calls. Preserve the existing `--dry-run` fully offline invariant. |
| FR-SC-05 | Support **Held-until-eligible** as a proposed new capability. An item outside the Facebook 10-minute–6-month window is retained as Held and reconsidered on later ticks; it is not marked Failed or submitted early. This is a new behavior and conflicts with the current manifest validation/skip behavior unless separately designed. **OPEN OWNER DECISION.** |
| FR-SC-06 | Persist pause/resume state in Spoolcast-owned storage. A paused runner performs no provider submissions; resuming does not rewrite queue items or reset the ledger. Persistence location/format is not selected. |
| FR-SC-07 | Define missed-run policy. Proposed default: after downtime, catch up once on the next tick for each currently eligible item; do not replay every missed tick. Items still outside the provider window remain Held. This default requires Owner approval. |
| FR-SC-08 | Maintain a run log with start/end time, tick identity, outcome counts, held reasons, and redacted errors. Never store provider secrets, token fragments, raw credential payloads, or sensitive process arguments. |
| FR-SC-09 | Failure handling defaults to **NO automatic retry**. A failed target remains governed by existing per-target idempotency and is not retried by a new hidden retry loop. Manual re-run semantics and any retry policy require separate approval. |
| FR-SC-10 | Enforce a configurable per-tick upload/submission cap and avoid unbounded bursts after downtime. Define how the cap interacts with multiple targets and queue order. Account for provider quota awareness; the YouTube quota impact and exact accounting are assumptions to verify against current provider policy before implementation. |
| FR-SC-11 | Support graceful shutdown: stop starting new target attempts, allow or safely report in-flight operations according to an approved policy, and never mark an incomplete/failed operation as posted. |
| FR-SC-12 | Design and verify Linux-first operation, including process lifecycle, filesystem permissions, lock semantics, Spoolcast home selection, and operator recovery. Windows is not in the active credential workstream and is not implied. |

### 9.2 State and persistence constraints

- All runner configuration, pause state, lock metadata, and run history belong to Spoolcast Core, not QFAT.
- Do not place provider secrets in runner state or logs. Token reads remain inside Spoolcast's existing trusted token boundary.
- Preserve atomic writes for any new persistent state.
- Do not alter the existing `queue/state.json` schema (`posted` / `failed`) under this proposal.
- New persistence is a material new subsystem and an explicit Owner approval gate. Its storage location, lifecycle, backup, recovery, retention, and corruption handling are all OPEN OWNER DECISION until settled.
- The runner must not rename, move, delete, or rewrite queue media/metadata as a side effect of holding, pausing, or processing.
- The immutable video-stem ledger key and exact raw-target idempotency key remain unchanged.
- Offline plan mode must not load tokens or make network calls. The current `--dry-run` behavior remains the baseline invariant.

### 9.3 QFAT presentation — FR-UI-20 through FR-UI-25

These are presentation/request requirements only. They require a separately approved Spoolcast-owned read/request boundary and owner-only access control; the browser must not implement runner logic.

| ID | Proposed requirement |
|---|---|
| FR-UI-20 | Show an Auto-Run status card with enabled/disabled, paused/running, last run, next planned tick (if defined), and source freshness. Distinguish unknown/unreachable from stopped. |
| FR-UI-21 | Enable, Pause, Resume, and Run now controls submit requests to Spoolcast. They do not start a browser timer, create QFAT jobs, or directly invoke provider APIs. Each action shows pending/accepted/rejected result from Spoolcast. |
| FR-UI-22 | Show run history from Spoolcast-owned records, including per-tick summary, held count/reasons, failure count, missed-run indication, and timestamps. Redact secrets. |
| FR-UI-23 | Show Queue states (Queued, Held, Running, Paused, Missed run) as runner states separately from provider states and ledger states. Do not overwrite the provider/ledger status label with a runner status. |
| FR-UI-24 | If Spoolcast is unreachable or data is stale, show last successful read and stale/unavailable status; do not infer Disabled, Empty, or successful operation. Disable state-changing controls while the authoritative runner state cannot be confirmed. |
| FR-UI-25 | Provide settings presentation for cadence, per-tick cap, and missed-run policy only if Spoolcast exposes validated authoritative settings. QFAT cannot invent defaults or write local scheduler configuration. |

### 9.4 Auto-Run vocabulary — separate from provider status

| Runner state | Meaning | Must not be confused with |
|---|---|---|
| Queued | Discovered by Spoolcast and awaiting a future runner decision | Provider accepted / Scheduled |
| Held | Deliberately not submitted because a known eligibility condition is not yet met | Failed, Published, or provider Scheduled |
| Running | A Spoolcast runner tick is active for the item/target | Uploading unless actual adapter progress confirms upload |
| Paused | Auto-Run is administratively paused | Provider-side scheduled post paused |
| Missed run | A planned tick did not occur within its defined tolerance | Failed provider attempt or missed provider publishAt |

These labels describe proposed runner workflow only. Provider status remains governed by §5.1. Existing ledger states remain `posted` / `failed`.

### 9.5 Guardrails

- Disabled by default. Installation or upgrade must never enable Auto-Run implicitly.
- First enable requires an offline dry-run preview showing the planned queue/target actions, eligibility decisions, and per-tick cap.
- Provide an operator kill switch in Spoolcast Core that stops future submissions without mutating queue files or ledger history.
- Locking and stale-lock recovery must be safe against concurrent process starts and process crashes.
- No automatic retry by default; no retry storm after downtime.
- A run must not submit an item outside a provider's current eligibility window.
- A provider failure for one target must not suppress attempts for independent targets where the existing run contract permits continuation.
- Logs and QFAT diagnostics must be secret-free.
- Verification must be local-only and offline for plan/lock/state tests. No live provider calls or uploads are allowed for this proposal's verification.
- QFAT controls remain disabled until Part B is separately approved and a secure Spoolcast request/read boundary is implemented.

## 10. Architecture options and recommendation

| Option | Description | Benefits | Risks / constraints | Disposition |
|---|---|---|---|---|
| 0. Status quo + operator guidance | Keep manual one-shot Spoolcast CLI; document safe OS timer examples only if separately approved | No new persistence or runner subsystem; lowest risk | No first-class Held/pause/run history; operator maintains external scheduling | Valid fallback; no new product capability |
| 1. Spoolcast Core runner | Add a runner within Spoolcast that reuses current run logic, owns lock/pause/run records, and supports offline planning | Single authority; keeps provider/queue/ledger ownership in Spoolcast; supports Held and observability | New persistence and process lifecycle; current manifest behavior does not implement Held; requires owner decisions | **Recommended proposal**, subject to approval and bounded design/implementation tasks |
| 2. OS timer templates | Provide examples/templates that invoke a single-tick Spoolcast command through systemd timer/cron or equivalent | OS owns cadence/restart; runner can remain short-lived | Still needs single-tick semantics, locking, Held logic, persistent pause/run state, and secure config; OS-specific operations | Candidate deployment form; Option 1 should be designed to degrade to Option 2 |
| 3. QFAT-owned scheduler | Browser/server timer or QFAT daemon scans queue and submits provider work | Superficially close to UI | Violates product identity and scope control; creates parallel scheduler/job ownership and split-brain state | **Explicitly rejected; out of scope** |

**Recommendation:** Option 1, designed so its core work can run as a single tick under Option 2. This recommendation is not Owner approval. Until decisions and separate tasks exist, Option 0 remains the only current behavior.

## 11. Risks and assumptions

| ID | Risk / assumption | Consequence | Required treatment |
|---|---|---|---|
| R1 | Overlapping runner processes or ticks | Duplicate attempts, races, or inconsistent reporting | Single-instance lock, safe recovery, concurrency tests; exact lock model is OPEN |
| R2 | Unintended uploads after enable or downtime | Content may be submitted without current operator intent | Disabled by default, preview, explicit enable, per-tick cap, kill switch, catch-up policy approval |
| R3 | Provider quota exhaustion or throttling | Partial failures or delayed processing | Verify current YouTube quota cost and Facebook rate constraints; quota assumptions are not source-verified by this PRD |
| R4 | Token expiry/revocation | A tick can fail even when an item is otherwise eligible | Reuse Spoolcast token authority; report redacted failure; no automatic reauth or retry assumption |
| R5 | Host asleep, offline, or process stopped | Planned tick is missed; queue processing delayed | Explicit missed-run policy; no claim of exact-time execution |
| R6 | LAN/Tailscale exposure | Remote browser could request publishing without owner proof | D-024-01 leaves enforceable owner-only access OPEN; no publish/control route until resolved |
| R7 | Spoolcast home ownership/path | Runner may read wrong queue/tokens or fail to locate trusted files | D-024-02 settles token authority but not deployment/configuration or OS access to Spoolcast home; OPEN |
| R8 | UI truthfulness and stale state | User mistakes a stale/unknown state for current runner/provider state | Source freshness, unavailable states, separate runner/provider/ledger vocabularies |
| R9 | Immediate-mode manifest gap | Publish Now may still hit required `publishAt` and Facebook schedule-window validation | Separate source-grounded resolution; no dummy timestamp workaround |
| R10 | Held logic changes manifest behavior | Current validation may reject out-of-window Facebook entries rather than persist a Held state | New capability conflicts with current behavior; requires Owner decision and bounded design before implementation |

Assumptions explicitly not verified: YouTube quota consumption per target/request under the current provider policy; provider rule metadata availability through Spoolcast; the exact cadence/precision and runner deployment model; and the persistence/read contract required for QFAT presentation.

## 12. OPEN OWNER DECISIONS

Every unresolved item below is an OPEN OWNER DECISION. Defaults are conservative recommendations only and do not become active requirements without approval.

| ID | OPEN OWNER DECISION | Why it matters | Default if undecided |
|---|---|---|---|
| OD-1 | Should Auto-Run be added to Spoolcast Core, and which runner model is authorized? | Creates a new runtime capability, lifecycle, and operator surface. | Keep status quo (manual one-shot CLI); no Auto-Run implementation. |
| OD-2 | What is the intended Held-until-eligible behavior, including whether current manifest validation/skip semantics may change? | Current manifest rejects Facebook schedule times outside the accepted window; Held requires new durable semantics and re-evaluation. | Do not implement Held; retain current validation behavior. |
| OD-3 | What retry policy, if any, is allowed for failed targets and missed ticks? | Retries can duplicate external effects or create bursts; existing per-target ledger already governs current reruns. | No automatic retry. |
| OD-4 | What durable status/run model is allowed while preserving `queue/state.json` schema? | QFAT needs truthful Queued/Held/Running/Paused/Missed run and accepted-vs-live distinctions. | No schema change; no new durable state until approved. |
| OD-5 | Where and how may runner lock, pause state, configuration, and run history persist? | Requires new storage, atomicity, recovery, retention, permissions, and backup policy. | No new persistence; keep runner unimplemented. |
| OD-6 | What is the approved read/request path for rules, queue, accounts, history, and Auto-Run state? | QFAT needs authoritative data without owning secrets, queue, or runner state. | Keep provider-touching and operational controls disabled; no fake/local data source. |
| OD-7 | Who owns cancel, edit, reschedule, and per-target retry of accepted/failed work? | These actions can conflict with provider state and existing idempotency semantics. | No such controls or capability. |
| OD-8 | What enforceable owner-only access control is required for LAN/Tailscale clients? | D-024-01 defines one Owner but current Origin/Host/session/CSRF does not authenticate that Owner. | No remote publishing or Auto-Run control exposure until an approved enforceable control exists. |
| OD-9 | Who owns Spoolcast-home configuration and least-privilege OS access for QFAT/runner processes? | D-024-02 assigns token authority to Spoolcast but does not settle home path, process identity, or deployment ownership. | Keep runtime integration/runner blocked; use only the existing explicitly configured Spoolcast environment. |

## 13. Phasing and approval gates

| Phase | Scope | Entry criteria | Exit criteria / gate |
|---|---|---|---|
| P0 — Owner decisions | Resolve OD-1–OD-9 as applicable; define which Part A read/publish surfaces are authorized | Owner review of this proposal | Decisions recorded in scope control/approved addendum; separate task specs created where needed |
| P1 — UI foundation | Implement only frontend shell/foundation work in `apps/web/**`: navigation shell, reusable layout/components, responsive/accessibility primitives, empty/loading/error/unknown presentation patterns, and explicitly labeled local fixtures. Screen shells may illustrate the proposed IA, but must not implement real Accounts/Queue/History/operational data access or imply those capabilities are approved. No runtime, API, bridge, provider, or persistence integration. | This PRD reviewed; a separate P1 task explicitly authorizes exact frontend paths; fixtures are visibly non-live and cannot be mistaken for current operational state | UI foundation tests/manual a11y; all operational data surfaces remain fixture-only; no provider-touching controls enabled; no real data or runtime behavior |
| P2 — Read path | Add only separately approved safe read access for accounts/queue/history/rules | Owner approves read contract, access control, Spoolcast-home ownership, data freshness/redaction, and bounded task | Read-only data is source-authoritative, secret-free, stale-aware, and tested locally |
| P3 — Publish path | Add the minimum approved Spoolcast invocation boundary for Publish Now + Schedule | Owner resolves owner-only access, media handoff, invocation/process lifecycle, immediate manifest gap, shared-time contract, progress/result transport, and status semantics | Independent target outcomes and truthful statuses verified without live calls except separately authorized tests |
| P4 — Auto-Run | Add approved Spoolcast Core runner and QFAT presentation/request controls | OD-1–OD-6, OD-8–OD-9 resolved; runner architecture, Held semantics, persistence, lock/recovery, missed-run and retry policy approved; separate bounded task | Offline plan, lock/state/ledger integrity and local operational checks pass; no live provider calls in verification |

**Only the narrowly defined P1 frontend foundation can start without further Owner decisions**, and only through a new task with exact allowed paths and fixture-only constraints. P1 does not authorize building complete operational Accounts/Queue/History features, connecting real data, adding diagnostics backed by Spoolcast, or representing operational states as live. P1 cannot enable provider actions or imply that P2/P3/P4 exist. P0 is the decision phase, not an implementation authorization.

## 14. Verification approach

All verification is local-only. No hosted CI, live OAuth, live provider API calls, or uploads are part of this proposal.

### Part A verification (when separately tasked)

- Inspect UI at desktop and 360 px mobile widths.
- Run the repository's applicable local frontend typecheck/build commands only if the bounded task changes code and requires them.
- Manually test keyboard-only navigation, visible focus, form labeling, validation/error focus, screen-reader announcements, status text independent of color, and reduced-motion behavior.
- Use typed fixtures only in P1; fixture content must be visibly marked as sample/demo and cannot resemble live provider success.
- Static check: a **Published/Live** UI state must be unreachable unless the typed input includes an explicit provider-confirmed visibility signal. A ledger `posted` value must map only to Submitted to provider.
- Verify disabled provider-touching controls expose an accessible explanation.

### Part B verification (only after separate approval)

- Offline plan mode: prove no token load, DNS/network access, or provider call occurs.
- Lock contention: concurrent runner starts result in at most one active runner; stale-lock recovery cannot steal a live process lock.
- Held eligibility: items outside Facebook's accepted window remain Held and are not uploaded; they become eligible only after authoritative Spoolcast rule evaluation.
- Ledger integrity: immutable video-stem key and exact raw-target idempotency remain unchanged; atomic writes survive interruption; failed never becomes posted.
- Pause/resume, missed-run policy, per-tick cap, graceful shutdown, and redacted run logs tested with local fixtures.
- No live uploads, OAuth, or provider calls in verification.

No checks are claimed as executed by this proposal.

## 15. Proposed first bounded task template — P1

The following is a template for a future task, not a work order. It must be completed and approved before P1 starts.

| Required task specification field (scope control §Required task specification) | Proposed P1 value |
|---|---|
| Goal / user outcome | Establish only the frontend shell, reusable UI foundation, responsive/accessibility primitives, and fixture-only screen shells for the proposed information architecture. No operational data feature or live integration is included. |
| Repository / target branch | `irfannuralam44-max/qfat`, `main` unless the Owner's task says otherwise. |
| Exact allowed paths | `apps/web/**` only, further narrowed by the task to the actual frontend files required. |
| Forbidden paths / work | `src/**`, `apps/server/**`, tests outside approved frontend test paths, package/dependency/config/schema/credential changes, APIs/bridges, OAuth/provider calls, persistence, queue/scheduler/job logic, Figma, hosted CI, and any runtime integration. |
| Source-of-truth docs / verified baseline | `AGENTS.md`, `CLAUDE.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`, QFAT-PRD-001, this QFAT-PRD-002, Publishing and Scheduling Flow, and inspected current `apps/web/src/App.tsx`/screen components. |
| Observable acceptance criteria | Navigation reuses existing labels/order; shell/layout primitives and empty/loading/error/unknown patterns are implemented; any route-specific content uses typed fixtures visibly marked non-live; Accounts/Queue/History/Overview/diagnostics do not read or imply real operational data; no provider control is enabled; WCAG 2.2 AA keyboard/screen-reader/reduced-motion and 360 px checks documented; Published/Live requires explicit provider-confirmed fixture input. |
| Local verification evidence / commands | Exact local frontend typecheck/build command from current package scripts; manual responsive and accessibility checklist; static check for Published/Live source; `git diff --name-status` limited to allowed paths. Record commands/results, do not claim unrun checks. |
| Security / data / network / API / credential permissions | No secrets, tokens, credentials, filesystem queue access, network/provider calls, OAuth, upload, API/bridge, or hosted CI. Use local typed fixtures only. |
| Explicit Not in Scope | P2 read path; P3 publishing; P4 Auto-Run; QFAT server changes; Spoolcast changes; persistence; queue/ledger mutation; provider-specific capability additions; Facebook image/album; per-target times. |
| Dependencies / OPEN OWNER DECISIONS | No new owner decisions needed for fixture-only presentation; any request for real data, runtime integration, or enabled controls stops and records OPEN OWNER DECISION. |
| Stop rule / report / handoff | Stop if any requirement needs runtime/data/security authority; report exact paths, acceptance evidence, local checks, findings, commit and remote publication; hand off “ready for GPT/Owner audit,” not accepted. |

## 16. Glossary

| Term | Definition |
|---|---|
| Target | One explicit platform/account destination, represented by its raw target string such as `youtube:alias` or `facebook:alias`. Per-target idempotency uses the exact raw string. |
| Provider-side scheduling | Spoolcast submits a future publication request; after acceptance, the provider controls when the post becomes public. No local QFAT/Spoolcast timer is required at that publish time. |
| Auto-Run | Proposed Spoolcast Core capability that decides when Spoolcast submits queue items to providers. It does not decide provider public-visibility time. |
| Held | Proposed runner state for an item not yet submitted because a provider eligibility condition is not currently satisfied. Not a ledger state, failure, or provider-scheduled post. |
| Ledger | Existing Spoolcast per-video-stem record in `queue/state.json`, with per-target `posted` / `failed` outcomes. It is not a public-visibility monitor or a new QFAT-owned source of truth. |

---

## Proposal status and authorization

QFAT-PRD-002 is **PROPOSED — pending Owner approval**. Part A proposes UI/UX direction but does not approve operational read surfaces or their data access; Part B proposes Auto-Run in Spoolcast Core only. Neither section authorizes implementation. Only the narrowly defined, fixture-only P1 frontend foundation may proceed without further Owner decisions, and only after a separate bounded task is issued. Real operational read data remains gated by P2; publishing and Auto-Run remain gated by P3/P4 and the decisions and approvals above.
