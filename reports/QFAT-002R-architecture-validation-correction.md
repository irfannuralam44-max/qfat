# QFAT-002R — Architecture Validation Report Correction

- **Status:** PASS WITH CONDITIONS
- **Original report:** `reports/QFAT-002-architecture-validation.md`
- **Original report commit:** `8786c41a4da596e7a60631144fe918f3f704b3b4`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Correction report path:** `reports/QFAT-002R-architecture-validation-correction.md`

---

## 1. Summary of Audit Findings

This correction report addresses material inaccuracies in the original QFAT-002 architecture validation report. The original report is **not rejected** but requires the following corrections before it can be considered fully accurate for owner audit.

| Area | Original Claim | Corrected Finding |
|---|---|---|
| **Inspected baseline SHA** | `99bc16e4e2c6e8b5f2a3d7c1e9b4f6a8c2d3e4f5` (invalid/fabricated) | Actual baseline: `99bc16e0a4885d14fe2fad62a7868b75787e2f4c` |
| **Desktop runtime decision** | Listed as BLOCKER: "Desktop host/runtime not yet selected" | **Product decision already made**: MVP is standalone Node.js backend + browser (no Electron/Tauri). PRD §6.1, §12, Decision Log row 19. |
| **Credential storage fallback** | Recommended `QFAT_ALLOW_INSECURE=1` for development | **Prohibited by PRD**: "do not silently fall back to plaintext" (PRD §6.4). Must fail closed. |
| **Facebook Page Photos endpoint** | Claimed verified with official URLs | **Partially verified**: Endpoint and permissions confirmed via official Meta docs. File size limit and format list NOT explicitly documented in accessible reference. |
| **Graph API v27.0** | Claimed announced 2026-11-04 | **VERIFIED**: Official blog post 2026-11-04, changelog confirms v27.0 released Nov 4, 2026. |
| **Typecheck/Build verification** | Claimed PASS | **VERIFIED**: Both commands executed and passed (exit 0). |
| **Git status/sync** | Claimed clean, synced to `99bc16e` | **VERIFIED**: Working tree clean, `origin/main` at `99bc16e0a4885d14fe2fad62a7868b75787e2f4c`. |

---

## 2. Correction 1: SHA and Baseline Verification

### 2.1 Original Report Error

The original report (line 9) states:
> **Inspected commit:** `99bc16e4e2c6e8b5f2a3d7c1e9b4f6a8c2d3e4f5` (HEAD of `main` after fetch)

This SHA **does not exist** in the repository. It appears to be a fabricated or hallucinated 40-character hex string.

### 2.2 Actual Git State (Verified)

```bash
$ git rev-parse HEAD
8786c41a4da596e7a60631144fe918f3f704b3b4   # Current HEAD (QFAT-002 report commit)

$ git rev-parse 99bc16e
99bc16e0a4885d14fe2fad62a7868b75787e2f4c   # Baseline commit BEFORE report was added

$ git log --oneline -5
8786c41 docs(task): architecture validation report for QFAT-002
99bc16e docs(qfat): add QFAT-002 architecture validation task
8c9a584 docs(qfat): propose local web MVP architecture
3a612c2 docs(qfat): add MVP product requirements document
0cc6c53 docs(assessment): add QFAT-001 integration report
```

### 2.3 Correct Baseline Description

- **Repository:** `irfannuralam44-max/qfat` (confirmed via `git remote -v`)
- **Target branch:** `main`
- **Baseline inspected for validation:** Commit `99bc16e0a4885d14fe2fad62a7868b75787e2f4c` (short: `99bc16e`) — the state of `main` **before** the QFAT-002 report was committed.
- **Current HEAD after report commit:** `8786c41a4da596e7a60631144fe918f3f704b3b4`
- **Working tree:** Clean (no uncommitted changes)
- **Remote sync:** Verified — `origin/main` at `99bc16e` before push, now at `8786c41` after push.

### 2.4 Impact

The original report's baseline metadata is **inaccurate**. Any audit tracing "inspected commit" to the claimed SHA will fail. This must be corrected in the record.

---

## 3. Correction 2: Desktop Runtime Decision

### 3.1 Original Report Error

Section 1 (Executive Recommendation), item 1; Section 10 (Unresolved Decisions), item 1:
> **Desktop host/runtime not yet selected** — "The architecture proposes a separate Node.js backend process without committing to Electron, Tauri, or another desktop host. The credential storage, process lifecycle, and packaging decisions depend on this choice."

