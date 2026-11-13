# QFAT-021 — Spoolcast Frontend Scope Alignment Report

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-021-spoolcast-frontend-scope-alignment.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Base HEAD inspected:** `f8c5f9584e4e7baa70231446fe60a38e222c024c`
- **Final documentation-change commit:** `e813ecac8a066b48985ebee04bfb38cf3747cdd4`
- **Report commit:** Pending publication
- **Commit message for final documentation change:** `docs(QFAT-021): mark historical task scope`

## 1. Scope and outcome

Completed the QFAT-021 documentation alignment. Current product direction is now explicit and consistent: **QFAT is the frontend/UI for Spoolcast; Spoolcast remains the application and publishing core.** The documents no longer authorize QFAT as a parallel publishing product/backend.

No application source, tests, package/dependency files, database schema/migrations, credentials, media, build configuration, or runtime behavior were changed.

## 2. Repository baseline and inspection

- Confirmed repository: `irfannuralam44-max/qfat`.
- Confirmed target/default branch: `main`.
- Inspected branch HEAD before changes: `f8c5f9584e4e7baa70231446fe60a38e222c024c`.
- This HEAD was newer than the task's stated historical base commit. Work was based on the actual current main HEAD; no branch was created or switched.
- Inspected `AGENTS.md`, `CLAUDE.md`, workflow, PRD, architecture, ADR-006, `UPSTREAM.md`, relevant Spoolcast source, QFAT server/web source paths, tasks QFAT-008 through QFAT-020, and their available reports.
- No existing scope-control document was present in the inspected repository tree; created `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`.

### Source-grounded facts

- Spoolcast source contains YouTube and Facebook authorization, YouTube upload, Facebook long-form upload, Facebook Reels upload, CLI queue/manifest discovery, per-target state ledger, and schedule handling.
- QFAT-015 adapted existing YouTube, Facebook video, and Reels upload functions for explicit caller input, immediate-publish invocation, progress callbacks, structured results, and bounded-memory Reels streaming. This is reuse/adaptation of Spoolcast—not a separate engine.
- Current `apps/server/src/index.ts` registers health, browser-security, and media routes; it does not register Spoolcast OAuth/upload operations or publishing-job orchestration.
- QFAT web source includes the existing shell, Create Content editors, media selector, and Media Library.
- Facebook single-image publishing was not found in the inspected Spoolcast upload source or QFAT-015 boundary. Existing UI selection does not establish a publishing capability.
- Spoolcast has scheduled-publishing semantics. Earlier QFAT immediate-only product wording was therefore removed as a blanket restriction; whether QFAT exposes scheduling remains an OPEN OWNER DECISION.

## 3. Documents changed

| Path | Purpose |
|---|---|
| `docs/PRD-QFAT-MVP.md` | Rewritten around QFAT frontend responsibilities, verified Spoolcast capabilities, feature gaps, non-goals, and open owner decisions |
| `docs/ARCHITECTURE-QFAT-MVP.md` | Rewritten as a responsibility/topology model without selecting an unapproved bridge runtime or backend |
| `docs/decisions/ADR-006-spoolcast-reuse-first-mvp.md` | Corrected decision; explicitly supersedes older QFAT-as-standalone-backend framing while preserving historical context |
| `AGENTS.md` | Replaced conflicting product guidance with Spoolcast frontend boundary, stop-and-ask rule, and preserved workflow/security gates |
| `CLAUDE.md` | Added explicit QFAT product overlay; labels remaining CLI guidance as Spoolcast-core reference only |
| `docs/AI-DEVELOPMENT-WORKFLOW.md` | Added mandatory product-scope gate and stop rule while preserving the universal execution/publication workflow |
| `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md` | New scope authority, work classification, owner approval gates, task specification requirements, stop rule, and documentation-only integrity rule |
| `tasks/QFAT-009-create-content-metadata-editors.md` | Historical/reusable UI note; immediate-only assumption superseded |
| `tasks/QFAT-010-media-selection-local-validation.md` | Historical/reusable UI note; does not authorize a media backend or publishing capability |
| `tasks/QFAT-012-web-frontend.md` | Marks vertical media-intake/backend scope as historical, not a standing product mandate |
| `tasks/QFAT-013-encrypted-local-credential-storage.md` | Marks credential ownership as requiring reassessment; no new credential owner/migration authorized |
| `tasks/QFAT-013W-windows-credential-storage.md` | Explicit held/unauthorized note |
| `tasks/QFAT-014-linux-github-actions-ci.md` | Explicit held note under the current no-hosted-CI decision |
| `tasks/QFAT-015-spoolcast-upload-service-boundary.md` | Clarifies existing Spoolcast callable adaptations are reusable core work, not authorization for QFAT publishing backend/orchestration |

Historical report contents were not rewritten. No task was deleted and no follow-on implementation task was created.

## 4. Existing task backlog classification

| Task(s) | Classification | Reason / current relationship |
|---|---|---|
| QFAT-008 | Historical/completed evidence; keep UI foundation | Existing app shell/theme/frontend work remains reusable UI foundation |
| QFAT-009 | Historical/completed evidence; reusable UI | Editor components remain useful; immediate-only assumption is superseded |
| QFAT-010 | Historical/completed evidence; reusable UI | Browser selection/validation remains frontend work; no backend/publishing authorization |
| QFAT-011 | Historical implementation evidence; acceptance caveat remains | Report records automated verification pass but physical LAN/Tailscale validation pending; security work may be reused only if required by an approved bridge |
| QFAT-012 | Historical/completed evidence; backend scope superseded | Media intake/library exists but is conditional, not an assumed QFAT product subsystem |
| QFAT-013, QFAT-013R, QFAT-013R2 | Historical credential implementation/hardening evidence | Existing key-file provider remains current implementation; this does not establish QFAT as permanent OAuth/token owner |
| QFAT-013L, QFAT-013L2, QFAT-013L3A | Historical evaluation evidence | Secret Service exploration does not authorize production adoption |
| QFAT-013W | Held/unauthorized | Windows remains deferred under the explicit Linux-first gate |
| QFAT-014 | Held/superseded | Hosted CI task conflicts with current no-GitHub-Actions/hosted-CI decision |
| QFAT-015 | Historical/completed Spoolcast adaptation; keep/reuse | Existing callable upload adaptations belong to Spoolcast core; no parallel QFAT publishing backend is authorized |
| QFAT-016 through QFAT-019 | Deferred/owner decision required | Secret Service validation/design artifacts only; no production backend authorized |
| QFAT-020 | Current documentation decision/evidence | Confirms no approved Secret Service backend and retains current key-file provider; does not authorize implementation |

