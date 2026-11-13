# QFAT-023 — Source-Grounded Spoolcast Invocation Boundary Design

- **Task ID:** QFAT-023
- **Status:** OWNER-AUTHORIZED FOR DOCUMENTATION WORK — 2026-11-14
- **Task type:** Read-only technical investigation and documentation-only architecture design
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **GPT-verified baseline HEAD:** `3fd8f4c060bc297acaf9cd2090fab42a2707ccae`
- **Expected design document:** `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md`
- **Expected report:** `reports/QFAT-023-spoolcast-invocation-boundary-design-report.md`
- **Owner authorization:** Continue with a bounded, documentation-only design investigation. This does not authorize runtime implementation or select an architecture.

## 1. Objective

Produce a source-grounded design assessment of the **smallest safe local mechanism** by which the QFAT browser frontend could invoke existing Spoolcast publishing operations while keeping Spoolcast as the publishing core and keeping provider secrets out of browser code.

The deliverable is a decision-support design, not an implementation plan that silently commits the Owner to a runtime topology. Compare viable approaches, identify the minimum responsibilities and trust boundaries, recommend a direction only where source evidence supports it, and explicitly mark decisions that still require Owner approval.

QFAT remains the frontend. Spoolcast remains authoritative for OAuth/provider integrations, upload protocols, publishing behavior, and existing domain behavior. Do not design a parallel publishing backend.

## 2. Required source-of-truth reading

After safely synchronizing `main`, read the complete current versions of:

1. `AGENTS.md`
2. `docs/AI-DEVELOPMENT-WORKFLOW.md`
3. `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`
4. `docs/PRD-QFAT-MVP.md`
5. `docs/ARCHITECTURE-QFAT-MVP.md`
6. `docs/design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md`
7. `CLAUDE.md`
8. `reports/QFAT-015-spoolcast-upload-service-boundary-report.md`
9. `reports/QFAT-021-spoolcast-frontend-scope-alignment-report.md`
10. `reports/QFAT-022-publishing-and-scheduling-contract-report.md`

Re-check all relevant source files and tests on the synchronized HEAD. The baseline below is a navigation aid, not a substitute for inspection.

## 3. Investigation scope

### 3.1 Existing invocation surfaces and process options

Inspect the root Spoolcast package/CLI, module exports, Node/runtime constraints, QFAT server startup/shutdown, server route registration, and frontend-to-server request/security model.

Compare, at minimum, these conceptual options where technically applicable:

- QFAT server importing/calling existing Spoolcast service/adapters in-process;
- QFAT server invoking a bounded one-shot Spoolcast child process;
- a supervised persistent child process or other IPC mechanism.

Do not assume all options are viable. Explain package/module boundary, startup cost, isolation, crash behavior, cancellation semantics, progress transport, local-only network exposure, and operational complexity using current source evidence. Do not select a daemon, desktop shell, new framework, or process supervisor by default.

If the existing CLI is not a safe service entry point, identify the exact mismatch. Do not modify it.

### 3.2 Security and trust boundaries

Describe:
- browser trust boundary and why provider secrets must never enter browser state, responses, logs, or error payloads;
- server-side request authentication/origin/CSRF protections already present and their actual scope;
- local bind/host assumptions and any gaps that must be addressed before a publishing endpoint could be exposed;
- input validation, path/media access constraints, request size limits, timeouts, and process termination concerns;
- secret redaction and safe error classification.

Do not invent protections as if they already exist. Separate verified controls from proposed controls and unresolved security decisions.

### 3.3 Credentials and account mapping

Inspect Spoolcast token/account types and resolution functions, QFAT credential storage/provider interfaces, and QFAT security/session model.

Map the current credential ownership and data shapes. Compare safe integration possibilities without moving, duplicating, migrating, or changing token ownership. Do not expose raw provider tokens to the browser. If no safe approved mapping exists, record **OPEN OWNER DECISION** and specify exactly what owner choice is needed.

### 3.4 Publishing invocation contract

Assess the minimum request/response contract needed for the approved MVP:
- content/media reference and safe server-side resolution;
- selected platform/account target identifiers;
- Publish Now versus Schedule;
- one shared timezone-aware schedule value normalized once to one instant;
- per-target independent outcomes;
- structured success/failure results;
- measured upload progress callbacks;
- provider acceptance versus public visibility semantics.

Do not add queue/job orchestration, retries, cancellation, history, or a new durable publishing ledger. Identify what can be synchronous for one operation and where process/runtime limits make that unsafe; do not invent an asynchronous job system as a workaround.

### 3.5 Existing source capability gaps

Re-verify and assess:
- `readManifest` requiring `publishAt` and Facebook schedule-window validation for immediate flows;
- the legacy CLI not passing QFAT-015's `immediate: true` option;
- QFAT-015 adapter inputs, progress callbacks, result types, and credential inputs;
- current sequential per-target behavior and failure isolation;
- current `posted | failed` state semantics;
- supported media/target combinations, explicitly excluding unverified Facebook single-image and album publishing.

Do not fix these gaps. Identify whether each blocks an invocation design, can be handled by an already-existing callable boundary, or requires a separate owner-approved Spoolcast capability/design decision.

