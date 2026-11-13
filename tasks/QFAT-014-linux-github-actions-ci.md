# Task — QFAT-014 Linux GitHub Actions CI

- Status: READY FOR EXECUTION
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Priority: Medium
- Owner authorization: The owner has now authorized a Linux-only GitHub Actions workflow to use GitHub-hosted free runners for automated verification. This supersedes the earlier decision to defer CI, but only for the narrow scope below.
- Platform scope: Ubuntu Linux only
- Windows: Explicitly excluded and remains deferred. Do not add Windows or macOS runners.
- Expected report: reports/QFAT-014-linux-github-actions-ci-report.md

## 1. Objective

Add a minimal, reliable GitHub Actions workflow that runs the existing QFAT frontend and backend verification commands on a GitHub-hosted Ubuntu runner. The immediate purpose is to verify that Actions can start for this now-public repository under the owner's GitHub Free account and provide repeatable Linux test evidence.

## 2. Required inspection

Before editing:

1. Follow `AGENTS.md` and `docs/AI-DEVELOPMENT-WORKFLOW.md`.
2. Inspect current `main`, existing `.github/workflows/` files, both app package manifests and lockfiles, and the exact test scripts.
3. Inspect `docs/decisions/ADR-001-sqlite-driver-and-migrations.md` for the accepted Linux Node/runtime constraint.
4. Do not duplicate or overwrite an existing workflow blindly. If an existing workflow already covers these checks, report that and propose the smallest safe correction instead.
5. Preserve all existing workflow files and unrelated repository content.

## 3. Scope

Create or minimally adapt one workflow under `.github/workflows/` with:

- A clear workflow name, e.g. `QFAT Linux CI`.
- Triggers: push to `main`, pull requests targeting `main`, and manual `workflow_dispatch`.
- Ubuntu Linux runner only (`ubuntu-latest`).
- Read-only repository permissions (`contents: read`).
- A concurrency group that avoids redundant overlapping runs without cancelling unrelated workflows.
- Node.js 24.x, because the current ADR records successful automatic Linux native SQLite installation on Node 24; do not use Node 22 for this initial CI baseline.
- Separate frontend and backend jobs where practical, each using its own app directory and lockfile.
- Reproducible dependency installation using `npm ci`.
- Frontend checks from `apps/web/`: `npm test`, `npm run typecheck`, and `npm run build`.
- Backend checks from `apps/server/`: `npm test`, `npm run typecheck`, and `npm run build`.

Use the exact package scripts present in the current repository. If inspection shows a listed command is absent or invalid, do not invent a substitute; document the discrepancy and stop for clarification.

## 4. Explicit exclusions

- No Windows or macOS runners.
- No secrets, OAuth credentials, platform tokens, or GitHub secrets are required.
- No live YouTube/Meta API calls, account authorization, uploads, or publishing.
- No changes to application source, dependencies, package manifests, lockfiles, or product behavior.
- No dependency upgrades, vulnerability remediation, database schema/migration changes, or unrelated cleanup.
- No external services or paid third-party actions beyond standard GitHub-maintained actions needed for checkout and Node setup.
- Do not change billing, spending limits, or request a payment method.
- Do not weaken, skip, or rewrite existing tests to obtain a green run.

## 5. Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| AC-01 | Workflow is valid and clearly named | Workflow file inspection and GitHub run |
| AC-02 | Triggers are limited to main push, PR targeting main, and manual dispatch | Workflow source |
| AC-03 | All jobs use Ubuntu Linux only | Workflow source and run metadata |
| AC-04 | Node 24.x is used consistently | Workflow source and run logs |
| AC-05 | Frontend clean install, tests, typecheck, and build execute | GitHub Actions step results |
| AC-06 | Backend clean install, tests, typecheck, and build execute | GitHub Actions step results |
| AC-07 | No secrets or live platform operations are used | Workflow/source audit |
| AC-08 | No application/dependency files are changed | Commit diff |
| AC-09 | The workflow run starts on the public repository using the owner's current GitHub Free account, or the exact GitHub-side blocker is recorded | Run URL/status or factual blocker evidence |
| AC-10 | Report distinguishes successful checks, failed checks, and NOT RUN | Implementation report |

## 6. Verification and reporting

- Validate workflow YAML syntax before commit using an available local validator if present; otherwise record that syntax validation is pending GitHub execution.
- Record exact local commands and outcomes; do not claim GitHub execution before a run actually occurs.
- After push, inspect the actual Actions run and record its URL, runner OS, Node version, each step result, and any billing/permission/startup blocker.
- If the runner cannot start due to account billing/spending restrictions, do not attempt to bypass billing, add a payment method, or change spending limits. Mark AC-09 BLOCKED and report the exact message.
- Commit only the workflow and this task's report (plus this task file if not already committed).
- Push to `main` and verify the remote commit and report.
- Agent-reported PASS is not owner acceptance; stop after the required four-line handoff for GPT audit.

## 7. Completion boundary

This task establishes automated Linux checks only. It does not establish complete end-to-end product readiness, production credential readiness, platform API publishing readiness, or Windows support.
