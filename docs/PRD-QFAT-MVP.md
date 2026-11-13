# QFAT MVP — Product Requirements Document

- **Document ID:** QFAT-PRD-001
- **Status:** OWNER-APPROVED PRODUCT DIRECTION / READY FOR TECHNICAL BREAKDOWN
- **Repository:** `irfannuralam44-max/qfat`
- **Target release:** MVP (local-first web application)
- **Last updated:** 2026-11-11
- **Supersedes:** Conflicting legacy product assumptions in the imported Spoolcast CLI documentation for the MVP scope only.

## 1. Product summary

QFAT is a local-first content publishing application that lets one operator manage multiple YouTube channels and Facebook Pages, prepare media and metadata, select publishing destinations, and publish immediately while monitoring each destination's upload progress and outcome.

The MVP is a **web application running locally on the user's computer**. The browser is the user interface; a separate Node.js backend owns platform integrations, OAuth credentials, upload execution, job orchestration, and local persistence. The MVP is not a hosted multi-tenant SaaS and does not require Electron or Tauri.

The frontend will reuse the established FATTECH 2.0 frontend foundation: React, Vite, TypeScript, Tailwind CSS 3.4, React Router 6, Lucide React, and Recharts. QFAT will have its own product identity and design tokens rather than copying FATTECH branding.

## 2. Problem and goals

### Problem
The current imported Spoolcast project is a Node.js CLI built around queue folders and JSON manifests. It provides useful YouTube and Facebook upload protocol code, but it does not provide a visual workflow for selecting media, managing multiple connected accounts, choosing destinations, or monitoring jobs. Its existing scheduled-publishing assumptions, plaintext token storage, and some upload recovery behavior are not suitable as-is for the QFAT MVP.

### Product goals
1. Provide a usable visual workflow for publishing video content to YouTube and Facebook.
2. Support multiple YouTube channels and multiple Facebook Pages without an arbitrary account limit.
3. Let the operator choose one or more destinations for each publishing job.
4. Support Facebook single-image posts in the MVP.
5. Show per-destination progress, status, errors, and publishing history.
6. Preserve and adapt useful Spoolcast upload protocol code where safe.
7. Keep media, job records, and application operation local to the user's machine; communicate with Google and Meta only as required for authentication and publishing.
8. Establish framework-independent backend boundaries so a future Tauri 2 desktop shell or Rust backend can be considered without rewriting product logic.

### Non-goals
- Public cloud hosting, multi-tenant SaaS, team collaboration, roles, or remote user accounts.
- Electron or Tauri packaging in the MVP.
- Rust rewrite in the MVP.
- Scheduled publishing or calendar-based scheduling.
- Facebook album/multi-photo publishing (planned after MVP).
- CSV import/export workflows.
- AI-generated metadata.
- Video transcoding or editing.
- Analytics beyond operational publishing/job status.
- Automatic scraping, reposting, or content discovery.
- Live production uploads as part of automated CI tests.

## 3. Target user and primary use case

### Primary user
A single operator who manages one or more YouTube channels and Facebook Pages and wants to publish media from a local computer without manually repeating the same upload workflow across accounts.

### Primary user journey
1. Start the local QFAT backend and open the web UI in a browser.
2. Connect one or more YouTube channels and Facebook Pages.
3. Select a local video or image.
4. Enter or review metadata in the editor for the intended platform.
5. Select one or more eligible destinations.
6. Review the publishing summary and confirm immediate publishing.
7. Observe upload progress independently for every destination.
8. Review successful, failed, or uncertain outcomes in the job history.
9. Retry only destinations that can safely be retried; resolve ambiguous outcomes without blindly creating duplicate posts.

## 4. MVP scope and functional requirements

### 4.1 Dashboard / Overview
The dashboard must provide an operational summary, not vanity analytics.
- Show counts for queued/running, completed, failed, and needs-attention jobs.
- Show recent publishing activity.
- Show connected-account counts grouped by platform.
- Provide clear navigation to Accounts, Media/Publish, Queue, History, and Settings.
- Display empty states and actionable errors when no accounts or jobs exist.

