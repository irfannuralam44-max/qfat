# ADR-001 — SQLite Driver and Migration Strategy

- **Status:** PROPOSED — pending owner approval and Linux/Windows validation
- **Decision area:** QFAT-002 canonical decision items 1 and 4 (SQLite library/migrations; related runtime compatibility)
- **Date:** 2026-11-11
- **Repository:** `irfannuralam44-max/qfat`
- **Scope:** Technical recommendation only. No dependency installation or implementation is authorized by this ADR.

## 1. Context

The QFAT MVP uses a local SQLite database for account metadata, media metadata, publishing jobs, per-destination state, upload checkpoints, and sanitized operational history. The database must work on the owner's Linux and Windows PCs.

The current PRD and architecture proposal specify Node.js >=20, SQLite, TypeScript, and leave the SQLite driver and migration strategy open. The imported upstream `package.json` also declares Node.js >=20. The database must not store platform credentials or media payloads.

The workload is local and write-oriented but modest: short transactional state updates, job queries, and checkpoint persistence. Large media transfer must remain file/stream based and must never be stored as SQLite BLOBs.

## 2. Recommendation

Adopt the following stack for the MVP, subject to owner approval and cross-platform install tests:

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

**Recommendation:** revise the QFAT backend minimum to Node.js 22 or newer, with Node.js 24 LTS as the preferred development/verification runtime. The exact minimum patch version and supported LTS policy must be checked before implementation. Do not quietly change the PRD or `package.json` as part of this proposal.

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

## 7. Validation required before acceptance

A single serial validation task should:

1. Confirm the actual Node.js runtime versions available on the owner's Linux and Windows PCs.
2. Install the selected driver on both systems from a clean checkout using the intended Node version.
3. Verify the installed package's actual prebuilt binary selection; record if native compilation/toolchains are needed.
4. Open a temporary SQLite database, enable foreign keys and WAL, execute prepared statements, commit/rollback a transaction, close and reopen the database.
5. Generate one sample migration, apply it to a fresh database, then apply a second migration to upgrade it.
6. Run the same test suite on Linux and Windows.
7. Record OS, architecture, Node, npm, driver, ORM, and migration-tool versions.
8. Compare the install/build friction and support evidence against the rejected alternatives if the selected driver cannot be installed cleanly.

Do not connect real platform accounts, run uploads, alter the user's application database, or add production dependencies during this validation.

## 8. Approval requested

Owner approval is requested for:

1. `better-sqlite3` as the SQLite driver.
2. Drizzle ORM + Drizzle Kit generated SQL migrations.
3. Raising QFAT's backend Node.js minimum from >=20 to >=22 (prefer Node 24 LTS for development and CI), subject to a final compatibility check.

Until approved and validated, this ADR remains PROPOSED. No implementation work is authorized.

## 9. References

- Node.js SQLite API and stability: https://nodejs.org/api/sqlite.html
- Node.js 22 SQLite API: https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html
- better-sqlite3 README: https://github.com/WiseLibs/better-sqlite3
- better-sqlite3 package metadata: https://github.com/WiseLibs/better-sqlite3/blob/master/package.json
- better-sqlite3 build matrix: https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml
- Drizzle SQLite driver documentation: https://orm.drizzle.team/docs/sqlite/get-started-sqlite
- Drizzle migration workflow: https://orm.drizzle.team/docs/get-started/sqlite-new

---

**Decision rule:** A technically recommended library is not considered accepted until the owner approves the runtime consequence and the Linux/Windows validation report passes. Agent PASS is not owner acceptance.
