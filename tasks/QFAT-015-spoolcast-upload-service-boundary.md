# QFAT-015 — Make Existing Spoolcast Upload Functions Callable by QFAT

- **Status:** READY FOR EXECUTION — bounded implementation task
- **Task type:** Spoolcast reuse / upload-service boundary
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Owner direction:** Reuse Spoolcast as the QFAT MVP platform engine; keep changes minimal.
- **Architecture:** `docs/ARCHITECTURE-QFAT-MVP.md`
- **Product requirements:** `docs/PRD-QFAT-MVP.md`
- **Workflow:** `docs/AI-DEVELOPMENT-WORKFLOW.md`
- **Expected report:** `reports/QFAT-015-spoolcast-upload-service-boundary-report.md`

## 1. Objective

Prepare the existing Spoolcast YouTube, Facebook Page video, and Facebook Reels upload functions so the QFAT server can call them directly in a later task.

Keep the existing upload protocols and source modules. Make only the smallest safe changes needed to:
- pass credentials and upload metadata from the caller instead of reading Spoolcast's plaintext token store;
- support QFAT's immediate-publish MVP behavior (no scheduling);
- report progress through callbacks rather than writing progress to the CLI terminal;
- return structured upload results and preserve the primary remote ID if optional follow-up work fails;
- test behavior without contacting Google or Meta.

This task creates a reusable service boundary. It does **not** add QFAT HTTP routes, OAuth flows, account persistence, or UI integration.

## 2. Verified repository baseline

Current relevant source:
- `src/upload-youtube.ts`: exports `uploadToYouTube(videoPath, meta, account)`; internally loads Google OAuth client JSON, writes console output, and requires scheduled metadata (`publishAtUTC`).
- `src/upload-facebook.ts`: exports `uploadToFacebook(videoPath, meta, account)`; implements the existing three-phase chunked Page video protocol and requires scheduled finish parameters.
- `src/upload-facebook-reel.ts`: exports `uploadReelToFacebook(videoPath, meta, account)`; implements the existing Reels protocol but reads the entire file into memory and requires scheduled finish parameters.
- `src/tokens.ts`: contains Spoolcast's plaintext JSON token-store and account types. QFAT must not use its plaintext persistence path.
- `apps/server/src/index.ts`: currently registers health, security, and media routes only; it does not invoke Spoolcast modules.
- `apps/server/src/credentials/provider.ts`: QFAT has an encrypted credential-provider contract, but account/OAuth integration is not part of this task.

The source above is the implementation baseline. Re-inspect exact current code after synchronizing to `main`; this task's summary is not a substitute for inspection.

## 3. Scope

### 3.1 Callable upload inputs

Refactor the existing exported upload functions (or add small adjacent service functions in the same existing source area) so QFAT can pass all required values explicitly.

- YouTube: accept the Google OAuth client ID/secret (or an already-created OAuth client) and the selected channel refresh token from the caller. Do not call `loadGoogleClient()`, `loadTokens()`, or `saveTokens()` from the QFAT-callable path.
- Facebook video and Reels: continue accepting the selected Page ID and Page access token as explicit function input. Do not read Spoolcast token files.
- Metadata must be explicit and typed. Do not require a Spoolcast queue folder, `meta.json`, channel manifest, alias lookup, or CLI arguments for the QFAT-callable path.
- Preserve existing CLI behavior where practical. If a shared function signature must change, update all existing callers and tests in this task.

### 3.2 Immediate publishing

The QFAT-callable path must publish immediately after the caller explicitly invokes it.

- YouTube: omit `publishAt`; use the approved immediate-publication status for the existing upload path. Preserve privacy/visibility behavior only where the provider requires an explicit safe default; document the exact choice and evidence.
- Facebook Page video: finish the existing upload session as published immediately; do not send scheduled publish time.
- Facebook Reels: finish the existing Reel as published immediately; do not send scheduled publish time.
- No future timestamp, schedule queue, cron, or scheduling UI/API is introduced.
- Do not change legacy CLI scheduling behavior unless unavoidable for safe code reuse; if it must change, stop and explain the conflict instead of silently breaking CLI compatibility.

The implementation report must identify the exact provider request fields used for immediate publishing. If current official provider semantics are uncertain, do not guess: stop the affected adapter and report BLOCKED with the precise unresolved question.

### 3.3 Progress and results

- Add an optional typed progress callback to each callable upload path.
- Emit only values actually measured by the existing transfer protocol/API callback. Include bytes sent/total where known; do not fabricate percentages.
- Do not write progress output to stdout/stderr from the QFAT-callable path.
- Preserve useful structured results (provider video ID and canonical URL where available).
- YouTube's primary video ID must be returned/persisted by the caller before optional thumbnail or playlist follow-up can fail. Prefer making optional post-upload operations independently reportable; a thumbnail/playlist failure must not be reported as if the primary video upload failed or trigger an automatic duplicate upload.
- Do not log credentials, OAuth data, signed upload URLs, or token-bearing query strings.

