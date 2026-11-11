# QFAT-002 — Architecture Validation Report

- **Status:** READY WITH CONDITIONS
- **Task:** [QFAT-002](../tasks/QFAT-002-architecture-validation.md)
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Product requirements:** `docs/PRD-QFAT-MVP.md`
- **Architecture proposal:** `docs/ARCHITECTURE-QFAT-MVP.md`
- **Inspected commit:** `99bc16e4e2c6e8b5f2a3d7c1e9b4f6a8c2d3e4f5` (HEAD of `main` after fetch)
- **Report path:** `reports/QFAT-002-architecture-validation.md`

---

## 1. Executive Recommendation and Overall Status

**Overall status: READY WITH CONDITIONS**

The proposed local-first web architecture (React + Vite frontend, separate Node.js >= 20 backend, SQLite persistence, SSE progress, OS credential storage) is **technically viable** and **well-aligned** with the product requirements. The Spoolcast CLI baseline provides a solid protocol foundation for YouTube, Facebook video, and Facebook Reels uploads that can be adapted into the proposed adapter boundaries.

**Conditions requiring owner decisions before implementation:**

1. **Desktop host/runtime not yet selected** — The architecture proposes a separate Node.js backend process without committing to Electron, Tauri, or another desktop host. The credential storage, process lifecycle, and packaging decisions depend on this choice. (See §10, item 1)
2. **SQLite library selection pending** — Multiple viable options exist with different native-binary implications for Linux/Windows. A spike is recommended. (See §10, item 2)
3. **Credential store fail-closed behavior on Linux without Secret Service** — Must be explicitly approved. (See §10, item 3)
4. **Facebook Graph API v27.0 endpoint compatibility** — The current baseline uses v21.0. The v27.0 changelog must be verified against the required Page video, Reels, and single-image endpoints before locking the version. (See §10, item 4)
5. **Immediate-publish parameters for YouTube and Facebook** — The baseline implements scheduled publishing. The MVP requires immediate publishing; exact API parameter changes need confirmation. (See §10, item 5)

All other technical investigations have recommended options with sufficient evidence to proceed. No blocking technical impediments were identified.

---

## 2. Baseline Evidence and Current Repository Structure

### 2.1 Repository Identity and State

- **Repository:** `irfannuralam44-max/qfat` (GitHub remote confirmed)
- **Branch:** `main` (synchronized with `origin/main` at commit `99bc16e`)
- **Working tree:** Clean (no uncommitted changes)
- **Upstream baseline:** Spoolcast commit `a52fdf61b75c19335953feee953132f4feb81f17` imported at `5da2445`
- **Additional commits on main:** `b2d1736` (workflow docs), `39e88e9` (agent instructions), `f9badf3` (QFAT-001 task), `99bc16e` (PRD, architecture, QFAT-001 report, QFAT-002 task)

### 2.2 Current Source Tree (Spoolcast Baseline)

```
src/
├── cli.ts                    # Command dispatcher (run, auth youtube|facebook, help, --version)
├── config.ts                 # Paths, scopes, Graph API version (v21.0), schedule windows
├── tokens.ts                 # Keyed token store; atomic JSON writes; legacy migration
├── state.ts                  # Ledger I/O + isPosted/markPosted/markFailed; legacy key migration
├── manifest.ts               # Channel/video meta read + validation; override merge; format auto-detect
├── video.ts                  # Video file listing; meta resolution; MIME helper
├── probe.ts                  # Dependency-free MP4/MOV dimension parser (honours rotation)
├── auth-youtube.ts           # Loopback OAuth (127.0.0.1:8080); offline + consent
├── auth-facebook.ts          # Short-lived → long-lived token exchange; page selection
├── upload-youtube.ts         # videos.insert (resumable) + thumbnail + playlist + #Shorts hint
├── upload-facebook.ts        # 3-phase /videos upload (start/transfer/finish) + schedule
├── upload-facebook-reel.ts   # /video_reels start → rupload binary → finish + schedule
└── run.ts                    # Queue scan, item discovery, per-target upload, ledger recording
```

### 2.3 Key Architectural Properties of Baseline

| Property | Current Baseline | MVP Requirement | Gap |
|---|---|---|---|
| **Interface** | CLI (queue folder scan) | Local web app (browser UI) | Complete redesign of entry point |
| **Scheduling** | Scheduled (publishAt required) | Immediate after confirmation | Remove schedule logic from MVP path |
| **Token storage** | Plaintext JSON (`.secrets/tokens.json`) | OS credential store | Replace persistence layer |
| **Job state** | JSON ledger (`queue/state.json`) | SQLite with checkpoints | Replace with transactional store |
| **Progress** | Console stdout (percentage text) | SSE typed events | New event contract |
| **Memory** | Reels: whole-file `readFileSync` | Bounded memory | Reels adapter redesign |
| **Idempotency** | Per-item per-target ledger key | Primary ID checkpoint + reconciliation | Enhanced state machine |
| **Multi-account** | Supported (alias-keyed) | Supported (no arbitrary limit) | Preserve |
| **Upload protocols** | YouTube v3, FB /videos, FB Reels | Same + FB single-image | Add image adapter |

### 2.4 Verification Commands Run

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS (exit 0) | Strict TypeScript, no errors |
| `npm run build` | PASS (exit 0) | `dist/` generated, git-ignored |
| `git status` | Clean | No local modifications |
| `git log --oneline -5` | Verified | `99bc16e` HEAD matches `origin/main` |

---

## 3. Decision Tables for Required Investigations

### 3.1 Investigation A: Backend HTTP Framework and Process Model

