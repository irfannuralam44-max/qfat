# ADR-001 — SQLite Driver and Migration Strategy

- **Status:** ACCEPTED WITH MITIGATION — owner approved the driver/migration choice on 2026-11-11
- **Decision area:** QFAT-002 canonical decision items 1 and 4 (SQLite library/migrations; related runtime compatibility)
- **Date:** 2026-11-11
- **Repository:** `irfannuralam44-max/qfat`
- **Scope:** Technical recommendation only. No dependency installation or implementation is authorized by this ADR.

## 1. Context

The QFAT MVP uses a local SQLite database for account metadata, media metadata, publishing jobs, per-destination state, upload checkpoints, and sanitized operational history. The database must work on the owner's Linux and Windows PCs.

The original PRD and imported upstream `package.json` declared Node.js >=20. The owner has explicitly approved raising the QFAT backend minimum to Node.js >=22. The SQLite driver and migration strategy have been validated on the tested Linux and Windows environments and explicitly accepted by the owner, subject to the dependency-audit mitigations recorded below. The database must not store platform credentials or media payloads.

The workload is local and write-oriented but modest: short transactional state updates, job queries, and checkpoint persistence. Large media transfer must remain file/stream based and must never be stored as SQLite BLOBs.

## 2. Accepted decision

**Owner decision (2026-11-11): ACCEPTED WITH MITIGATION.** Adopt the following stack for the QFAT MVP:

- **Driver:** `better-sqlite3`
- **Typed query/schema layer:** Drizzle ORM's `better-sqlite3` driver
- **Migration authoring:** Drizzle Kit `generate`, producing committed SQL migration files
- **Migration execution:** Drizzle's runtime migrator during controlled backend startup
- **Database file:** Per-user application-data directory, outside the repository and source tree

Use Drizzle as a thin typed schema/query layer, not as a reason to hide transaction boundaries. Use explicit SQL where it is clearer, and keep critical multi-step job state changes inside explicit database transactions.

## 3. Why this option

### 3.1 better-sqlite3

The current upstream project documents a synchronous API, prepared statements, transactions, worker-thread support for slow queries, and prebuilt binaries for major platforms/architectures. Its current package metadata requires Node.js >=22. The project also publishes Windows x64/arm64 and Linux x64/arm64 build targets.

The synchronous API is acceptable for QFAT only under these constraints:

- Keep every database operation small and bounded.
- Never perform network requests, file reads, media streaming, or long computation inside a database transaction.
- Do not read large result sets or media payloads into memory.
- Use prepared statements and indexes for recurring job/account queries.
- If profiling later demonstrates event-loop blocking, isolate database work behind a worker boundary rather than prematurely introducing a different database.

### 3.2 Drizzle ORM and migrations

Drizzle officially documents a `better-sqlite3` adapter and a migration workflow that generates SQL migration files and applies them through a migrator. This gives the TypeScript project typed schema definitions while retaining reviewable SQL migrations in Git.

Use the following workflow:

1. Change the typed schema.
2. Generate a migration with Drizzle Kit.
3. Review the generated SQL manually.
4. Commit the SQL migration and schema change together.
5. Apply committed migrations at backend startup using the runtime migrator.
6. Test both a fresh database and an upgrade from the previous schema version.

Do **not** use `drizzle-kit push` as the production/runtime migration mechanism. Do not silently rewrite or delete migration history after it has been applied to a user's database.

## 4. Runtime compatibility consequence

The existing PRD and imported package metadata say Node.js >=20. Current `better-sqlite3` package metadata requires Node.js >=22. This makes the proposed driver incompatible with the current declared minimum unless the runtime requirement is raised.

**Owner decision (2026-11-11): APPROVED.** QFAT backend minimum is Node.js >=22. Use Node.js 24 LTS as the preferred development/verification runtime. Before implementation, verify the exact Node 22 minimum supported by the selected driver release and record the tested Node 22 and Node 24 versions. The imported upstream package metadata is not automatically changed; the QFAT backend runtime contract supersedes it.

The built-in `node:sqlite` module is not recommended as the MVP default at this time: current Node documentation labels it Release Candidate, and the Node 22 documentation still marks it as active development. Reconsider it only after it reaches an appropriate stability level and QFAT explicitly raises/sets its runtime baseline.

## 5. Alternatives considered

| Option | Advantages | Reasons not selected now |
|---|---|---|
| `better-sqlite3` + Drizzle | Mature Node SQLite ecosystem; simple synchronous API; typed schema; generated, reviewable SQL migrations; documented Windows/Linux prebuild targets | Requires Node >=22 in current release; synchronous calls must stay short |
| `node:sqlite` + Drizzle | No third-party native SQLite driver dependency; Drizzle documents integration | Node API is still Release Candidate in current docs; requires a newer Node baseline than current PRD; avoid making an evolving runtime API foundational for MVP |
| `@napi-rs/sqlite` | N-API-based native package is a plausible alternative | Not selected without a verified compatibility/support matrix, API fit, and successful Linux/Windows install test against QFAT's exact Node baseline |
| Raw SQL + custom migration runner | Minimal runtime abstraction; explicit SQL | Adds project-owned migration bookkeeping and testing responsibility without a compelling MVP benefit |
| `libsql` | Drizzle support; additional capabilities | Remote/Turso and libSQL-specific features are not required for a local-only SQLite MVP |