This is listed as a **BLOCKER** requiring owner decision.

### 3.2 PRD Evidence (Product Decision Already Made)

**PRD-QFAT-MVP.md** explicitly states:

- §1 Product Summary (line 14): "The MVP is a **web application running locally on the user's computer**. The browser is the user interface; a separate Node.js backend owns platform integrations... The MVP is not a hosted multi-tenant SaaS and **does not require Electron or Tauri**."
- §6.1 Runtime Architecture (lines 232-236): "The MVP consists of two separately runnable local processes: **Frontend: React + Vite static/client application served to the browser. Backend: Node.js >= 20 + TypeScript HTTP API and upload worker.**"
- §12 Decision Log (line 419): "**Desktop shell: Not in MVP; Tauri 2 is a possible later phase**"
- §10 Post-MVP Roadmap (line 381): "**Tauri 2 desktop packaging using the same web frontend and Node.js backend as a Sidecar** — potential follow-up capability, each requiring separate scope."

### 3.3 Corrected Position

| Decision | Status | Evidence |
|---|---|---|
| **MVP delivery model** | **DECIDED** | Local-first web app (React + Vite frontend, separate Node.js backend) |
| **Electron/Tauri for MVP** | **EXPLICITLY EXCLUDED** | PRD Non-goals §38: "Electron or Tauri packaging in the MVP" |
| **Tauri 2** | **POST-MVP** | PRD §10, Decision Log row 19: "possible later phase" |
| **Desktop host/runtime selection** | **NOT A BLOCKER** | Product decision already made; no desktop framework for MVP |

The original report incorrectly treats the **absence of a desktop framework** as an unresolved decision. The product decision is clear: **no desktop framework in MVP**. The backend is a standalone Node.js process; the frontend runs in the browser. This is a **product decision**, not a technical decision pending owner approval.

### 3.4 Impact on Credential Storage

Since Electron is **not** the MVP host, `Electron safeStorage` is **not an option** for MVP credential storage. The credential provider must use a Node.js-compatible solution (e.g., `@napi-rs/keyring` or direct OS API bindings) that works in a standalone Node.js process on Linux and Windows.

---

## 4. Correction 3: Credential Storage Policy

### 4.1 Original Report Error

Section 3.3 (Credential Storage), Section 4.2 (Fail-Closed Specification):

> - `QFAT_ALLOW_INSECURE=1` enables a development-only fallback to encrypted file (AES-256-GCM with key derived from machine ID) — **not plaintext**. This is a last resort for headless CI/dev containers, never for production.
> - Throw actionable error: "... or set QFAT_ALLOW_INSECURE=1 to override (NOT RECOMMENDED)."

### 4.2 PRD Evidence (Prohibits Fallback)

**PRD-QFAT-MVP.md §6.4 Persistence (lines 305-307):**
> "Platform secrets must not be stored as plaintext in SQLite or ordinary JSON files.
> Define a credential-provider abstraction and select an appropriate secure storage implementation for Linux and Windows before implementing OAuth persistence.
> **On systems without a usable secure credential store, fail closed or require an explicit owner-approved alternative; do not silently fall back to plaintext.**"

**PRD §7 Security (line 333):**
> "Keep OAuth access/refresh tokens and Meta Page tokens in OS-protected credential storage, not browser storage, logs, SQLite plaintext, or Git."

### 4.3 Corrected Policy

| Requirement | Corrected Specification |
|---|---|
| **Plaintext fallback** | **PROHIBITED** — No `QFAT_ALLOW_INSECURE`, no encrypted file fallback, no JSON/SQLite plaintext storage. |
| **Linux without Secret Service** | **FAIL CLOSED** — Operation requiring credentials MUST fail with actionable error. No automatic fallback. |
| **Windows** | Use Windows Credential Vault (DPAPI) via `@napi-rs/keyring` or equivalent. |
| **Owner-approved alternative** | If owner explicitly approves a specific alternative (documented, scoped), it may be implemented. But **no generic fallback mechanism** in code. |
| **Migration from JSON** | One-time secure migration; original `.secrets/tokens.json` securely wiped (overwrite + unlink). No plaintext retention. |

### 4.4 Recommended CredentialProvider Interface (Standalone Node.js)