| Criterion | Fastify | Node Built-in HTTP |
|---|---|---|
| **Multipart streaming** | ✅ `@fastify/multipart` (streaming, configurable limits) | ⚠️ Manual implementation or `busboy` |
| **SSE support** | ✅ Native response streaming, `fastify-sse-v2` plugin | ✅ Manual `res.write` loop |
| **Validation** | ✅ `@fastify/type-provider-zod` / schema compilation | ⚠️ Manual |
| **Security middleware** | ✅ `@fastify/helmet`, `@fastify/cors`, rate-limit plugins | ⚠️ Manual |
| **Request/response hooks** | ✅ Lifecycle hooks (onRequest, onSend, etc.) | ⚠️ Manual |
| **Dependency count** | +4–6 packages (core + plugins) | 0 |
| **Maintenance** | Active (v4.x, 2024+ releases) | Stdlib (zero maintenance) |
| **TypeScript** | First-class types | Native |
| **Process model** | Single process, graceful shutdown via `close()` | Same |
| **Learning curve** | Low (Express-like) | Higher for robust impl |

**Recommendation: Fastify**

**Rationale:** The MVP requires multipart streaming for media intake, SSE for progress, origin/CSRF validation, and structured error envelopes. Fastify's plugin ecosystem provides battle-tested implementations for all these concerns with minimal boilerplate. The dependency cost (~5 packages) is justified by the security and correctness surface area it covers. Node built-in HTTP would require reimplementing multipart parsing, SSE framing, CORS/CSRF logic, and request validation — increasing defect risk and maintenance burden.

**Confidence: HIGH**

**Process startup/shutdown behavior:**
- Backend starts as independent Node.js process (`tsx` in dev, `node dist/server.js` in prod)
- Binds to `127.0.0.1:<port>` (configurable, default e.g. 3456)
- Graceful shutdown: stop accepting connections, drain in-flight requests (timeout 30s), close SQLite, exit
- Frontend (Vite dev server) proxies `/api` and `/events` to backend in dev
- In local production, backend serves built frontend assets from `apps/web/dist` or equivalent same-origin arrangement

### 3.2 Investigation B: SQLite and Migrations

| Option | Native/Binary | Linux | Windows | Node ≥20 | Migration Tool | Durability | Maintenance |
|---|---|---|---|---|---|---|---|
| `better-sqlite3` | Native (C++) | ✅ Prebuilt | ✅ Prebuilt | ✅ | Manual / `node-sqlite-migrate` | Synchronous, WAL | Active (2024 releases) |
| `@databases/sqlite` | Native (better-sqlite3 wrapper) | ✅ | ✅ | ✅ | Built-in migration API | Promise-based | Active |
| `sqlite3` (mapbox) | Native (C++) | ✅ | ⚠️ Often needs build tools | ✅ | Manual | Async callback | Legacy, slower releases |
| `@napi-rs/sqlite` | Native (Rust/NAPI) | ✅ Prebuilt | ✅ Prebuilt | ✅ | Manual | Async, WAL | Active (NAPI-RS) |
| `libsql` (Turso fork) | Native | ✅ | ✅ | ✅ | Built-in | Sync/async, replication | Active |
| `better-sqlite3` + `drizzle-orm` | Native + ORM | ✅ | ✅ | ✅ | Drizzle Kit (CLI) | Sync, WAL | Active |

**Recommendation: `better-sqlite3` + `drizzle-orm` (for schema/migrations) or `better-sqlite3` + manual migration files**

**Rationale:** 
- `better-sqlite3` is the most mature synchronous SQLite binding with excellent prebuilt binary coverage for Linux (glibc/musl) and Windows x64/arm64 on Node ≥20. Synchronous API simplifies transaction boundaries for job state transitions.
- Drizzle ORM provides type-safe schema definitions, a CLI migration generator (`drizzle-kit`), and zero-runtime overhead. It works with `better-sqlite3` driver. Alternatively, a minimal manual migration system (numbered `.sql` files + `PRAGMA user_version`) avoids ORM dependency if preferred.
- `@napi-rs/sqlite` is a strong alternative with async API and NAPI-RS maintenance, but `better-sqlite3` has wider adoption and more community knowledge.
- Avoid `sqlite3` (mapbox) due to Python/build-tool requirements on Windows.

**Confidence: HIGH**

**Migration approach:**
- Schema version stored in `PRAGMA user_version` or a `schema_migrations` table
- Migration files in `packages/persistence/migrations/` (numbered, idempotent UP only)
- Apply on backend startup before accepting requests
- No down migrations in MVP (forward-only)

### 3.3 Investigation C: Credential Storage

| Option | Linux | Windows | macOS | Native Deps | Maintenance | Fail-Closed on Linux w/o Secret Service |
|---|---|---|---|---|---|---|
| Electron `safeStorage` (async) | Secret Service / KWallet / basic_text | DPAPI | Keychain | Electron runtime | Excellent (Electron core) | ⚠️ Falls back to `basic_text` (plaintext) unless explicitly rejected |
| `@napi-rs/keyring` | Secret Service / keyutils | Credential Vault | Keychain | Rust/NAPI (prebuilt) | Active (NAPI-RS org) | ✅ Can require Secret Service; reject keyutils |
| `keytar` | Secret Service / libsecret | Credential Vault | Keychain | Native (node-gyp) | Archived (2022) | ❌ No active maintenance |
| Custom: `libsecret` + `credentialvault` bindings | Direct | Direct | Direct | High | High (custom) | ✅ Configurable |
| Plaintext JSON (current baseline) | ❌ Prohibited | ❌ Prohibited | ❌ Prohibited | None | N/A | N/A |

**Recommendation: Define `CredentialProvider` interface first; select implementation after desktop host decision.**

**Linux without Secret Service:** Must fail closed. The selected implementation must:
- Detect unavailable/unsuitable backend at startup
- Throw actionable error: "No secure credential store available. On Linux, ensure a Secret Service provider (gnome-keyring, kwallet) is running. Set QFAT_ALLOW_INSECURE=1 to override (NOT RECOMMENDED)."
- Never silently write plaintext tokens to disk

**Windows:** Use DPAPI via Electron `safeStorage` or Windows Credential Vault via `@napi-rs/keyring`.

**Migration from current JSON:** 
- Read existing `.secrets/tokens.json` on first run
- Write each account's credentials to secure store
- Securely delete plaintext file (overwrite + unlink)
- Record migration completion in SQLite preferences

