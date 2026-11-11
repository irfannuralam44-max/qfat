# QFAT MVP — Technical Architecture Proposal

- **Document ID:** QFAT-ARCH-001
- **Status:** PROPOSED — pending QFAT-002 technical validation and owner approval
- **Product requirements:** [PRD-QFAT-MVP](./PRD-QFAT-MVP.md)
- **Repository:** `irfannuralam44-max/qfat`
- **Last updated:** 2026-11-11

## 1. Architecture goals

1. Deliver the MVP as a local-first web application, not a desktop package or hosted SaaS.
2. Reuse the existing Spoolcast Node.js/TypeScript platform integration code where safe.
3. Use the FATTECH 2.0 frontend foundation while keeping QFAT's product identity independent.
4. Keep UI, API, platform adapters, job orchestration, persistence, and credentials behind explicit boundaries.
5. Support Linux and Windows development/testing on separate PCs.
6. Preserve a future path to Tauri 2 without making Tauri or Rust a current dependency.

## 2. Proposed system topology

```text
Browser (localhost)
  |
  | React SPA / HTTP JSON / SSE
  v
Vite dev server (development only)
  |
  | API requests to loopback backend
  v
QFAT Node.js >=22 backend (separate process)
  |-- HTTP API and local-origin protection
  |-- OAuth callback handlers
  |-- Media intake / staging
  |-- Job orchestration and state machine
  |-- YouTube adapter
  |-- Facebook video / Reels / single-image adapters
  |-- CredentialProvider interface
  |-- SQLite repositories
  |
  +--> Google / YouTube APIs
  +--> Meta / Facebook Graph APIs
  +--> OS credential store (Linux / Windows)
  +--> Local media directory
```

The frontend is an independently built static React application. The backend is the only trusted application process and the only component allowed to access platform credentials or call publishing APIs.

In development, Vite serves the frontend and proxies `/api` and `/events` to the backend. In local production, the backend should serve the built frontend assets or provide an equivalent same-origin local serving arrangement. Avoid requiring a separately exposed public port or LAN binding.

## 3. Proposed technology decisions

| Layer | Proposal | Status / rationale |
|---|---|---|
| Frontend | React + TypeScript | Agreed product direction; reuse FATTECH foundation |
| Build/dev server | Vite | Agreed product direction |
| Styling | Tailwind CSS 3.4 | Agreed product direction |
| Routing | React Router 6 | Agreed product direction |
| Icons | Lucide React | Agreed product direction |
| Charts | Recharts, only where useful | Agreed product direction |
| API server | Fastify (Node.js >=22 + TypeScript) | Proposal; validate plugin/security needs in QFAT-002 |
| API contract | JSON REST + shared Zod schemas | Proposal; typed validation at both boundaries |
| Live updates | Server-Sent Events (SSE) | PRD preference; simple one-way job progress |
| Database | SQLite | Product direction agreed; library/migration tool pending |
| Credentials | OS credential-store adapter | Requirement; exact Linux/Windows implementation pending |
| Upload/media handling | Node streams / bounded buffers | Required for large files |
| Tests | Node test runner or Vitest + mocked HTTP/platform clients | Select in QFAT-002; no live API dependency |
| Frontend server state | TanStack Query | Recommended |
| Forms | React Hook Form + Zod | Recommended |

Do not add a UI component library merely by default. Inspect FATTECH 2.0's actual component patterns and selectively reuse concepts/code only if licensing and maintenance allow; QFAT must remain independently buildable.

## 4. Repository layout proposal

The architecture task may adjust exact package boundaries after inspecting the existing tree. Preferred target shape:

```text
apps/
  web/                     # React + Vite browser application
  server/                  # Node.js API + worker process
packages/
  contracts/               # Zod request/response/event schemas
  domain/                  # Platform-independent entities and use cases
  upload-engine/            # Job orchestration, retries, state transitions
  adapters/
    youtube/
    facebook/
  auth/                     # OAuth orchestration and credential interface
  persistence/              # SQLite repositories and migrations
  shared/                   # Small cross-package utilities only
docs/
  PRD-QFAT-MVP.md
  ARCHITECTURE-QFAT-MVP.md
```

This is a target proposal, not an instruction to immediately move all imported files. QFAT-002 must recommend a low-risk migration sequence that preserves Spoolcast attribution and keeps changes reviewable. Avoid premature monorepo tooling if npm workspaces are sufficient.

## 5. Backend boundaries

### API layer

