# QFAT-003R — Backend SQLite Foundation Correction

- **Task ID:** QFAT-003R
- **Status:** READY FOR EXECUTION — correction of QFAT-003 implementation and report
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Base commit:** `c670bcfe153bb1c20d507a19817f943fb95f33f1` (QFAT-003 implementation commit)
- **Related documents:** `docs/decisions/ADR-001-sqlite-driver-and-migrations.md`, `tasks/QFAT-003-backend-sqlite-foundation.md`, `reports/QFAT-003-backend-sqlite-foundation.md`
- **Expected report:** `reports/QFAT-003R-backend-sqlite-foundation-correction.md`
- **Execution mode:** One agent, serial

---

## 1. Objective

Fix the material issues identified in the GPT audit of QFAT-003:

1. **Report metadata correction** — Replace placeholder SHA values with actual commit SHA (`c670bcfe153bb1c20d507a19817f943fb95f33f1`) and correct base commit.
2. **CI security gate** — Add a real GitHub Actions workflow that runs `npm audit --omit=dev` and fails on any production-scope finding (per ADR-001 mitigation M-2).
3. **Migration runner uses connection module** — Refactor `apps/server/src/db/migrate.ts` to use `openDatabase()` from the connection module instead of opening SQLite directly, ensuring consistent PRAGMA configuration.
4. **Migration upgrade test** — Add a test that exercises a v1→v2 schema upgrade (add a column via a second generated migration, then verify upgrade preserves data).
5. **Test runner structure** — Integrate the migration verification test into the standard `node:test` suite (remove standalone `migration-verify.test.ts` or convert it to use `node:test`).

All fixes must maintain the existing isolated `apps/server/` package structure and not change the root Spoolcast CLI.

---

## 2. Scope

### In scope

- Update `reports/QFAT-003-backend-sqlite-foundation.md` with correct Git metadata.
- Add `.github/workflows/ci.yml` with production-scope audit gate.
- Refactor `apps/server/src/db/migrate.ts` to use `openDatabase()` from `./connection.js`.
- Add a second migration (v2) to schema and test upgrade path.
- Consolidate test files to use `node:test` consistently.
- Re-run all verification commands and update the report with actual results.
- Commit and push the corrected implementation and a new correction report `reports/QFAT-003R-backend-sqlite-foundation-correction.md`.

### Out of scope

- No changes to root `package.json`, `tsconfig.json`, or Spoolcast CLI source.
- No Fastify, API, frontend, OAuth, upload, or business schema work.
- No Windows validation (separate task).
- No npm overrides or audit suppression.

---

## 3. Acceptance Criteria

| ID | Criterion | Required Evidence |
|---|---|---|
| AC-01 | Report metadata matches actual commit | Base commit = `7a4fac8...`, Full SHA = `c670bcfe153bb1c20d507a19817f943fb95f33f1` |
| AC-02 | CI workflow runs `npm audit --omit=dev` and fails on findings | `.github/workflows/ci.yml` exists, workflow run visible on GitHub |
| AC-03 | Migration runner uses `openDatabase()` | `migrate.ts` imports from `./connection.js`, no direct `new Database()` |
| AC-04 | Migration upgrade test passes | Second migration generated, v1→v2 upgrade tested with data preservation |
| AC-05 | All tests use `node:test` | `npm test` runs all tests via `node --test`, no standalone scripts |
| AC-06 | All original QFAT-003 ACs still pass | Re-run typecheck, test, audit:prod, audit:full, root typecheck/build |
| AC-07 | No unintended changes | `git diff` shows only task-scoped changes |

---

## 4. Verification Commands

Run and record exact results:

1. `cd apps/server && npm run typecheck`
2. `cd apps/server && npm test`
3. `cd apps/server && npm run audit:prod`
4. `cd apps/server && npm run audit:full`
5. `cd apps/server && npm run db:generate` (verify second migration)
6. `cd apps/server && npm run db:migrate` on fresh DB with v1 data
7. `npm run typecheck` (root)
8. `npm run build` (root)
9. `git diff --check` and `git status`

---

## 5. Report Requirements

Create `reports/QFAT-003R-backend-sqlite-foundation-correction.md` containing:

1. Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
2. Reference to original QFAT-003 commit and this correction commit.
3. Summary of each fix with before/after evidence.
4. Updated acceptance criteria results.
5. Exact commands and outputs for all verification steps.
6. Updated Git publication details.
7. Statement that work is ready for GPT/owner audit.

---

## 6. Git and Workflow

- Commit message: `fix(server): QFAT-003R correction — metadata, CI gate, migration runner, upgrade test`
- Push to `main` and verify remote.
- Chat handoff: branch, commit message, full SHA, report path.

---

**Note:** This correction task addresses audit findings only. It does not expand the QFAT-003 scope or authorize new features.