# Task QFAT-010 — Media Selection and Local Validation

- **Status:** READY FOR OWNER REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION
- **Task type:** Frontend media-selection workflow
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Preferred runtime:** Node.js 24 LTS
- **Expected report:** `reports/QFAT-010-media-selection-local-validation-report.md`
- **Product authority:** `docs/PRD-QFAT-MVP.md`
- **Design foundation:** QFAT-008 app shell and QFAT-009 Create Content editors
- **Predecessor:** QFAT-009 accepted by owner on 2026-11-12
- **Workflow:** GitHub-first; one OpenCode agent serially; GPT audit and owner approval gate

## 1. Objective

Add a usable local media-selection step to the existing Create Content workflow. The operator must be able to choose one local video for YouTube/Facebook video workflows or exactly one image for a Facebook single-image workflow, see the selected file's basic metadata, and receive clear client-side validation feedback.

This task is deliberately a **frontend-only selection slice**. It establishes the user interaction and keeps the selected `File` object in page memory. It does not upload, copy, persist, or transmit the file. A later separately authorized task will implement secure backend streaming intake and managed local storage.

## 2. Approved product behavior

- YouTube supports video selection only.
- Facebook supports video, Reels, or exactly one image.
- Facebook video, Reels, and single-image intent continue to use the same Facebook metadata form from QFAT-009.
- Facebook album/multiple-image selection is post-MVP and must not be offered.
- A selected image must never be offered as a YouTube or Facebook video/Reels asset.
- Switching platform or Facebook media intent must not silently reinterpret an incompatible selected file.
- Publishing remains immediate-only in the MVP, but confirmation and publishing are outside this task.
- No fabricated file, media-library record, upload progress, or publishing result may appear.

## 3. Required implementation

### 3.1 Placement and workflow

- Integrate a media-selection section into the existing Create Content page without breaking its separate YouTube and Facebook editors.
- Keep YouTube and Facebook metadata fields and their current in-memory behavior intact.
- The selected media must be visibly associated with the active platform/media intent.
- When switching to an incompatible platform or media intent, do not silently discard the selection. Show a clear incompatibility state and require the user to remove or replace the file before proceeding with that intent.
- A clear/remove action must work and must not reset unrelated metadata.
- Explain in the UI that selected files remain in this browser page's memory and have not yet been uploaded or saved to the QFAT media library.

### 3.2 File picker and compatibility

- Use the browser's native file picker; do not add a third-party file-picker dependency.
- YouTube: accept supported video extensions already established by the project requirements/source, initially `.mp4` and `.mov`.
- Facebook Video/Reels: accept `.mp4` and `.mov`.
- Facebook Single image: accept exactly one image. Limit the UI's accepted formats to JPEG, PNG, and WebP unless current official Meta documentation and implementation evidence justify another format. Do not add GIF/animated image behavior in this task.
- Do not provide drag-and-drop unless it can be implemented accessibly without expanding scope.
- The input must prevent selecting multiple files for the single-image MVP.
- File extension and browser-reported MIME are hints, not security validation. Clearly treat frontend checks as preliminary only; authoritative server-side validation belongs to the future upload-intake task.

### 3.3 Local validation and file details

- Reject zero-byte files.
- Display the original file name, human-readable file size, and detected media type.
- For image selection, show a local preview using a browser object URL and revoke it when the file is replaced, removed, or the page component unmounts. Do not persist or log the object URL.
- For video selection, show a truthful file summary and a neutral video placeholder; do not claim that the video has been uploaded or fully decoded.
- Handle unsupported extension/MIME combinations and empty selection with actionable inline feedback.
- Do not invent provider upload-size, duration, aspect-ratio, resolution, or codec limits. If a reliable local fact is available (e.g. file size), display it without claiming provider acceptance.
- Preserve Unicode file names safely; do not use the file name as an HTML string or filesystem path.
- Avoid reading the full video/image payload into JavaScript memory. Use `File` metadata and object URLs only.

### 3.4 Editor integration

- YouTube editor must expose video selection only.
- Facebook editor keeps its existing caption field for Video, Reels, and Single image.
- Facebook media intent controls the compatible file picker and preview:
  - Video: one video file.
  - Reels: one video file.
  - Single image: one image file.
- Switching between Facebook Video and Reels retains the selected video.
- Switching between Facebook video/Reels and Single image must not silently retain an incompatible file as if it were valid. Keep it visibly marked as incompatible until removed/replaced, or use another explicit, accessible interaction that prevents accidental data loss.
- Switching platform must not map YouTube's selected file into Facebook state or vice versa without an explicit, documented shared-selection design. Prefer independent per-platform selections for this task.
- Clearing media must not clear title, description, tags, or caption.

### 3.5 State and privacy boundary

- Keep selected `File` objects and preview state in memory only.
- Do not write file data or metadata to localStorage, sessionStorage, IndexedDB, SQLite, backend, URL parameters, logs, telemetry, or external services.
- Do not call Google, Meta, or any external endpoint.
- Do not add upload endpoints, backend routes, database tables, migrations, media staging directories, or server dependencies.
- Do not show upload progress, upload completion, media-library persistence, or publishing readiness.
- Do not change the frontend listener, Vite proxy, backend health behavior, LAN/Tailscale access, or security boundaries.