```ts
// packages/auth/src/credential-provider.ts
export interface PlatformCredential {
  // YouTube
  refresh_token?: string;
  channel_id?: string;
  channel_title?: string;
  // Facebook
  page_id?: string;
  page_token?: string;
  page_name?: string;
}

export interface CredentialProvider {
  get(accountKey: string): Promise<PlatformCredential | null>;
  set(accountKey: string, credential: PlatformCredential): Promise<void>;
  delete(accountKey: string): Promise<void>;
  listKeys(platform: 'youtube' | 'facebook'): Promise<string[]>;
}

// Implementation: @napi-rs/keyring (or equivalent) for Linux Secret Service + Windows Credential Vault
// NO Electron safeStorage (Electron not in MVP)
// NO plaintext/encrypted-file fallback
// Factory throws on initialization if secure backend unavailable
export async function createCredentialProvider(): Promise<CredentialProvider> {
  // Probe Secret Service (Linux) / Credential Vault (Windows)
  // Throw CredentialStoreUnavailableError if not available
  // Error message: "No secure credential store detected. On Linux, ensure gnome-keyring or kwalletd is running."
}
```

---

## 5. Correction 4: Facebook Page Photos API Verification

### 5.1 Original Report Claims

Section 3.7, Section 7:
- Endpoint: `POST /{page-id}/photos`
- Method: `multipart/form-data`
- Permissions: `pages_manage_posts`, `pages_read_engagement`
- Parameters: `source` (file), `message`, `published` (bool), `scheduled_publish_time`
- Formats: JPEG, PNG, GIF, BMP, TIFF, WebP
- Size limit: 100 MB
- Response: `{id, post_id}`
- Official URLs cited (accessed 2026-11-11)

### 5.2 Actual Verification from Meta Documentation

**Verified via official Meta Graph API Reference (accessed 2026-11-11):**

| Aspect | Verified | Source |
|---|---|---|
| **Endpoint** | ✅ `POST /{page-id}/photos` (also versioned `POST /v27.0/{page-id}/photos`) | https://developers.facebook.com/docs/graph-api/reference/v27.0/page/photos/ |
| **HTTP Method** | ✅ POST with `multipart/form-data` (file upload) | Official reference shows curl examples with file attachment |
| **Required Permissions** | ✅ Page access token + `pages_read_engagement` + `pages_show_list` (for MODERATE task) | Official reference "Requirements" section |
| **App Review** | ✅ `pages_manage_posts` requires App Review for non-owned Pages; Development mode works for owned Pages | Standard Meta policy, consistent with docs |
| **Parameters** | ✅ `source` (file), `message` (caption), `published` (boolean, default true), `scheduled_publish_time` (Unix timestamp) | Official reference parameters list |
| **Return Type** | ✅ `{id: numeric_string, post_id: string}` | Official reference "Return Type" |
| **Error Codes** | ✅ 324 (missing/invalid image), 200 (permissions), 190 (invalid token), 100 (invalid param), 240 (desktop app restriction), 283 (extended permissions) | Official reference "Error Codes" |
| **Temporary photo TTL** | ✅ 24 hours if not published | Official reference |
| **File size limit** | ❌ **NOT explicitly documented** in accessible reference | Not found in v27.0/v26.0/v25.0 reference pages |
| **Supported formats list** | ❌ **NOT explicitly documented** in accessible reference | Reference mentions "image file" but not exhaustive format list |
| **Single-image vs multi-photo** | ✅ Single photo upload to `/photos` returns photo ID; multi-photo post uses `/feed` with `attached_media` | Official reference "Publishing a multi-photo post" |

### 5.3 Corrected Findings

| Item | Corrected Detail |
|---|---|
| **Endpoint** | `POST /v27.0/{page-id}/photos` (use versioned endpoint) |
| **Permissions** | Page access token with `pages_read_engagement`, `pages_show_list` (for pages the user can MODERATE). `pages_manage_posts` required for publishing. |
| **Publishing** | Immediate: `published=true` (default). Scheduled: `published=false` + `scheduled_publish_time` (Unix seconds). MVP uses immediate. |
| **Size limit** | **NOT VERIFIED** — Meta docs do not explicitly state a 100 MB limit for photos in the accessible reference. Implementation should enforce a conservative limit (e.g., 50 MB) and handle 324 error. |
| **Supported formats** | **NOT VERIFIED** — Reference does not enumerate JPEG/PNG/GIF/BMP/TIFF/WebP. Implementation should validate via MIME type (magic bytes) and accept common image MIME types. |
| **App Review** | Required for `pages_manage_posts` on Pages not owned by app developer. Development mode works for admin/tester accounts on owned Pages. |
| **Desktop app restriction** | Error code 240: "Desktop applications cannot call this function for other users" — relevant for MVP (local app). Must use Page access token, not user token. |

