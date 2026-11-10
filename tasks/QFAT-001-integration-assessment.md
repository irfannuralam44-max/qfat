# Task QFAT-001 — Assess Desktop Integration Architecture for Spoolcast Adapters

- Status: READY
- Task type: Read-only technical assessment / design
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Parent issue: https://github.com/irfannuralam44-max/qfat/issues/1
- Report: `reports/QFAT-001-integration-assessment.md`

## 1. Objective

Assess how the imported Spoolcast upload and authentication code should be adapted into Qfat's intended desktop upload workflow. Produce an evidence-based integration design and implementation breakdown before changing application code.

This is an assessment task only. Do not implement the adapters or redesign the application in this task.

## 2. Current baseline

The repository contains the upstream Spoolcast baseline, imported from `jaycverg/spoolcast`. Read `UPSTREAM.md`, `README.md`, `CLAUDE.md`, and the relevant source modules.

The baseline is a Node.js >=20 / TypeScript ESM CLI. It is not yet a desktop application shell. Do not assume a desktop framework, renderer, IPC layer, persistence layer, or UI event system exists unless you find it in the current repository.

Relevant upstream modules include:

- `src/upload-youtube.ts`
- `src/upload-facebook.ts`
- `src/upload-facebook-reel.ts`
- `src/auth-youtube.ts`
- `src/auth-facebook.ts`
- `src/tokens.ts`
- `src/state.ts`
- `src/run.ts`
- `src/config.ts`

## 3. Required decisions and constraints

The assessment must account for the following accepted product constraints:

1. Preserve support for multiple YouTube channels and multiple Facebook Pages. Do not impose an arbitrary two-account limit.
2. The MVP must support selecting one or more destinations for a video upload.
3. Upload progress, success, and failure must be observable by the eventual desktop UI through a clean callback/event boundary.
4. The MVP targets immediate publishing. Do not carry over scheduled publishing unless an API flow or platform requirement makes it necessary; explain any unavoidable exception.
5. OAuth refresh tokens and Facebook Page tokens must not remain in plaintext JSON files. Evaluate secure OS credential storage suitable for the actual target desktop platforms. Do not choose a dependency without explaining platform coverage and maintenance implications.
6. Persist a successful platform video ID immediately after the primary upload succeeds. Later optional operations (such as thumbnail or playlist updates) must not cause a duplicate primary upload on retry.
7. Facebook Reel transfer must use bounded memory; do not read the entire media file into RAM.
8. Verify the currently supported Facebook Graph API version from authoritative Meta documentation before recommending a version. Do not assume an old hardcoded version remains supported.
9. Preserve the Spoolcast MIT license and upstream attribution.
10. Do not request, create, store, or use real platform credentials. Do not perform live uploads.

## 4. Work scope

### In scope

- Inspect the current repository tree, package metadata, documentation, and all relevant source modules.
- Identify which upstream modules can be reused with limited changes and which require redesign.
- Trace the current YouTube, Facebook long-form, Facebook Reel, and OAuth flows.
- Analyze the current token persistence, upload state/idempotency, progress reporting, and error/retry behavior.
- Identify what desktop application infrastructure is absent and what decisions are needed before adapter integration.
- Recommend a minimal architecture boundary for upload adapters, account credential access, upload-job orchestration/state, and UI progress events.
- Recommend a staged implementation plan with small, independently verifiable tasks.
- Identify security, API compatibility, duplicate-upload, cancellation, and memory risks.

### Out of scope

- No source-code changes, refactors, dependency installation, or package upgrades.
- No new desktop framework selection presented as approved; provide options and trade-offs if the host app stack is not already defined in repository evidence.
- No live OAuth, API calls requiring credentials, or real uploads.
- No removal of Spoolcast CLI behavior or queue functionality in this assessment.
- No arbitrary account-count limit.
- No implementation of UI, IPC, secure credential storage, or upload-job state.

## 5. Required investigation

Inspect at minimum:

- `package.json`, `tsconfig.json`, `.gitignore`
- `README.md`, `CLAUDE.md`, `UPSTREAM.md`
- All source modules listed in §2
- Existing tests and scripts, if any
- Repository tree for signs of an existing desktop shell, IPC, database, or UI integration

For each relevant upload flow, document:

- Entry point and inputs
- Authentication/token dependency
- Upload protocol and memory behavior
- Progress reporting capability
- Success/failure boundary
- State persistence and retry/idempotency behavior
- Optional post-upload actions and their failure semantics

Use official Meta documentation for the Facebook Graph API version and relevant upload protocol details. Cite URLs and access date in the report. Do not rely on stale source comments alone.

## 6. Deliverable

Create `reports/QFAT-001-integration-assessment.md` with:

1. Executive conclusion: ready to implement / blocked pending owner decision.
2. Repository baseline and evidence of whether a desktop shell currently exists.
3. Current architecture and upload-flow findings for YouTube, Facebook video, Facebook Reel, and OAuth.
4. Reuse / adapt / replace matrix for relevant modules.
5. Recommended adapter and job-orchestration boundaries.
6. Credential-storage options with OS/platform coverage, maintenance considerations, and recommendation.
7. Progress/event interface proposal (illustrative TypeScript types are allowed; do not add source code).
8. Idempotency and retry design, including primary upload success vs optional follow-up operations.
9. Bounded-memory Reel transfer design.
10. Facebook API version recommendation with authoritative source URLs and access date.
11. Risks, assumptions, unresolved owner decisions, and blockers.
12. A staged implementation plan. Each proposed follow-up task must have scope, exclusions, acceptance criteria, and verification commands.
13. A clear list of checks run and not run.

Do not mark implementation criteria PASS; this task has no implementation.

## 7. Verification

Because this is a read-only assessment:

- Do not install dependencies.
- Do not edit source files or package metadata.
- You may run read-only inspection commands if useful.
- If you run any checks, record exact commands and outcomes.
- Confirm `git status` is unchanged at the end.
- The only intended repository change is the assessment report.

## 8. Completion and handoff

- Commit the report to `main` only after reviewing the diff and confirming no other files changed.
- Push and verify the commit and report on GitHub.
- Stop after publication; do not start implementation tasks.
- Chat handoff must contain only branch, commit message, full SHA, and report path, as required by `docs/AI-DEVELOPMENT-WORKFLOW.md`.
- GPT/owner will audit the report and authorize the next implementation task.
