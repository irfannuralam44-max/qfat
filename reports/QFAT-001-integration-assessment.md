# QFAT-001 — Desktop Integration Architecture Assessment

- **Status:** BLOCKED PENDING OWNER DECISIONS (assessment complete; implementation not authorized)
- **Task:** [QFAT-001](../tasks/QFAT-001-integration-assessment.md)
- **Repository:** `irfannuralam44-max/qfat`
- **Inspected branch / baseline:** `main` / `f9badf37d8ceac644990aa5f59d5653e9cf91dc5`
- **Assessment date:** 2026-11-10
- **Prepared from:** GitHub repository content and public platform documentation. This was not a local OpenCode run.

## 1. Executive conclusion

The imported Spoolcast code is a useful **CLI upload-protocol baseline**, but it is not yet a desktop application foundation. There is no evidenced desktop shell, renderer, IPC contract, durable desktop job store, account-management UI, or desktop packaging configuration in the inspected repository. The existing CLI and its queue/manifest assumptions should therefore be treated as a source of platform-specific implementation knowledge—not as the application architecture to embed unchanged.

**Recommendation: proceed after a short owner-decision gate.** The platform adapter boundaries, credential abstraction, per-destination job model, progress events, and retry semantics can be designed now. Implementation should not start until the owner chooses the desktop host/runtime and target operating systems, confirms the local persistence strategy, and accepts the immediate-publishing behavior described below.

The assessment found three high-priority correctness/security issues to address before MVP integration:

1. **YouTube duplicate-upload risk:** `uploadToYouTube()` performs the primary `videos.insert` call, then awaits optional thumbnail and playlist operations before returning the video ID. If either optional operation fails, `run.ts` records the whole target as failed. A retry can create a second primary video.
2. **Facebook Reel memory use:** `uploadReelToFacebook()` uses `fs.readFileSync()` and sends the entire video buffer in one request. This violates the bounded-memory requirement.
3. **Plaintext credentials:** `tokens.ts` persists YouTube refresh tokens and Facebook Page access tokens in `.secrets/tokens.json`. Git-ignored is not equivalent to encrypted or OS-protected.

The current code also hardcodes Facebook Graph API `v21.0`; Meta announced Graph API v27.0 on 2026-11-04. The version should be moved to a single configurable constant and validated against Meta's version/changelog documentation at implementation time.

No code changes, dependency installations, live OAuth flows, or uploads were performed as part of this assessment.

## 2. Repository baseline and desktop-shell assessment

### Evidence inspected

- `package.json`: package name `spoolcast`, Node `>=20`, TypeScript ESM, CLI binary `dist/cli.js`; runtime dependency is `googleapis`; development dependencies are TypeScript, tsx, and Node types.
- `tsconfig.json`: strict TypeScript, NodeNext module resolution, ES2022 target, source rooted at `src/`.
- `.gitignore`: excludes `.secrets/`, `queue/`, `node_modules/`, `dist/`, and local artifacts.
- `README.md`, `CLAUDE.md`, `UPSTREAM.md`, `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`.
- Relevant source files: `src/cli.ts`, `src/run.ts`, `src/config.ts`, `src/manifest.ts`, `src/video.ts`, `src/probe.ts`, `src/state.ts`, `src/tokens.ts`, `src/auth-youtube.ts`, `src/auth-facebook.ts`, `src/upload-youtube.ts`, `src/upload-facebook.ts`, and `src/upload-facebook-reel.ts`.

### Finding

The project is currently a Node.js CLI. Its package scripts expose `start`, `build`, and `typecheck`; no desktop framework/runtime or UI framework is declared. The inspected application flow is invoked from the CLI and reports progress using `console.log` / `process.stdout.write`. No renderer, IPC layer, desktop main-process entry point, local database, or desktop packaging configuration was identified.

The repository therefore does **not** provide evidence for choosing Electron, Tauri, or another desktop host. Do not create an IPC design that assumes one of them has already been approved.

### Existing CLI/product-model mismatch

The CLI discovers files from `queue/`, reads channel/video JSON manifests, and fans out to targets declared in those manifests. The intended Qfat MVP instead needs a user-facing flow in which a user selects one or more destinations for a video. The queue scanner and manifest target-selection model should not be the desktop UI's source of truth.

