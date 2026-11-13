> **QFAT-021 scope note — 2026-11-13 (HELD / SUPERSEDED BY NO-HOSTED-CI DECISION):** This task remains historical evidence of its original authorized scope. It is not current authorization to build or extend a standalone QFAT publishing backend. Current product identity is QFAT frontend for Spoolcast; see `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`. The earlier hosted CI task is not executable. Current owner decision prohibits creating, enabling, triggering, or relying on hosted CI. Its report remains historical evidence. Future reuse requires a new bounded task and explicit owner authorization.

# Task — QFAT-014 Linux GitHub Actions CI

- Status: CANCELLED BY OWNER
- Repository: irfannuralam44-max/qfat
- Target branch: main
- Decision date: 2026-11-13
- Owner decision: Do not use GitHub Actions or hosted CI for QFAT. All verification and tests are local-only.
- Historical implementation: `.github/workflows/qfat-linux-ci.yml` was created and a GitHub run was attempted; the run was blocked before runner startup by an account billing lock.
- Historical report: `reports/QFAT-014-linux-github-actions-ci-report.md`

## Cancellation

The owner has explicitly cancelled the GitHub Actions approach to avoid further account/billing friction. This task is closed as **CANCELLED**, not PASS and not a technical failure of the QFAT source code.

The workflow file created by this task is removed. No hosted workflow should be recreated, enabled, manually dispatched, or treated as a required check unless the owner explicitly reverses this decision in a new instruction.

## Verification policy going forward

- Run tests, typechecks, builds, audits, and other required checks directly in the local Linux development environment.
- Record the exact command, environment/runtime versions, exit code, and relevant test counts in the task report.
- Distinguish PASS, FAIL, and NOT RUN honestly.
- Do not infer that a GitHub push or a successful commit means tests ran.
- GitHub remains in use for source control, task specifications, reports, and review; only GitHub Actions/hosted CI is discontinued.

## Historical note

The original implementation and blocked GitHub run remain documented in the linked report for audit history. Do not rewrite those historical facts as though the run never occurred.
