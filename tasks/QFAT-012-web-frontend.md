> **QFAT-021 scope note — 2026-11-13 (HISTORICAL / SCOPE SUPERSEDED):** This task remains historical evidence of its original authorized scope. It is not current authorization to build or extend a standalone QFAT publishing backend. Current product identity is QFAT frontend for Spoolcast; see `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`. Its vertical QFAT media-intake/library backend scope is not a standing product mandate. Retain the implementation as existing work; reassess only against a separately approved Spoolcast frontend flow. Future reuse requires a new bounded task and explicit owner authorization.

# QFAT-012 — Media Intake & Local Library

- **Status:** READY — OWNER-AUTHORIZED FOR IMPLEMENTATION
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Task type:** IMPLEMENTATION — vertical product slice
- **Owner:** QFAT project owner
- **Executor:** OpenCode local agent, one main agent, serial execution
- **Mode:** HYBRID (GPT task author/auditor; OpenCode implementation)
- **GPS standard:** `irfannuralam44-max/gps@main`, version 1.2.0
- **Expected report:** `reports/QFAT-012-media-intake-local-library-report.md`
- **Authorization:** Owner approved the Media Intake & Local Library scope in this project conversation on 2026-11-12.

> This task is authorized for implementation. Implement only the scope below. Do not advance to account connection, platform publishing, or another task after completion.

## 1. Objective

Deliver the first real end-to-end media workflow in QFAT:

1. An operator selects a supported local video or a single image in the browser.
2. The browser uploads the file to the local QFAT backend using bounded-memory streaming.
3. The backend validates and stores the media in an application-managed local directory.
4. The backend persists media metadata in SQLite.
5. The operator can browse, inspect, and explicitly delete items in a functional Media Library.

The library must display only records and files that actually exist. No mock data, sample rows, simulated upload progress, or fabricated operational status.

This is a vertical slice across the existing web frontend and Node.js backend. It is not a frontend-only task.

## 2. Authority and required context

Read before editing:
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md` (especially §§4.3, 4.4, 4.8, 6.1–6.4, 7)
- `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- `docs/ARCHITECTURE-QFAT-MVP.md` as a proposal/context, not higher authority than the approved PRD or recorded owner decisions
- Existing QFAT-008, QFAT-009, QFAT-010, and QFAT-011 task/report documents where relevant
- Existing web app shell, Create Content/MediaSelector components, Fastify server/security routes, SQLite connection/migration/schema modules, and relevant tests.

Owner-approved product constraints:
- QFAT is a local-first web application running on the user's PC.
- Frontend is reachable through the configured LAN/Tailscale browser entrypoint; backend remains bound to `127.0.0.1:3001` behind the frontend proxy.
- Use relative same-origin API paths.
- Figma is cancelled. Do not request or depend on Figma.
- Existing QFAT source/UI patterns, the owner-approved PRD, and recorded owner decisions are the design authority.
- Facebook single-image media is in MVP; Facebook albums/multiple images are post-MVP.
- QFAT-011 is Owner-accepted. Do not ask for repeat LAN/Tailscale tests.
- Preserve the imported Spoolcast source, CLI compatibility, MIT license, and upstream attribution.

The PRD is the product authority. Existing source is the implementation baseline. If they conflict, report the conflict and follow the approved PRD/recorded owner decision unless a material decision is needed from the Owner.

## 3. In-scope deliverables

### 3.1 Backend media intake

Implement versioned local API endpoints under `/api/v1/media` for:
- Upload one media file.
- List persisted media records with stable pagination or a documented bounded result limit.
- Fetch one media record by opaque ID.
- Explicitly delete one media item and its managed file, with safe filesystem/database consistency handling.

Requirements:
- Integrate with the existing Fastify server and existing security/session/CSRF foundation.
- State-changing operations must use the existing mutation guard and validate Origin/Host and session/CSRF. Read endpoints must enforce the appropriate same-origin/session policy consistent with existing security design; do not weaken current protections.
- Use streaming request/file handling with bounded memory. Do not read the entire upload into a single Node.js Buffer or accumulate chunks in memory.
- Do not trust browser-supplied filename, MIME type, extension, size, or path.
- Generate opaque server-side media IDs and safe storage filenames. Never use a client path as a filesystem path.
- Store files only inside an application-managed media directory. Resolve the directory using the existing project configuration conventions or a clearly documented QFAT-specific configuration. The default must be local to the QFAT application data area, not the repository working tree or an arbitrary current working directory.
- Prevent path traversal and symlink/path escape. Ensure all resolved storage paths remain inside the configured media root.
- Persist metadata in SQLite using the existing Drizzle schema/migration approach. At minimum record: opaque ID, original display filename (sanitized), detected media type/MIME, byte size, managed storage key/path (never expose an absolute path to the browser), created timestamp, and any integrity metadata needed for safe verification.
- Use transactional/compensating behavior so a failed database write does not leave an untracked file and a failed file write does not create a successful media record. Document crash/recovery limitations honestly.
- Return typed, sanitized API errors. Do not expose local absolute paths, stack traces, secrets, or internal filesystem details.
- Enforce a documented maximum upload size and supported formats. Select limits from existing project requirements and safe implementation constraints; do not invent platform-specific Meta/Google constraints. If the PRD requires platform-specific validation that depends on official current limits, mark it as a follow-up validation rather than inventing values.
- Validate actual file content where practical (magic bytes/content signatures) in addition to declared MIME/extension. Reject unsupported, empty, malformed, or mismatched files with actionable errors.
- Do not transcode, alter, compress, or silently rewrite source media.
- Do not automatically clean up media based on age or account/job status.

