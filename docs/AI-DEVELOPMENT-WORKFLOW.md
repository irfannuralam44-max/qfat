# AI Development Workflow — Qfat

Status: Active repository workflow
Workflow model: GitHub-first, Markdown-driven, GPT-planned and GPT-audited
Applies to: implementation, maintenance, adaptation, and QA tasks in this repository

This document defines the reusable operating contract for work in Qfat. Project-specific architecture, product behavior, security constraints, and verification commands are defined by `AGENTS.md`, `README.md`, `CLAUDE.md`, and task-specific documentation. The repository currently contains the Spoolcast upstream baseline; do not treat planned Qfat adaptations as completed features.

## 1. Roles and authority

| Role | Responsibility | Authority |
|---|---|---|
| GPT / Architect | Analyze requests, define scope, create task Markdown, set acceptance criteria and target branch | Owns task definition and final audit |
| GitHub | Stores task specifications, source changes, reports, and evidence | Single source of truth |
| OpenCode main agent | Read task, coordinate execution, and enforce workflow | Execution coordinator |
| Developer agent | Implement assigned scope and run developer checks | Cannot self-approve final acceptance |
| Reviewer / QA agent | Independently inspect the candidate commit and run assigned checks | Reports findings; does not silently fix implementation |
| GPT / Owner | Audit pushed code and report | Decides PASS, changes required, or next task/stage |

Use only the roles needed by the task. Do not spawn extra agents for a small task merely to follow a fixed headcount. Prefer serial execution by one main agent unless a task has a clear reason and sufficient resources for independent parallel work.

## 2. Required task input

GPT creates or updates the task specification in GitHub before implementation. The task should identify, as applicable:

- Task ID and title.
- Objective and context.
- Target repository and target branch.
- Exact scope and explicit exclusions.
- Relevant source documents and files.
- Acceptance criteria / definition of done.
- Required checks and test commands.
- Expected report path.
- Owner decisions, dependencies, and constraints.
- Whether the task permits external API calls, credential use, or real uploads.

The task file is the execution contract. Agents must not infer approval from a discussion summary when a current task specification exists.

If the target branch, scope, permissions, or acceptance criteria are materially ambiguous, stop and request clarification. Do not create a branch unless the task explicitly requests one.

## 3. Mandatory execution sequence

### Phase A — Inspect, synchronize, then read the task

1. Confirm repository identity and inspect current branch, recent commits, and working-tree status.
2. Preserve every pre-existing local change. Never reset, clean, stash, overwrite, or discard user work.
3. Fetch the remote and pull the exact target branch named by the task. Do not create or switch branches unless explicitly authorized. If local changes make a safe pull uncertain or it would overwrite/conflict with user work, stop and report `BLOCKED`. Never force synchronization.
4. After synchronization, verify that the specified task file exists on the target branch and read it completely.
5. Read `AGENTS.md`, this workflow, and the project documents relevant to the task. For Qfat, consult `README.md` and `CLAUDE.md` as applicable.
6. Inspect affected implementation and tests; confirm compatibility with the task's scope and acceptance criteria.

Do not implement from a stale checkout, a chat paraphrase, or a task file that was not verified after synchronization.

### Phase B — Plan and implement

1. Identify affected files and behaviors.
2. Map each acceptance criterion to an implementation or verification step.
3. Keep changes within the assigned scope.
4. Preserve the repository's current architecture and established behavior unless an approved task explicitly changes them.
5. Use relevant OpenCode skills when available. A skill is reusable procedural guidance, not permission to expand task scope.
6. If a required skill or tool is unavailable, continue only when safe and record the limitation; never claim it was used.
7. Stop and request clarification when implementation reveals a material product, security, compatibility, API, or data-loss decision not covered by the task.
8. Do not perform live uploads, account authorization, or credential-dependent operations unless explicitly authorized by the task and owner.

### Phase C — Verify

Run the checks required by the task and applicable project QA guidance.

Rules:

- Record exact commands, environment, and actual exit results.
- Distinguish source inspection from executed tests.
- Mark unavailable checks as NOT RUN with a reason.
- Do not mark a criterion PASS based only on code appearance.
- Do not conceal failures or weaken tests to obtain a green result.
- For API integrations, prefer mocks or controlled fixtures. Live platform uploads require explicit authorization.
- For CLI/queue changes, use a safe fixture and verify dry-run behavior remains offline.
- Identify developer self-tests and independent QA findings separately.

### Phase D — Report

Create a Markdown report under `reports/`, unless the task specifies another path. Use the report structure in §6.

The report must be committed with the implementation (or in a clearly linked follow-up commit on the same agreed branch). It must identify the exact candidate commit SHA and branch. Do not paste the detailed report into chat.

### Phase E — Commit, push, and verify

1. Review `git diff`, `git status`, and the staged file list.
2. Ensure only task-related changes are included.
3. Commit using the message specified by GPT; if none is specified, use a concise conventional commit message describing the actual change.
4. Push to the exact target branch.
5. Verify the remote branch points to the expected commit and the report is present on GitHub.
6. If push fails or the remote differs, stop and report BLOCKED. Do not claim the task is complete.

### Phase F — Minimal chat handoff

After successful remote verification, the chat response must contain only:

- **Branch:** exact target branch
- **Commit:** exact commit message
- **SHA:** full commit SHA
- **Report:** exact Markdown report path

No detailed summary, test log, changed-file list, or report body in chat. GPT reads the report and code directly from GitHub.

### Phase G — GPT post-publication audit and documentation maintenance

After the agent has pushed and verified its report, GPT owns the post-publication audit. This phase is performed by GPT/architect, not sent back to the agent merely to fix report metadata.

1. Fetch the report and relevant source files from the pushed GitHub branch.
2. Verify the report commit, branch HEAD, and remote publication state independently.
3. Audit factual claims, acceptance evidence, decision counts, citations, and consistency with approved product requirements.
4. Distinguish historical report-time statements from post-publication facts. A report field such as “push verification pending” may accurately describe the state when the report was authored; it is not by itself evidence of a failed push.
5. If post-publication metadata should be completed or corrected (for example, verified push state, final remote commit, or report status), GPT updates the Markdown report directly in a follow-up documentation-only commit and verifies that commit on the remote branch.
6. Do not ask the agent to repeat completed implementation or validation work solely to repair post-push documentation metadata.
7. If GPT finds a substantive implementation, test, or evidence defect, record it clearly and create a new scoped agent task only when agent work is actually required.
8. Preserve the original report and its historical context; add a dated/clearly labeled post-publication audit note rather than rewriting history or pretending a later fact was known at report time.

GPT's post-publication documentation commit must be separately identified from the agent's task commit. Do not attempt to embed a commit's own full SHA in the content of that same commit; it would change the commit SHA.

## 4. Git safety rules

- The target branch is selected by the task specification.
- Do not create a branch unless explicitly requested.
- Do not push to a different branch as a workaround.
- Do not force-push or rewrite history.
- Do not merge into `main` unless explicitly authorized.
- Do not amend or replace commits already pushed unless explicitly authorized.
- Do not include unrelated user changes.
- If the branch advanced during work, fetch and reconcile safely; never overwrite remote work.
- A local commit is not a completed delivery. Successful push and remote verification are mandatory.

## 5. UCQR boundary — QA only

If UCQR is installed and configured for Qfat, it may execute configured checks, inspect Git state read-only, and generate a factual Markdown QA report.

UCQR must not run `fetch`, `pull`, `checkout`, branch switching/creation, `merge`, `commit`, `push`, ref updates, or any other Git synchronization/publication operation. The agent owns all Git operations: inspect, fetch/pull, implement, test, report, commit, push, and verify the remote result.

Do not assume UCQR is present or configured. Use it only when the repository has the required runner files/configuration or an explicit task authorizes adding/adapting it.

## 6. Required implementation report

Suggested filename: `reports/<TASK-ID>-<short-description>.md`.

