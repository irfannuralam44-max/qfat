# QFAT-021 — Align Product Scope and Development Documents to Spoolcast Frontend Direction

- **Task ID:** QFAT-021
- **Status:** GPT-AUTHORED — READY FOR OWNER-AUTHORIZED DOCUMENTATION WORK
- **Task type:** Documentation-only scope and architecture alignment
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Base commit inspected:** `bc52d8f3e248e58569fa3d902fed6c3b9d583127`
- **Expected report:** `reports/QFAT-021-spoolcast-frontend-scope-alignment-report.md`
- **Owner direction:** QFAT's product direction is to provide a frontend for Spoolcast. Spoolcast remains the existing application/publishing core. QFAT must not evolve into a parallel or replacement publishing product/backend.

## 1. Objective

Bring the active product, architecture, agent-instruction, and development-workflow documents into one consistent scope that reflects the owner's corrected direction:

**QFAT is the frontend/UI layer for Spoolcast. It is not a second publishing engine or a separately designed publishing backend.**

Spoolcast remains the owner of its existing publishing behavior and platform integrations. The frontend may require a small local integration/launch boundary because browser code cannot directly execute the Node.js application or safely access local credentials. Such a boundary is permitted only to the extent demonstrably necessary to present and invoke existing Spoolcast capabilities. It must not become an excuse to build a parallel job engine, scheduler, account/token system, media platform, persistence layer, or replacement backend.

The task is to revise documentation and classify existing work—not to implement, remove, or refactor product code.

## 2. Required inspection

Before editing, inspect the current `main` branch and read at minimum:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/decisions/ADR-006-spoolcast-reuse-first-mvp.md`
- `UPSTREAM.md`
- Relevant existing QFAT tasks and reports, especially QFAT-008 through QFAT-015 and QFAT-016 through QFAT-020
- Relevant source directory/package structure only as needed to verify what Spoolcast already owns and what QFAT has added

Record the actual branch HEAD and inspect whether any scope-control document already exists before creating a new one. Do not assume this task's base commit is still HEAD; synchronize safely according to the repository workflow.

## 3. Required deliverables

### A. Rewritten product scope — `docs/PRD-QFAT-MVP.md`

Revise the PRD so it clearly describes a frontend for Spoolcast rather than a standalone local-first publishing product.

It must distinguish:

1. **Spoolcast core responsibilities:** existing platform integrations, OAuth/credential ownership, publishing protocols, CLI/domain behavior, and any existing queue/state semantics that belong to Spoolcast. Verify exact capabilities from source/docs; do not invent capabilities.
2. **QFAT frontend responsibilities:** user-facing screens, interaction, input/validation/presentation, and invoking supported Spoolcast operations.
3. **Minimum integration boundary:** only the smallest local mechanism needed for the browser to communicate with or launch/control Spoolcast. State that this is an enabling boundary, not a new product backend.
4. **Existing QFAT work:** classify as keep, adapt, optional/undecided, or not part of the frontend MVP. Do not imply a feature is accepted merely because code exists.
5. **Feature coverage:** map proposed UI capabilities to existing Spoolcast capability. If a capability is absent or uncertain, mark it as a gap/decision for owner review; do not authorize implementing it in this task.
6. **Explicit non-goals:** replacement publishing engine; parallel account/OAuth/token ownership; new queue/scheduler/orchestration; independent publishing state ledger; generic adapter/plugin framework; backend/database/credential/media subsystems that are not strictly required for the frontend bridge; desktop shell, Rust rewrite, hosted SaaS, unrelated infrastructure, and platform expansion unless later approved.
7. **Feature scope inherited from Spoolcast:** do not blindly preserve prior QFAT-only assumptions such as immediate-only publishing or remove Spoolcast-supported scheduling. Document what the current Spoolcast behavior supports and leave UI exposure as an explicit product decision if it is not already approved.

Do not add a new product feature or change product behavior through documentation without clear existing owner approval.

### B. Rewritten architecture — `docs/ARCHITECTURE-QFAT-MVP.md`

Describe the actual intended topology in simple terms:

- Spoolcast is the core application and publishing authority.
- QFAT is the browser frontend.
- A local bridge/launcher/API is allowed only if source inspection proves it is needed; define its narrow responsibilities and what it must never own.
- Browser code must not receive secrets or directly implement provider protocols.
- Reuse existing Spoolcast entry points/modules; do not invent a new engine or broad abstraction.
- Explain the intended runtime/process relationship without committing to an unverified implementation design.
- Classify existing `apps/server`, SQLite, media library, credential provider, and upload-service boundary as keep/adapt/defer/decision-needed based on evidence. Do not instruct deletion or source changes.
- Include a small responsibility matrix and a minimal interaction flow.
- List architecture decisions that require owner approval separately from settled facts.

The architecture must not silently assume that the existing QFAT backend/database/credential model remains mandatory merely because it has already been implemented.

### C. Correct ADR-006 — `docs/decisions/ADR-006-spoolcast-reuse-first-mvp.md`

Update the title/context/decision/consequences to record the corrected owner direction: frontend for Spoolcast, not QFAT as a parallel publishing application. Clearly supersede conflicting older wording. Preserve historical decision context rather than erasing the fact that earlier work followed a different direction.

### D. Synchronize agent instructions

Update the QFAT-specific portions of:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`