### 3.6 Decision matrix and recommendation

Provide a concise comparison matrix with:
- option;
- source evidence and prerequisites;
- benefits;
- risks/failure modes;
- security implications;
- operational complexity;
- what must change;
- owner approvals required.

Give a recommendation only if it is clearly supported by source evidence and respects the minimum-boundary principle. Otherwise state that the options remain unresolved and identify the smallest additional evidence or owner decision required.

The design must distinguish:
- **verified existing behavior**;
- **proposed design**;
- **assumption requiring validation**;
- **OPEN OWNER DECISION**;
- **out of scope**.

## 4. Exact allowed paths

The only paths that may be created or modified are:

- `tasks/QFAT-023-spoolcast-invocation-boundary-design.md` (this task specification; do not modify after execution begins)
- `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md` (new design document)
- `reports/QFAT-023-spoolcast-invocation-boundary-design-report.md` (new report)

All source, tests, package files, lockfiles, configuration, schemas, migrations, credentials, media, and other documentation are read-only.

## 5. Strict exclusions

- Any runtime/source/test changes under `src/`, `apps/`, or elsewhere.
- Any dependency, package manifest, lockfile, build, configuration, schema, migration, or database change.
- Implementing any route, endpoint, IPC, child process, launcher, service, daemon, worker, queue, scheduler, job engine, or persistence.
- Changing OAuth, token, account, credential, or ownership behavior.
- Implementing or changing upload adapters, CLI behavior, manifest validation, provider protocols, or media handling.
- UI/frontend changes, enabling Publish buttons, account screens, Queue, or History.
- Live OAuth, account authorization, provider API calls, uploads, or external network tests.
- Hosted CI/GitHub Actions.
- Figma work.
- Deleting, migrating, or refactoring existing QFAT subsystems.

The existence of QFAT server, SQLite, media intake, key-file credentials, or QFAT-015 adapter functions is not authorization to reuse or extend them.

## 6. Acceptance criteria

- [ ] AC-01: Safely synchronize the exact target branch `main`; verify remote HEAD and preserve all pre-existing local work.
- [ ] AC-02: Read all required documents in §2 and inspect current source/tests relevant to every design claim.
- [ ] AC-03: Document the existing process/package/server topology accurately, distinguishing fact from proposal.
- [ ] AC-04: Compare viable in-process, one-shot child, and persistent-child/IPC options where applicable; do not force a false comparison where source rules an option out.
- [ ] AC-05: Document browser/server/Spoolcast trust boundaries, local exposure, request validation, process lifecycle, timeout, termination, progress, and error-handling implications.
- [ ] AC-06: Document current credential/account data ownership and safe mapping constraints without changing ownership or exposing secrets.
- [ ] AC-07: Specify a minimal conceptual request/result/progress contract consistent with QFAT-022, without creating a job engine or durable ledger.
- [ ] AC-08: Re-verify immediate manifest, adapter, target-isolation, state semantics, and supported-media caveats against current source.
- [ ] AC-09: Provide a decision matrix, evidence-backed recommendation or explicit unresolved conclusion, and a clear list of Owner decisions required before implementation.
- [ ] AC-10: Preserve all current scope boundaries: QFAT frontend, Spoolcast core, provider-side scheduling, one shared MVP timestamp, independent target outcomes, no local scheduler.
- [ ] AC-11: No source/runtime/test/dependency/configuration/schema changes occurred; only the paths in §4 changed.
- [ ] AC-12: Report includes exact commands/environment/results, source paths inspected, findings, limitations, and Git publication evidence.

## 7. Verification and evidence

This is documentation-only:
- Run `git diff --check`.
- Review `git status --short`, staged paths, and the complete diff.
- Verify only the allowed documentation paths changed.
- Check internal Markdown links/references in the new design document.
- Use targeted repository searches for stale or contradictory claims where useful.
- Do not run live provider calls or credential-dependent flows.
- Typecheck/build/application tests are **NOT RUN** unless needed for a purely read-only reason; do not modify code to make them pass.
- Record exact commands and actual outcomes. Do not claim checks that were not run.

## 8. Stop conditions

Stop and report **BLOCKED / OPEN OWNER DECISION** if:
- source cannot establish a safe invocation path without new runtime architecture;
- credential/account mapping would require a new token owner or migration;
- a required Spoolcast capability is missing;
- a security boundary cannot be justified from existing controls;
- the design requires a queue, scheduler, daemon, job engine, independent ledger, new persistence, or provider-protocol changes;
- repository state cannot be safely synchronized without overwriting local work.

Do not invent a workaround. Record exact source evidence and the specific decision needed from the Owner. Do not proceed to implementation or create another follow-on task.

## 9. Git and handoff

- Target branch: `main` only.
- Do not create/switch branches, force-push, rewrite history, or amend published commits.
- Preserve pre-existing local changes; never reset, clean, stash, or discard user work.
- Suggested implementation/design commit message: `docs(QFAT-023): design Spoolcast invocation boundary`.
- Push and independently verify remote publication of the design document and report.
- Agent handoff after publication must contain only:
  - Branch
  - Commit message
  - Full SHA
  - Report path

This task authorizes **documentation and read-only technical investigation only**. It does not authorize runtime implementation.