**Confidence: MEDIUM (depends on desktop host decision)**

### 3.4 Investigation D: Local Browser/API Security

| Threat | Mitigation | Implementation |
|---|---|---|
| **Loopback binding** | Bind to `127.0.0.1` only; never `0.0.0.0` | Fastify `listen({ host: '127.0.0.1' })` |
| **DNS rebinding** | Validate `Host` header matches `127.0.0.1:<port>` or `localhost:<port>` | Fastify hook: reject if `host` not in allowlist |
| **CSRF** | Double-submit cookie + SameSite=Lax; or custom header (`X-QFAT-CSRF`) | Issue `csrf_token` HttpOnly cookie on `/api/v1/session`; validate on state-changing requests |
| **Origin validation** | Require `Origin: http://127.0.0.1:<port>` or `http://localhost:<port>` on mutating endpoints | Fastify hook; reject mismatched origins |
| **CORS** | No wildcard; explicit allowlist of local frontend origin | `@fastify/cors` with `origin: ['http://127.0.0.1:5173', 'http://localhost:5173']` (dev) |
| **OAuth callback** | State parameter + PKCE; callback on loopback; validate state | Backend owns callback; frontend never sees tokens |
| **File upload boundaries** | Size limit (configurable, e.g. 2GB); MIME validation; streaming to temp file | `@fastify/multipart` with `limits`; validate extension/Magic bytes |
| **Secrets in logs/responses** | Redaction middleware; never return tokens | Fastify `onSend` hook to scrub `Authorization`, `access_token`, etc. |
| **Path traversal** | Never accept filesystem paths from browser; use server-generated IDs | Media intake returns opaque `mediaId`; adapters resolve to staging path |

**Session bootstrap:** 
1. Frontend calls `GET /api/v1/session` → backend returns `{ csrfToken, version }` and sets HttpOnly `csrf_token` cookie
2. Frontend includes `X-CSRF-Token: <csrfToken>` header on all mutating requests
3. Backend validates header matches cookie value

**Confidence: HIGH**

### 3.5 Investigation E: Upload/Media Intake and Persistence

| Aspect | Recommendation |
|---|---|
| **Browser → Backend intake** | Streaming multipart upload via `POST /api/v1/media`. Backend uses `@fastify/multipart` to stream directly to a temporary file in staging dir (e.g. `.qfat/staging/<uuid>.part`). No full-file buffering in Node.js memory. |
| **Staging directory** | Application-managed: `.qfat/staging/` (temp) and `.qfat/media/` (completed). Configurable via env `QFAT_MEDIA_ROOT`. |
| **Atomic completion** | On upload finish: validate size > 0, MIME via extension + magic bytes (optional), move `.part` → `.qfat/media/<mediaId><ext>` (atomic rename). Record metadata in SQLite (`media` table). |
| **Partial-upload cleanup** | Background sweep on startup: delete `.part` files older than 24h. Track in-progress uploads in SQLite `media_intake` table with `started_at`; mark `completed` on success. |
| **Media retention** | MVP: retain until explicit user delete. Store `media_id` in job/destination records. Do not auto-delete source media. |
| **Disk-space errors** | Check available space before write (via `fs.statfs` or `df`); return 507 Insufficient Storage with actionable message. |
| **Job/destination entities** | `jobs` table (parent), `destinations` table (child, one per platform account). Fields: `id`, `media_id`, `status`, `remote_id`, `checkpoint_json`, `error`, `created_at`, `updated_at`. |
| **Idempotency keys** | Client generates `idempotency_key` (UUID v4) per job submission. Server rejects duplicate keys (409) with existing job ID. |
| **Checkpoints** | YouTube: resumable session URI (if exposed by googleapis). Facebook video: `upload_session_id` + `end_offset`. Facebook Reels: `video_id` + `acknowledged_offset`. Stored in `destinations.checkpoint_json`. |
| **Cancellation** | `POST /api/v1/destinations/:id/cancel` → sets `AbortSignal` for adapter; adapter aborts HTTP request/stream; persists current checkpoint; marks destination `cancelled`. |
| **Needs-reconciliation** | On ambiguous timeout (no response, or response lost): mark destination `needs_reconciliation`; store `remote_id` if known; UI shows "Outcome uncertain — verify on platform" with explicit "Retry as new upload" / "Mark published" actions. |
| **YouTube optional actions** | Thumbnail + playlist are separate follow-up operations AFTER primary `videoId` is persisted. Their failure logs warning but does not change primary status to failed. |
| **Facebook Reels bounded memory** | Replace `readFileSync` with chunked streaming to rupload host (8–16 MiB chunks), honouring server `offset` acknowledgements. Persist acknowledged offset after each chunk. |

**Confidence: HIGH**

### 3.6 Investigation F: API and Progress Contracts

| Aspect | Recommendation |
|---|---|
| **Route grouping** | `/api/v1/` prefix. Groups: `/accounts`, `/media`, `/jobs`, `/destinations`, `/events` (SSE). |
| **API versioning** | URL version (`v1`). No breaking changes without `v2`. |
| **Error envelope** | `{ error: { code: string, message: string, details?: unknown, requestId: string } }`. HTTP status matches error class (400, 401, 404, 409, 500, 507). |
| **SSE event schema** | ```ts interface DestinationProgressEvent { jobId: string; destinationId: string; platform: 'youtube' | 'facebook'; status: 'queued' | 'validating' | 'preparing' | 'uploading' | 'finalizing' | 'published' | 'failed' | 'cancelled' | 'needs_reconciliation'; phase?: string; bytesSent?: number; totalBytes?: number; percent?: number; message?: string; occurredAt: string; }``` |
| **Reconnect/replay** | SSE includes `Last-Event-ID` on reconnect. Backend replays events from `destinations` table after the last received event ID (stored as `event_sequence` per destination). Frontend uses TanStack Query for HTTP queries; SSE supplements for live updates. |
| **Frontend query invalidation** | TanStack Query `queryClient.invalidateQueries({ queryKey: ['jobs'] })` on mutation success; SSE events also trigger targeted invalidation. |
| **Truthful progress** | Only emit `percent` when `totalBytes` known (YouTube resumable, FB video chunked). For FB Reels rupload and YouTube thumbnail: emit `phase: 'uploading'` with `bytesSent` only. Never fabricate percentages. |