### 4.2 Account management
- Connect multiple YouTube channels using Google's supported OAuth flow.
- Connect multiple Facebook Pages using the approved Meta authorization flow and Page permissions.
- Display platform, channel/Page name, account alias or identifier, connection status, and last-known authorization state.
- Allow the operator to disconnect an account and replace/re-authorize credentials.
- Allow account aliases to be edited without changing the platform's canonical account ID.
- Do not impose a fixed maximum account count in application logic.
- Keep access tokens, refresh tokens, authorization codes, and app secrets out of the browser UI, browser storage, logs, and ordinary application database fields.
- The backend is the only component permitted to access platform credentials.

**Acceptance criteria**
- The user can connect and see more than one account on each supported platform.
- The user can select any connected account as a destination.
- Disconnecting an account prevents new jobs from using it; existing job history remains readable.
- No credential value is returned by account-list or account-detail API responses.

### 4.3 Media selection and validation

MVP media types:

| Media type | YouTube | Facebook |
|---|---:|---:|
| Standard video | Yes | Yes |
| Short-form video | YouTube Shorts via standard video upload rules | Facebook Reels |
| Single image | No | Yes |
| Multiple-image album | No | No — post-MVP |

- The operator selects a local media file through the browser file picker.
- The frontend sends the file to the local backend using a streaming upload path; the backend must not buffer the entire media file in memory.
- The backend stores the selected media in an application-managed local staging/library directory and records its metadata in SQLite.
- Validate file existence, non-zero size, supported extension/MIME, and applicable platform constraints before creating a publishing job.
- For video, preserve the distinction between standard Facebook Page video and Facebook Reel upload protocols.
- YouTube Shorts are uploaded through the regular YouTube video upload API; eligibility is based on YouTube's current platform rules, not a separate Shorts endpoint.
- For Facebook Reels, validate constraints against current official Meta documentation during implementation. Do not hardcode unverified limits into user-facing copy.
- For Facebook single-image posts, validate supported image MIME/format and file size against current official Meta documentation during implementation.
- Provide useful validation messages and do not silently transcode or alter source media.

**Acceptance criteria**
- A user can select a video and create a video publishing draft.
- A user can select one image and create a Facebook image-post draft.
- Selecting an image does not offer YouTube or Facebook video/Reel destinations.
- Selecting a video offers only destinations compatible with the selected format and connected accounts.
- Large file transfer to the backend uses bounded memory and does not require loading the whole file into a single Node.js Buffer.

### 4.4 Metadata editor

QFAT must provide **separate platform editors**. Do not combine YouTube and Facebook metadata into one shared form or a single cross-platform editor.

**YouTube Editor**
- Title.
- Description.
- Tags where supported.
- Video format intent: standard video or Shorts.
- YouTube channel destination selection.
- Platform-specific validation and a destination-specific preview/summary before confirmation where practical.

**Facebook Editor**
- Caption/message.
- Facebook Page destination selection.
- Media selection supports video, Reels, or exactly one image in the MVP.
- The metadata fields and form structure are the same for Facebook video and Facebook single-image posts. Changing the media type must not create a separate image-only metadata form.
- Media-specific file validation, eligible publishing format, and preview may change according to the selected media type.

**Shared editor rules**
- Switching platform means switching to that platform's editor; metadata fields must not be silently mixed across platforms.
- Validate required fields and platform constraints before submission.
- Preserve user-entered Unicode and line breaks.
- Show a destination-specific preview/summary before confirmation where practical.
- Do not invent, auto-generate, or silently rewrite metadata.
- CSV import and AI metadata generation are explicitly outside MVP scope.
- Facebook album/multiple-image posts are post-MVP and must not appear as an MVP media option.

### 4.5 Destination selection and publishing
- A video job may target one or more connected YouTube channels and/or Facebook Pages.
- A single-image job may target one or more connected Facebook Pages only.
- Each selected destination is represented as an independent destination job with its own status, progress, remote ID, error, and retry/reconciliation state.
- MVP publishing is immediate. The UI must not expose a future publish date or schedule calendar.
- Require a final confirmation before dispatching a live publishing job.
- The application must not automatically publish a draft merely because a file was selected or metadata was saved.
- Do not impose an arbitrary limit on the number of destinations selected.

