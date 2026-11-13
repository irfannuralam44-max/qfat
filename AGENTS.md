# Agent Instructions — Qfat

These instructions apply to every AI coding agent working in this repository. The operating process is defined in [docs/AI-DEVELOPMENT-WORKFLOW.md](docs/AI-DEVELOPMENT-WORKFLOW.md). The current product behavior and technical constraints are documented in `README.md` and `CLAUDE.md`; use the source code as the final authority when documentation conflicts with implementation.

## 1. Source of truth and task authority

- Treat the latest explicit GPT-authored task Markdown in `tasks/` (or the exact path named in the GitHub Issue/task) as the implementation brief.
- GitHub is the source of truth for task specifications, source changes, reports, and audit evidence.
- Read the complete task before editing. Also read this file, the universal workflow, relevant project documentation, and affected source/tests.
- Verify that referenced paths exist on the target branch. Do not assume a document is current if source code contradicts it; report conflicts.
- If the task, scope, acceptance criteria, or target branch is materially ambiguous or unsafe, stop and request clarification. Do not guess or infer approval from chat summaries.

## 2. Project identity and technical constraints

- This repository currently contains the Spoolcast upstream baseline under the Qfat repository. Do not assume that planned Qfat product adaptations have already been implemented.
- Current baseline: Node.js >= 20, TypeScript ESM, CLI entry point in `src/cli.ts`, `tsx` for source execution, and `googleapis` as the runtime dependency.
- Current platform integrations: YouTube Data API v3 and Facebook Graph API, including long-form video and short-form upload paths.
- **QFAT MVP reuse-first rule (owner decision 2026-11-13):** treat imported Spoolcast modules as the platform integration engine. Reuse/adapt existing OAuth and upload flows with the smallest safe changes. Do not rebuild platform protocols, create a replacement upload engine, or split modules into additional packages solely for architectural neatness. Use the existing `apps/server` and `apps/web` structure. Any major rewrite, new framework, broad package restructuring, or platform expansion requires concrete MVP justification and owner approval.
- Preserve the current architecture and behavior unless a task explicitly authorizes a change. Do not introduce a GUI framework, database, daemon, scheduler, web server, or unrelated dependency merely because it may be useful later.
- Preserve support for multiple YouTube channels and Facebook Pages. Do not impose an arbitrary account/Page limit such as two accounts per platform.
- Preserve the current queue/manifest model, per-video/per-target idempotency, and upload state ledger unless a task explicitly changes them.
- Preserve the distinction between YouTube scheduled uploads, Facebook long-form scheduled uploads, and Facebook Reels upload protocol.
- Keep `--dry-run` fully offline: it must not load credentials or make network requests.
- Preserve atomic writes for token and state files.
- Preserve the separation of concerns in the existing source modules. In particular, upload adapters must not independently mutate the upload ledger; orchestration owns outcome recording.
- Keep upstream attribution and the MIT license notice intact. Do not remove or rewrite upstream copyright/license notices during adaptation.

## 3. Security and user data

- Treat `.secrets/`, OAuth refresh tokens, Facebook Page tokens, app secrets, and credential files as sensitive.
- Never ask the user to paste secrets into GitHub Issues, task files, reports, source code, or chat.
- Never commit, log, display, screenshot, or transmit credential values.
- Keep `.secrets/` and user content/state under `queue/` out of version control as configured by the repository.
- Do not perform real uploads, authorize accounts, or use live credentials unless the task explicitly requires it and the owner has approved that action.
- Do not add telemetry, external data transfer, or automatic credential collection without explicit approval.
- Before changing token storage, filesystem paths, cleanup behavior, OAuth flows, or API request handling, inspect the existing implementation and document security implications.

## 4. Mandatory execution sequence

1. Confirm repository identity; inspect the current branch, recent commits, and working-tree status.
2. Preserve all pre-existing local changes. Never reset, clean, stash, overwrite, or discard user work.
3. Fetch and pull the exact target branch named by the task before reading its task Markdown. Do not create or switch branches unless explicitly authorized. If synchronization could overwrite or conflict with local work, stop and report `BLOCKED`.
4. Verify that the specified task file exists on the target branch, then read it completely.
5. Read this file, `docs/AI-DEVELOPMENT-WORKFLOW.md`, and relevant project documents (at minimum the relevant sections of `README.md` and `CLAUDE.md`).
6. Inspect affected source code and tests before editing. Map every acceptance criterion to implementation and verification.
7. Implement only the assigned scope. Do not perform unrelated refactors or opportunistic feature additions.
8. Run required checks, write the report, commit, push, and verify publication as defined in the workflow.