Remove or correct conflicting instructions that currently authorize building a full QFAT publishing backend, independent OAuth/credential management, queue/job orchestration, or other product subsystems as if they were the product goal.

Preserve still-valid universal workflow rules, including:
- GitHub as source of truth.
- GPT-authored task Markdown before agent execution.
- Read/synchronize safely; preserve local work.
- Exact task scope and stop rules.
- Local-only verification; no GitHub Actions/hosted CI.
- Linux-first; Windows deferred unless explicitly reauthorized.
- No live OAuth/account authorization/uploads without explicit approval.
- No secrets in chat, repository, logs, reports, or screenshots.
- Agent report/commit/push/remote verification and concise handoff.
- GPT's independent audit and owner acceptance gate.
- Figma remains cancelled.

Agent instructions must explicitly state: when a task reveals a missing Spoolcast capability or requires a new backend subsystem, stop, document the gap, and ask for owner approval. Do not implement an assumed workaround.

### E. Add one scope-control document

Create `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md` unless an equivalent current document already exists (if so, update that document and record the path in the report).

It must define:
- Product identity and responsibility boundary.
- In-scope / out-of-scope / conditional work.
- Document authority order and how conflicts are resolved.
- Owner approval required for scope changes, new dependencies, new runtime services, new persistence/credential ownership, platform expansion, and architectural changes.
- Required task specification fields: goal, exact allowed paths/areas, forbidden work, acceptance criteria, verification evidence, explicit Not in Scope, and stop rule.
- A mandatory stop-and-ask rule for discovered scope gaps.
- A rule that historical task files/reports are evidence of prior work, not automatic authorization for future work.
- No source changes or feature implementation under a documentation-only task.

### F. Review active task backlog

Inspect task files and classify each relevant QFAT task as:
- Historical/completed evidence,
- Still valid and potentially reusable,
- Superseded by the corrected direction,
- Deferred/owner decision required,
- Cancelled/held.

Do not rewrite historical task/report contents or mark old commits as invalid. Do not delete tasks. Do not create follow-on implementation tasks. Add a concise status/relationship note only where needed to prevent an old task from being mistaken as current authorization; keep this limited to task documents that materially conflict with the new direction. Record the classification in the report.

## 4. Scope boundaries — strict

### Allowed

- Documentation inspection and edits to the deliverables listed above.
- A new scope-control Markdown document.
- Minimal status notes in directly conflicting active task documents, only when necessary to prevent accidental execution under superseded assumptions.
- Read-only source inspection to ground documentation claims.
- Local Markdown/link consistency checks if available without installing dependencies.

