# QFAT-012 — Web Frontend (Scope Draft)

- **Status:** DRAFT — NEEDS OWNER SCOPE CONFIRMATION; NOT AUTHORIZED FOR IMPLEMENTATION
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main` (proposed; no implementation branch authorized)
- **Task type:** IMPLEMENTATION — proposed, not yet READY
- **Owner:** QFAT project owner
- **Executor:** OpenCode local agent — proposed
- **Mode:** HYBRID (GPT task author/auditor; OpenCode implementation)
- **GPS standard:** `irfannuralam44-max/gps@main`, version 1.2.0
- **Expected report if approved:** `reports/QFAT-012-web-frontend-report.md`

> This document is a scope draft only. It is not an instruction to start implementation. Do not execute until the Owner confirms the scope and the task is promoted to READY / OWNER-AUTHORIZED.

## 1. Objective — proposed

Continue the QFAT MVP web frontend in accordance with the owner-approved PRD, while preserving the frontend work already delivered in QFAT-008, QFAT-009, and QFAT-010.

The historical QFAT-002 architecture validation plan identifies QFAT-012 as “Web Frontend” (`apps/web/`, React/Vite/Tailwind, pages per PRD). That plan predates the later frontend tasks QFAT-008 through QFAT-010 and must not be treated as a complete current implementation brief.

The exact remaining frontend deliverable must be derived from the current source, owner-approved PRD, and recorded owner decisions. Figma is cancelled and is not a required design source or dependency.

## 2. Context and baseline

- Repository: `irfannuralam44-max/qfat`
- Branch: `main`
- Task-draft commit: `0ab65af2372cb6435d7dcc2780b94537025397db`
- GPS: `irfannuralam44-max/gps@main`, version 1.2.0
- Product requirements: `docs/PRD-QFAT-MVP.md`
- Beta access requirements: `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- Architecture proposal: `docs/ARCHITECTURE-QFAT-MVP.md`
- Repository agent instructions: `AGENTS.md`
- Repository workflow: `docs/AI-DEVELOPMENT-WORKFLOW.md`

### Verified existing work

- QFAT-008: design foundations, responsive shell, themes, Overview, and truthful health status.
- QFAT-009: separate YouTube and Facebook metadata editors.
- QFAT-010: browser-local media selection and validation, including Facebook single image.
- QFAT-011: browser session, CSRF, dynamic Origin/Host, and proxy security foundation. Its automated tests are reported as passing.

### QFAT-011 predecessor gate — owner accepted

The Owner explicitly confirmed in this project conversation that the LAN and Tailscale physical tests requested for QFAT-011 have already been performed, and directed the project to proceed to QFAT-012 (“iya masuk ke qfat 12”). Treat QFAT-011 as **OWNER-ACCEPTED** for the project workflow.

The older QFAT-011 reports still say the physical checks were NOT RUN and QFAT-011 was not accepted at the time those reports were written. Those reports are historical snapshots and must not override the later explicit Owner confirmation. Do not ask the Owner to repeat the LAN/Tailscale tests.

Evidence limitation: the exact device/browser observations and test outputs were not restated in the latest confirmation. Record the acceptance as Owner-confirmed in the continuity/decision record; do not invent detailed test results or rewrite historical test tables as if GPT independently witnessed them. If exact test details are needed for a later audit, ask only for those details when materially necessary.

## 3. Facts, decisions, assumptions, and open questions

### Facts

- The PRD is the product requirements source of truth.
- The current frontend already contains meaningful work from QFAT-008, QFAT-009, and QFAT-010.
- The QFAT-002 architecture report's original QFAT-012 label is historical and predates those frontend tasks.
- QFAT-011 automated verification is reported PASS. The Owner separately confirmed the LAN and Tailscale physical checks and accepted QFAT-011; the historical report wording remains a snapshot of its authoring time.
- Current backend capabilities must be established from current source and tests, not inferred from the PRD or architecture proposal.

### Owner decisions already recorded

- QFAT is a local-first web application.
- YouTube and Facebook have separate metadata editors.
- Facebook single-image posts are in MVP; albums are post-MVP.
- Browser access uses the frontend LAN/Tailscale entrypoint; backend remains loopback-only.
- Figma is cancelled for QFAT. Existing QFAT UI/source patterns, the owner-approved PRD, and recorded owner decisions are the design authority. GPT owns routine UI gap analysis and UX decisions within those boundaries.
- QFAT-008, QFAT-009, and QFAT-010 have been implemented in their respective approved scopes.

### Assumptions — NOT APPROVED

- That QFAT-012 should implement the remaining PRD frontend pages rather than another functional slice.
- That all remaining frontend pages can be completed without additional backend APIs.
- That a frontend-only implementation is the best next increment after QFAT-011.