The README and adapters currently implement scheduled publishing (YouTube `privacyStatus: private` plus `publishAt`; Facebook `published=false` plus `scheduled_publish_time`; Reels `video_state=SCHEDULED`). This conflicts with the accepted Qfat MVP requirement for immediate publishing. Scheduling should be removed from the MVP job path unless an owner-approved product requirement changes that scope.

## 3. Existing flow findings

### 3.1 YouTube upload

**Entry and inputs**

- `src/upload-youtube.ts: uploadToYouTube(videoPath, meta, account)`.
- Loads shared Google OAuth client credentials using `loadGoogleClient()`.
- Builds an OAuth2 client and supplies the selected account's `refresh_token`.
- Calls YouTube Data API v3 `videos.insert` with a Node `fs.createReadStream(videoPath)`.
- `googleapis` reports `onUploadProgress`; the current callback writes percentage text directly to stdout.

**Protocol and memory**

- Uses the standard `videos.insert` media upload with a file stream; it does not load the entire video into a Buffer.
- Google documents resumable media upload for this API. The current implementation delegates transfer/retry behavior to the Google client library, but does not persist an application-owned upload session/checkpoint that can be recovered after an application restart.

**Success boundary and duplicate risk**

- The API response's `id` is checked after the primary insert.
- The adapter then optionally calls `thumbnails.set` and `playlistItems.insert`.
- The adapter returns `{ videoId, url }` only after those optional calls finish.
- `src/run.ts` calls `markPosted()` only after the adapter promise resolves. Any optional-operation error falls into the same catch path as a primary upload error and invokes `markFailed()`.
- Therefore, a successful primary upload followed by a thumbnail/playlist failure can be retried as a new primary upload. This is a confirmed code-path defect relative to Qfat's idempotency requirement.

**Publishing behavior**

- Current request uses `privacyStatus: 'private'` and `publishAt`, i.e. scheduled publishing. The MVP should use an immediate-publication policy, subject to API/account restrictions, and must not require a future `publishAt` value.

### 3.2 Facebook Page long-form video

**Entry and protocol**

- `src/upload-facebook.ts: uploadToFacebook(videoPath, meta, account)`.
- Uses the three-phase resumable `/{page-id}/videos` flow against `graph-video.facebook.com`: start, chunk transfer, finish.
- The start phase receives an `upload_session_id`, `video_id`, and server offsets.
- Transfer uses a 10 MiB chunk buffer, `fs.readSync()`, and a file handle. This is bounded-memory behavior.
- Progress is printed directly to stdout; there is no caller-supplied callback/event interface.

**Success and retry behavior**

- The start phase provides a remote `video_id`, but the adapter does not return it or persist the upload session.
- The adapter returns the start-phase ID after the finish request receives an HTTP-success response.
- The finish response body is not parsed or validated beyond `Response.ok`; a successful HTTP status alone is treated as sufficient.
- If transfer or finish fails, `run.ts` marks the target failed. There is no persisted session ID/offset checkpoint for safe resume, so a retry may create another upload session and remote video object.
- A network timeout after the server commits the finish request is ambiguous; blindly starting a new session is unsafe.

**Publishing behavior**

- Current finish request uses `published=false` and `scheduled_publish_time`. For immediate publishing, the implementation must use the documented immediate-publish form and verify the final API response. Do not carry the schedule-window validation into the MVP.

### 3.3 Facebook Reels

**Entry and protocol**

- `src/upload-facebook-reel.ts: uploadReelToFacebook(videoPath, meta, account)`.
- Uses the Reels flow: Graph API start at `/{page-id}/video_reels`, binary upload to the returned `upload_url` (or the configured rupload host), then Graph API finish.
- Start returns a `video_id` and optionally an `upload_url`.
- Binary upload uses `Authorization: OAuth <page_token>`, `offset`, and `file_size` headers.

**Memory and progress**

- `fs.readFileSync(videoPath)` reads the entire file into memory before the binary request. Memory consumption scales with the full media file size; this must be replaced.
- No upload progress callback exists; progress is only a console message before the request.
- The implementation should use a streaming/chunked transfer strategy with a fixed maximum in-flight buffer, honor server-acknowledged offsets, and keep the Reels-specific rupload protocol separate from the long-form `/videos` adapter. Confirm exact chunk and acknowledgement semantics against the current Meta Reels documentation during implementation.

**Success and retry behavior**

- The remote `video_id` is obtained before the binary transfer and finish phase, but is not persisted.
- Finish uses `video_state: 'SCHEDULED'` and `scheduled_publish_time`.
- If the binary upload or finish fails, a retry starts a new Reel session. A timeout during finish can leave the remote state ambiguous.
- As with long-form video, HTTP success should not be the only completion signal if the API response includes an explicit success/result field.

### 3.4 OAuth and account storage

**YouTube**

- `src/auth-youtube.ts` implements an installed-app loopback OAuth flow using `127.0.0.1:8080`.
- Opens the browser consent URL, requests offline access and consent, exchanges the code, calls `channels.list(mine=true)`, and stores the refresh token under a generated or explicit alias.
- The alias-keyed `TokenStore` supports multiple YouTube channels.
- The loopback desktop OAuth approach remains supported by Google's desktop-app documentation; the current fixed port and CLI/browser launch assumptions will need to be adapted to the selected host.

**Facebook**

- `src/auth-facebook.ts` expects a short-lived user token supplied as a CLI argument or pasted into a terminal prompt.
- Exchanges it for a long-lived user token, calls `/me/accounts`, prompts for one Page, then stores that Page's access token and ID under an alias.
- Multiple Pages are supported by repeating authorization and choosing distinct aliases. There is no integrated browser OAuth/account picker, no desktop account-management interface, and no explicit token-refresh/expiry lifecycle in the current account model.

**Storage**

- `src/tokens.ts: saveTokens()` writes JSON to `.secrets/tokens.json` using temp-file-plus-rename atomicity.
- Atomic writes prevent partial-file corruption but do not encrypt credentials or use the operating system credential vault.
- `loadTokens()` supports multiple accounts and a legacy single-account shape; preserve this multi-account capability when migrating storage.
- Facebook app credentials are also read from a local JSON file or environment variables. Do not confuse app configuration with per-user Page tokens; define a secure deployment/configuration strategy separately.

## 4. Reuse / adapt / replace matrix

| Existing module | Decision | Rationale / target change |
|---|---|---|
| `src/upload-youtube.ts` | **Adapt** | Keep the YouTube Data API call and stream input. Remove CLI logging, inject progress/cancellation, separate primary upload result from optional post-processing, and add durable checkpoint/reconciliation semantics. |
| `src/upload-facebook.ts` | **Adapt** | Reuse the three-phase long-form protocol and bounded chunk reads. Add progress callback, persist session/offset checkpoints, verify finish response, and switch to immediate publishing. |
| `src/upload-facebook-reel.ts` | **Redesign adapter internals** | Keep the Reels-specific start/rupload/finish distinction. Replace whole-file Buffer with bounded streaming/chunk transfer and resumable offset handling. |
| `src/auth-youtube.ts` | **Adapt** | Reuse installed-app OAuth concepts and channel identity lookup. Integrate browser/loopback lifecycle with the selected desktop host and secure credential provider. |
| `src/auth-facebook.ts` | **Redesign UX; reuse API concepts** | Replace terminal token paste/page prompt with a supported browser OAuth/account-selection flow. Retain Page identity/token retrieval only where current Meta permissions and app review allow it. |
| `src/tokens.ts` | **Replace persistence; retain domain model** | Keep typed multi-account aliases and account resolution. Replace JSON token persistence with a credential-store abstraction and secure migration/removal path. |
| `src/state.ts` | **Replace for desktop jobs** | Its JSON ledger is CLI/queue-oriented and lacks transactional job state, checkpoints, per-follow-up status, and recovery. Use a durable job repository selected by the owner. |
| `src/run.ts` | **Replace orchestration, preserve useful rules** | It scans folders and writes stdout. Desktop orchestration should accept an explicit video plus selected destinations, create independent destination jobs, and emit events. |
| `src/config.ts` | **Adapt** | Keep platform constants in one place; update the Graph API version and remove schedule constants from the immediate-publish MVP path. |
| `src/manifest.ts`, `src/video.ts`, `src/probe.ts` | **Selective reuse** | Reuse metadata validation, MIME detection, and MP4/MOV dimension probing where relevant. Do not require queue manifests or `publishAt` for a desktop job. |
| `README.md`, `CLAUDE.md`, upstream license/docs | **Preserve and revise carefully** | Keep upstream attribution and MIT license. Update product-facing docs only after the new desktop behavior is implemented; retain upstream history/provenance. |

## 5. Recommended target architecture

Keep platform protocol code independent from UI and job persistence.

1. **Desktop host (not yet selected):** owns window lifecycle, app permissions, secure-store access, local database, and the trusted boundary to the renderer.
2. **Application service / UploadJobService:** accepts a video source, metadata, and one or more explicit destination account IDs. Creates one destination job per platform account; orchestrates validation, upload, follow-ups, retry, cancellation, and recovery.
3. **Platform adapters:** YouTube, Facebook long-form, and Facebook Reels implement a shared contract. They must not import UI APIs, write to stdout, read the desktop database directly, or load secrets from JSON.
4. **CredentialProvider:** resolves a selected account's secret only inside the trusted main/service process. Renderer/UI receives safe account metadata (alias, channel/Page name, platform, status), never tokens.
5. **JobRepository:** persists job/destination state, remote IDs, upload session checkpoints, timestamps, errors, and optional-operation results. A transactional local database (SQLite is a candidate) is preferable to a JSON ledger for concurrent and crash-recoverable jobs; owner approval is required before choosing the implementation.
6. **ProgressEventPublisher:** emits typed, serializable progress and state events to the desktop UI through the eventual host's IPC/event mechanism. The adapter contract must not depend on Electron IPC or Tauri events directly.

### Illustrative TypeScript boundary

```ts
type Platform = 'youtube' | 'facebook';
type FacebookFormat = 'video' | 'reel';

interface UploadDestination {
  platform: Platform;
  accountId: string; // stable app-owned account identifier, not a token
  format?: FacebookFormat;
}

interface UploadProgressEvent {
  jobId: string;
  destinationId: string;
  platform: Platform;
  phase: 'validating' | 'initializing' | 'transferring' |
         'finalizing' | 'post-processing';
  bytesTransferred?: number;
  totalBytes?: number;
  percent?: number;
  message?: string; // sanitized; never include credentials
  occurredAt: string;
}

interface PrimaryUploadResult {
  remoteVideoId: string;
  permalink?: string;
  completedAt: string;
}

interface UploadAdapter {
  uploadPrimary(
    input: UploadInput,
    context: {
      credentialProvider: CredentialProvider;
      signal: AbortSignal;
      onProgress(event: Omit<UploadProgressEvent, 'jobId' | 'destinationId'>): void;
      checkpoint(data: UploadCheckpoint): Promise<void>;
    },
  ): Promise<PrimaryUploadResult>;
  runOptionalActions?(
    result: PrimaryUploadResult,
    input: UploadInput,
    context: { signal: AbortSignal; onProgress(event: UploadProgressEvent): void },
  ): Promise<OptionalActionResult[]>;
}
```

The actual public types should be finalized after the host/runtime is chosen. The important invariants are that adapters return the primary remote ID independently, receive cancellation/progress/checkpoint capabilities as dependencies, and never own UI or database implementation details.

### Suggested destination-job lifecycle

`queued → validating → initializing → transferring → finalizing → uploaded → post_processing → completed`

Additional terminal/recovery states: `failed`, `cancelled`, `interrupted`, and `needs_reconciliation`.

Keep status per **video × destination account**, not per video alone. One destination can succeed while another fails. Preserve unlimited/multiple account support; do not introduce an arbitrary two-channel/two-Page limit. Any practical concurrency limit should be a configurable resource policy, not an account-count product restriction.

## 6. Credential-storage options

The desktop target OS list is not yet specified, so no dependency should be approved in this assessment.

| Option | Platform coverage / behavior | Maintenance and trade-offs | Assessment |
|---|---|---|---|
| Electron `safeStorage` (if Electron is selected) | Uses OS-provided protection: macOS Keychain, Windows DPAPI, and Linux secret-store providers including Secret Service/KWallet. Current docs recommend the asynchronous API. Linux can fall back to `basic_text` when no usable secret store exists. | Integrated with Electron main process; encrypted values are still stored in an app-managed file/database. Must detect and reject weak Linux fallback if policy forbids it. macOS code signing affects Keychain consistency. | Good fit only if Electron is selected. Use async methods and fail closed when Linux backend is `basic_text`; do not expose secrets to renderer. |
| `@napi-rs/keyring` / Rust keyring binding | Node binding to native keyring services; package documents macOS, Windows, and Linux usage. Linux can select Secret Service or kernel keyutils; keyutils is in-memory and does not persist across reboot. | Recent releases and bundled native binaries reduce local build friction, but native packaging/architecture support and platform CI must be tested. Pin Linux to Secret Service for persistent credentials rather than silently accepting keyutils fallback. | Candidate for a Node-based main process independent of Electron, subject to OS/architecture validation. |
| `keytar` | Historically wraps macOS Keychain, Linux Secret Service/libsecret, and Windows Credential Vault. | Upstream `atom/node-keytar` was archived on 2022-12-15. Native build and maintenance risk are unattractive for a new project. | Do not select for new Qfat work. |

**Recommendation:** define a narrow `CredentialProvider` / `CredentialStore` interface first. After the desktop host and supported OS list are approved, compare Electron's async `safeStorage` with `@napi-rs/keyring` in a small platform spike. The selected implementation must fail closed if secure storage is unavailable; it must never silently write plaintext tokens. Include credential migration from the old JSON file, token deletion/revocation, account replacement, and backup/restore behavior in the design. Do not install a credential package until that spike is authorized.

## 7. Progress, cancellation, and error contract

- Emit structured events with stable `jobId` and `destinationId`; do not parse console text in the UI.
- Progress should identify the phase and use bytes transferred / total bytes where the API exposes them. Percent is optional when total size is unknown.
- Emit state transitions separately from transfer progress so the UI can show queued, uploading, published, follow-up warning, failure, and cancellation.
- Pass an `AbortSignal` to adapters and abort active HTTP requests/streams where supported. Cancellation must preserve checkpoints and must not be mislabeled as an ordinary platform failure.
- Sanitize API error bodies before persistence/display. Never persist access tokens, refresh tokens, authorization headers, OAuth codes, or token-bearing URLs in logs or reports.
- Distinguish retryable transport/rate-limit/server failures from permanent permission/validation failures. Apply bounded exponential backoff with jitter only where retrying the operation is safe.
- Expose optional post-processing status (thumbnail, playlist) independently from primary upload status.

## 8. Idempotency and recovery design

The current single `posted | failed` ledger is too coarse. A destination job needs durable stage-specific information.

### YouTube

1. Persist a job as `initializing/uploading` before the API call.
2. Use resumable upload support and capture any session/checkpoint information the client library makes available.
3. When `videos.insert` returns a valid video ID, persist `remoteVideoId` and mark the primary upload complete **immediately**, before calling thumbnail or playlist endpoints.
4. Run thumbnail and playlist actions as separate optional operations with their own status/error fields. A failure here must not re-run `videos.insert`.
5. If the connection is lost after the server may have committed the insert but before the client receives the ID, mark the job `needs_reconciliation`. Do not automatically issue a second insert without a reliable way to prove the first did not create a video.

### Facebook long-form video

1. Persist the returned `upload_session_id`, `video_id`, and acknowledged offsets after start.
2. Transfer chunks using server-provided offsets; persist updated offsets after each acknowledged chunk.
3. Finalize the existing session. Verify the finish response and/or query the created video status before marking the destination published.
4. On retry, resume/reconcile the existing session and remote video ID; do not blindly create a new session after an ambiguous transfer or finish timeout.

### Facebook Reels

1. Persist the `video_id`, returned `upload_url` (if supplied), file size, and acknowledged offset after start.
2. Stream bounded chunks to the rupload endpoint, honoring the protocol's offset/acknowledgement behavior.
3. Persist checkpoints and finish the existing Reel session.
4. If finish outcome is ambiguous, reconcile the existing `video_id` before any new start request.

**Important limitation:** platform APIs do not necessarily provide a universal client-supplied idempotency key. The application cannot guarantee exactly-once creation when a request times out after the provider commits but before the response reaches the client. The safe behavior is to persist checkpoints and use `needs_reconciliation` rather than silently creating a duplicate. A user-facing explicit “retry as new upload” action may be needed after reconciliation fails.

## 9. Bounded-memory Facebook Reel transfer

Replace `readFileSync()` with a file-handle/stream-based transfer loop:

- Open the media file once and obtain its size.
- Read at most a configured fixed chunk size (for example, 8–16 MiB) into memory at any time.
- Send each chunk with the protocol-required `offset` and `file_size` headers.
- Advance only from the offset acknowledged by the server; do not assume every request consumed the whole chunk.
- Persist the acknowledged offset after each successful transfer response.
- Close the file handle in `finally`; honor cancellation and retry only from the acknowledged offset.
- Keep Reels start/finish calls on Graph API and binary transfer on the rupload host. Do not merge Reel and long-form upload implementations because their protocols differ.
- Add tests with a large sparse/fixture file and an instrumented reader to assert that no read exceeds the configured chunk bound and no whole-file Buffer is created.

The exact chunk size and response semantics must be confirmed against the current Meta Reels publishing guide when implementing; this assessment does not perform an authenticated upload.

## 10. Facebook Graph API version

**Recommendation as of 2026-11-10: use Graph API v27.0 for new integration work**, after confirming that the required Page video and Reels endpoints behave as expected under that version in a non-production test app.

Evidence:

- Meta for Developers' official developer-news page lists **“Introducing Graph API v27.0 and Marketing API v27.0”** and links to the v27.0 changelog. The announcement is dated 2026-11-04 in the developer-news feed.
- The current code's `src/config.ts` still pins `FB_GRAPH_VERSION = 'v21.0'`. This is stale relative to Meta's v27.0 announcement.
- Set the version in one shared configuration location and use it consistently for Graph API calls, `graph-video` upload calls, and the Reels rupload version path. Do not mix versions across phases of a single upload session.

Official references (accessed 2026-11-10):

- Meta developer news: https://developers.meta.com/resources/blog/ (entry: “Introducing Graph API v27.0 and Marketing API v27.0”).
- Meta Graph API changelog: https://developers.facebook.com/docs/graph-api/changelog/
- Meta Graph API versions: https://developers.facebook.com/docs/graph-api/changelog/versions/
- Meta Reels publishing guide: https://developers.facebook.com/docs/video-api/guides/reels-publishing/
- Meta Page videos reference: https://developers.facebook.com/docs/graph-api/reference/page/videos/

**Verification limitation:** Meta's changelog/version and Reels guide URLs were identified, but direct page retrieval returned HTTP 429 during this assessment. The v27.0 release is confirmed by Meta's official developer-news listing; endpoint-specific breaking-change compatibility and the precise Reels chunk contract must be rechecked against the linked Meta docs before implementation or release. Do not infer that the newest version automatically guarantees every endpoint's compatibility.

## 11. Risks, assumptions, and owner decisions

### High-priority risks

| Risk | Severity | Mitigation |
|---|---|---|
| YouTube primary upload followed by optional-action failure can create duplicates on retry | Critical | Persist primary video ID before optional actions; split primary and follow-up state. |
| Facebook Reel whole-file read causes memory spikes/OOM | High | Bounded chunk streaming with acknowledged-offset checkpoints. |
| Tokens stored in plaintext JSON | Critical | OS credential store abstraction; fail closed; migrate and remove plaintext copies securely. |
| Ambiguous provider timeout may create duplicate remote video | High | Durable checkpoints, reconciliation state, no blind retry. |
| Current Graph API version is stale (`v21.0`) | High | Upgrade to v27.0 after endpoint compatibility verification; centralize version. |
| CLI console output is the only progress surface | High | Typed progress/state events and cancellation contract. |
| Scheduled-publish assumptions conflict with immediate MVP | High | Remove schedule requirements and use immediate publish parameters; update tests/docs. |
| Host/runtime is undefined | Blocking | Owner chooses Electron/Tauri/other and target OS list before host-specific implementation. |

### Owner decisions required before implementation

1. **Desktop host:** Electron, Tauri, or another runtime? Which operating systems and CPU architectures are in MVP?
2. **Persistence:** approve SQLite or another durable local job store? Define backup/restore expectations.
3. **Immediate publishing:** confirm that YouTube videos should be public immediately and Facebook videos/Reels should use the platform's immediate-publish state. Confirm whether the UI may offer a private/unpublished option later.
4. **Optional YouTube actions:** are custom thumbnails and playlist insertion in MVP, and should their failure be a warning while the primary upload remains successful?
5. **Facebook permissions:** confirm the Meta app ownership/review state and the Page permissions/scopes available for production distribution.
6. **Account UX:** confirm users may connect multiple channels and Pages, select one or more destinations per video, and manage/remove each account.
7. **Recovery UX:** approve a `needs_reconciliation` state and explicit user action when the provider's outcome cannot be determined safely.
8. **Supported file constraints:** define maximum video size, supported codecs/containers, and whether pre-upload validation/transcoding is in scope.

## 12. Staged implementation plan

Each stage should be a separate GPT-authored task after owner approval. No stage below is authorized by this assessment.

### QFAT-002 — Desktop host and architecture decisions

- **Scope:** Record the approved desktop host, OS/architecture matrix, process boundaries, persistence choice, packaging assumptions, and immediate-publish policy in an ADR.
- **Exclusions:** No app shell, UI, adapter, database, or credential code.
- **Acceptance criteria:** ADR answers all owner decisions in §11; identifies main/trusted process and renderer boundary; specifies local job persistence and supported platform matrix.
- **Verification:** Review ADR against Issue #1 and QFAT-001; check all decisions are explicit and internally consistent. No build/test command required.

### QFAT-003 — Upload job domain and persistence foundation

- **Scope:** Define job/destination entities, state machine, transaction boundaries, remote ID/checkpoint persistence, retry/reconciliation semantics, and repository interface. Implement selected local persistence only after QFAT-002.
- **Exclusions:** No live platform API calls, OAuth, desktop UI, or production credentials.
- **Acceptance criteria:** Multiple destinations per video; independent per-destination outcomes; stage-specific status; atomic checkpoint updates; crash/restart recovery tests; ambiguous outcomes enter reconciliation rather than blind retry.
- **Verification:** `npm run typecheck`; `npm run build`; `npm test` after a test script is introduced. Add deterministic repository/state-machine tests.

### QFAT-004 — Secure credential provider and account model

- **Scope:** Implement the approved OS credential backend behind `CredentialProvider`; account metadata storage; multi-account CRUD; migration strategy for existing JSON tokens.
- **Exclusions:** No UI polish, uploads, or plaintext fallback.
- **Acceptance criteria:** Tokens never appear in app database/JSON/logs; Linux without a secure persistent backend fails closed; add/read/replace/delete works for multiple accounts; migration does not silently leave active plaintext copies.
- **Verification:** `npm run typecheck`; `npm run build`; mocked credential-provider tests; platform smoke tests on every supported OS/architecture.

### QFAT-005 — YouTube primary upload adapter

- **Scope:** Refactor `videos.insert` into the adapter contract; progress and cancellation; primary video ID persistence; optional thumbnail/playlist actions as separate follow-ups; immediate-publish behavior.
- **Exclusions:** No live upload in CI; no Facebook changes.
- **Acceptance criteria:** File is streamed; progress events are structured; primary ID is checkpointed before optional actions; optional-action failure never triggers another primary insert; ambiguous insert outcome is not blindly retried.
- **Verification:** `npm run typecheck`; `npm run build`; mocked YouTube API tests covering success, progress, cancellation, retryable errors, optional-action failure, and ambiguous timeout.

### QFAT-006 — Facebook Page video and Reel adapters

- **Scope:** Refactor long-form and Reel adapters for immediate publishing, v27.0, progress/cancellation, session/offset checkpoints, and bounded-memory Reel transfer.
- **Exclusions:** No OAuth UI, desktop UI, or live production uploads.
- **Acceptance criteria:** Long-form and Reel protocols remain distinct; Reel memory remains bounded by configured chunk size; offsets/checkpoints persist; finish responses are validated; retries resume/reconcile existing remote sessions; API version is consistent across phases.
- **Verification:** `npm run typecheck`; `npm run build`; mocked fetch/stream tests; large-fixture memory-bound test; Meta test-app smoke test only after explicit authorization.

