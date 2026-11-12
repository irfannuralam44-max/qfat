# QFAT-012 — Media Intake & Local Library Report

## Status

PASS

## Task specification

- Path: `tasks/QFAT-012-web-frontend.md`
- Repository: `irfannuralam44-max/qfat`
- Target branch: `main`
- Commit message: `feat(QFAT-012): media intake and local library`
- Full commit SHA: `6fc6e3afe9d7b5764b1da5ae4bcd117d822d949c`

## Scope and implementation decisions

Implemented a vertical media intake/local library slice across backend and frontend:

- Added `media_items` SQLite table and Drizzle migration (`0002_amazing_mesmero.sql`).
- Added application data directory configuration (`QFAT_DATA_DIR`, default `~/.qfat`) for DB and media storage, keeping files outside the repository tree.
- Added streaming upload endpoint `POST /api/v1/media` with bounded memory, magic-byte validation, size enforcement, sanitized filenames, opaque UUID IDs, SHA-256 integrity metadata, and DB/file compensation.
- Added `GET /api/v1/media`, `GET /api/v1/media/:mediaId`, and `DELETE /api/v1/media/:mediaId`.
- Integrated media routes with existing Fastify server, security/session/CSRF protections, and migration runner.
- Added frontend Media Library page with loading/empty/error/retry/upload/delete/detail states and real backend data.
- Enabled Media Library navigation and route.
- Added automated media tests.

## Files changed

- `apps/server/src/config.ts` — data directory resolution.
- `apps/server/src/index.ts` — buildServer DB/media wiring and migration execution.
- `apps/server/src/schema/index.ts` — `media_items` table and types.
- `apps/server/migrations/0002_amazing_mesmero.sql` — migration.
- `apps/server/src/media/storage.ts` — storage, validation, persistence helpers.
- `apps/server/src/media/routes.ts` — media API routes.
- `apps/server/test/media.test.ts` — media tests.
- `apps/server/test/connection.test.ts` — updated migration count expectation for new migration.
- `apps/web/src/pages/MediaLibraryPage.tsx` — Media Library UI.
- `apps/web/src/App.tsx` — navigation and route.
- `reports/QFAT-012-media-intake-local-library-report.md` — this report.

## API, schema, migration, and UI

API:
- `POST /api/v1/media` — streamed raw file upload; returns persisted media record.
- `GET /api/v1/media` — list persisted media records.
- `GET /api/v1/media/:mediaId` — safe metadata detail.
- `DELETE /api/v1/media/:mediaId` — explicit delete.

Schema `media_items`:
- `id`, `original_filename`, `media_type`, `mime_type`, `size_bytes`, `storage_key`, `sha256`, `created_at`.

UI:
- Media Library page with upload control, loading/empty/error states, list, details dialog, delete confirmation, refresh.

## Technical decisions

- Raw binary request body with `X-File-Name` header avoids multipart dependency and keeps streaming bounded.
- Magic-byte detection determines actual media type/MIME; browser declarations are not trusted.
- Storage keys are UUIDs with no client path or extension; path containment is enforced.
- Read endpoints validate Origin/Host and session but do not require CSRF for GET.
- Mutations use the existing mutation guard (Origin/Host/session/CSRF).

## Verification

Commands run:
- `cd apps/server && npm run typecheck` — PASS
- `cd apps/server && npm test` — PASS (119 tests)
- `cd apps/server && npm run build` — PASS
- `cd apps/web && npm run typecheck` — PASS
- `cd apps/web && npm run build` — PASS
- `git diff --check` — PASS

Media regression tests now cover:
- database delete failure rollback (SQLite trigger raises on delete),
- filesystem move failure (read-only `.trash`),
- filesystem unlink failure with an injected `unlink` rejection on a real regular file (quarantined copy retained, record deleted),
- directory/non-regular managed object rejection with HTTP 409 and no `.trash` artifact,
- crash after quarantine before DB delete followed by restart recovery,
- orphan quarantine cleanup after DB row removal,
- symlinked `.tmp`, `.trash`, and target file rejection,
- exact quarantine-name matching,
- abort-signal ingestion stop with `.part` cleanup and no DB record,
- aborted HTTP upload with `.part` cleanup and no DB record,
- stable pagination with identical timestamps,
- pagination limit/offset pages and max/invalid parameters.

Manual smoke test via temporary `QFAT_DATA_DIR` verified upload, list, detail, delete, and persistence behavior.

## Acceptance criteria

| ID | Status | Evidence |
|---|---|---|
| AC-01 | PASS | Smoke test + automated test |
| AC-02 | PASS | PNG upload automated test |
| AC-03 | PASS | Streaming implementation; no full-buffer accumulation |
| AC-04 | PASS | Empty/mismatch tests |
| AC-05 | PASS | Automated upload test verifies record |
| AC-06 | PASS | Restart persistence test; stable pagination test |
| AC-07 | PASS | Detail response excludes storage path |
| AC-08 | PASS | Delete, DB/filesystem failure, crash recovery, orphan cleanup, non-regular 409 rejection, and symlink tests |
| AC-09 | PASS | Security guard tests |
| AC-10 | PASS | Abort-signal and aborted-HTTP-upload tests verify stream stop, `.part` cleanup, and no DB record |
| AC-11 | PASS | UI states implemented |
| AC-12 | PASS | Existing routes/security preserved; typecheck/tests pass |
| AC-13 | PASS | No publishing/OAuth/albums introduced |
| AC-14 | PASS | Typecheck/tests/build pass |

## Limitations and risks

- Upload uses raw binary rather than multipart; documented in code.
- Aborted uploads clean their `.part` file during request handling. A hard process crash can still leave an orphan `.part`; startup does not sweep `.tmp`, so that remains a documented limitation.
- Delete rejects symlinks and any non-regular managed object with HTTP 409 before quarantine; it never moves a directory into `.trash`.
- Delete quarantines the managed file before deleting the database row, rolls back the file move if database deletion fails, and leaves recoverable copies in `.trash` if final cleanup fails.
- Startup recovery restores exact quarantined copies for active records and removes orphan quarantine files that no longer belong to an active record.
- Symlink/path containment is validated lexically and via realpath where paths exist; symlinked roots, `.tmp`, `.trash`, and target files are rejected or detected.
- Upload abort is driven by an `AbortController` attached to the request's `aborted`/`close` events, not by casting `IncomingMessage` to `AbortSignal`.
- No platform-specific media constraints implemented; marked as follow-up validation.
- List uses bounded pagination (default 100, max 500) with deterministic `created_at DESC, id DESC` ordering.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: `6fc6e3afe9d7b5764b1da5ae4bcd117d822d949c`
- Follow-up fix commits:
  - `4870ad4ecc04700e11c37eb2e567dc37ba5a71cf`
  - `0cac3492fe6569aa085561a47cd7f2cab5038fe1`
- Audit-fix commit (delete safety, abort signal, tests): `3c2c43b606d5afee7ead23e051fc222ed487f9d6`
- Report update commit: `883ffc97487320c6ff3abe465b91bb6109f187a8`
- Push verification: audit-fix commit, report update commit, and final metadata correction pushed to `origin/main`; `git ls-remote origin main` was checked after push and matched the final `main` HEAD reported in the handoff.