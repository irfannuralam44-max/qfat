# QFAT-012 — Web Frontend Completion and API Integration

- **Status:** GPT-AUTHORED TASK — READY FOR OWNER AUTHORIZATION
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Task type:** Web frontend implementation and integration
- **Expected report:** `reports/QFAT-012-web-frontend-report.md`
- **Product authority:** `docs/PRD-QFAT-MVP.md`
- **Architecture authority:** `docs/ARCHITECTURE-QFAT-MVP.md`
- **Beta access authority:** `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- **Workflow:** GitHub-first; one OpenCode agent serially; GPT audit and owner acceptance

## 1. Objective

Advance the existing QFAT React/Vite frontend toward the MVP web application defined by the PRD.

The repository already contains work from QFAT-008 (design foundation, shell, Overview), QFAT-009 (separate YouTube and Facebook metadata editors), and QFAT-010 (local video/single-image selection). Preserve and build on that work; do not recreate it.

This task must first establish the actual frontend/backend integration boundary. The currently documented backend work includes health and browser-session/CSRF security. Do not assume that account, media-library, job, queue, history, or settings APIs exist. Inspect the current server source and tests before implementing any frontend integration.

The frontend must show only real backend capabilities. No fabricated accounts, media records, upload completion, publishing jobs, progress, or history may be presented as real.

## 2. Mandatory repository inspection

Before editing:

1. Read `AGENTS.md` and `docs/AI-DEVELOPMENT-WORKFLOW.md` in full.
2. Read the PRD, architecture proposal, beta access addendum, and relevant ADRs.
3. Read task specifications and reports for QFAT-008, QFAT-009, QFAT-010, and QFAT-011.
4. Inspect the current `apps/web/` source, routes, components, tests, package manifest, and lockfile.
5. Inspect the current `apps/server/` route registration, schemas, security hooks, tests, and API response contracts.
6. Inspect the current `packages/` contracts, if present.
7. Verify current Git branch, HEAD, working tree, and remote synchronization. Preserve all local changes.

Produce an endpoint inventory before implementation. For each endpoint, record method, path, purpose, request/response schema, security requirement, and test evidence. Distinguish implemented endpoints from proposed endpoints in documentation.

If the current source materially differs from the task assumptions, stop and report the discrepancy.

## 3. Scope

### 3.1 Frontend foundation preservation

- Preserve QFAT-008 design tokens, app shell, dark/light/system theme behavior, responsive navigation, and truthful Overview health status.
- Preserve QFAT-009 separate YouTube and Facebook editors and their independent metadata state.
- Preserve QFAT-010 video and Facebook single-image selection behavior, preview cleanup, validation, and memory-only handling before explicit upload.
- Preserve QFAT-011 session, CSRF, dynamic Origin/Host, and same-origin proxy behavior.
- Do not introduce a second UI design system or replace existing components without evidence and justification.

### 3.2 API client and server-state boundary

- Inspect whether a reusable typed API client already exists; reuse or minimally improve it.
- State-changing requests must use the existing QFAT-011 security client and CSRF token mechanism.
- Keep API URLs relative/same-origin. Never hardcode localhost, LAN IP, Tailscale IP, or backend port in browser code.
- Use the actual server response schemas and error envelope. Do not invent API routes or silently assume response shapes.
- Use TanStack Query, React Hook Form, or other dependencies only if already installed or clearly justified by the existing architecture. Do not add dependencies merely because they are recommended.
- Handle loading, empty, success, unavailable, and error states distinctly.
- Refresh/reload must recover server-authoritative data where a real read API exists. Do not treat component memory as persistent backend state.

### 3.3 Product pages and navigation

Review all PRD pages:

1. Overview
2. Accounts
3. Media Library / Select Media
4. Create Content
5. Queue / Active Uploads
6. History / Job Details
7. Settings

For each page, compare the required behavior with the actual backend API inventory.

- Keep already implemented Overview and Create Content behavior intact.
- Implement a page interaction only when its required backend contract exists and is tested.
- Where the backend contract does not exist, keep the destination clearly marked as unavailable/coming soon or show a truthful explanatory state. Do not create fake records or pretend that the feature is operational.
- Do not add backend routes, database tables, migrations, OAuth, upload processing, job orchestration, or platform publishing as part of this frontend task.
- Do not build decorative charts or sample activity.

### 3.4 Media selection and upload boundary

- Preserve QFAT-010 local file selection.
- Inspect whether a real, tested media-intake API exists in the current server.
- If and only if a real upload contract exists, integrate it using QFAT-011 CSRF protection and truthful upload states.
- If no media-intake endpoint exists, do not invent one or display a working upload action. Keep the selected file clearly identified as local-only and document media upload as blocked by missing backend capability.
- Do not persist file contents in browser storage or send files to an unverified endpoint.

### 3.5 Accounts and publishing boundary

- Do not implement OAuth or credential handling.
- Do not display connected accounts unless returned by a real server API.
- Do not implement publishing, destination selection, scheduling, queue mutation, retry, cancellation, or reconciliation unless the corresponding real API contract already exists and is in scope.
- Keep publish controls disabled or unavailable until the actual server capability exists.
- No live Google or Meta requests and no real publishing.

### 3.6 Responsive and accessible behavior

Verify and preserve:

- 360 px, 768 px, and 1440 px viewports without horizontal overflow.
- Dark, light, and system themes.
- Keyboard navigation, visible focus, semantic labels, and accessible status/error announcements.
- Reduced-motion behavior.
- Direct loading and browser refresh for implemented routes.
- Mobile browser use through the existing LAN/Tailscale frontend entrypoint.

Do not claim PWA installability or secure-context support for plain HTTP IP origins.

## 4. Explicit exclusions

Do NOT implement:

- Backend API routes, Fastify plugins, database tables, or migrations.
- Media intake/storage if no tested endpoint exists.
- YouTube/Meta OAuth, credential storage, or account authorization.
- Platform upload adapters or live uploads.
- Publishing jobs, queue workers, SSE publishing progress, retry, cancellation, or reconciliation.
- Facebook albums/multiple-image posts.
- Scheduling or calendar publishing.
- Video/image editing, transcoding, compression, or thumbnail generation.
- Public hosting, router port forwarding, Tailscale-specific integration, HTTPS, PWA, Electron, or Tauri.
- CI/GitHub Actions.
- Broad dependency upgrades, unrelated refactors, or Spoolcast CLI behavior changes.

If a required frontend feature is blocked by a missing backend capability, record it as a dependency for a separately scoped future task. Do not expand QFAT-012 to implement that backend capability.

## 5. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | Existing QFAT-008 Overview, shell, themes, and health behavior remain functional. |
| AC-02 | Existing QFAT-009 YouTube and Facebook editors retain their separate fields and state. |
| AC-03 | Existing QFAT-010 video and Facebook single-image selection behavior remains functional. |
| AC-04 | Existing QFAT-011 session/CSRF client and security behavior are preserved for all mutations. |
| AC-05 | A documented endpoint inventory accurately distinguishes implemented and missing backend APIs. |
| AC-06 | Frontend API calls use relative same-origin paths and actual server contracts only. |
| AC-07 | No fabricated account, media, queue, history, job, progress, or publishing data is shown. |
| AC-08 | Product navigation routes lead to a real implemented page or a truthful unavailable/coming-soon state; no broken or blank route. |
| AC-09 | Media upload is enabled only if a real, tested server media-intake endpoint exists; otherwise the UI remains explicitly local-only. |
| AC-10 | Loading, empty, unavailable, success, and error states are truthful and accessible wherever applicable. |
| AC-11 | Direct route load and browser refresh work for implemented routes. |
| AC-12 | Responsive layouts work at 360/768/1440 px without horizontal overflow. |
| AC-13 | Dark/light/system themes, keyboard access, visible focus, semantic labels, and reduced motion remain correct. |
| AC-14 | No backend, OAuth, credential, publishing, queue, scheduling, or external platform behavior is introduced. |
| AC-15 | Frontend tests, typecheck, build, dependency audits, and `git diff --check` pass, or findings are documented accurately. |
| AC-16 | LAN/Tailscale same-origin frontend access and backend loopback-only boundary remain unchanged. |

## 6. Verification

Run checks on the designated Linux PC and record OS, architecture, Node, npm, and browser versions.

At minimum:

1. Safe synchronization with `origin/main`; record base SHA and initial Git status.
2. `npm ci` in `apps/web/`.
3. `npm audit` and `npm audit --omit=dev` in `apps/web/`.
4. `npm run typecheck` and `npm run build` in `apps/web/`.
5. Run all available frontend tests.
6. Run relevant backend tests without modifying backend behavior.
7. Verify the endpoint inventory against actual route registration and tests.
8. Verify implemented routes, direct loading, refresh, and truthful unavailable states.
9. Verify existing editor switching, metadata preservation, media selection, and preview cleanup.
10. Verify security-client behavior for state-changing requests; do not expose tokens in logs or test output.
11. Verify no unsupported endpoint is called and no external Google/Meta request is introduced.
12. Verify responsive breakpoints, themes, keyboard operation, focus, and reduced motion.
13. Inspect browser console and network requests.
14. Run `git diff --check` and inspect all changed/staged files.

Do not use live platform credentials, authorize accounts, upload to Google/Meta, or publish content. Do not use GitHub Actions/CI.

## 7. Implementation report

Create `reports/QFAT-012-web-frontend-report.md`.

Include:

- Task path, repository, branch, base SHA, implementation commit message, and full commit SHA.
- Initial Git state and synchronization evidence.
- Endpoint inventory with implemented/missing status and source/test references.
- Files changed and rationale.
- Acceptance criteria table with PASS / FAIL / NOT RUN and concrete evidence.
- Exact commands, environment, and actual outcomes.
- Frontend behavior and responsive/accessibility evidence.
- Dependency audit results and unresolved advisories.
- Explicit list of frontend features blocked by missing backend APIs.
- Confirmation that no fake data, unauthorized backend functionality, OAuth, external API calls, or live publishing were introduced.
- Findings, limitations, and residual risks.
- Commit and push verification.

## 8. Git and publication

- Target branch is `main`.
- Preserve all pre-existing local changes.
- Do not use reset, restore, clean, stash, rebase, amend published commits, or force push.
- Do not create a new branch.
- Review `git diff`, `git status`, and staged paths before committing.
- Commit only QFAT-012 task-related changes.
- Suggested implementation commit message: `feat(web): complete QFAT MVP frontend integration`.
- Push to `main` and verify the remote commit and report.

## 9. Stop condition

After implementation, verification, report publication, and remote verification:

STOP.

Do not start QFAT-013 or another task. Return the minimal GitHub handoff required by `docs/AI-DEVELOPMENT-WORKFLOW.md` and wait for GPT audit and owner acceptance.