**Acceptance criteria**
- One video can be submitted to multiple eligible destinations in one action.
- One image can be submitted to multiple Facebook Pages in one action.
- Success on one destination does not mask failure on another.
- A completed destination is not re-uploaded when another destination fails.

### 4.6 Upload queue and progress
- Show queued, preparing, uploading, finalizing, completed, failed, cancelled, and needs-reconciliation states as applicable.
- Show per-destination progress when the platform protocol provides measurable progress.
- If exact progress is unavailable, show a truthful indeterminate state rather than fabricated percentages.
- Show the media name, platform/account destination, start time, elapsed time where available, and concise error information.
- Support cancellation where the underlying operation can be safely cancelled.
- Use a typed backend event contract. Server-Sent Events (SSE) is the preferred MVP transport for live progress; a normal HTTP API is used for commands and queries.
- The UI must recover the latest job state from the backend after a browser refresh or reconnect; it must not depend on having observed every SSE event.

### 4.7 Job history, retry, and recovery
- Persist job and per-destination state in SQLite.
- Persist remote platform IDs and upload-session checkpoints as soon as they are safely available.
- Record timestamps and sanitized error details.
- Retrying one destination must not re-run successful destinations.
- Distinguish retryable failures, permanent validation/permission failures, cancellation, and ambiguous provider outcomes.
- If a provider may have accepted a publish request but the response was lost, mark the destination `needs_reconciliation`; do not blindly create a duplicate post.
- Provide a user-visible explanation and an explicit safe next action for reconciliation cases.
- Keep job history after media cleanup or account disconnection.
- Define media retention/cleanup behavior in implementation design; do not delete source media automatically in the MVP without an explicit user-facing policy.

### 4.8 Settings
MVP settings are limited to:
- Application-managed media/staging directory and available disk-space indication.
- Theme preference (dark/light/system) if straightforward to persist locally.
- Basic application version and diagnostics information.
- Safe log export with secrets and token-bearing URLs redacted.

Do not expose raw API credentials or arbitrary backend environment variables in the UI.

## 5. UX and visual direction

### Design foundation
Use the FATTECH 2.0 frontend stack as a technical/design foundation, while creating QFAT-specific tokens, layout, and visual identity.
- React 18 + Vite 5.
- TypeScript.
- Tailwind CSS 3.4.
- React Router 6.
- Lucide React.
- Recharts only for operational charts that add real value.
- TanStack Query is recommended for API/server-state caching and invalidation.
- React Hook Form + Zod are recommended for forms and validation.
- Do not add a component library such as shadcn/ui automatically; first evaluate whether the existing FATTECH component patterns can be reused without pulling in an unnecessary dependency.

### Visual direction
- Dark-first operational dashboard, with a complete light theme.
- Compact, clear sidebar navigation.
- Neutral dark surfaces with a restrained indigo/blue accent; platform brand colors may identify YouTube and Facebook destinations.
- Clear status colors for success, warning, failure, and running.
- Dense but readable tables and queue rows.
- Accessible focus states, keyboard navigation, responsive layout, and reduced-motion support.
- Avoid decorative charts that do not help the operator make a publishing decision.

### Required pages
1. Overview
2. Accounts
3. Media Library / Select Media
4. Create Content — with separate YouTube Editor and Facebook Editor
5. Queue / Active Uploads
6. History / Job Details
7. Settings

## 6. Technical product constraints

### 6.1 Runtime architecture

The MVP uses the existing QFAT local web application structure: React frontend and a local Node.js/TypeScript server. The server is the only component permitted to access credentials or call Google/Meta APIs.

**Reuse-first implementation rule:** the imported Spoolcast source in `src/` is the existing platform integration engine. Adapt its OAuth and upload code in place or through thin wrappers. Do not rebuild the platform protocols, introduce a replacement upload engine, or reorganize the source into many packages unless a concrete MVP requirement cannot be met safely by the existing code.

The server owns the minimum application responsibilities required by the UI: account operations, media intake, invoking Spoolcast functions, per-destination job state, progress events, and history. Preserve the existing `apps/server` and `apps/web` structure unless implementation evidence requires a narrowly scoped change.