### Forbidden

- Any source-code changes under `src/`, `apps/`, or other runtime directories.
- Any feature implementation, refactor, deletion, or migration.
- Changes to `package.json`, lockfiles, dependencies, database schema, credentials, media files, build configuration, or runtime behavior.
- Implementing or selecting a new backend, launcher, API, scheduler, job engine, adapter framework, credential provider, or persistence design.
- Reopening the Secret Service/keyring exploration or Windows work.
- Reintroducing hosted CI/GitHub Actions.
- Live OAuth, account authorization, provider API calls, or uploads.
- Rewriting historical reports or claiming prior work was wasted/invalid.
- Creating QFAT-022 or any subsequent implementation task.

If a required document change would imply a product decision not already made by the owner, record it as **OPEN OWNER DECISION** instead of choosing on the owner's behalf.

## 5. Required acceptance criteria

- [ ] AC-01: Current `main` HEAD and all required source documents/tasks/reports were inspected; report records exact HEAD.
- [ ] AC-02: PRD unambiguously defines QFAT as Spoolcast frontend and does not authorize a replacement/parallel publishing backend.
- [ ] AC-03: PRD separates verified Spoolcast capabilities from QFAT UI responsibilities and unresolved product decisions.
- [ ] AC-04: Architecture describes the minimum frontend-to-Spoolcast boundary without inventing an unapproved runtime design.
- [ ] AC-05: ADR-006 records the corrected direction and explicitly supersedes its older conflicting framing.
- [ ] AC-06: AGENTS.md, CLAUDE.md, and workflow contain no contradictory instruction authorizing the superseded full-QFAT-backend direction.
- [ ] AC-07: Scope-control document exists and defines explicit approval gates and stop rules.
- [ ] AC-08: Relevant old tasks are classified without deleting or rewriting historical evidence and without creating implementation authorization.
- [ ] AC-09: No runtime/source/dependency/configuration changes were made.
- [ ] AC-10: All modified Markdown links and referenced paths were checked where practical; limitations are reported honestly.
- [ ] AC-11: A factual report is committed and pushed to `main`, with full commit SHA and remote verification.

## 6. Verification

Documentation-only verification:
- Inspect `git diff --check`.
- Inspect `git status --short` and the full diff; confirm only permitted Markdown paths changed.
- Check all internal relative links and referenced paths changed by the task.
- Search the revised active documents for conflicting language that describes QFAT as owning a replacement/full publishing backend, independent OAuth/token system, independent scheduler/queue, or new publishing engine.
- No application build, typecheck, test suite, or live integration test is required because runtime code must not change. Mark them NOT RUN — documentation-only task.

Do not install tools or dependencies just to validate Markdown.

## 7. Report requirements

Create `reports/QFAT-021-spoolcast-frontend-scope-alignment-report.md`.

Include:
- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Base HEAD inspected, branch, commit message, full commit SHA.
- Documents reviewed and changed.
- A responsibility-boundary summary.
- Task backlog classification with task IDs and reasons.
- Open owner decisions; do not silently resolve them.
- Acceptance criteria evidence.
- Exact documentation checks and outcomes.
- Explicit confirmation that no source/runtime/dependency changes occurred.
- Git publication details in the repository's required format.
- Handoff statement: ready for GPT/owner audit, not owner-accepted.

## 8. Git and workflow

Follow `AGENTS.md` and `docs/AI-DEVELOPMENT-WORKFLOW.md`. Work on `main` only. Do not create/switch branches, force-push, rewrite history, or overwrite local changes. Synchronize safely before reading this task from the remote branch. Commit only the approved documentation files and report.

Suggested commit message:

`docs(QFAT-021): align product scope to Spoolcast frontend`

After push and remote verification, stop. Do not begin implementation or the next task. Chat handoff must contain only:

- Branch
- Commit message
- Full SHA
- Report path

GPT will independently audit the pushed documentation/report and record any acceptance or corrections separately.