```markdown
# Implementation Report — <TASK-ID>

- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED
- Task specification: <path>
- Repository: irfannuralam44-max/qfat
- Target branch: <branch>
- Commit message: <message>
- Commit SHA: <full SHA>

## Scope
What was requested and what was completed.

## Implementation
Key technical changes and relevant decisions.

## Files Changed
List paths and purpose.

## Acceptance Criteria
| Criterion | Result | Evidence |
|---|---|---|
| ... | PASS / FAIL / NOT RUN | ... |

## Verification
| Command / Check | Result | Notes |
|---|---|---|
| ... | PASS / FAIL / NOT RUN | ... |

## Manual / API Evidence
Environment, steps, outcomes, and evidence paths; state explicitly if unavailable.

## Findings and Limitations
Known defects, risks, unresolved questions, and anything not tested.

## Git Publication
Remote branch, commit message, full SHA, and push verification.

## Handoff
State that work is ready for GPT/owner audit; do not claim owner acceptance.
```

A report must be factual. Use PASS WITH FINDINGS when required work passed but known non-blocking findings remain. Use BLOCKED when work cannot safely proceed or publication cannot be verified.

## 7. Independent QA protocol

When a task assigns an independent reviewer/QA agent:

1. Pull the exact candidate commit using the safe synchronization rules.
2. Read the task specification and implementation report.
3. Verify acceptance criteria against source and actual execution evidence.
4. Run the checks assigned to QA; inspect the relevant CLI/API behavior.
5. Record reproducible defects, severity, expected behavior, actual behavior, and evidence.
6. Publish a separate QA Markdown report to the agreed branch.
7. Do not silently modify the implementation under review.

If QA discovers a defect, GPT creates or authorizes a scoped fix task. The developer fixes it, pushes a new commit and report, and QA rechecks the new candidate.

## 8. Stage gates and approval

The workflow does not define product-specific stages. GPT and the owner define stage plans and explicit acceptance gates in task/roadmap documents when staged development is needed.

- An agent may work only on the task and stage authorized by GPT/owner.
- Agent PASS means assigned internal checks passed; it is not final acceptance.
- A stage does not advance automatically after a green test run.
- GPT/owner reviews the pushed implementation and report, then explicitly approves, requests changes, or authorizes the next task/stage.

## 9. Universal vs project-specific configuration

The reusable operating contract is:

- GPT-authored task Markdown is the work order.
- Agent inspects local state, synchronizes the authorized target branch, then reads the task.
- Agent implements only the assigned scope, verifies, reports in Markdown, commits, pushes, and verifies.
- UCQR, when configured, only runs checks, inspects Git state read-only, and writes QA reports; it never synchronizes or publishes Git changes.
- Chat handoff contains only branch, commit message, full SHA, and report path.
- GPT audits the pushed GitHub state; owner approves the result and next stage.

The following remain Qfat/project-specific and must not be copied blindly to other repositories:

- Framework, language, architecture, and directory conventions.
- Build, lint, typecheck, and test commands.
- Product behavior, security, privacy, and data-handling requirements.
- Stage gates, API permissions, and acceptance criteria.
- Packaging, installation, and release rules.

## 10. QFAT UI/design authority — owner decision

Figma has been cancelled for QFAT. It is not a design dependency, required handoff, or approved workflow tool for this project. Agents must not request Figma access, wait for Figma files, invoke Figma workflows, or treat missing Figma artifacts as a blocker unless the Owner explicitly reverses this decision.

Use this authority order for QFAT UI work:

1. Existing QFAT implementation and established UI patterns in the repository.
2. Owner-approved product requirements in `docs/PRD-QFAT-MVP.md` and applicable approved addenda.
3. Explicit owner-approved product decisions recorded in repository documentation.

GPT owns source-based UI gap analysis and routine UX decisions within those authorities. Ask the Owner only when a material product/scope trade-off remains unresolved or approved sources conflict. Do not redesign from zero or invent operational behavior/data to fill a UI gap. Record consequential decisions in the relevant task or decision document.