### 6.2 API and event boundaries

Use the existing server framework and API conventions in the repository. Add only the endpoints and event handling required for account management, media, publishing, job status, and history. Do not build a generic contract framework before it is needed.

Validate all browser input at the server boundary. The frontend must not import Spoolcast platform modules, access credential files, or call platform APIs directly. Progress should be passed from existing upload callbacks through a thin server event bridge; report indeterminate progress when exact measurements are unavailable.

### 6.3 Repository organization

Keep the current repository layout:
- `src/`: imported Spoolcast platform and CLI baseline.
- `apps/server/`: QFAT local API and application integration.
- `apps/web/`: QFAT React UI.
- Existing `packages/` may be used where already present and justified, but do not split or move Spoolcast modules solely for architectural neatness.

Preserve the upstream MIT license and attribution. The CLI/queue behavior should remain compatible where practical, but QFAT's browser workflow must not require users to manually edit queue folders or JSON manifests.

### 6.4 Persistence

SQLite stores QFAT account metadata, media metadata, publishing jobs, destination outcomes, checkpoints, and history. Media files remain in application-managed local storage, not in SQLite blobs.

Use the existing QFAT persistence implementation and migrations. Do not introduce another database library or persistence abstraction unless the current implementation demonstrably cannot meet an MVP requirement.

### 6.5 Credential storage

Platform tokens must not be exposed to the frontend or stored as plaintext SQLite fields or ordinary JSON files. Continue using the existing encrypted credential provider and AES-256-GCM envelope.

