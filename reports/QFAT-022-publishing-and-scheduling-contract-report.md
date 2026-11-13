# Implementation Report — QFAT-022

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-022-publishing-and-scheduling-contract.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Commit message:** `docs(QFAT-022): record publishing and scheduling contract`
- **Commit SHA:** `26be2fb895219f1da756052d1bd629eedadb9d2e`

## Scope

Recorded the Owner-approved QFAT MVP publishing/scheduling UX in active product documentation. The contract distinguishes Publish Now from provider-side Schedule, requires one shared timezone-aware publication instant for all selected targets in MVP, requires independent target outcomes, and records per-target timestamps as future direction only.

QFAT remains the frontend; Spoolcast remains the publishing core. No publishing/scheduling feature, OAuth, account management, bridge, API, backend, scheduler, daemon, queue, job engine, or runtime behavior was implemented.

## Implementation

### Approved contract recorded

- **Publish Now:** use the existing Spoolcast adapter's explicit immediate mode in a future separately authorized integration.
- **Schedule:** submit a future schedule request to each selected provider. After acceptance, the provider performs publication; no local QFAT/Spoolcast timer is implied.
- **Shared MVP time:** one user-entered date/time and explicit timezone for the entire selected target set; normalize once to one instant and serialize per provider (YouTube RFC 3339 UTC; Facebook Unix seconds).
- **Independent target outcomes:** one target's failure must not prevent remaining target attempts. Report outcomes per target. Existing CLI is sequential; no concurrency or simultaneous-publication guarantee is claimed.
- **Future direction:** different times per platform/account are later enhancement only, not MVP behavior.
- **Truthful status:** provider acceptance/success is distinct from eventual public visibility; scheduled acceptance is Scheduled, not Published/Live.

### Source-grounded gaps recorded

- `src/manifest.ts` requires and parses `publishAt` even for a potential immediate path. Facebook schedule-window validation (minimum 10 minutes, maximum 6 months) is applied whenever a Facebook target is resolved, without an immediate-mode switch.
- QFAT-015 adapter functions support immediate mode for YouTube, Facebook Page video, and Facebook Reels, but `src/run.ts` does not pass `immediate: true`; the legacy CLI remains scheduled by default.
- `src/run.ts` processes targets sequentially, catches target-local errors, records failure, and continues to later targets.
- `src/state.ts` stores only `posted` and `failed`; successful scheduled submissions are persisted as `posted`. This is not evidence that a post is publicly live.
- The current QFAT server registers health/security/media routes only; Create Content remains preparation UI; Accounts, Queue, and History navigation remain disabled.
- OAuth/account mapping, local invocation boundary/process lifecycle, progress/result transport, durable scheduled status, media handoff, cancellation/retry behavior, and Facebook single-image/album capability remain unresolved or unverified.

These are recorded as **OPEN OWNER DECISION** / capability gaps. No workaround or runtime design was invented. Work stops at the documentation boundary; no QFAT-023 or follow-on task was created.

## Files Changed

Only the Markdown paths authorized by QFAT-022 are present in the final net diff:

| Path | Purpose |
|---|---|
| `AGENTS.md` | Replaced stale scheduling-open statement with approved UX boundary |
| `CLAUDE.md` | Updated QFAT product overlay only; Spoolcast-specific CLI guidance retained |
| `docs/AI-DEVELOPMENT-WORKFLOW.md` | Updated QFAT product-scope gate only; universal workflow retained |
| `docs/PRD-QFAT-MVP.md` | Added approved publishing modes, shared-time contract, per-target outcomes, status semantics, and remaining gaps |
| `docs/ARCHITECTURE-QFAT-MVP.md` | Added logical flow, responsibility mapping, source caveats, and integration gates without selecting runtime topology |
| `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md` | Added bounded UX approval and clarified what it does not authorize |
| `docs/design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md` | New focused design note with journeys, timezone normalization, source evidence, status vocabulary, gaps, and approval gates |
| `reports/QFAT-022-publishing-and-scheduling-contract-report.md` | This report |

No task file, ADR, README, Spoolcast documentation, source, tests, package/dependency files, configuration, database/schema, credential, media, or runtime file is part of the final net diff.

**Git history note:** During the first documentation commit, ADR-006 was inadvertently included in the write set. It was immediately restored byte-for-byte to its pre-task content in a corrective commit. The final compare from the task's synchronized base confirms ADR-006 is not changed in the resulting tree. Both commits are disclosed in Git Publication below; no history was rewritten.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 Safely synchronize main, verify HEAD, and read required task/docs/ADR/QFAT-015/source | PASS | Verified current main HEAD `157ed53729568ae69541482b8a708c3320e78d0b`; read complete QFAT-022 task, AGENTS, workflow, PRD, architecture, scope control, ADR-006, QFAT-015 task/report, README/CLAUDE, and relevant current source |
| AC-02 PRD, architecture, scope control, and instruction overlays consistently record approved decisions | PASS | Updated all seven authorized active-document paths; cross-checked exact old scheduling-open wording absent |
| AC-03 Provider-side scheduled publication distinguished from local scheduler/daemon | PASS | PRD §§3, 7; architecture §§3–4; scope approval; design note §§3, 7 |
| AC-04 One shared intended timestamp in MVP; per-target times future only | PASS | PRD §3; architecture §§3–4; scope approval; design note §4 |
| AC-05 Per-target independent processing without claiming simultaneous API execution | PASS | PRD §3; architecture §4; design note §5; source evidence from sequential `src/run.ts` target loop |
| AC-06 Source caveats re-verified, including immediate-mode manifest validation | PASS | Re-fetched `src/manifest.ts`, three adapter files, `src/run.ts`, `src/state.ts`, server/web source, README and QFAT-015 report at current main |
| AC-07 Focused design note contains journeys, evidence, status semantics, gaps, decisions | PASS | `docs/design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md` §§2–9 |
| AC-08 No runtime/source/test/dependency/configuration/schema changes | PASS | Final remote compare lists only seven authorized Markdown documentation paths before report addition |
| AC-09 Markdown links/references checked where practical | PASS WITH FINDINGS | Static relative-link check against the remote repository tree found zero broken links in the seven changed docs; stale scheduling-open wording scan found zero matches. Local `git diff --check` was NOT RUN because no local checkout/shell is available through the repository connector. |
| AC-10 Report committed/pushed to main and remote verified | Pending report publication | Complete after report commit and remote re-fetch |

## Verification

| Command / Check | Result | Notes |
|---|---|---|
| Re-fetch target branch and verify HEAD | PASS | Main HEAD recorded above before edits |
| Read full QFAT-022 task and required source/docs | PASS | Remote file contents fetched; source evidence inspected read-only |
| Static Markdown relative-link validation | PASS | Normalized relative paths against the recursive remote tree; zero broken links in changed docs |
| Stale scheduling-open wording scan | PASS | No stale “scheduling UI is OPEN OWNER DECISION” wording remains in the seven active documents |
| Trailing-whitespace / final-newline scan | PASS WITH FINDINGS | New/changed documents have final newline; no trailing whitespace except one pre-existing line in the Spoolcast CLI section of CLAUDE.md, outside the modified QFAT overlay |
| `git diff --check` | NOT RUN | No local repository checkout/shell is available via the connected GitHub repository interface |
| `git status --short` / local full diff review | NOT RUN | No local checkout. Remote compare and final changed-path review used instead |
| Final remote compare from synchronized base | PASS | Only authorized Markdown docs in final net diff; details in Git Publication |
| Typecheck/build/tests | NOT RUN | Documentation-only; runtime changes forbidden |
| Live OAuth/provider calls/uploads | NOT RUN | Explicitly forbidden |
| GitHub Actions/hosted CI | NOT RUN | Explicitly forbidden; no workflow created, enabled, or triggered |

## Findings and Limitations

1. **Immediate-mode manifest validation is a real integration gap.** The adapters have immediate request options, but the manifest resolver still requires `publishAt`; Facebook validation also imposes a future scheduling window for a Facebook target even for an intended immediate action. No code-level fix was selected.
2. **The approved UX does not settle runtime integration.** Local invocation boundary/process lifecycle, account/OAuth mapping, progress transport, media handoff, durable result/status semantics, cancellation, retry, and history ownership remain OPEN OWNER DECISION.
3. **Provider acceptance is not public visibility.** Current ledger `posted` cannot be treated as a provider-verified Live state.
4. **Current CLI isolation is sequential.** The source does not demonstrate concurrent target fan-out.
5. **Facebook single-image and album publishing remain unverified** and excluded from the approved publishing MVP.
6. Local `git diff --check` and local working-tree inspection could not be run through the available repository connector. The remote compare and static Markdown checks are not represented as local Git commands.

No runtime changes, workaround, new scheduler/daemon/queue/job engine, bridge/API, QFAT-023, or follow-on task was created.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 26be2fb895219f1da756052d1bd629eedadb9d2e
- Follow-up fix commit: 59e6cd64025a08609329fe724531f39fccfcbfa6
- Report update commit: Pending
- Push verification: Pending

The follow-up commit restores the out-of-scope ADR-006 to its exact pre-task contents; it is not a runtime fix. The final net diff is limited to the seven authorized documentation paths plus this report.

## Handoff

Work is ready for GPT/Owner audit. It is not accepted by GPT or the Owner. Stop here; no subsequent task or implementation stage has been started.