### Open questions requiring Owner confirmation

1. Should QFAT-012 retain the historical “Web Frontend” stage, with its exact remaining scope derived from the current PRD, designs, source, and API inventory?
2. Or does the Owner intend to redefine QFAT-012 as a different next functional increment? Any such change must be explicitly approved and reflected in the task title, scope, and roadmap.
3. CLOSED — QFAT-011 is Owner-accepted. The Owner explicitly confirmed completion of LAN and Tailscale physical checks and directed the project to proceed to QFAT-012. Do not reopen this question or ask for repeat tests.

## 4. Required sources before task finalization

GPT must retrieve the minimum relevant sources from the canonical repositories and verify their current revisions:

### GPS — universal operating standard

- `core/GPT-PROJECT-SOURCE-INDEX.md`
- `core/GPT-AGENTS.md`
- `core/GPT-WORKFLOW.md`
- `core/GPT-CONTEXT-MANAGEMENT.md`
- `core/GPT-TASK-TEMPLATE.md`
- `standards/DOCUMENTATION-STANDARD.md`
- `standards/QUALITY-AND-AUDIT.md`
- `standards/DECISION-MANAGEMENT.md`

### QFAT — project-specific authority

- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `tasks/QFAT-008-design-foundations-app-shell.md` and its report
- `tasks/QFAT-009-create-content-metadata-editors.md` and its report
- `tasks/QFAT-010-media-selection-local-validation.md` and its report
- `tasks/QFAT-011-browser-session-csrf-security.md` and its reports
- Existing frontend source and UI patterns that establish the current visual/interaction baseline.
- Owner-approved PRD and recorded product decisions. No Figma handoff is required; Figma is cancelled.

### Executor access requirement

GPT's ability to read a GitHub file does not prove OpenCode can access it. Before implementation, OpenCode must report the exact repository, branch, task path, and source paths/revisions it actually read. If any essential source is unavailable, use the GPS traceable self-contained task-packet fallback or stop BLOCKED. Do not claim an executor read a source merely because this document links to it.

## 5. Proposed scope boundary — not yet approved

The likely work area is `apps/web/`, but no implementation files are authorized yet.

Potential work may include only frontend behavior explicitly mapped to approved PRD requirements and supported by real backend contracts. The final task must identify exact pages, user flows, API contracts, affected files, and measurable outcomes after a source-based gap analysis.

Do not assume an API exists because a page appears in the PRD. Verify route registration, schemas, and tests in the current backend. Do not fabricate accounts, media, jobs, progress, history, or publishing outcomes.

## 6. Prohibited actions unless a later approved task explicitly permits them

- No backend route, database, migration, media intake, or server behavior changes under a frontend-only scope.
- No OAuth, credentials, live Google/Meta API requests, real uploads, or publishing.
- No fake/demo/sample records or fake operational status.
- No scheduling, Facebook album support, or unrelated product expansion.
- No CI/GitHub Actions, public hosting, router port forwarding, Tailscale-specific integration, PWA claims, Electron, or Tauri.
- No broad dependency upgrades or unrelated refactors.
- Preserve all Spoolcast upstream attribution and existing CLI compatibility.
- Preserve user changes; never reset, clean, stash, overwrite, rebase, amend published commits, or force-push.

## 7. Readiness and approval gate

This draft is **NOT READY** because the remaining frontend scope must still be derived from current source and approved product requirements, then reviewed by the Owner. No Figma handoff is required. The QFAT-011 predecessor gate is considered owner-accepted as recorded in §2; do not block QFAT-012 on the stale historical report wording.

Before implementation can begin, GPT must:

1. Inspect the current frontend source and current backend API inventory.
2. Use the existing QFAT UI/source patterns, approved PRD, and recorded owner decisions to identify the exact remaining screens and flows. GPT resolves routine UI details; escalate only material unresolved product decisions.
3. Map each proposed feature to an approved PRD/design requirement and a real API contract where one is required.
4. Define exact in-scope and out-of-scope behavior; distinguish UI-only flows from API-dependent features.
5. Add measurable acceptance criteria, verification commands/environment, evidence requirements, report path, Git permissions, and stop conditions using GPS `GPT-TASK-TEMPLATE.md`.
6. Review the task for contradictions, missing requirements, unsupported assumptions, and executor source-access gaps.
7. Present the completed task to the Owner for explicit authorization.

Only after those steps may the status be changed to `READY — OWNER AUTHORIZED FOR IMPLEMENTATION`.

## 8. Stop condition

Until the Owner confirms the intended QFAT-012 scope and the predecessor gate is reconciled:

- Do not send this draft to OpenCode as an implementation instruction.
- Do not begin coding, create implementation commits, or start QFAT-013.
- GPT may continue source inspection, task planning, and documentation correction only within the Owner's request.