Responsibilities:
- Parse and validate HTTP input.
- Enforce loopback/origin/session protections.
- Return stable API errors.
- Stream media intake to staging storage.
- Expose job queries and SSE events.
- Never contain platform-specific upload protocol logic.

### Application/domain layer

Responsibilities:
- Create and validate publishing jobs.
- Resolve eligible destinations.
- Fan one media item out into independent destination jobs.
- Enforce allowed state transitions.
- Coordinate adapters, persistence, cancellation, and reconciliation.
- Own idempotency and retry policy.

### Platform adapters

Each adapter receives explicit dependencies: credential access, media stream/path, metadata, progress callback, cancellation signal, and typed logger. Adapters return structured results and must not mutate SQLite repositories or job state directly.

Separate protocols:
- YouTube video upload (Shorts remain a regular YouTube video upload path).
- Facebook Page long-form video.
- Facebook Reels.
- Facebook single-image Page post.

Do not combine Facebook long-form video and Reels transfer implementations; their protocols differ.

### Persistence layer

SQLite stores non-secret application data:
- Account metadata and platform IDs (not tokens).
- Media metadata and managed local path.
- Parent jobs and destination jobs.
- State transition history and sanitized errors.
- Remote platform IDs and upload-session checkpoints.
- Minimal app preferences.

Use database transactions for state transitions and checkpoint updates. Keep file payloads out of SQLite.

### Credential layer

Define an interface such as:

```ts
interface CredentialProvider {
  get(accountKey: string): Promise<PlatformCredential | null>;
  set(accountKey: string, credential: PlatformCredential): Promise<void>;
  delete(accountKey: string): Promise<void>;
}
```

The exact shape must avoid exposing secrets outside the backend. Select and test Linux and Windows implementations before OAuth integration. Linux may lack a usable Secret Service/keyring daemon in some desktop environments; fail closed with actionable guidance rather than silently writing plaintext JSON. Windows should use an OS-protected credential mechanism. Document behavior for locked/unavailable stores and credential migration.

## 6. Local API and browser security

The MVP is local-only but loopback is not, by itself, a complete security boundary.

Required design:
- Bind the API to `127.0.0.1` by default; do not bind to `0.0.0.0`.
- Validate the expected browser Origin on state-changing requests.
- Use a local session/CSRF bootstrap mechanism appropriate for the local app; do not rely on permissive wildcard CORS.
- Use secure, HttpOnly, SameSite cookies where applicable, or an equivalent narrowly scoped local-session mechanism.
- Reject untrusted Host/Origin values and avoid DNS-rebinding exposure.
- Keep API secrets and platform credentials out of frontend bundles, localStorage, sessionStorage, URLs, and error responses.
- Do not expose arbitrary filesystem paths or arbitrary shell/process execution through API endpoints.
- Sanitize filenames and generate server-side media IDs.
- Redact authorization headers, OAuth codes, access/refresh tokens, signed upload URLs, and token-bearing query strings from logs.

QFAT-002 must validate a concrete threat model and propose the smallest secure local-browser bootstrap that works in both Linux and Windows.

## 7. API surface proposal

Illustrative route groups only; final schemas and exact route names belong to implementation tasks.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Local backend readiness (no secrets) |
| GET | `/api/v1/accounts` | List connected account metadata |
| POST | `/api/v1/accounts/youtube/connect` | Start YouTube OAuth |
| POST | `/api/v1/accounts/facebook/connect` | Start Facebook authorization |
| DELETE | `/api/v1/accounts/:id` | Disconnect account |
| POST | `/api/v1/media` | Stream media into local staging |
| GET | `/api/v1/media` | List staged media metadata |
| POST | `/api/v1/jobs` | Validate and create a publishing job |
| GET | `/api/v1/jobs` | List jobs |
| GET | `/api/v1/jobs/:id` | Job and destination details |
| POST | `/api/v1/jobs/:id/cancel` | Request safe cancellation |
| POST | `/api/v1/destinations/:id/retry` | Retry one eligible destination |
| GET | `/events` | SSE job/destination updates |

Do not accept arbitrary local filesystem paths from the browser as upload sources. Browser-selected files must be uploaded through the media intake endpoint.

## 8. Job model and state machine

A parent job represents one media item and metadata submission. Each selected platform account creates an independent destination job.

Suggested destination states:

```text
queued -> validating -> preparing -> uploading -> finalizing -> published
   |           |           |           |             |
   +----------> failed <---+-----------+-------------+
   +----------> cancelled (only where cancellation is safe)
   +----------> needs_reconciliation (ambiguous remote outcome)
```

