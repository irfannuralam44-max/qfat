# ADR-005: Local-Only Verification; No Hosted CI

- Status: Accepted
- Decision date: 2026-11-13
- Decision owner: Project owner
- Scope: QFAT repository verification and test execution

## Context

QFAT's GitHub Actions setup encountered account-level billing/startup restrictions. Continuing to troubleshoot hosted runners adds operational friction without being necessary for the current Linux-first development workflow.

## Decision

All QFAT verification is performed locally in the Linux development environment.

The project will not create, enable, trigger, require, or rely on GitHub Actions or other hosted CI workflows. Existing hosted workflow files are to be removed. No billing, payment-method, spending-limit, account-transfer, or runner workaround is authorized for this purpose.

GitHub remains the canonical platform for source control, task specifications, implementation reports, and review. This ADR does not disable GitHub repository usage.

## Required local verification evidence

Every task report must record, as applicable:

- Operating system and architecture.
- Node.js and npm versions.
- Exact commands executed and working directories.
- Exit codes and test counts.
- PASS, FAIL, or NOT RUN for each required check.
- Any limitation or environment-specific finding.

A check must not be marked PASS unless it was actually executed and passed. Source inspection is not a substitute for execution. A GitHub push is not evidence that tests ran.

## Consequences

- GitHub Actions is not a project dependency or acceptance criterion.
- No workflow should be reintroduced without a new, explicit owner decision.
- Linux local verification remains the active baseline.
- Windows remains deferred under the separate Linux-first platform decision; this ADR does not authorize Windows work.

## Historical record

QFAT-014 created a Linux GitHub Actions workflow and attempted run `43351816748`. GitHub blocked the jobs before runner startup because of an account billing lock; no workflow steps ran. The task was subsequently cancelled by the owner. Its original implementation/report history is retained in `tasks/QFAT-014-linux-github-actions-ci.md` and `reports/QFAT-014-linux-github-actions-ci-report.md`.