Do not implement from a stale checkout, a chat paraphrase, or a task file that was not verified after synchronization.

## 5. Verification and quality

- Follow the task's acceptance criteria and the current project QA instructions.
- At minimum, run `npm run typecheck` after TypeScript changes.
- Run `npm run build` when the task affects compilation, packaging, or generated output.
- Run `spoolcast run --dry-run` only when a task's changes affect queue discovery, manifests, scheduling, or orchestration and a safe local fixture is available. Confirm that it remains offline.
- The upstream baseline does not currently define a comprehensive automated test suite. Do not claim tests exist or passed unless they were actually run.
- For API integrations, use mocks or controlled tests where practical. Do not perform live uploads as a substitute for tests.
- Record exact commands, environment, and actual outcomes. Distinguish source inspection from executed checks.
- Mark unavailable checks as `NOT RUN` with a reason. Never fabricate results or weaken tests to obtain a passing result.
- Identify developer self-checks and independent QA findings separately.

## 6. Git and publication

- **Verification policy:** QFAT checks and tests run locally only. Do not create, enable, trigger, or rely on GitHub Actions or other hosted CI workflows. GitHub remains the repository, task, report, and source-control platform; this decision disables hosted CI, not GitHub usage itself. Record exact local commands and outcomes in each task report.

- Use only the target branch explicitly named by the task.
- Do not create, rename, switch, merge, or delete branches unless the task explicitly authorizes it.
- Do not force-push, rewrite history, amend published commits, or merge into `main` unless authorized.
- Review `git diff`, `git status`, and the staged file list before committing.
- Create the implementation report under `reports/`, unless the task specifies another path.
- Commit and push the implementation and report to the agreed branch.
- Verify that the pushed commit is visible on GitHub and the report is present.
- A local commit is not a completed delivery. If push or remote verification fails, report `BLOCKED`.

## 7. UCQR boundary

If UCQR is explicitly configured for this repository, it is a QA utility only. It may execute configured checks, inspect Git state read-only, and write a Markdown QA report. It must not fetch, pull, checkout/switch branches, merge, commit, push, update refs, or perform any other Git synchronization/publication operation. The coding agent remains responsible for Git operations.

Do not assume UCQR is installed or configured unless the repository and task establish that fact.

## 8. Required implementation report

Unless a task specifies another path, write `reports/<TASK-ID>-<short-description>.md`. Include:

- Status: `PASS`, `PASS WITH FINDINGS`, `FAIL`, or `BLOCKED`.
- Task specification path, repository, target branch, commit message, and full commit SHA.
- Scope and implementation decisions.
- Files changed and purpose.
- Acceptance criteria with PASS/FAIL/NOT RUN and evidence.
- Exact verification commands, environment, and outcomes.
- Manual/API checks and evidence where applicable.
- Findings, limitations, unresolved risks, and checks not run.
- Git publication and remote verification.
- A statement that the work is ready for GPT/owner audit, not that it has been finally accepted.

A report must be factual. Agent-reported PASS is not owner acceptance.

## 9. Chat handoff and completion authority

After successful push and remote verification, keep the chat handoff limited to:

1. Target branch
2. Commit message
3. Full commit SHA
4. Report path

GPT audits the pushed code and report directly on GitHub. GPT/owner decides PASS, requests changes, or authorizes the next task/stage. Stop after publishing the report; do not begin another task or stage without explicit approval.

## 10. QFAT UI and design authority

- Figma is cancelled for QFAT. Do not use Figma, request a Figma handoff, or make Figma access/design files a task prerequisite unless the Owner explicitly reverses this decision.
- UI/design authority is the existing QFAT source and established UI patterns, the owner-approved PRD, and explicit owner-approved product decisions recorded in repository documentation.
- GPT owns routine UI gap analysis and UX decisions within those authorities. Escalate only material product/scope trade-offs or decisions that cannot be resolved safely from approved sources.
- Do not restart the visual design process from zero or block implementation waiting for external design artifacts.