### 3.6 Accessibility and responsive behavior

- Use a semantic file input with a visible associated label and keyboard-operable remove/replace controls.
- Announce validation errors appropriately; avoid excessive live-region announcements.
- Ensure focus visibility and sensible focus behavior after removal or validation failure.
- Respect dark/light/system themes and reduced-motion preferences.
- Verify 360 px, 768 px, and 1440 px layouts without horizontal overflow.
- Keep the selected file summary and image preview legible on small screens.

## 4. Explicit exclusions

Do NOT implement:
- Backend media intake, multipart upload, streaming, staging, managed media library, or file persistence.
- OAuth, connected accounts, channel/Page selection, destination selection, or credential storage.
- Upload adapters, queue, SSE progress, retry, cancellation, publishing, confirmation, history, or reconciliation.
- Facebook album/multiple-image posts.
- Image editing, cropping, transcoding, video probing, or thumbnail generation.
- Provider-specific size/duration/resolution/codec validation unless explicitly approved in a later task.
- PWA, HTTPS, Docker, CI/GitHub Actions, Electron, Tauri, installers, or auto-start.
- Unrelated refactors, dependency upgrades, or Spoolcast CLI changes.

## 5. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | Create Content supports local video selection for YouTube and Facebook Video/Reels. |
| AC-02 | Facebook Single image supports exactly one selected image and does not offer album/multiple-image. |
| AC-03 | YouTube cannot treat an image as a valid media selection. |
| AC-04 | Facebook media intent changes update compatible picker/preview behavior while retaining the same caption form. |
| AC-05 | Switching Facebook Video ↔ Reels retains the selected video; incompatible media is never silently treated as valid. |
| AC-06 | YouTube and Facebook selections remain separate when switching platform. |
| AC-07 | File name, human-readable size, media type, zero-byte and unsupported-file feedback are accurate and accessible. |
| AC-08 | Image preview uses a temporary object URL and revokes it on replace/remove/unmount. |
| AC-09 | Clear/remove media does not erase unrelated metadata fields. |
| AC-10 | Selected files remain in memory only; no upload, persistence, external request, or backend behavior is added. |
| AC-11 | UI does not imply server validation, upload completion, or publishing readiness. |
| AC-12 | Responsive behavior, themes, keyboard use, focus, and accessibility remain intact at 360/768/1440 px. |
| AC-13 | Existing frontend dependency audits, typecheck, and production build pass; no unnecessary dependency is added. |
| AC-14 | Existing Overview health and private-network frontend/proxy behavior remain unchanged. |

## 6. Verification — Linux PC only

Record OS, architecture, Node, npm, and browser versions.

Required checks:

1. Safe repository synchronization per `AGENTS.md` and the universal workflow.
2. `npm ci` from `apps/web/`.
3. `npm audit` from `apps/web/`.
4. `npm audit --omit=dev` from `apps/web/`.
5. `npm run typecheck` from `apps/web/`.
6. `npm run build` from `apps/web/`.
7. Run available relevant automated tests; add focused tests only if a suitable existing test setup is present.
8. Verify selecting valid video for YouTube and Facebook Video/Reels.
9. Verify Facebook Single image accepts one supported image and rejects video/multiple files.
10. Verify switching Facebook Video ↔ Reels retains video; switching to Single image does not silently accept the video.
11. Verify platform switching keeps media selections separate.
12. Verify zero-byte and unsupported file feedback, Unicode file names, and human-readable file sizes.
13. Verify image preview appears and object URL cleanup occurs on replace/remove/unmount through appropriate tests or browser inspection.
14. Verify clearing media leaves all metadata fields unchanged.
15. Verify no file payload or metadata is persisted/transmitted and no external network call is introduced.
16. Verify dark/light/system themes, keyboard operation, visible focus, and responsive layouts at 360/768/1440 px.
17. Verify direct loading/refresh of Create Content and existing Overview health/proxy behavior.
18. Inspect browser console and run `git diff --check`.

Do not run GitHub Actions/CI. Do not connect accounts, use live credentials, upload files to a backend, or publish content.

## 7. Implementation report

Create `reports/QFAT-010-media-selection-local-validation-report.md`.

Include:
- Task path, base SHA, target branch, implementation commit message, and full commit SHA.
- Changed files and rationale.
- Exact OS/runtime/browser environment.
- Acceptance criteria table with PASS / FAIL / NOT RUN and concrete evidence.
- Exact commands and actual outcomes.
- Evidence for file selection, compatibility handling, preview lifecycle, reset behavior, and responsive layouts.
- npm audit results from `apps/web/`.
- Checks not run and why.
- Explicit confirmation that file data remains in memory and no upload, persistence, backend, external API, account, or publishing functionality was introduced.
- Findings, limitations, and residual risks.
- Git publication and remote verification.

Review `git diff`, `git status`, and staged paths. Commit only task-related files, push to `main`, and verify the remote commit and report.

## 8. Stop condition and required handoff

Stop after implementation and report publication. Do not start QFAT-011 or any subsequent task.

After successful push and remote verification, return exactly:

Branch:
Commit message:
Full SHA:
Report path:
