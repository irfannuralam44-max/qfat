# QFAT — Spoolcast Invocation Boundary Design

- **Task:** QFAT-023
- **Status:** Decision-support design; runtime topology **NOT SELECTED**
- **Evidence baseline:** `main` at `5e5c4b74c55abac709bbbf9f01ab0e502d0df83b`
- **Owner authority:** Documentation and read-only investigation only. No runtime implementation is authorized.
- **Product boundary:** QFAT is the frontend; Spoolcast remains the publishing core.

## 1. Executive assessment

The repository contains useful pieces for a future local invocation boundary, but it does **not** currently contain a safe, end-to-end QFAT-to-Spoolcast publishing entry point.

Verified reusable pieces:

- QFAT-015 made the three existing video upload adapters callable with explicit account/credential inputs, immediate/scheduled mode options, measured byte-progress callbacks, quiet mode, and structured results.
- The QFAT Fastify server already has loopback binding, session/CSRF helpers, and a browser-to-server Vite proxy.
- QFAT media intake stores media under an application-managed root and exposes opaque media IDs rather than filesystem paths to the browser.

Blocking gaps:

1. The root Spoolcast package is a separate ESM package with a CLI binary, no declared service export/API, and no dependency relationship from `@qfat/server`. Its CLI is a queue-scanning, side-effecting command, not a one-item request interface.
2. QFAT's encrypted `CredentialProvider` stores opaque payloads but has no account/OAuth domain model or verified mapping to Spoolcast's `.secrets/tokens.json`, Google client file, or Facebook app credentials.
3. Current QFAT browser security is an origin/session/CSRF boundary, not user authentication or per-account authorization. The frontend is deliberately reachable over LAN/Tailscale while the API is loopback behind Vite. Publishing through that same surface would need an explicit Owner decision about who may initiate an irreversible provider action.
4. QFAT media records and Spoolcast adapter inputs do not yet meet at a verified publishing handoff. The adapters require an absolute local video path and resolved Spoolcast metadata; the media API exposes no path, and media intake also accepts images and formats outside Spoolcast's `.mp4/.mov` video input set.
5. The approved immediate mode still has a Spoolcast manifest/CLI mismatch. The manifest requires `publishAt` and validates Facebook's schedule window for a Facebook target; the legacy CLI does not pass `immediate: true`.

**Conclusion:** no option can be selected as implementation-ready from current source alone. An in-process call to the QFAT-015 adapters is the narrowest candidate worth evaluating first, because those functions already accept explicit inputs and callbacks; however, package boundary, credential ownership/mapping, media resolution, request security, and progress transport remain unresolved. This is not approval to implement that candidate. Record the required choices as **OPEN OWNER DECISION** below.

## 2. Evidence labels and authority

- **VERIFIED EXISTING BEHAVIOR** — directly visible in the inspected `main` source or current project documents.
- **PROPOSED DESIGN** — a conceptual boundary/contract for discussion; not implemented or approved.
- **ASSUMPTION REQUIRING VALIDATION** — plausible but not proven by current source or runtime evidence.
- **OPEN OWNER DECISION** — a product, security, credential-ownership, or runtime choice requiring explicit Owner direction.
- **OUT OF SCOPE** — explicitly prohibited by QFAT-023 or current product scope.

Authority remains `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`, current PRD/architecture and Owner decisions. Source proves implementation facts; it does not authorize reuse or expansion.

## 3. Verified current topology

### 3.1 Spoolcast package and CLI

**VERIFIED EXISTING BEHAVIOR**