### QFAT-007 — Platform account authorization and management

- **Scope:** Integrate YouTube desktop OAuth and Facebook Login/account selection with the approved host; store tokens only through the secure provider; support multiple channels/Pages.
- **Exclusions:** No uploads, scheduling, or arbitrary account-count cap.
- **Acceptance criteria:** Connect, list, select, rename/alias, replace, and disconnect accounts; no secrets cross into renderer; OAuth errors and revocation are surfaced safely.
- **Verification:** `npm run typecheck`; `npm run build`; mocked OAuth tests; manual sandbox-app authorization on supported OS targets.

### QFAT-008 — Desktop upload workflow integration

- **Scope:** Build the user flow to select a video, metadata, and one or more destinations; submit jobs; show per-destination progress/results; cancel and retry safely.
- **Exclusions:** Scheduling, bulk automation, and unrelated CMS/creator features unless separately approved.
- **Acceptance criteria:** User can choose multiple connected accounts across platforms; each destination has independent state; progress and failure details update without parsing logs; app restart restores jobs; no token reaches renderer.
- **Verification:** `npm run typecheck`; `npm run build`; unit/integration tests; Playwright or host-appropriate desktop E2E tests; no live upload without explicit approval.

## 13. Verification and execution record

### Performed

- Confirmed the task commit `f9badf37d8ceac644990aa5f59d5653e9cf91dc5` and inspected the current `main` file contents through GitHub.
- Read the task specification, workflow instructions, package metadata, README/upstream guidance, TypeScript configuration, ignore rules, and relevant upload/auth/state/config source modules.
- Reviewed official YouTube API upload documentation and Google's desktop OAuth documentation.
- Reviewed Meta's official developer-news listing announcing Graph API v27.0; attempted to retrieve Meta changelog/version and Reels publishing pages, but those pages returned HTTP 429.
- Compared the implementation with the accepted Qfat product constraints.

### Not performed

- No local clone, local OpenCode execution, shell commands, or local `git status` check.
- No dependency installation, build, typecheck, test suite, or static-analysis command.
- No credential creation, OAuth authorization, Meta app access, or live platform request/upload.
- No source-code or package metadata modification.
- No desktop-host selection or implementation.

This is an architecture assessment, not an implementation or QA pass. A local agent's `git status` could not be verified because no local agent run occurred. The only intended repository artifact from this task is this report.

## 14. References

### Repository evidence

- `README.md`
- `CLAUDE.md`
- `UPSTREAM.md`
- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `package.json`
- `tsconfig.json`
- `src/upload-youtube.ts`
- `src/upload-facebook.ts`
- `src/upload-facebook-reel.ts`
- `src/auth-youtube.ts`
- `src/auth-facebook.ts`
- `src/tokens.ts`
- `src/state.ts`
- `src/run.ts`
- `src/config.ts`

### Platform / credential references (accessed 2026-11-10)

- YouTube `videos.insert`: https://developers.google.com/youtube/v3/docs/videos/insert
- YouTube upload guide: https://developers.google.com/youtube/v3/guides/uploading_a_video
- Google OAuth 2.0 for desktop apps: https://developers.google.com/identity/protocols/oauth2/native-app
- Google loopback migration guidance: https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration
- Meta Graph API v27.0 announcement: https://developers.meta.com/resources/blog/
- Meta Graph API changelog: https://developers.facebook.com/docs/graph-api/changelog/
- Meta Graph API versions: https://developers.facebook.com/docs/graph-api/changelog/versions/
- Meta Reels publishing: https://developers.facebook.com/docs/video-api/guides/reels-publishing/
- Meta Page videos: https://developers.facebook.com/docs/graph-api/reference/page/videos/
- Electron `safeStorage`: https://www.electronjs.org/docs/latest/api/safe-storage
- `@napi-rs/keyring`: https://www.npmjs.com/package/@napi-rs/keyring
- Archived `node-keytar` repository: https://github.com/atom/node-keytar (archived 2022-12-15)

---