Rules:
- Destination states are independent; one destination's success does not change another's result.
- Persist remote IDs and provider session/checkpoint values immediately when received.
- A completed destination is never automatically re-uploaded because another destination failed.
- Optional post-publish actions have independent statuses and cannot downgrade a successful primary publish.
- An ambiguous provider timeout must enter reconciliation, not automatic fresh upload.
- Progress values are only emitted when measured; otherwise report an indeterminate state.
- Browser refresh/reconnect always reloads authoritative state from HTTP API/database.

QFAT-002 must propose concrete entity fields, uniqueness/idempotency keys, transaction boundaries, restart recovery, and transition validation.

## 9. Media lifecycle

- Browser file selection is transferred to the backend using a streaming multipart/request-body implementation.
- Backend writes to a generated temporary file under an application-managed staging directory.
- Validate size, extension, MIME signature where practical, and platform-specific requirements before marking media ready.
- Atomically move/rename completed intake files into managed storage.
- Keep source media until the user explicitly deletes it or an approved retention policy is implemented.
- Platform adapters read from file streams or bounded chunks; never read an entire large video into memory.
- Store relative/managed media identifiers in SQLite rather than trusting arbitrary browser paths.
- Define cleanup for abandoned partial uploads and temporary files.

## 10. OAuth flow proposal

- OAuth is initiated and completed by the backend; frontend receives only status and non-secret account metadata.
- Use state validation and PKCE where supported/appropriate for the selected provider flow.
- Bind callback listeners to loopback only and use dynamically selected ports where provider requirements permit.
- Validate callback state, issuer/provider, and expected account identity.
- Store credentials through CredentialProvider before marking the account connected.
- Never place long-lived tokens in query parameters, logs, browser state, or SQLite.
- Support multiple accounts by stable internal account IDs and editable aliases.
- Disconnect/revoke behavior must distinguish local credential deletion from remote provider revocation.

Exact Google and Meta OAuth implementation requirements, scopes, app review state, and callback restrictions must be checked against current official provider documentation during implementation planning.

## 11. Cross-platform and operational model

Development:
- Linux PC and Windows PC each clone the same Git repository.
- Frontend and backend run as separate local processes.
- Provide one documented command or a small script to start both in development, without hiding individual logs.
- Use portable path handling and OS-aware credential integration.
- Keep local state/database/media directories outside source control.
- Provide a diagnostic command/page that reports app version, runtime version, database health, media directory access, and credential-store availability without exposing secrets.

Production MVP:
- Start backend locally and serve the built frontend from the same local origin where feasible.
- Bind only to loopback.
- No installer or desktop packaging requirement.
- Browser compatibility target: current stable Chrome/Chromium and Edge; test Firefox if practical.

## 12. Future Tauri 2 compatibility

Do not implement Tauri now. Preserve these boundaries:
- Frontend communicates through documented API contracts, not Node internals.
- Backend can start as a separate process with configurable data paths and port.
- No dependency on browser-only local filesystem paths.
- No platform credentials in the frontend.
- Backend startup/shutdown and progress events have explicit interfaces.

A future Tauri 2 shell can host the same frontend and supervise the Node.js backend as a sidecar. Rust migration, if desired, should replace individual backend modules behind stable contracts rather than require a rewrite.

## 13. Decisions for QFAT-002 to validate

1. Fastify versus Node built-in HTTP: choose the smallest maintainable option and justify multipart streaming, SSE, security middleware, and plugin support.
2. SQLite library and migrations: compare options for native module installation and reliability on Linux/Windows; prefer low operational complexity.
3. Credential store: prove a viable Linux and Windows path; define fail-closed behavior and tests.
4. Local browser security: specify origin/session/CSRF/Host protections and OAuth callback strategy.
5. Monorepo/workspaces: decide whether npm workspaces are sufficient and how to preserve imported Spoolcast source history/attribution.
6. Upload intake and staging: define streaming implementation, limits, partial-file cleanup, and path policy.
7. Job schema/state machine: define durable idempotency, transaction boundaries, cancellation, and reconciliation.
8. API/SSE contracts: define versioning, event replay/reconnect strategy, and error envelope.
9. Test strategy: select test runner and mocked provider approach; include Linux and Windows verification.
10. Exact Meta API version, single-image endpoint/permissions, and current media constraints must be checked from authoritative Meta documentation at implementation time.

## 14. Approval gate

This is a proposal only. No code, dependencies, database, API server, OAuth, or upload behavior is authorized by this document. QFAT-002 must produce an evidence-based technical decision report and updated ADR recommendations. The owner then approves or revises the architecture before implementation tasks are created.