### 3.4 Bounded-memory Reels transfer

Replace `readFileSync(videoPath)` in the Reels transfer with a bounded-memory streaming/chunked approach that matches the current Meta Reels protocol and its server acknowledgement requirements.

- Do not invent chunk/offset semantics.
- If the current protocol evidence is insufficient to implement safe bounded-memory transfer, do not approximate it; document the blocker and stop that sub-scope.
- Keep the existing three-stage Reels protocol and server-provided upload URL behavior.
- Add tests proving that the implementation does not read the entire media file into one Buffer.

### 3.5 Tests

Add offline tests for:
- immediate-publish request construction for each supported upload path;
- caller-supplied credentials are used and no Spoolcast token-store read/write is attempted;
- measured progress callback values;
- no CLI progress output from the QFAT-callable path;
- primary YouTube result is preserved when optional follow-up actions fail;
- bounded-memory Reels transfer and expected acknowledgement handling;
- provider errors are sanitized before they reach the caller where required.

Use injected/mock HTTP/provider clients and temporary fixture files. Do not use live Google/Meta APIs, real credentials, OAuth, or uploads.

## 4. Explicit exclusions

Do not:
- add or install dependencies unless an unavoidable, separately justified owner decision is requested first;
- add Fastify routes or modify `apps/server`;
- add or change database schema, account tables, jobs, or persistence;
- integrate the QFAT credential provider or Linux Secret Service;
- implement OAuth browser flows or change `src/auth-youtube.ts` / `src/auth-facebook.ts`;
- implement Facebook single-image publishing (separate follow-up task);
- add album publishing, scheduling, retries, job orchestration, SSE, or UI changes;
- delete or migrate `.secrets/tokens.json` or any existing credentials;
- perform real authorization or live publishing;
- work on Windows or GitHub Actions/hosted CI;
- perform broad refactors or move Spoolcast source into new packages.

## 5. Required workflow

1. Synchronize safely with `main`; preserve local user changes.
2. Read `AGENTS.md`, `CLAUDE.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, the PRD, architecture, and relevant existing tests.
3. Inspect current callers and CLI behavior before editing.
4. Map every acceptance criterion to source changes and offline tests.
5. Keep changes limited to the existing Spoolcast upload modules and directly necessary tests.
6. Run all required checks locally on Linux. Record exact commands, environment, exit codes, and test counts.
7. Commit and push to `main`; verify the remote commit and report.
8. Stop after publication. Do not start server routes, OAuth, account persistence, or the next task.

## 6. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | QFAT-callable YouTube, Facebook video, and Facebook Reels upload paths accept credentials explicitly and never read/write Spoolcast token JSON. |
| AC-02 | QFAT-callable paths accept explicit typed metadata and do not depend on CLI args, queue manifests, aliases, or `meta.json`. |
| AC-03 | Immediate-publish request semantics are implemented correctly for all three upload types; no scheduling fields are sent. |
| AC-04 | Each path supports an optional typed progress callback with truthful measured values and no CLI progress output. |
| AC-05 | Primary YouTube upload result remains available even if optional thumbnail/playlist follow-up fails. |
| AC-06 | Reels upload uses bounded memory and preserves verified protocol acknowledgement semantics; no whole-file read. |
| AC-07 | Offline tests cover request construction, credential injection, callbacks, follow-up failure, Reels streaming, and error handling. |
| AC-08 | Existing CLI behavior remains compatible, or any unavoidable behavior change is explicitly documented with regression evidence. |
| AC-09 | No HTTP server, OAuth, database, credential-provider, UI, dependency, Windows, or hosted-CI scope is added. |
| AC-10 | Local Linux typecheck/build/tests pass; report includes exact commands and outcomes. |

## 7. Stop conditions

Stop and report BLOCKED rather than guessing if:
- immediate-publish semantics for any provider endpoint cannot be established from current authoritative documentation;
- safe bounded-memory Reels transfer cannot be implemented from verified protocol behavior;
- a dependency or major architecture change appears necessary;
- existing CLI compatibility would be broken by the smallest safe adaptation;
- the implementation would require live credentials, OAuth, or publishing.

Do not silently expand the task to resolve any stop condition.

## 8. Handoff

Create `reports/QFAT-015-spoolcast-upload-service-boundary-report.md`. Record the candidate commit SHA, branch, exact files changed, AC results, local verification, provider request semantics and source links, and remaining findings. The report must state that this is ready for GPT audit, not owner acceptance.

After push and remote verification, provide only the minimal workflow handoff: branch, commit message, full SHA, and report path.