### 5.4 Graph API v27.0 Verification

**VERIFIED** via official Meta sources:
- Blog post: https://developers.facebook.com/blog/post/2026/11/04/introducing-graph-api-v27-and-marketing-api-v27 (published 2026-11-04)
- Changelog: https://developers.facebook.com/docs/graph-api/changelog/version27.0 (shows "Released November 4, 2026")
- Version table: https://developers.facebook.com/docs/graph-api/changelog/ (shows v27.0 | November 4, 2026 | TBD)

The original report's claim of v27.0 release on 2026-11-04 is **correct**.

---

## 6. Correction 5: Verification Commands Audit

### 6.1 Commands Actually Executed (During This Correction Task)

| Command | Executed | Result | Evidence |
|---|---|---|---|
| `npm run typecheck` | ✅ Yes | PASS (exit 0) | `tsc --noEmit` completed without errors |
| `npm run build` | ✅ Yes | PASS (exit 0) | `tsc` generated `dist/` |
| `git status` | ✅ Yes | Clean | No uncommitted changes |
| `git log --oneline -10` | ✅ Yes | Verified | Commit history matches |
| `git remote -v` | ✅ Yes | Verified | `origin` → `https://github.com/irfannuralam44-max/qfat.git` |
| `git rev-parse HEAD` | ✅ Yes | `8786c41a4da596e7a60631144fe918f3f704b3b4` | Current HEAD |
| `git rev-parse 99bc16e` | ✅ Yes | `99bc16e0a4885d14fe2fad62a7868b75787e2f4c` | Baseline commit |

### 6.2 Original Report Claims vs. Reality

| Original Claim | Actual Verification |
|---|---|
| "Typecheck PASS (exit 0)" | **VERIFIED TRUE** — command executed and passed |
| "Build PASS (exit 0)" | **VERIFIED TRUE** — command executed and passed |
| "git status Clean" | **VERIFIED TRUE** — working tree clean |
| "git log verified 99bc16e HEAD matches origin/main" | **PARTIALLY TRUE** — `99bc16e` was HEAD of `origin/main` BEFORE report commit; after push, `origin/main` is at `8786c41` |
| "Inspected commit 99bc16e4e2c6..." | **FALSE** — SHA does not exist; actual baseline is `99bc16e0a4885d14fe2fad62a7868b75787e2f4c` |

### 6.3 Checks NOT Performed (By Design — Read-Only Task)

The following were correctly identified as not performed in both original and this correction:
- Dependency installation (`npm install` new packages)
- Source code modifications
- Live OAuth / credential creation
- Live API calls / uploads
- Database creation / migrations
- Frontend scaffolding / mockups
- Cross-platform runtime testing (Linux/Windows)
- Benchmarks
- Security audit / penetration test

---

## 7. Summary of Changes to Original Recommendations

| Section | Original | Corrected |
|---|---|---|
| **Executive Status** | READY WITH CONDITIONS (5 conditions) | READY WITH CONDITIONS (3 conditions — desktop host removed, credential fallback removed) |
| **Blocker #1: Desktop host** | "Desktop host/runtime not yet selected" — BLOCKER | **REMOVED** — Product decision already made: standalone Node.js + browser |
| **Blocker #4: Credential fallback** | `QFAT_ALLOW_INSECURE=1` fallback recommended | **REMOVED** — Prohibited by PRD; fail closed only |
| **Credential provider options** | Included Electron `safeStorage` | **REMOVED** — Electron not in MVP |
| **Facebook photo size limit** | "100 MB (per Meta docs)" | **NOT VERIFIED** — No explicit limit in accessible docs |
| **Facebook photo formats** | "JPEG, PNG, GIF, BMP, TIFF, WebP (per Meta docs)" | **NOT VERIFIED** — No explicit format list in accessible docs |
| **Inspected baseline SHA** | `99bc16e4e2c6e8b5f2a3d7c1e9b4f6a8c2d3e4f5` | `99bc16e0a4885d14fe2fad62a7868b75787e2f4c` |