This classification preserves the history and does not invalidate prior work or commits. The seven concise task notes above were added only where an old task could reasonably be mistaken as current authorization.

## 5. OPEN OWNER DECISIONS retained

1. Which existing Spoolcast operations and user journeys should the first QFAT frontend release expose?
2. Should QFAT expose Spoolcast scheduling, and which controls/constraints should the UI present?
3. What is the smallest acceptable local browser-to-Node invocation boundary and process lifecycle?
4. Should QFAT retain its current media library, or hand selected files to Spoolcast's existing input/queue model?
5. Which existing QFAT SQLite/media/credential records remain necessary after the frontend direction is applied?
6. How should account UI invoke Spoolcast's existing OAuth flows without duplicating OAuth/token ownership?
7. Is Facebook single-image publishing required despite no verified existing Spoolcast capability?
8. Which status/progress/history views can be truthfully presented without a parallel job engine?

No new product/runtime decision was made to resolve these questions.

## 6. Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 Current main HEAD and required documents/tasks/reports/source inspected | PASS | HEAD recorded above; repository tree/source/task/report inspection completed |
| AC-02 PRD defines QFAT as Spoolcast frontend, not parallel backend | PASS | Rewritten PRD §§1–3, 6 |
| AC-03 PRD separates verified core capabilities, UI role, and gaps | PASS | PRD §§2, 4, 7 |
| AC-04 Architecture describes minimum boundary without inventing runtime design | PASS | Architecture §§1–5; process choice left OPEN OWNER DECISION |
| AC-05 ADR-006 records corrected direction and supersedes old framing | PASS | Updated title, decision, historical context, consequences |
| AC-06 Agent/workflow documents contain no current authorization for full QFAT publishing backend | PASS | Updated AGENTS, CLAUDE overlay, workflow scope gate |
| AC-07 Scope-control document and approval/stop rules exist | PASS | New `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md` |
| AC-08 Relevant old tasks classified without deleting/re-writing historical reports or creating implementation authorization | PASS | Backlog table; minimal notes in seven directly relevant task documents |
| AC-09 No source/runtime/dependency/configuration changes | PASS | Remote compare lists only Markdown documentation/task paths |
| AC-10 Markdown links/referenced paths checked where practical | PASS WITH FINDINGS | Relative-link scan run on seven revised core docs against current repository tree. Three architecture links initially appeared unresolved because the simple checker did not normalize `.`/`..`; their normalized target paths exist. Local `git diff --check` and local working-tree status were not executable through the available GitHub-only repository interface; remote commit diff/path list was inspected instead. |
| AC-11 Report committed/pushed and remote verified | PASS | Report commit `578a19c74f2934ff3bf4deb415325a78ff01d8f6` is visible on `main`; report path fetched successfully from remote |

## 7. Verification evidence and limitations

- Repository tree inspection: PASS; verified the scope-control document did not previously exist and reviewed source/task/report path inventory.
- GitHub compare from base HEAD `f8c5f9584e4e7baa70231446fe60a38e222c024c` to documentation HEAD `e813ecac8a066b48985ebee04bfb38cf3747cdd4`: 14 commits ahead, 0 behind; only the 14 Markdown paths listed above changed.
- Internal relative links: checked across seven revised core documents. The architecture's three relative references resolve after normalizing relative path segments.
- Local `git diff --check`: NOT RUN — no local checkout/shell was available through the connected GitHub repository interface.
- Local `git status --short`, staged-file inspection, and local full-diff review: NOT RUN for the same reason. Remote commit comparison and changed-path inspection were used instead.
- Application build, typecheck, automated tests, and live integrations: NOT RUN — documentation-only task; runtime changes were forbidden.
- No hosted CI was created, enabled, triggered, or used.
- No live OAuth, account authorization, provider API call, or upload was performed.

## 8. Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: e813ecac8a066b48985ebee04bfb38cf3747cdd4
- Follow-up fix commit: N/A
- Report update commit: N/A
- Push verification: PASS

The documentation changes were published as a sequence of 14 fast-forward commits from the inspected HEAD. The commit recorded above is the final scope-note change before report publication; the full changed-path set is captured in the GitHub compare evidence described above.

## 9. Post-publication verification

- On 2026-11-13, re-fetched `main` and confirmed its HEAD was `578a19c74f2934ff3bf4deb415325a78ff01d8f6`.
- Re-fetched `reports/QFAT-021-spoolcast-frontend-scope-alignment-report.md` from `main`; the report is present and readable.
- Compared `e813ecac8a066b48985ebee04bfb38cf3747cdd4` to `578a19c74f2934ff3bf4deb415325a78ff01d8f6`: one report-only commit ahead, zero behind.
- Remote publication verification: PASS. This verifies GitHub source publication only, not hosted CI.

## 10. Handoff

This work is ready for GPT/Owner audit. It is not owner-accepted. No subsequent task or implementation stage has been started.