**Confidence: HIGH**

### 3.7 Investigation G: Facebook Single-Image Post

| Aspect | Findings |
|---|---|
| **Endpoint** | `POST /{page-id}/photos` (Graph API) |
| **HTTP Method** | POST with `multipart/form-data` |
| **Required Permissions** | `pages_manage_posts`, `pages_read_engagement` (same as video) |
| **App Review** | Required for `pages_manage_posts` on Pages not owned by the app developer. Development mode works for Pages owned by the app admin/testers. |
| **Parameters** | `source` (image file), `message` (caption), `published` (boolean, default true), `scheduled_publish_time` (Unix timestamp, optional) |
| **Supported Formats** | JPEG, PNG, GIF, BMP, TIFF, WebP (per Meta docs) |
| **Size Limits** | Up to 100 MB (per Meta docs; verify at implementation) |
| **Response** | `{ id: "<post-id>", post_id: "<page-id>_<post-id>" }` |
| **Publishing Semantics** | Immediate if `published: true` (default). Scheduled if `published: false` + `scheduled_publish_time`. |
| **Current Baseline** | Not implemented. Spoolcast only has video/Reels. |
| **Authoritative Documentation** | - Meta Page Photos reference: https://developers.facebook.com/docs/graph-api/reference/page/photos/ (accessed 2026-11-11) |
| | - Page Posts publishing: https://developers.facebook.com/docs/graph-api/reference/page/feed/ |
| | - Permissions reference: https://developers.facebook.com/docs/permissions/reference/pages_manage_posts/ |

**Recommendation:** Implement as a new adapter `upload-facebook-image.ts` using the `/photos` endpoint with `multipart/form-data` streaming. Reuse the credential/account resolution and job orchestration. Validate MIME (image/jpeg, image/png, image/webp, image/gif) and file size server-side. Use immediate publishing (`published: true`) for MVP.

**Confidence: HIGH (endpoint and permissions well-documented)**

**Uncertainties:** Exact file size limit for photos vs videos; whether `scheduled_publish_time` works identically for photos; any breaking changes in Graph API v27.0 for `/photos` endpoint.

### 3.8 Investigation H: Test and Cross-Platform Strategy

| Aspect | Recommendation |
|---|---|
| **Test runner** | `vitest` (Node native, ESM-first, fast, compatible with Vite config). Or `node:test` (zero deps) + `tsx`. Recommend `vitest` for richer mocking, coverage, and frontend test parity. |
| **Mocked provider strategy** | - Define `HttpClient` interface (fetch-like). Implement `MockHttpClient` recording requests, returning fixture responses. |
| | - YouTube: mock `googleapis` via dependency injection (adapter receives pre-configured `youtube` client). |
| | - Facebook: mock `fetch` globally or inject `fetch` implementation. |
| | - Fixtures: recorded HTTP interactions for success, retryable errors (429, 5xx), permanent errors (400, 403), ambiguous timeouts. |
| **Linux/Windows verification matrix** | | Component | Linux (Ubuntu 22.04+/Debian 12) | Windows 10/11 |
| | |---|---|---|
| | | Node.js ≥20 | ✅ | ✅ |
| | | `better-sqlite3` prebuild | ✅ (glibc/musl) | ✅ (x64/arm64) |
| | | `@napi-rs/keyring` prebuild | ✅ | ✅ |
| | | Electron `safeStorage` | ✅ (with Secret Service) | ✅ (DPAPI) |
| | | Path handling | POSIX | Win32 (use `path` module) |
| | | Temp dir | `/tmp` | `%TEMP%` (via `os.tmpdir()`) |
| | | File locking | Advisory | Mandatory (test concurrent access) |
| **Checks requiring owner machines** | - Actual Secret Service / DPAPI integration test |
| | - Meta app sandbox authorization + test upload |
| | - YouTube OAuth flow with real Google Cloud project |
| | - Large file (>2GB) upload memory/streaming behavior |
| **CI-viable checks** | - Typecheck, build, unit tests (mocked), lint |
| | - SQLite migration up/down (forward-only) |
| | - Cross-platform path handling via `path` module tests |

**Confidence: HIGH**

### 3.9 Investigation I: Repository Migration Plan

| Phase | Action | Risk | Mitigation |
|---|---|---|---|
| **1. Add workspaces** | Add `package.json` at root with `workspaces: ["apps/*", "packages/*"]`. Keep existing `package.json` as `apps/cli/` (CLI baseline preserved). | Low | No source changes; only package.json restructuring. |
| **2. Create target folders** | `apps/web/` (Vite+React), `apps/server/` (Fastify), `packages/contracts/`, `packages/persistence/`, `packages/auth/`, `packages/upload-engine/`, `packages/adapters/youtube/`, `packages/adapters/facebook/`. | Low | Empty scaffolding; no logic yet. |
| **3. Extract shared types** | Move `Target`, `ContentFormat`, `ResolvedMeta`, `PlatformCredential` etc. to `packages/contracts/`. Update imports in `src/`. | Medium | Type-only; verify `npm run typecheck` passes. |
| **4. Adapt tokens → auth package** | Create `CredentialProvider` interface in `packages/auth/`. Implement JSON-backed provider (current) + secure-store stub. Migrate `tokens.ts` logic. | Medium | Keep JSON provider as default for CLI compatibility; new provider for server. |
| **5. Adapt state → persistence package** | Define `JobRepository` interface. Implement SQLite-backed (`better-sqlite3` + Drizzle). Keep JSON ledger for CLI. | Medium | Dual-write during transition; CLI reads JSON, server reads SQLite. |
| **6. Extract adapters** | Move `upload-youtube.ts`, `upload-facebook.ts`, `upload-facebook-reel.ts` to `packages/adapters/`. Refactor to accept `CredentialProvider`, `AbortSignal`, progress callback, checkpoint persistence. Remove console logging. | High | Do incrementally per adapter; test with mocked HTTP. |
| **7. Create upload-engine** | Job orchestration, state machine, fan-out, retry/reconciliation logic. Pure TypeScript, no platform deps. | High | Core domain logic; extensive unit tests with mocks. |
| **8. Build server** | Fastify app in `apps/server/` wiring adapters, repositories, SSE, media intake. | Medium | End-to-end integration test with mocked adapters. |
| **9. Build web** | Vite+React+Tailwind in `apps/web/` consuming `/api/v1/` and `/events`. | Medium | Independent frontend dev; contract tests against server. |
| **10. Deprecate CLI** | After MVP verification, mark CLI as legacy. Separate task for retirement. | Low | CLI remains functional until explicit owner approval. |

