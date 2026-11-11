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
4. Enter or review metadata appropriate to the media and selected platforms.
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

For video publishing:
- Title.
- Description/caption.
- Tags where supported by the selected platform.
- Video format intent: standard video or short-form where relevant; allow platform-specific format selection when needed.
- Platform-specific overrides for fields whose behavior differs between destinations.

For Facebook single-image publishing:
- Caption/message.
- Exactly one image asset for the MVP.

Rules:
- Validate required fields per platform before submission.
- Do not invent or auto-generate metadata.
- Preserve user-entered Unicode and line breaks.
- Show a destination-specific preview/summary before confirmation where practical.
- CSV import and AI metadata generation are explicitly outside MVP scope.

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
4. Create Publish Job
5. Queue / Active Uploads
6. History / Job Details
7. Settings

## 6. Technical product constraints

### 6.1 Runtime architecture

The MVP consists of two separately runnable local processes:

- **Frontend:** React + Vite static/client application served to the browser.
- **Backend:** Node.js >= 22 + TypeScript HTTP API and upload worker.

The backend must be independently startable and must own:
- OAuth flows and credential access.
- Platform API clients and upload adapters.
- Media staging and file streaming.
- Job orchestration, cancellation, retry, and reconciliation.
- SQLite persistence.
- Progress event publication.

The frontend must not import platform adapter modules, access token files, or execute arbitrary shell commands.

### 6.2 API and event boundaries

- Use versioned, documented JSON HTTP endpoints for commands and queries.
- Use SSE for job/destination progress events.
- Define shared request/response/event schemas in a contracts module/package.
- Validate all external input at the backend boundary.
- Treat browser-supplied paths, account IDs, file names, and metadata as untrusted input.
- Do not make the frontend's in-memory state the source of truth for job state.

Illustrative event shape (not a final API contract):

```ts
type DestinationStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "published"
  | "failed"
  | "cancelled"
  | "needs_reconciliation";

interface DestinationProgressEvent {
  jobId: string;
  destinationId: string;
  platform: "youtube" | "facebook";
  status: DestinationStatus;
  bytesSent?: number;
  totalBytes?: number;
  percent?: number;
  message?: string;
  occurredAt: string;
}
```

### 6.3 Suggested repository organization

The exact folder layout may be adjusted by the architecture task, but preserve clear process and domain boundaries:

```text
apps/
  web/                 # React + Vite frontend
  api/                 # Node.js HTTP API and worker
packages/
  contracts/           # Shared API and event schemas
  core/                # Platform-independent domain/use cases
  upload-engine/       # Job orchestration and upload lifecycle
  youtube/              # YouTube adapter
  facebook/             # Facebook video, Reel, and image adapters
  auth/                 # OAuth and credential-provider interfaces
  persistence/          # SQLite repositories and migrations
```

Do not reorganize the imported upstream source tree in the PRD implementation itself. A dedicated implementation task must decide how to migrate existing `src/` modules into the target structure while preserving attribution and behavior.

### 6.4 Persistence

- SQLite is the proposed local database for accounts metadata, media metadata, jobs, destination jobs, and upload checkpoints.
- Platform secrets must not be stored as plaintext in SQLite or ordinary JSON files.
- Define a credential-provider abstraction and select an appropriate secure storage implementation for Linux and Windows before implementing OAuth persistence.
- On systems without a usable secure credential store, fail closed or require an explicit owner-approved alternative; do not silently fall back to plaintext.
- Use transactions for state transitions and checkpoint updates.
- Preserve job history and destination-level idempotency across backend restarts.

### 6.5 Upload adapter requirements

Adapt the imported Spoolcast modules; do not embed CLI behavior in the web application.

- YouTube: stream the media file; report structured progress; persist the primary video ID immediately after successful creation; keep optional follow-up operations separate so their failure cannot trigger a duplicate primary upload.
- Facebook Page video: preserve the three-phase resumable upload protocol; use bounded chunks; persist session identifiers and acknowledged offsets; validate finish responses.
- Facebook Reels: keep the Reels protocol separate from long-form video; replace whole-file `readFileSync` behavior with bounded-memory transfer; honor server acknowledgements and persist checkpoints.
- Facebook single image: implement the Page photo publishing flow for one image; confirm current endpoint, permission, and publishing semantics against official Meta documentation before implementation.
- All adapters: accept injected credentials, cancellation, progress reporting, and typed errors; never write directly to the job database/ledger. The orchestration layer owns state transitions.

### 6.6 Publishing semantics

- Publish immediately by default after explicit user confirmation.
- Do not carry over the upstream scheduled-publishing requirements into the MVP.
- Respect platform privacy/default publishing settings and account permissions; if the platform requires a choice or does not allow the requested state, present the constraint before dispatch.
- Centralize and verify the supported Meta Graph API version at implementation time. Do not rely solely on the upstream hardcoded version.

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

## 8. Cross-platform development and verification

The MVP must be testable on the owner's separate Linux and Windows PCs.

- Keep paths, temporary files, process startup, SQLite access, and secure credential integration cross-platform.
- Use environment/configuration validation at backend startup with actionable diagnostics.
- Provide documented development commands for installing dependencies, starting frontend/backend, running typecheck, tests, and production builds.
- Use mocked platform APIs for automated tests.
- Do not require live Google/Meta credentials for the normal unit/integration test suite.
- Perform manual sandbox authorization and upload smoke tests only with explicit owner approval.
- Record platform-specific checks separately for Linux and Windows.
- Do not claim cross-platform support based solely on a successful build on one OS.

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

## 11. Open implementation decisions

The product direction is established, but these technical choices must be resolved in a dedicated architecture task before implementation:

1. Exact HTTP server framework and API route conventions for the Node.js backend.
2. Exact SQLite library, migration strategy, and database location.
3. Linux and Windows credential-provider implementation and failure behavior.
4. Local media staging directory, retention policy, and disk-space handling.
5. Exact Meta permissions, app mode/review requirements, and currently supported Graph API version.
6. Exact supported file formats/size limits for YouTube, Facebook video, Reels, and Facebook single-image posts.
7. Whether YouTube thumbnail upload and playlist insertion are included in the first MVP release or deferred.
8. Whether a minimal local session/token is needed for browser-to-loopback API protection and how it is bootstrapped safely.

These are implementation design decisions, not permission to expand the MVP product scope.

## 12. Decision log

| Decision | Current direction |
|---|---|
| MVP delivery | Local-first web app |
| Frontend framework | React + Vite + TypeScript |
| Styling | Tailwind CSS 3.4, based on FATTECH 2.0 foundation |
| Routing | React Router 6 |
| Icons / charts | Lucide React / Recharts |
| Backend | Separate Node.js >= 20 + TypeScript process |
| Database | SQLite |
| Live progress | SSE preferred |
| Publishing | Immediate after explicit confirmation |
| Account support | Multiple YouTube channels and Facebook Pages; no arbitrary cap |
| Video destinations | YouTube video/Shorts; Facebook video/Reels |
| Image support | Facebook single-image post in MVP |
| Album support | Post-MVP |
| Desktop shell | Not in MVP; Tauri 2 is a possible later phase |
| Rust | Not in MVP; gradual future migration only |
| CSV / AI metadata | Out of scope for current MVP |
| Upstream | Preserve Spoolcast MIT license and attribution |

---

**Owner review note:** This PRD records the product direction agreed in the QFAT planning conversation. It does not authorize implementation by itself. The next step is a GPT-authored architecture/task breakdown that resolves the open implementation decisions and updates any conflicting legacy repository guidance before OpenCode begins coding.