### 3.2 Media type and MVP compatibility

Support:
- Video files usable as standard video source for YouTube/Facebook workflows.
- One image file for Facebook single-image workflows.

Do not implement:
- Multi-image selection or Facebook albums.
- Platform publishing or OAuth.
- Video transcoding/editing.
- Scheduling or queue/job creation.

The media record is platform-neutral. Do not hard-bind a stored file to an account or publishing destination.

### 3.3 Frontend Media Library

Implement a real Media Library view and navigation entry using existing QFAT layout, tokens, components, accessibility, and responsive conventions.

The view must:
- Load records from the backend; never use fixture/sample records.
- Show a truthful empty state when no media exists.
- Show loading, upload, success, validation error, network error, and retry states accurately.
- Allow selecting one file and uploading it.
- Display the original display name, media kind, formatted size, and created date/time from persisted server data.
- Allow opening a record's details.
- Allow explicit deletion with confirmation. On deletion failure, preserve the visible record and show an actionable error.
- Refresh/reconcile the list from the backend after upload/delete and after route revisit or browser reload.
- Be usable at desktop and mobile breakpoints and via keyboard.
- Avoid fake percentage progress. If the selected upload transport provides real byte progress, show it; otherwise use an honest indeterminate uploading state.

### 3.4 Integration with existing Create Content flow

Connect the existing local media selection experience to persisted backend media records only to the extent required for this slice:
- After successful upload, the media item must be available from the Media Library.
- Reuse the existing YouTube/Facebook editor separation and preserve Facebook single-image behavior.
- Do not enable Publish buttons, create destination jobs, or imply that media has been sent to YouTube/Meta.
- If editor integration would require inventing unsupported publishing behavior, leave the existing editor behavior intact and report the remaining integration boundary.

## 4. API and data contract

The agent must define and document concrete request/response schemas before wiring the UI. Keep the API small and consistent with current project conventions.

Minimum logical operations:
- `POST /api/v1/media` — one streamed file upload; return the persisted media record.
- `GET /api/v1/media` — list persisted media records.
- `GET /api/v1/media/:mediaId` — get one record.
- `DELETE /api/v1/media/:mediaId` — explicitly delete one record/file.

Use an opaque ID (UUID or an equally safe random identifier). Browser responses must not expose absolute filesystem paths, raw storage paths, or internal database details.

A successful upload response is allowed only after the file is stored and its metadata is persisted. Define behavior for interrupted uploads and partial failures. Avoid accepting arbitrary content via JSON/base64.

## 5. Explicit exclusions

- No OAuth, account connection, credential storage, Google/Meta API calls, or live publishing.
- No queue, publishing job, destination job, retry/reconciliation engine, SSE job progress, or publishing history.
- No Facebook album/multiple-image support.
- No scheduling/calendar.
- No fake/demo/sample operational data.
- No backend exposure beyond loopback; do not change the approved LAN/Tailscale frontend entrypoint.
- No Tailscale SDK/API/CLI/Serve/Funnel or special Tailscale integration.
- No public hosting, router port forwarding, firewall automation, Electron, Tauri, or PWA/HTTPS claims.
- No CI/GitHub Actions creation or execution.
- No broad dependency upgrades, unrelated refactors, or upstream CLI behavior changes.
- No automatic media cleanup/retention deletion policy.

## 6. Security, reliability, and data safety