- Root `package.json` names the package `spoolcast`, sets ESM (`"type": "module"`), exposes only the `spoolcast` binary at `dist/cli.js`, includes `dist` in published files, and declares Node `>=20`.
- Root TypeScript uses `NodeNext`, `rootDir: "src"`, and emits the core into root `dist/`. There is no package `exports` map or declared service entry point.
- `src/cli.ts` dispatches by dynamic import because importing a command entry module runs its `main()` at module load. The `run` command imports `./run.js`.
- `src/run.ts` is a CLI orchestration entry point. It scans `SPOOLCAST_HOME/queue` (or the current working directory's `queue/`), reads channel/video manifests, loads tokens, processes every queued item × target, writes the Spoolcast ledger, prints console output, and terminates the process. It is not a one-item JSON request handler.
- `src/config.ts` derives `.secrets/`, `queue/`, token file, Google client file, Facebook app file, and ledger paths from `SPOOLCAST_HOME` or process CWD.
- Root package has no declared dependency/workspace link from `apps/server/package.json`; `@qfat/server` is its own ESM package with Node `>=22`, its own TypeScript config/build output, and its own dependency set. Both packages are Node ESM, but that alone does not establish a supported import/API boundary.

**Important mismatch:** importing `src/cli.ts` or `src/run.ts` is not a safe service call: it executes CLI dispatch/orchestration at import time, consumes process arguments, scans a whole queue, loads the Spoolcast token store, writes the existing ledger, logs human-readable output, and has no request-scoped return/progress contract. A child process running `spoolcast run` therefore does not mean “publish this selected QFAT media item to these selected targets”.

### 3.2 Existing callable upload adapters

**VERIFIED EXISTING BEHAVIOR**

- `src/upload-youtube.ts`: `uploadToYouTube(videoPath, meta, account, options?)`. Options include explicit Google client credentials, explicit refresh token, `immediate`, byte-progress callback, and `quiet`. Result includes `videoId`, `url`, and optional thumbnail/playlist outcomes.
- `src/upload-facebook.ts`: `uploadToFacebook(videoPath, meta, account, options?)`. Options include `immediate`, byte-progress callback, and `quiet`; it takes a resolved `FacebookAccount` and returns `videoId`.
- `src/upload-facebook-reel.ts`: `uploadReelToFacebook(videoPath, meta, account, options?)`. It has equivalent immediate/progress/quiet options and returns `videoId`; binary upload uses a bounded-memory stream.
- These are adapter functions, not a complete QFAT service. They do not load QFAT media records, select accounts, validate a browser request, coordinate a selected target set, or define HTTP/IPC progress delivery. Upload functions themselves do not own the Spoolcast ledger.
- YouTube's adapter may load `google-client.json` when explicit client credentials are omitted. Its account type carries `refresh_token`. Facebook's account type carries `page_id` and `page_token`. Those are secrets and must remain server/process-side.

### 3.3 QFAT server and browser request path

**VERIFIED EXISTING BEHAVIOR**

- `apps/server/src/index.ts` builds Fastify, opens/migrates QFAT SQLite, ensures/recover media storage, registers `GET /api/v1/health`, browser-security routes, and media routes. It does not register publishing/OAuth/account routes or invoke Spoolcast.
- The server listens on `127.0.0.1:3001`; graceful shutdown handles SIGINT/SIGTERM, shuts down the in-memory session store, and closes Fastify/SQLite. No child process is currently started or supervised.
- `apps/web/vite.config.ts` listens on `0.0.0.0:5173` and proxies `/api/v1` to `http://127.0.0.1:3001` while preserving the browser-facing Host header (`changeOrigin: false`). This supports browser access over configured LAN/Tailscale interfaces while the API itself stays on loopback.
- The browser `SecurityClient` restricts requests to relative `/api/v1` paths, uses `credentials: include`, bootstraps a session, keeps the CSRF token in browser memory, and attaches `X-CSRF-Token` to state-changing requests.
- Server security validates canonical HTTP Origin and matching Host, allowing numeric IPv4 addresses in loopback, RFC1918, or Tailscale CGNAT ranges on frontend port 5173. Bootstrap is process-rate-limited to 10 attempts per 60 seconds. Session IDs are HttpOnly cookies; sessions are in-memory with a 30-minute expiry. Mutations require session + matching CSRF token. Read routes require Origin/Host + session.
- The cookie is `HttpOnly; SameSite=Strict; Path=/` and does not set `Secure`; current documented topology is HTTP local access. This is not transport encryption.
- Current media route uses the mutation guard for upload/delete and the read guard for list/detail. Upload storage caps a media body at 512 MiB, validates a detected file signature, stores a generated storage key, and protects managed paths against traversal/symlink escape. API responses return media metadata and opaque ID, not the filesystem path.
- QFAT's media intake accepts supported image signatures as well as video signatures (MP4/QuickTime and WebM). Spoolcast's configured video extensions are only `.mp4` and `.mov`.

**Security scope limit:** current controls establish a browser-origin/session/CSRF boundary for existing routes. They do not establish an authenticated human identity, per-account permissions, a publishing-specific confirmation policy, or an authorization relationship between a browser session and a Spoolcast account. Because the UI is reachable through LAN/Tailscale, a publishing route on the same surface could be callable by another device/browser that can bootstrap an allowed-origin session. This must not be treated as an acceptable publishing authorization model without an explicit Owner decision.

## 4. Credentials and account ownership

### 4.1 Existing Spoolcast ownership

**VERIFIED EXISTING BEHAVIOR**

- `src/tokens.ts` defines `TokenStore` as platform-keyed maps of user-chosen aliases. YouTube account values contain `refresh_token`, optional channel ID/title; Facebook account values contain `page_id`, `page_token`, optional page name.
- `loadTokens()` reads `SPOOLCAST_HOME/.secrets/tokens.json`; `saveTokens()` writes that store. `loadGoogleClient()` reads `google-client.json`; `loadFbAppCreds()` reads environment variables or `fb-app.json`.
- `getYouTubeAccount` / `getFacebookAccount` resolve an alias or allow an unqualified platform only when exactly one account exists. The upload adapters receive the resolved account object.

### 4.2 Existing QFAT credential boundary

**VERIFIED EXISTING BEHAVIOR**

- `apps/server/src/credentials/provider.ts` defines an opaque `CredentialProvider` interface: `store(context, Buffer)`, `retrieve(context)`, and `delete(context)`.
- Its current `KeyFileCredentialProvider` encrypts opaque payloads into QFAT SQLite using AES-256-GCM and a separate key file. `CredentialContext` is `{ id, purpose, provider }`; the ID is an internal credential-record ID, not a provider account ID.
- This module is storage infrastructure only. Inspection found no implemented OAuth account entity, token schema for Spoolcast's `TokenStore`, account-alias mapping, or publishing route consuming those credential records.

**OPEN OWNER DECISION — credential source of truth and account mapping**

Owner must decide whether Spoolcast's existing token files remain authoritative for the first integration, whether QFAT credential records are intended to become authoritative, or whether an explicit mapping layer is desired. The current task cannot choose among them. Any future choice must specify how an opaque QFAT account ID maps to a Spoolcast alias and how Google client/Facebook app credentials are made available server-side without copying or returning raw secrets. No migration, dual-write, token duplication, or new token owner is implied.

## 5. Candidate invocation options

| Option | Source evidence and prerequisites | Benefits | Risks / failure modes | Security implications | Complexity / changes | Owner approval |
|---|---|---|---|---|---|---|
| **A. QFAT server calls adapters in-process** | QFAT-015 adapters already accept explicit file path, resolved metadata, account inputs, options, and callbacks. However, root Spoolcast has no service export; server is a separate package with independent build config and no declared dependency. CLI entry modules are unsafe to import. | No child startup/IPC; direct typed result and measured progress callback; exceptions remain in one process; easiest way to call the already-existing adapters without turning CLI into a service. | Package/build coupling; adapter/network call can hold a Fastify request open; server crash terminates the upload; no current AbortSignal/cancel contract; process-wide memory/CPU contention; in-process import path/API would need an approved boundary. | Provider secrets stay in server memory if resolved server-side, but any route must have publishing authorization beyond today's session/CSRF check; secrets/errors/logs must be redacted. | Requires an explicit supported package/module boundary, build/runtime packaging decision, input/account/media resolution, and a progress transport. No such wiring exists today. | **OPEN OWNER DECISION** on import boundary, credentials, session authorization, and progress delivery. |
| **B. QFAT server starts a bounded one-shot child process** | CLI exists as `dist/cli.js`, but `spoolcast run` scans the configured queue and uses files/aliases; no single-item command, JSON request contract, structured result stream, or caller-supplied immediate option exists. | Process isolation; OS process can be terminated; Spoolcast environment/CWD can be bounded; server need not import its modules directly. | Existing command performs the wrong unit of work (whole queue), has CLI output not a protocol, no reliable per-target progress events, and kill/timeout may leave provider upload outcome ambiguous. Child exit is not proof of provider/public state. | Child inherits selected environment unless deliberately constrained; token files and app credentials are accessible to it. Must not pass secrets in argv or echo them in stdout/stderr. Local process permissions remain same OS user. | Not viable as-is for a single QFAT action. A new CLI/service command or machine protocol would be a source/runtime change expressly forbidden here. | **OPEN OWNER DECISION** if a separately authorized one-shot command boundary is preferred; current CLI is not sufficient. |
| **C. Supervised persistent child / IPC** | No existing IPC protocol, worker, supervisor, service process, or publishing daemon. Server shutdown only closes Fastify/session/DB. | Could amortize startup and support a persistent progress channel. | Adds lifecycle/restart/backpressure/deadlock/versioning/crash recovery concerns; orphaned process and in-flight provider state; more complex cancellation; protocol compatibility burden. It risks becoming a long-lived service/worker subsystem. | Additional IPC endpoint/channel permissions and secret-handling surface; supervisor must ensure only the intended local server can communicate. | Highest complexity; new persistent process and protocol are not the minimum demonstrated by source. | **OUT OF SCOPE by default**; would require explicit architecture and owner approval, and may violate the product boundary. |

### Assessment

- Option A is the narrowest *candidate* because the adapters already have caller-oriented function signatures and callbacks. It is not ready to implement: package boundary, build coupling, credentials, media resolution, and browser authorization are unresolved.
- Option B is not a usable adapter for a selected QFAT item today. The existing CLI's command semantics are broader and side-effecting.
- Option C has no source evidence of necessity and should not be selected to solve missing progress or long-running-request questions.
- Therefore **no invocation topology is selected**. Do not interpret Option A being the first candidate for further design as architecture approval.

## 6. Minimum conceptual invocation contract

The following is **PROPOSED DESIGN for discussion only**, not an API schema or authorization to implement.

### 6.1 Request intent

One bounded invocation should describe one content item and its selected targets, not a queue or batch of unrelated content:

- `mediaId`: opaque QFAT media record ID; never a client-supplied filesystem path.
- Content fields needed to construct the existing Spoolcast `ResolvedMeta`: title, description, tags, category ID, format, made-for-kids flag, optional playlist ID. Validation and allowed limits remain to be specified.
- `targets[]`: platform plus opaque QFAT account identifier or approved Spoolcast alias. Never accept token values, page tokens, refresh tokens, client secrets, or provider URLs from the browser.
- `mode`: `immediate` or `schedule`.
- For `schedule` only: one date/time with an explicit UTC offset or an unambiguous timezone-aware representation. Normalize once to one instant and serialize for all selected targets (YouTube RFC 3339 UTC; Facebook Unix seconds), per QFAT-022.
- No per-target timestamps in MVP.

### 6.2 Server-side resolution

A future boundary would need to:

1. Validate the request shape, allowed platform/format combinations, metadata lengths, target count/duplicates, and mode-specific schedule fields.
2. Resolve `mediaId` through QFAT's own database and media root; verify the record exists, the file is a regular managed file under the configured root, and it is a Spoolcast-supported video extension (`.mp4` or `.mov`). Never trust a browser path.
3. Resolve account identifiers through an Owner-approved mapping and load the Spoolcast account object and app credentials only in the trusted Node process.
4. Build the adapter's existing `ResolvedMeta` input from validated content fields and the single normalized timestamp. The immediate path cannot safely use the current `readManifest` contract unchanged; see §8.
5. Invoke each selected target independently, preferably sequentially initially to match the verified current CLI behavior and avoid implying simultaneous completion. Preserve each target's own outcome even if a prior target fails.

This list does not create a queue, durable job, retry policy, or separate publishing ledger.

### 6.3 Result and progress semantics

**PROPOSED DESIGN**

- Final result is per target: stable non-secret target reference, `accepted`/success or `failed`, provider video ID/URL when returned, and a sanitized error code/message on failure.
- Schedule success means **Scheduled / provider accepted**, not Published/Live. Publish Now success means the adapter/provider operation returned success; public visibility must not be claimed unless verified by provider state.
- Progress events contain target reference, measured `bytesSent`, `totalBytes`, and a phase label only when phase is known. The current adapters expose byte counts but not a uniform start/finish lifecycle callback.
- Do not return account objects, tokens, client secrets, raw provider responses, or unsanitized exception bodies to the browser.
- Do not store a new durable publishing ledger. Existing `posted | failed` state does not distinguish scheduled acceptance from public visibility.

**Transport remains OPEN OWNER DECISION.** A single ordinary JSON response cannot display live byte progress while the request is still running. In-process callbacks could be bridged through a future streaming response/event channel, but no publishing event route or transport exists. The child CLI's current console output is human-readable, not a stable machine protocol. Do not add SSE, WebSocket, polling, or a job resource by assumption.

### 6.4 Synchronous execution and cancellation

A single adapter call is promise-based and can remain active for the duration of the provider upload. Facebook Page video uses multiple confirmed transfer chunks; Reels streams a request body; YouTube reports measured bytes through its client callback. There is no adapter-wide timeout or AbortSignal contract in the inspected signatures.

- A synchronous HTTP request is conceptually possible only if the chosen server/proxy/browser request lifetime can safely accommodate the largest permitted media and provider duration. No such bound is established by current source.
- Aborting the browser fetch or closing the HTTP connection must **not** be represented as proof that the provider upload stopped. Current adapter signatures do not accept an AbortSignal.
- A child process kill can stop local execution but cannot guarantee rollback of a provider request already accepted or resolve an ambiguous network outcome.
- **OPEN OWNER DECISION:** whether an initial integration may accept a bounded long-running request with no cancellation guarantee, or whether this is a blocker requiring a separately approved execution/transport design. Do not invent a background job system to hide the issue.

## 7. Security and operational requirements before any publishing route

These are requirements/questions for a future approved design, not claims about existing controls.

### Verified controls

- Server binds to loopback `127.0.0.1`; Vite is the LAN-facing entry point and proxies the API.
- Existing routes validate Origin/Host; mutation routes additionally validate a session cookie and CSRF header.
- Session cookie is HttpOnly and SameSite Strict; CSRF token is kept in frontend JS memory.
- Media upload is size-bounded at 512 MiB, signature-detected, and stored under a managed media root with path/symlink checks.
- Existing Facebook error helper redacts common token form values; YouTube optional follow-up error sanitization removes selected credential assignments. These are adapter-local filters, not a universal log/error policy.

### Gaps / decisions

1. **Human authorization:** current bootstrap is open to any browser request with an allowed Origin/Host; it creates a new local session. There is no user login, OS-user confirmation, account-level authorization, or publishing-specific approval. Decide whether LAN/Tailscale users are allowed to publish and what proof of local-user intent is required.
2. **Transport exposure:** API loopback binding does not make the app private to the host when Vite deliberately exposes the browser UI to LAN/Tailscale. Decide the allowed access perimeter for publishing independently of the existing read/media UX.
3. **HTTP cookie transport:** current cookie has no Secure attribute under the documented HTTP-local topology. No TLS is configured. Do not reuse this configuration outside its documented local context or treat it as encrypted transport.
4. **Input/path validation:** accept opaque media IDs, not paths; resolve under the managed media root; enforce regular-file, containment, symlink, extension, size, and existence checks at time of use. Existing media validation alone is not proof of Spoolcast compatibility.
5. **Request limits/timeouts:** existing media intake has a 512 MiB stream limit. No publishing request body schema, publishing-specific payload limit, route timeout, or end-to-end provider deadline is defined in the inspected code. Determine bounded metadata sizes, upload duration policy, and proxy/browser lifetime before implementation.
6. **Secret handling:** never accept secrets from the browser; never include tokens in URLs, argv, error messages, progress events, HTTP responses, or logs. Use allowlisted error categories and sanitized diagnostic IDs. Existing sanitizers are not comprehensive enough to assume all raw errors are safe.
7. **Process controls:** if a child is later approved, constrain executable/path/CWD/environment, avoid shell interpolation, use argument arrays, bound stdout/stderr, handle spawn errors/exit/signal, timeout, shutdown, and process-tree termination. These are design requirements, not existing controls.
8. **Rate/duplicate submission:** bootstrap rate limit is not a publishing rate limit. No idempotency key or duplicate-submit contract exists at the publishing boundary. **OPEN OWNER DECISION** whether a simple in-flight duplicate guard is required; do not add a durable idempotency/job ledger by assumption.

## 8. Source capability gaps and implications

| Gap | Verified evidence | Invocation impact | Disposition |
|---|---|---|---|
| Immediate manifest handling | `src/manifest.ts` `RawMeta.publishAt` is required; `readManifest` always parses it and validates Facebook's 10-minute–6-month window whenever target platform is Facebook. | Immediate request cannot safely call the existing manifest resolver without a future publish timestamp; Facebook may reject an immediate target before adapter call. | **OPEN OWNER DECISION** for a separately authorized Spoolcast immediate-input/manifest design. Do not invent dummy timestamps or bypass validation in QFAT. |
| CLI immediate option | `src/run.ts` calls upload adapters without `immediate: true`; `src/run.ts` loads the token store and scans all queue items. | Legacy CLI is scheduled-only in its current default behavior and does not implement the QFAT request contract. | Not a usable QFAT service entry point as-is. Any CLI change needs a separate Spoolcast task. |
| Adapter callable boundary | QFAT-015 signatures accept explicit path, resolved meta, account and options; byte progress callbacks and result types exist. | Good low-level reuse candidate; does not solve account/media/manifest/request/security orchestration. | Verified capability, not invocation API approval. |
| Target isolation | `src/run.ts` loops item × target sequentially and catches per-target errors, records failure, then continues. | A future one-request orchestrator must preserve per-target isolation. Current adapters alone do not provide target-set orchestration. | Preserve sequential attempt semantics initially; no concurrency promise. |
| State semantics | `src/state.ts` only defines `posted | failed`; a scheduled provider acceptance is stored by CLI as `posted`. | Cannot represent Scheduled distinctly or assert public visibility. | Do not expose ledger `posted` as Live; any status/history redesign requires separate approval. |
| Media matrix | Spoolcast `VIDEO_EXTENSIONS` are `.mp4` and `.mov`; current QFAT media intake accepts image and additional video signatures including WebM. No Facebook single-image or album adapter was found in the inspected Spoolcast adapters/QFAT-015 report. | QFAT media ID alone does not prove a publishable media/target combination. | Limit any future design to verified video paths; Facebook single-image and album remain unsupported/unverified and excluded. |
| Credentials/account mapping | Spoolcast uses token JSON + app credential files/env; QFAT CredentialProvider is opaque encrypted Buffer storage with internal record context. No OAuth/account mapping found. | Server cannot safely resolve a selected QFAT account to adapter credentials using an approved existing mapping. | **OPEN OWNER DECISION**; no token migration, duplication, or ownership change. |
| Progress transport | Adapter callbacks provide bytes, but server has no publishing route/event channel; CLI prints console progress. | Browser cannot receive live progress from existing path. | **OPEN OWNER DECISION** on one-shot response/event transport; no assumed SSE/IPC/jobs. |
| Cancellation/timeout | Adapter options have no AbortSignal; server has no publishing operation lifecycle. | Browser disconnect or child kill may leave provider outcome uncertain. | **OPEN OWNER DECISION** on acceptable first-release behavior and bounded request duration. |

## 9. Supported scope boundary

**Within approved product contract (not implementation authorization):**

- Publish Now and Schedule for verified Spoolcast video targets only.
- One shared date/time/timezone for all selected targets in MVP; normalize once to one instant.
- Independent target outcomes; sequential execution is acceptable and is the current core behavior.
- Provider-side future publication after provider acceptance; no local scheduler.
- Browser displays no provider tokens or client secrets.
- Schedule acceptance is Scheduled, not Published/Live.

**OUT OF SCOPE / NOT VERIFIED:**

- Facebook single-image publishing and albums.
- Any image publishing path inferred from QFAT media intake or old UI selection.
- QFAT-owned OAuth/token/account system or migration/dual-write.
- New QFAT queue, job engine, retry/cancellation orchestration, history ledger, scheduler, daemon, or worker.
- Persistent child supervisor, desktop shell, Tauri/Electron, new framework, or broad package restructuring.
- Hosted service, public/LAN API listener, live OAuth/provider calls, uploads, or external integration tests.

## 10. OPEN OWNER DECISIONS required before an implementation task

1. **Invocation topology:** Should the next design/implementation stage pursue an in-process adapter boundary, a newly bounded one-shot CLI command, or neither? Current source does not make the CLI a usable one-shot endpoint; in-process is only the narrowest candidate.
2. **Spoolcast package contract:** If in-process is pursued, what supported package/build/export boundary may QFAT server consume without coupling to private `src/` paths or executing CLI modules?
3. **Credential source of truth:** Do Spoolcast's existing token files remain authoritative, or should QFAT account records/credential storage be integrated? Who owns OAuth lifecycle and alias mapping? How are app-level credentials resolved?
4. **Publishing authorization:** Is publishing allowed from LAN/Tailscale browser sessions? Is current Origin/Host + bootstrap session + CSRF sufficient for Owner's threat model, or is an additional local-user confirmation/authentication boundary required?
5. **Media handoff:** Is the existing QFAT media library the selected content source? Which media formats/extensions are in scope? Confirm video-only MVP and explicitly exclude Facebook image/album unless a separate Spoolcast capability is approved.
6. **Immediate-mode Spoolcast input:** How should immediate publishing construct valid adapter metadata without a scheduled `publishAt` and Facebook schedule-window validation? This is a Spoolcast design/capability decision.
7. **Progress and request lifetime:** Is a bounded long-running synchronous operation acceptable? Which progress transport and timeout behavior are approved? What is the expected user-visible result if the browser disconnects while provider work may continue?
8. **Status semantics:** Is it acceptable for the first invocation boundary to return per-target transient results only, leaving existing `posted | failed` ledger untouched, or is durable Scheduled status a prerequisite? Do not build a second ledger.
9. **Duplicate submission:** What is the acceptable behavior for double-click/retry after an ambiguous network outcome without adding a new durable job/idempotency ledger?

No answer is inferred in this task. No implementation stage or follow-on task is authorized by this design.

## 11. Evidence inspected

Required documents read from synchronized `main`:

- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/QFAT-SCOPE-AND-CHANGE-CONTROL.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/design/QFAT-PUBLISHING-AND-SCHEDULING-FLOW.md`
- `CLAUDE.md`
- `reports/QFAT-015-spoolcast-upload-service-boundary-report.md`
- `reports/QFAT-021-spoolcast-frontend-scope-alignment-report.md`
- `reports/QFAT-022-publishing-and-scheduling-contract-report.md`
- `tasks/QFAT-023-spoolcast-invocation-boundary-design.md`

Read-only source/test inspection included:

- Root `package.json`, `tsconfig.json`, `src/cli.ts`, `src/run.ts`, `src/config.ts`, `src/manifest.ts`, `src/state.ts`, `src/tokens.ts`, `src/upload-youtube.ts`, `src/upload-facebook.ts`, `src/upload-facebook-reel.ts`.
- `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/index.ts`, `apps/server/src/config.ts`, `apps/server/src/security/index.ts`, `apps/server/src/security/routes.ts`, `apps/server/src/media/routes.ts`, `apps/server/src/media/storage.ts`, `apps/server/src/credentials/provider.ts`, `apps/server/src/credentials/envelope.ts`.
- `apps/web/vite.config.ts`, `apps/web/src/security/client.ts`.
- `test/upload-service.test.ts`, `apps/server/test/security.test.ts`, `apps/server/test/media.test.ts` (read-only inspection; not executed).

## 12. Final conclusion

**BLOCKED / OPEN OWNER DECISION for runtime architecture.** The documentation task can record the evidence and candidate comparison, but the repository does not establish a complete safe invocation path or approved credential/account/security ownership. No topology is selected. The smallest safe next action is for the Owner to answer the decisions in §10 and then authorize a separate, bounded task. Do not implement a bridge, endpoint, process, credential mapping, or publishing flow on the basis of this document alone.