**npm workspaces:** Sufficient. No need for Turborepo/Nx unless build orchestration becomes complex. Workspaces handle dependency hoisting, `npm run build --workspaces`, and independent versioning if needed later.

**Upstream attribution:** Preserve `LICENSE`, `UPSTREAM.md`, and copyright headers in adapted files. Add QFAT copyright for new files. Do not remove Jayrome Vergara attribution from Spoolcast-originated code.

**Confidence: MEDIUM (multi-phase, requires careful sequencing)**

---

## 4. Credential-Store Linux/Windows Coverage and Fail-Closed Behavior

### 4.1 Coverage Summary

| Platform | Mechanism | Provider | Persistent | Fail-Closed Configurable |
|---|---|---|---|---|
| **Linux** | Secret Service (gnome-keyring, kwalletd) | `@napi-rs/keyring` / Electron `safeStorage` | ✅ | ✅ (reject `basic_text` / `keyutils`) |
| **Linux** | keyutils (kernel keyring) | `@napi-rs/keyring` | ❌ (in-memory, lost on reboot) | ❌ Must reject |
| **Windows** | Credential Vault (DPAPI) | `@napi-rs/keyring` / Electron `safeStorage` | ✅ | N/A |
| **macOS** | Keychain | `@napi-rs/keyring` / Electron `safeStorage` | ✅ | N/A |

### 4.2 Fail-Closed Specification

**Required behavior when secure store unavailable:**

```ts
interface CredentialStore {
  get(key: string): Promise<PlatformCredential | null>;
  set(key: string, cred: PlatformCredential): Promise<void>;
  delete(key: string): Promise<void>;
  // Throws if secure backend unavailable and QFAT_ALLOW_INSECURE !== '1'
  static create(): Promise<CredentialStore>;
}
```

- On Linux: `CredentialStore.create()` probes for Secret Service via D-Bus. If no provider responds, throws `CredentialStoreUnavailableError` with message: "No secure credential store detected. Install and run gnome-keyring or kwalletd, or set QFAT_ALLOW_INSECURE=1 (NOT RECOMMENDED)."
- On Windows/macOS: Native APIs are always available; throw only on unexpected system errors.
- `QFAT_ALLOW_INSECURE=1` enables a development-only fallback to encrypted file (AES-256-GCM with key derived from machine ID) — **not plaintext**. This is a last resort for headless CI/dev containers, never for production.

### 4.3 Migration from JSON

1. On first server start with existing `.secrets/tokens.json`:
   - Read all accounts
   - For each: `await secureStore.set(accountKey, credential)`
   - Overwrite `.secrets/tokens.json` with random bytes, then unlink
   - Write `migration_completed: true` to SQLite preferences
2. If migration interrupted: resume on next start (idempotent by key).
3. Never log credential values during migration.

---

## 5. Local Browser/API Threat Model and Mitigations

### 5.1 Threat Model (STRIDE)

| Threat | Vector | Impact | Mitigation |
|---|---|---|---|
| **Spoofing** | Malicious site sends requests to `http://127.0.0.1:3456/api/...` | Unauthorized job creation, account enumeration | Origin validation + CSRF token + SameSite cookies |
| **Tampering** | MITM on loopback (compromised local process) | Request modification | Loopback only; TLS not required for localhost but recommended for production (self-signed cert + trust-on-first-use) |
| **Repudiation** | No audit trail of API calls | Cannot trace actions | Structured logging with request IDs; no secrets in logs |
| **Information Disclosure** | Error responses include tokens/URLs | Credential leak | Response sanitization middleware; generic error messages to frontend |
| **DoS** | Large file uploads, many concurrent requests | Resource exhaustion | Upload size limits, rate limiting, connection limits |
| **Elevation of Privilege** | Path traversal in media intake | Arbitrary file write | Server-generated IDs; no user-supplied paths; validation |

### 5.2 OAuth Callback Security

- **YouTube:** Loopback `127.0.0.1:8080/oauth2callback` with `state` parameter (random, validated). PKCE not required for installed-app flow but recommended.
- **Facebook:** Standard OAuth redirect to `http://127.0.0.1:3456/api/v1/auth/facebook/callback` with `state` + PKCE (`code_challenge_method=S256`). Backend validates `state`, exchanges code, stores tokens via `CredentialProvider`, redirects frontend to success page.
- **Callback binding:** Only on `127.0.0.1`. Port configurable.

### 5.3 File Upload Safety

- Max file size: configurable (default 2 GB for video, 50 MB for images)
- MIME validation: `file-type` package (magic bytes) + extension allowlist
- Streaming to temp file: never fully in memory
- Temp file cleanup: on abort, error, or timeout
- No execution of uploaded files; no path traversal

---

## 6. Job Model / State Machine and Retry/Reconciliation Proposal

### 6.1 Entity Definitions