- Preserve the existing browser session and CSRF protections. Never bypass them for convenience.
- Enforce upload limits while streaming, not only after the file has been fully received.
- Treat all request headers, multipart fields, filenames, MIME declarations, and file bytes as untrusted.
- Do not allow arbitrary destination paths, overwrite existing files, or follow attacker-controlled symlinks.
- Use exclusive file creation and collision-safe generated names.
- Clean up partial files on request abort, validation failure, storage failure, and database failure.
- Ensure delete operations cannot remove files outside the managed media root.
- Avoid logging raw request bodies, local full paths, or user media contents.
- Do not serve uploaded files from an executable/public static directory. If previews are needed, use a narrowly scoped authenticated media-serving endpoint with safe content headers; otherwise details may show metadata only.
- Do not introduce a plaintext credential store or change existing security boundaries.
- Do not overwrite, reset, clean, stash, rebase, amend published commits, or force-push. Preserve pre-existing local changes.

## 7. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | A supported video can be selected in the browser, uploaded to the local backend, and persisted on disk. |
| AC-02 | A supported single image can be uploaded and persisted for Facebook image-post use. |
| AC-03 | Upload transfer is streaming/bounded-memory; implementation does not buffer the complete file in memory. |
| AC-04 | Unsupported, empty, oversized, malformed, or MIME/content-mismatched files are rejected with useful errors and no successful library record. |
| AC-05 | A successful upload creates exactly one persisted SQLite media record linked to the managed file. |
| AC-06 | The Media Library lists actual persisted records and survives browser refresh and backend restart. |
| AC-07 | Media detail returns safe metadata and never exposes absolute storage paths. |
| AC-08 | Explicit deletion removes the selected record and managed file; failed deletion does not silently lose the record or delete an unrelated file. |
| AC-09 | Upload and delete mutations enforce the existing Origin/Host, session, and CSRF protections. |
| AC-10 | Upload interruption/failure cleans partial artifacts and does not report success. |
| AC-11 | UI empty/loading/success/error states reflect backend outcomes; no sample data or fabricated progress is present. |
| AC-12 | Existing YouTube/Facebook editor behavior, Facebook single-image selection, app shell, and LAN/Tailscale access remain intact. |
| AC-13 | No OAuth, external platform API calls, publishing, scheduling, albums, or unrelated features are introduced. |
| AC-14 | Backend/web typecheck, relevant automated tests, and production builds pass, or failures are recorded accurately with evidence. |

## 8. Verification requirements

Run from the repository root / relevant workspace using the actual scripts present in the repository:
- Backend: `npm run typecheck`, `npm test`, `npm run build` in `apps/server`.
- Web: `npm run typecheck`, relevant tests if configured, and `npm run build` in `apps/web`.
- Run migration tests against temporary test databases; do not use or alter the owner's real application database.
- Add automated tests for upload success, invalid/empty/oversized input, content mismatch, abort/partial cleanup, path traversal attempts, duplicate filename handling, list/detail/delete, database failure compensation, and CSRF/session rejection.
- Verify bounded-memory behavior through code-level streaming tests or a controlled large-file test; document the method and limits. Do not claim a memory profile unless actually measured.
- Verify restart persistence with a temporary database and media directory.
- Verify existing security tests remain green.
- Inspect `git diff --check`, `git status`, and staged files before commit.
- Do not run live platform uploads or use real OAuth credentials.
- Do not create or run CI/GitHub Actions.

Report exact commands, environment, outcomes, and checks not run. Distinguish agent-reported tests from GPT's independent source audit.

## 9. Files and scope control

Likely areas include:
- `apps/server/src/` routes, media service/storage, schema, migrations, and tests.
- `apps/web/src/` API client, Media Library page/components, navigation/routes, and tests.
- Documentation for the media API, storage configuration, and operational behavior.
- `reports/QFAT-012-media-intake-local-library-report.md`.

The list is indicative, not permission for broad restructuring. Inspect current paths and follow existing conventions. Do not create a new framework or architecture layer unless needed and justified.

If implementation reveals a material unresolved decision about data location, deletion semantics, file limits, security, or data loss, stop and report BLOCKED rather than guessing.

## 10. Git, report, and handoff

- Target branch: `main`; no new branch is authorized.
- Before work, verify repository identity, origin, branch, HEAD, and worktree. Preserve all changes. If clean and safe, use `git pull --ff-only origin main`; stop if dirty, diverged, wrong remote, or otherwise unsafe. Never reset/clean/stash/rebase/force.
- Implement only QFAT-012.
- Write the full Markdown report at `reports/QFAT-012-media-intake-local-library-report.md`.
- Commit and push only after reviewing the diff and checks.
- Verify the pushed commit and report on GitHub.
- Stop after handoff; do not start QFAT-013 or another scope.

OpenCode final chat handoff must contain exactly these four lines:
`Branch:`
`Commit message:`
`Full SHA:`
`Report path:`

Agent PASS is not final acceptance. GPT independently audits the pushed commit, diff, report, and source. The Owner decides acceptance and next stage.