The agreed Linux MVP direction is to store the AES key in Linux Secret Service (provided by the owner's GNOME Keyring environment), using the default collection after verification. `@napi-rs/keyring` is a conditional candidate with explicit Secret Service backend selection; no keyutils or plaintext fallback is permitted. If the keyring is locked/unavailable, QFAT instructs the user to unlock it through Linux and retry, then fails closed.

The candidate's D-Bus blocking risk must be tested and mitigated before production use. Migration from the existing key-file provider must be an explicit, separately tested operation; never migrate or delete real key material implicitly. Windows credential storage remains deferred and is not part of the active Linux MVP workstream.

### 6.6 Upload adapter requirements

Adapt the existing Spoolcast modules; do not replace them with a new adapter framework.

- YouTube: retain the existing Google API upload path and file streaming. Capture the primary video ID immediately after success; optional post-publish failures must not cause a duplicate primary upload.
- Facebook Page video: retain the existing three-phase resumable protocol and bounded chunk transfer.
- Facebook Reels: retain the Reels-specific protocol, but replace whole-file memory loading with bounded-memory transfer.
- Facebook single image: add the single-photo Page publishing path for MVP; album/multiple-image publishing is post-MVP.
- All platform paths: add only the progress, cancellation, error, checkpoint, and job-state bridging required by QFAT.
- Immediate publishing only. Do not expose scheduling in the MVP UI or carry over upstream schedule assumptions.


## 7. Security, privacy, and reliability
- Bind the local API to loopback by default; do not expose it to the LAN or public internet in the MVP.
- Protect state-changing API endpoints against cross-site request forgery and unauthorized browser origins. Validate the expected frontend origin and use a local session/anti-CSRF mechanism where appropriate.
- Do not treat loopback networking alone as an authentication boundary.
- Keep OAuth access/refresh tokens and Meta Page tokens in OS-protected credential storage, not browser storage, logs, SQLite plaintext, or Git.
- Never return secrets to the frontend.
- Redact authorization headers, access tokens, refresh tokens, OAuth codes, signed URLs, and token-bearing query parameters from logs and error messages.
- Validate upload MIME, extension, size, and metadata server-side; do not trust browser validation.
- Use bounded-memory streaming for media intake and platform uploads.
- Use explicit job state transitions and safe retry/reconciliation behavior to avoid duplicate posts.
- Keep external network activity limited to the explicitly selected platform authorization and publishing actions; no telemetry in the MVP.
- Preserve the upstream MIT license and attribution.

## 8. Platform scope and verification

Linux is the active MVP implementation and verification target. Run automated checks locally on Linux; GitHub Actions and hosted CI are not used. Windows remains deferred and is not an active implementation or acceptance target until the owner explicitly authorizes it.

Use mocked platform APIs for automated tests. Manual sandbox authorization and upload smoke tests require explicit owner approval. Do not claim cross-platform support based solely on a Linux build. Record exact local commands, environment, and outcomes in task reports.


## 9. MVP release acceptance criteria
The MVP is ready for owner review when all of the following are true:
1. The local web application starts reliably and can be opened in a supported browser.
2. Frontend and backend run as separate processes with documented startup commands.
3. The operator can connect and manage multiple YouTube channels and Facebook Pages.
4. The operator can select a video and publish it immediately to one or more eligible destinations.
5. The operator can select one image and publish it immediately to one or more Facebook Pages.
6. Facebook album publishing is absent from the MVP UI and documented as post-MVP.
7. The operator can observe truthful per-destination upload progress and final outcomes.
8. Job and destination states survive browser refresh and backend restart.
9. A failure on one destination does not re-upload destinations that already succeeded.
10. Ambiguous provider outcomes are reconciled safely rather than blindly retried.
11. Facebook Reel transfer and browser-to-backend media intake use bounded memory.
12. Platform credentials are not exposed to the frontend, logs, or plaintext database storage.
13. Automated tests cover job state transitions, destination fan-out, upload adapter protocols via mocks, validation, and failure/retry paths.
14. Typecheck and production build pass on Linux and Windows; relevant tests pass on both.
15. The upstream MIT license and attribution remain intact.
16. No live production upload is required to pass automated CI.

## 10. Post-MVP roadmap (not authorized by this PRD)
Potential follow-up capabilities, each requiring a separate scope and acceptance criteria:
- Facebook album/multi-image publishing.
- Tauri 2 desktop packaging using the same web frontend and Node.js backend as a Sidecar.
- Gradual migration of selected backend services from Node.js to Rust after the desktop version is stable.
- Additional publishing destinations/platforms.
- Optional scheduling, if explicitly re-approved as a separate product capability.
- CSV import/export and AI metadata only if the owner later changes the current scope decision.

## 11. Remaining implementation decisions

Resolve only when the relevant feature task reaches the decision point:
1. Exact provider OAuth requirements, Meta permissions, app review state, and supported Graph API version.
2. Supported media formats and size limits for each platform.
3. Whether YouTube thumbnail upload and playlist insertion are included or deferred.
4. Exact safe-retry/reconciliation behavior for ambiguous provider outcomes.
5. The final migration/cutover procedure from the existing key-file credential provider to Linux Secret Service.

These are bounded implementation details. They do not authorize new frameworks, replacement upload engines, broad package restructuring, Windows work, or expansion of MVP scope.


## 12. Decision log

| Decision | Current direction |
|---|---|
| MVP delivery | Local-first web app |
| Frontend framework | React + Vite + TypeScript |
| Styling | Tailwind CSS 3.4, based on FATTECH 2.0 foundation |
| Routing | React Router 6 |
| Icons / charts | Lucide React / Recharts |
| Backend | Separate Node.js >= 22 + TypeScript process |
| Database | SQLite |
| Live progress | SSE preferred |
| Publishing | Immediate after explicit confirmation |
| Account support | Multiple YouTube channels and Facebook Pages; no arbitrary cap |
| Video destinations | YouTube video/Shorts; Facebook video/Reels |
| Image support | Facebook single-image post in MVP |
| Album support | Post-MVP |
| Metadata editor | Separate YouTube and Facebook editors; Facebook video and single-image use the same metadata form |
| Desktop shell | Not in MVP; Tauri 2 is a possible later phase |
| Rust | Not in MVP; gradual future migration only |
| CSV / AI metadata | Out of scope for current MVP |
| Upstream | Preserve Spoolcast MIT license and attribution |

---

**Owner direction (2026-11-13):** Prefer reuse of the imported Spoolcast engine and the existing QFAT server/web structure. Keep implementation changes small and directly tied to MVP user flows. Do not rebuild working platform integrations or expand architecture without a concrete requirement and owner approval.