## 6. Required database operating rules

Regardless of the final driver:

- Enable and verify foreign-key enforcement on every connection.
- Evaluate WAL mode for the local workload and document backup/checkpoint behavior.
- Set a bounded busy timeout; surface persistent lock contention as an actionable error.
- Use transactions for state transitions, destination fan-out, and upload checkpoint updates.
- Keep database transactions short; never hold a transaction open during platform API calls or media transfer.
- Store UTC timestamps in a consistent representation.
- Use explicit indexes and uniqueness constraints for idempotency and remote identifiers where appropriate.
- Store only managed relative media identifiers/paths; media files remain on disk.
- Never store OAuth tokens, Page tokens, or other secrets in SQLite.
- Backups must account for SQLite WAL sidecar files; do not copy only the main database file while it is live.
- Add tests for transaction rollback, foreign keys, migrations, concurrent access/locking, and restart recovery.

## 7. Validation evidence completed

The following validation work was completed before owner acceptance:

1. Confirm the actual Node.js runtime versions available on the owner's Linux and Windows PCs.
2. Install the selected driver on both systems from a clean checkout using the intended Node version.
3. Verify the installed package's actual prebuilt binary selection; record if native compilation/toolchains are needed.
4. Open a temporary SQLite database, enable foreign keys and WAL, execute prepared statements, commit/rollback a transaction, close and reopen the database.
5. Generate one sample migration, apply it to a fresh database, then apply a second migration to upgrade it.
6. Run the same test suite on Linux and Windows.
7. Record OS, architecture, Node, npm, driver, ORM, and migration-tool versions.
8. Compare the install/build friction and support evidence against the rejected alternatives if the selected driver cannot be installed cleanly.

Validation reports:

- `reports/QFAT-002S-sqlite-driver-validation.md` — Linux validation; PASS WITH FINDINGS.
- `reports/QFAT-002W-windows-sqlite-validation.md` — Windows 10 x64, Node 22 and Node 24; PASS WITH FINDINGS.
- `reports/QFAT-002V-dependency-audit-findings.md` — dependency audit; PASS WITH FINDINGS, recommendation ACCEPT WITH MITIGATION.

**Coverage boundary:** Linux validation was executed on the reported Node 24 environment; Windows validation covered Node 22 and Node 24. Windows 11, ARM64, and broader sustained contention/large-WAL scenarios were not established by these reports. These are not silently treated as tested.

No real platform accounts, uploads, user database, or production dependency installation were used in the validation.

## 8. Owner approval and conditions

Owner approval is requested for:

1. `better-sqlite3` as the SQLite driver.
2. Drizzle ORM + Drizzle Kit generated SQL migrations.
3. ~~Raising QFAT's backend Node.js minimum from >=20 to >=22~~ **APPROVED by owner on 2026-11-11** (Node.js 24 LTS preferred for development/CI).

The Node.js >=22 runtime change and the `better-sqlite3` + Drizzle driver/migration choice are approved by the owner. This approval authorizes the selected technology stack for QFAT MVP planning and implementation, subject to the following mandatory dependency-audit mitigations:

1. Keep `drizzle-kit`, `tsx`, and `typescript` in `devDependencies`; do not include them in the production/runtime dependency closure.
2. Add a CI gate running `npm audit --omit=dev` and fail the gate on any production-scope vulnerability.
3. Record the full-scope development-tooling advisory `GHSA-67mh-4wv8-2f99` as a dated, explicit exception while it remains present in the selected stable Drizzle Kit dependency tree. The current audit found one advisory propagated to four npm nodes, with the vulnerable `esbuild@0.18.20` copy in a deprecated, apparently unused tooling chain.
4. Do not run `npm audit fix --force` or downgrade Drizzle Kit to `0.18.1` as a purported fix; the audit found that downgrade breaking and still vulnerable.
5. Re-evaluate the exception when a stable Drizzle Kit release removes the deprecated `@esbuild-kit` chain. The exploratory npm override is not selected or authorized by this decision.

This is explicit owner acceptance of the database stack and authorizes subsequent implementation tasks within the existing QFAT stage gates. It does not authorize live platform account connections, real uploads, credential use, or scope beyond the MVP.

## 9. References

- Node.js SQLite API and stability: https://nodejs.org/api/sqlite.html
- Node.js 22 SQLite API: https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html
- better-sqlite3 README: https://github.com/WiseLibs/better-sqlite3
- better-sqlite3 package metadata: https://github.com/WiseLibs/better-sqlite3/blob/master/package.json
- better-sqlite3 build matrix: https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml
- Drizzle SQLite driver documentation: https://orm.drizzle.team/docs/sqlite/get-started-sqlite
- Drizzle migration workflow: https://orm.drizzle.team/docs/get-started/sqlite-new

---

**Decision record:** The owner explicitly accepted this stack on 2026-11-11 after review of the Linux, Windows, and dependency-audit reports. The acceptance is conditional on the mitigations in §8; future implementation tasks remain subject to their own scope and verification gates.