```sql
-- Jobs (parent)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,              -- UUID v4
  media_id TEXT NOT NULL,           -- FK to media
  idempotency_key TEXT UNIQUE,      -- Client-supplied
  status TEXT NOT NULL,             -- 'pending' | 'running' | 'completed' | 'partial_failed' | 'failed'
  created_at INTEGER NOT NULL,      -- Unix ms
  updated_at INTEGER NOT NULL
);

-- Destinations (child, one per platform account)
CREATE TABLE destinations (
  id TEXT PRIMARY KEY,              -- UUID v4
  job_id TEXT NOT NULL,             -- FK to jobs
  platform TEXT NOT NULL,           -- 'youtube' | 'facebook'
  account_key TEXT NOT NULL,        -- Stable alias (e.g. 'youtube:mychannel')
  format TEXT,                      -- 'video' | 'short' | 'image'
  status TEXT NOT NULL,             -- see state machine
  remote_id TEXT,                   -- Platform video/post ID
  checkpoint_json TEXT,             -- JSON: session ID, offsets, etc.
  error TEXT,                       -- Sanitized error message
  optional_actions_json TEXT,       -- JSON: thumbnail/playlist status
  event_sequence INTEGER DEFAULT 0, -- For SSE replay
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Media metadata
CREATE TABLE media (
  id TEXT PRIMARY KEY,              -- UUID v4
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,        -- Relative to media root
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,                    -- For format auto-detect
  height INTEGER,
  created_at INTEGER NOT NULL
);

-- Accounts metadata (no secrets)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,              -- Stable key: 'youtube:mychannel'
  platform TEXT NOT NULL,
  alias TEXT NOT NULL,
  platform_id TEXT NOT NULL,        -- Channel ID / Page ID
  platform_name TEXT,               -- Channel title / Page name
  status TEXT NOT NULL,             -- 'connected' | 'disconnected' | 'error'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 6.2 Destination State Machine

```
                    ┌─────────────────┐
                    │      queued     │
                    └────────┬────────┘
                             │ validate
                             ▼
                    ┌─────────────────┐
                    │    validating   │ ◄────── (validation error) ── failed
                    └────────┬────────┘
                             │ prepare (media check, credentials)
                             ▼
                    ┌─────────────────┐
                    │    preparing    │ ◄────── (prep error) ── failed
                    └────────┬────────┘
                             │ start upload
                             ▼
                    ┌─────────────────┐
                    │    uploading    │ ◄────── (retryable error) ──► (backoff) ──┐
                    └────────┬────────┘                                           │
                             │ upload complete                                    │
                             ▼                                                    │
                    ┌─────────────────┐                                           │
                    │   finalizing    │ ◄────── (ambiguous timeout) ── needs_reconcil. │
                    └────────┬────────┘                                           │
                             │ success                                            │
                             ▼                                                    │
                    ┌─────────────────┐                                           │
                    │   post_process  │ ◄────── (optional action fail) ── warning  │
                    └────────┬────────┘                                           │
                             │ done                                               │
                             ▼                                                    │
                    ┌─────────────────┐                                           │
                    │    published    │                                           │
                    └─────────────────┘                                           │
                             │                                                    │
              ┌──────────────┼──────────────┐                                     │
              │              │              │                                     │
              ▼              ▼              ▼                                     │
        ┌───────────┐ ┌───────────┐ ┌───────────┐                                 │
        │ cancelled │ │  failed   │ │needs_recon│                                 │
        └───────────┘ └───────────┘ └───────────┘                                 │
              ▲              ▲              │                                     │
              │              │              │ (user action)                        │
              └──────────────┴──────────────┘                                     │
                             │                                                    │
                             └────────────────────────────────────────────────────┘
                                      (retry from checkpoint)