---

## 8. Remaining Unresolved Owner Decisions (Corrected)

| # | Decision | Status | Impact |
|---|---|---|---|
| 1 | **SQLite library**: `better-sqlite3` + Drizzle vs `@napi-rs/sqlite` vs manual migrations | PENDING | Low risk; spike recommended before QFAT-004 |
| 2 | **Credential store fail-closed on Linux w/o Secret Service**: Approve error message (no fallback) | PENDING | Security policy; required for QFAT-005 |
| 3 | **Graph API version**: Lock to v27.0 after verifying Page video, Reels, Photos endpoints | PENDING | Must verify against Meta changelog before adapter work |
| 4 | **Immediate-publish parameters**: YouTube `privacyStatus: 'public'`/`'unlisted'` + no `publishAt`; Facebook `published: true` + no `scheduled_publish_time` | PENDING | Product confirmation needed; baseline uses scheduled |
| 5 | **YouTube optional actions in MVP**: Thumbnail upload + playlist insertion included? Failure = warning only? | PENDING | Scope decision; affects adapter contract |
| 6 | **Facebook Reels constraints**: Enforce 9:16, 3–90s, 1080×1920 client-side or trust platform rejection? | PENDING | UX vs implementation effort |
| 7 | **Media retention policy**: User-only delete, or auto-cleanup after N days / on job completion? | PENDING | Storage management |
| 8 | **Session/CSRF mechanism**: Double-submit cookie vs custom header? HttpOnly cookie vs localStorage? | PENDING | Security implementation detail |

**Note:** "Desktop host/runtime" and "Target OS/arch matrix" are **removed** as blockers — product decisions already documented in PRD.

---

## 9. Risk Assessment Update

| Risk | Original Severity | Corrected Severity | Notes |
|---|---|---|---|
| Desktop host undefined | Blocking | **Resolved** | Product decision: no desktop framework in MVP |
| Credential plaintext fallback | Critical | **Resolved** | PRD prohibits fallback; fail closed only |
| Electron `safeStorage` dependency | High | **Resolved** | Electron not in MVP; use `@napi-rs/keyring` |
| Facebook photo size/format unverified | Medium | **Medium** | Implementation must handle gracefully |
| Graph API v27.0 endpoint compatibility | High | **High** | Must verify Page video, Reels, Photos on v27.0 |
| YouTube duplicate upload on optional action fail | Critical | **Critical** | Unchanged — requires adapter redesign |
| Facebook Reels whole-file memory | High | **High** | Unchanged — requires streaming redesign |

---

## 10. Next Steps Recommendation

1. **Owner reviews this correction report** alongside original QFAT-002 report.
2. **Owner approves/resolves remaining 8 decisions** in §8.
3. **GPT authors QFAT-003** (Workspace & Contracts) with corrected assumptions:
   - No Electron/Tauri in workspace
   - Credential provider uses `@napi-rs/keyring` (or equivalent standalone Node.js)
   - Fail-closed credential store (no fallback)
   - Graph API v27.0 as baseline version
4. **Implementation proceeds** with corrected architecture.

---

## 11. Conclusion: Original Report Status

**The original QFAT-002 report (commit `8786c41`) is PASS WITH CONDITIONS but contains material inaccuracies that must be acknowledged:**

- ❌ **Invalid baseline SHA** — fabricated commit hash
- ❌ **False blocker** — desktop host decision already made in PRD
- ❌ **Policy violation** — recommended credential fallback prohibited by PRD
- ⚠️ **Unverified claims** — Facebook photo size limit and format list not in official docs
- ✅ **Verified claims** — typecheck, build, git status, Graph API v27.0 release date, Page Photos endpoint/permissions

**This correction report should be read as an addendum to the original.** The original report is not withdrawn but its findings are superseded where corrected herein.

**Agent completion ≠ owner acceptance.** GPT/owner will audit both reports on GitHub to decide final status.

---

## 12. Git Publication

- **Remote:** `origin` → `https://github.com/irfannuralam44-max/qfat.git`
- **Branch:** `main`
- **Commit message:** `docs(task): QFAT-002R architecture validation correction report`
- **Files changed:** `reports/QFAT-002R-architecture-validation-correction.md` (new)
- **Base commit:** `8786c41a4da596e7a60631144fe918f3f704b3b4` (original QFAT-002 report)