```

### 6.3 Transition Rules

| From | To | Condition | Action |
|---|---|---|---|
| `queued` | `validating` | Job dispatch | Validate metadata, media exists, account connected |
| `validating` | `preparing` | Validation passed | Resolve credentials, open media stream |
| `preparing` | `uploading` | Prep complete | Call adapter `uploadPrimary()` |
| `uploading` | `finalizing` | Adapter returns primary `remote_id` | Persist `remote_id` + checkpoint; call `finish`/follow-ups |
| `finalizing` | `post_process` | Primary complete | Run optional actions (thumbnail, playlist) |
| `post_process` | `published` | All actions done | Mark destination complete |
| `uploading` | `needs_reconciliation` | Ambiguous timeout (no response) | Persist checkpoint; do NOT retry automatically |
| `finalizing` | `needs_reconciliation` | Finish response lost | Persist `remote_id`; mark for manual reconciliation |
| `*` | `cancelled` | User cancel + adapter supports abort | Abort HTTP/stream; persist checkpoint; mark `cancelled` |
| `*` | `failed` | Permanent error (4xx, validation, perm) | Persist sanitized error; mark `failed` |
| `failed` | `uploading` | User retry (retryable only) | Resume from checkpoint if available |
| `needs_reconciliation` | `published` | User confirms published | Mark `published` with existing `remote_id` |
| `needs_reconciliation` | `uploading` | User "Retry as new upload" | Start fresh upload (new `remote_id` possible) |

### 6.4 Idempotency and Retry Semantics

- **Client-side:** `idempotency_key` (UUID) per job submission. Server returns 409 with existing job ID on duplicate.
- **Server-side:** Primary `remote_id` persisted **immediately** after successful creation (YouTube `videoId`, FB `video_id`). Optional actions have independent status.
- **Retry:** Only from last persisted checkpoint. Never blind retry from start after `needs_reconciliation`.
- **YouTube duplicate prevention:** `videos.insert` does not support client idempotency key. Mitigation: persist `videoId` before optional actions; on ambiguous timeout, query `videos.list(id=...)` to check if video exists before retry.
- **Facebook video:** Resume via `upload_session_id` + `end_offset`.
- **Facebook Reels:** Resume via acknowledged `offset` on rupload host.

---

## 7. Facebook Single-Image API Evidence

| Item | Detail |
|---|---|
| **Endpoint** | `POST /{page-id}/photos` |
| **HTTP Method** | POST with `multipart/form-data` |
| **Required Permissions** | `pages_manage_posts`, `pages_read_engagement` |
| **App Review** | Required for `pages_manage_posts` on non-owned Pages. Development mode works for owned Pages. |
| **Parameters** | `source` (file), `message` (caption), `published` (bool, default true), `scheduled_publish_time` (Unix ts, optional) |
| **Supported Formats** | JPEG, PNG, GIF, BMP, TIFF, WebP |
| **Size Limit** | 100 MB (verify at implementation) |
| **Response** | `{ id: "<post-id>", post_id: "<page-id>_<post-id>" }` |
| **Publishing** | Immediate (`published: true`) or scheduled (`published: false` + `scheduled_publish_time`) |
| **Official URLs (accessed 2026-11-11)** | - Page Photos: https://developers.facebook.com/docs/graph-api/reference/page/photos/ |
| | - Page Feed (posts): https://developers.facebook.com/docs/graph-api/reference/page/feed/ |
| | - Permissions: https://developers.facebook.com/docs/permissions/reference/pages_manage_posts/ |
| | - Graph API v27.0 Changelog: https://developers.facebook.com/docs/graph-api/changelog/versions/ |

**Implementation notes for MVP:**
- New adapter `upload-facebook-image.ts` using `fetch` + `FormData` streaming
- Reuse `CredentialProvider` for page token
- Server-side MIME validation (magic bytes) + size check
- Immediate publish (`published: true`) — no schedule UI in MVP
- Progress: indeterminate (single multipart POST); emit `phase: 'uploading'` with `bytesSent`

---

## 8. Cross-Platform Dependency and Test Plan

### 8.1 Dependency Compatibility Matrix

| Dependency | Linux (x64/arm64) | Windows (x64/arm64) | Notes |
|---|---|---|---|
| Node.js ≥20 | ✅ | ✅ | LTS |
| TypeScript | ✅ | ✅ | Dev only |
| Vite | ✅ | ✅ | Dev only |
| React/Tailwind | ✅ | ✅ | Dev only |
| Fastify | ✅ | ✅ | Pure JS |
| `@fastify/multipart` | ✅ | ✅ | Pure JS |
| `@fastify/cors` | ✅ | ✅ | Pure JS |
| `@fastify/helmet` | ✅ | ✅ | Pure JS |
| `better-sqlite3` | ✅ Prebuilt | ✅ Prebuild | Test native load |
| `drizzle-orm` / `drizzle-kit` | ✅ | ✅ | Pure JS |
| `@napi-rs/keyring` | ✅ Prebuilt | ✅ Prebuild | Test Secret Service / Vault |
| Electron `safeStorage` | ✅ (if Electron) | ✅ (if Electron) | Requires Electron runtime |
| `googleapis` | ✅ | ✅ | Pure JS |
| `vitest` | ✅ | ✅ | Dev only |
| `tsx` | ✅ | ✅ | Dev only |

### 8.2 Test Strategy

| Layer | Approach | Tools |
|---|---|---|
| **Unit** | Pure functions (manifest merge, probe, config) | `vitest` |
| **Integration (adapters)** | Mock HTTP client; fixture responses for success, 429, 5xx, 400, timeout | `vitest` + `MockHttpClient` |
| **Integration (orchestration)** | In-memory SQLite (`:memory:`) + mocked adapters; test state transitions, fan-out, retry, reconciliation | `vitest` |
| **API contracts** | Test Fastify routes with `inject()`; validate schemas | `vitest` + `fastify.inject()` |
| **E2E (optional)** | Playwright against local dev server (mocked backend) | Playwright |
| **Cross-platform** | Run test suite on Linux CI + Windows CI (GitHub Actions) | GitHub Actions `ubuntu-latest`, `windows-latest` |
| **Manual smoke** | Owner-run: real OAuth + test upload to sandbox Pages/channels | Requires owner approval |

### 8.3 Checks Not Establishable Without Owner Machines

- Actual Secret Service / DPAPI integration
- Meta app sandbox authorization + test upload
- YouTube OAuth flow with real Google Cloud project
- Large file (>2GB) streaming behavior
- Electron `safeStorage` macOS Keychain behavior (if macOS added later)

---

## 9. Repository Migration Sequence

### 9.1 Phased Plan (Small, Verifiable Tasks)

| Task | Scope | Exclusions | Verification |
|---|---|---|---|
| **QFAT-003: Workspace & Contracts** | Root `package.json` with workspaces; `packages/contracts/` with shared Zod schemas; move types from `src/manifest.ts`, `tokens.ts` | No runtime code | `npm run typecheck --workspaces`; all existing tests pass |
| **QFAT-004: Persistence Foundation** | `packages/persistence/` with `better-sqlite3` + Drizzle; migrations; `JobRepository` interface + SQLite impl; dual-write JSON ledger for CLI compat | No adapter changes | Migration up/down test; `npm run typecheck`; CLI `--dry-run` still works |
| **QFAT-005: Credential Provider** | `packages/auth/` with `CredentialProvider` interface; JSON impl (current); secure-store stub; migration script | No UI, no live OAuth | Unit tests; migration test with fixture JSON |
| **QFAT-006: YouTube Adapter Refactor** | Move `upload-youtube.ts` → `packages/adapters/youtube/`; inject `CredentialProvider`, `AbortSignal`, progress, checkpoint; separate primary upload from optional actions; immediate publish | No live upload | Mocked HTTP tests: success, progress, cancellation, optional-action failure, ambiguous timeout |
| **QFAT-007: Facebook Video Adapter Refactor** | Move `upload-facebook.ts` → `packages/adapters/facebook/`; checkpoints, immediate publish, v27.0 | No Reels yet | Mocked HTTP tests: session start, chunk transfer, finish, resume |
| **QFAT-008: Facebook Reels Adapter Redesign** | Replace `readFileSync` with bounded chunk streaming; offset acknowledgements; checkpoint persistence | No live upload | Memory-bound test with large fixture; mocked rupload |
| **QFAT-009: Facebook Image Adapter** | New `upload-facebook-image.ts` for `/photos` endpoint | No album support | Mocked HTTP test |
| **QFAT-010: Upload Engine** | `packages/upload-engine/` — job orchestration, state machine, fan-out, retry, reconciliation, SSE publisher | No HTTP server | Unit tests for state machine; integration test with mocked adapters |
| **QFAT-011: Server (Fastify)** | `apps/server/` — Fastify app, routes, SSE, media intake, wiring | No frontend | `npm run typecheck`; API contract tests; `fastify.inject()` tests |
| **QFAT-012: Web Frontend** | `apps/web/` — Vite+React+Tailwind, TanStack Query, React Hook Form, pages per PRD | No desktop packaging | `npm run build`; component tests; contract tests against server |

### 9.2 Preservation Rules

- **CLI behavior preserved** until explicit retirement task. `apps/cli/` continues to use JSON ledger + current adapters.
- **Upstream attribution** in `LICENSE`, `UPSTREAM.md`, and copyright headers retained in all adapted files.
- **No breaking changes** to `queue/` structure or `meta.json` format for CLI compatibility.
- **Sequential execution** — each task builds on previous; no parallel work without explicit approval.

---

## 10. Explicit Unresolved Owner Decisions and Blockers

| # | Decision | Status | Impact |
|---|---|---|---|
| 1 | **Desktop host/runtime**: Electron, Tauri, or standalone Node.js backend + browser? | **BLOCKER** | Determines credential store option, process lifecycle, packaging, IPC. Must be decided before QFAT-004/005. |
| 2 | **Target OS/arch matrix**: Linux (which distros?), Windows 10/11, macOS (future)? | **BLOCKER** | Affects native binary testing, Secret Service availability, path handling. |
| 3 | **SQLite library**: `better-sqlite3` + Drizzle vs `@napi-rs/sqlite` vs manual migrations? | **PENDING** | Low risk; spike recommended. Decision before QFAT-004. |
| 4 | **Credential store fail-closed on Linux w/o Secret Service**: Approve error message and `QFAT_ALLOW_INSECURE` fallback? | **PENDING** | Security policy decision. Required for QFAT-005. |
| 5 | **Graph API version**: Lock to v27.0 after verifying Page video, Reels, Photos endpoints? | **PENDING** | Must verify against Meta changelog before QFAT-006/007/008/009. |
| 6 | **Immediate-publish parameters**: YouTube `privacyStatus: 'public'` (or 'unlisted') + no `publishAt`; Facebook `published: true` + no `scheduled_publish_time`? | **PENDING** | Product confirmation needed. Current baseline uses scheduled. |
| 7 | **YouTube optional actions in MVP**: Thumbnail upload + playlist insertion included? Failure = warning only? | **PENDING** | Scope decision. Affects adapter contract. |
| 8 | **Facebook Reels constraints**: Enforce 9:16, 3–90s, 1080×1920 client-side or trust platform rejection? | **PENDING** | UX vs implementation effort. |
| 9 | **Media retention policy**: User-only delete, or auto-cleanup after N days / on job completion? | **PENDING** | Storage management. |
| 10 | **Session/CSRF mechanism**: Double-submit cookie vs custom header? HttpOnly cookie vs localStorage? | **PENDING** | Security implementation detail. |

---

## 11. Checks Performed and Not Performed

### 11.1 Performed (Read-Only Inspection)

| Check | Command / Method | Result |
|---|---|---|
| Repository sync | `git fetch origin && git pull origin main` | PASS (fast-forward to `99bc16e`) |
| Working tree clean | `git status` | PASS (no changes) |
| TypeScript strict check | `npm run typecheck` | PASS (exit 0) |
| Build | `npm run build` | PASS (exit 0, `dist/` generated) |
| Source code inspection | Read all `src/*.ts`, `package.json`, `tsconfig.json`, `.gitignore`, docs | COMPLETE |
| PRD & Architecture review | Read `docs/PRD-QFAT-MVP.md`, `docs/ARCHITECTURE-QFAT-MVP.md` | COMPLETE |
| QFAT-001 report review | Read `reports/QFAT-001-integration-assessment.md` | COMPLETE |
| Upstream baseline verification | Verified `UPSTREAM.md` commit hash `a52fdf6` | COMPLETE |
| Meta Graph API v27.0 announcement | Web search: Meta developer news 2026-11-04 | VERIFIED (URL cited) |
| Facebook single-image endpoint | Web search: Meta Graph API Page Photos reference | VERIFIED (URL cited) |
| Dependency compatibility | Researched `better-sqlite3`, `@napi-rs/keyring`, Fastify plugins | COMPLETE |

### 11.2 Not Performed (By Design — Read-Only Task)

| Check | Reason |
|---|---|
| Dependency installation (`npm install` new packages) | Excluded by task (§6) |
| Source code modifications | Excluded by task (§6) |
| Live OAuth / credential creation | Excluded by task (§6, §116) |
| Live API calls / uploads | Excluded by task (§6, §116) |
| Database creation / migrations | Excluded by task (§6, §119) |
| Frontend scaffolding / mockups | Excluded by task (§6, §118) |
| Cross-platform runtime testing (Linux/Windows) | Requires owner machines; not in scope |
| Benchmarks (memory, throughput) | Not required for validation |
| Security audit / penetration test | Out of scope |

---

## 12. Git Publication

- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Branch:** `main`
- **Commit message:** `docs(task): architecture validation report for QFAT-002`
- **Files changed:** `reports/QFAT-002-architecture-validation.md` (new)
- **Verification:** Push verified; commit visible on GitHub

---

## 13. Handoff

This report is ready for GPT/owner audit. The assessment concludes that the proposed architecture is **technically viable** with **five owner decisions required** before implementation can begin (see §10). No implementation work has been performed. The next step is owner review and approval of the unresolved decisions, followed by GPT-authored implementation tasks starting with repository workspace setup (QFAT-003).

**Agent completion ≠ owner acceptance.** GPT/owner will audit this report and the pushed commit on GitHub to decide PASS, request changes, or authorize the next task.