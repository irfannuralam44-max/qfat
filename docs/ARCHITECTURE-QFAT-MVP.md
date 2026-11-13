# QFAT MVP — Practical Integration Architecture

- **Document ID:** QFAT-ARCH-001
- **Status:** OWNER-DIRECTED BASELINE
- **Last updated:** 2026-11-13
- **Product requirements:** [PRD-QFAT-MVP](./PRD-QFAT-MVP.md)
- **Upstream baseline:** [Spoolcast](../UPSTREAM.md)

## 1. Architecture decision

QFAT is a local-first web application. For the MVP, QFAT will **reuse the imported Spoolcast Node.js/TypeScript code as its platform integration engine** and add only the application-facing pieces needed to operate it from the QFAT UI.

Do not rebuild Spoolcast's OAuth or YouTube/Facebook upload protocols merely to create cleaner package boundaries. Do not introduce a new upload engine, adapter framework, plugin system, daemon, scheduler, or broad domain abstraction unless a concrete MVP requirement cannot be met by adapting the existing code.

The implementation should prefer the smallest safe change to the existing source.

## 2. Runtime shape

```text
QFAT Web UI (React)
       |
       | same-origin local HTTP API + progress updates
       v
QFAT Server (Node.js / TypeScript)
       |
       | thin application integration
       v
Existing Spoolcast modules
  - YouTube OAuth and upload
  - Facebook authorization concepts and upload
  - Facebook Reels upload
       |
       +---- Google / YouTube APIs
       +---- Meta / Facebook APIs

QFAT local data:
  - SQLite: accounts metadata, media metadata, jobs/history
  - encrypted credential records
  - local media library
  - Linux Secret Service protects the AES key (Linux MVP)
```

The browser never accesses platform credentials or calls platform APIs directly. The server owns credentials, local persistence, media handling, and publishing.

## 3. Reuse-first rules

| Existing Spoolcast area | MVP treatment |
|---|---|
| YouTube OAuth flow | Reuse its working OAuth/API logic; adapt callback and UI interaction only where required |
| Facebook authorization | Reuse API/token-exchange logic; replace terminal prompts with the minimum browser-facing flow needed |
| YouTube upload | Keep the existing Google API upload path; add structured progress and safe result handling |
| Facebook long-form video | Keep the existing three-phase upload protocol and bounded chunk transfer |
| Facebook Reels | Keep the Reels protocol; fix whole-file memory loading and expose progress/checkpoints as needed |
| Multi-account token model | Preserve multiple YouTube channels and Facebook Pages; connect it to QFAT account records |
| CLI queue/manifest | Keep for upstream/CLI compatibility where practical; do not make it the QFAT UI's required workflow |
| CLI console output | Replace or wrap only the output boundary needed by the server; do not spread UI concerns into protocol code |

Preserve Spoolcast's MIT license and copyright notices in adapted code. Keep the upstream source traceable.

## 4. Minimal QFAT server responsibilities

The server is an application wrapper around the existing platform modules. Its MVP responsibilities are:

1. Expose local HTTP endpoints for account status, media intake/library, publishing commands, job status, and history.
2. Invoke the existing OAuth and upload functions through narrow wrappers.
3. Provide credentials to those functions without returning secrets to the browser.
4. Accept media from the browser using streaming/bounded-memory file handling.
5. Record each selected destination independently in the existing QFAT SQLite persistence.
6. Translate upload callbacks/progress into a simple event stream for the UI.
7. Sanitize errors and prevent unsafe blind retries when the remote outcome is uncertain.

Use the existing server framework and folder structure already present in the repository. Do not replace it based on architectural preference. Add a dependency only when the current implementation demonstrably cannot meet an MVP requirement.

## 5. Upload behavior and essential fixes

Only make changes needed for the approved MVP behavior:

- **Immediate publishing:** QFAT MVP publishes after explicit user confirmation. Do not expose scheduling or carry over Spoolcast's scheduled-publishing behavior into the QFAT job path.
- **YouTube primary result:** capture and persist the primary video ID as soon as the upload succeeds. Optional thumbnail/playlist failures must not cause the primary video to be uploaded again.
- **Facebook long-form video:** retain the existing bounded chunk transfer. Add only the checkpoint/result handling required for truthful job status and safe recovery.
- **Facebook Reels:** replace whole-file `readFileSync` transfer with bounded-memory transfer. Preserve the platform-specific Reels protocol.
- **Facebook single image:** implement the single-photo Page publishing path for MVP. Albums/multiple images remain post-MVP.
- **Progress:** surface measured progress where available. If the provider does not expose a reliable percentage, show an indeterminate state rather than inventing one.
- **Multiple destinations:** preserve independent per-destination outcomes. A success at one destination must not be repeated because another destination failed.

Do not add optional post-publish features (such as thumbnail or playlist management) to the critical publishing path unless they are already needed and explicitly included in the MVP.

## 6. Persistence and credentials

Keep SQLite for QFAT application records: account metadata, media metadata, jobs, destination outcomes, and history. Do not store platform tokens as plaintext SQLite fields or ordinary JSON files.

The existing QFAT encrypted credential provider and AES-256-GCM envelope remain the credential foundation. The agreed Linux direction is:
- Secret Service is the key-storage interface.
- Use the Linux Secret Service implementation available on the owner's Linux Mint environment (GNOME Keyring).
- `@napi-rs/keyring` remains a conditional dependency candidate, with explicit Secret Service backend selection and no keyutils fallback.
- Use the Linux default collection, after verifying actual behavior.
- If the keyring is locked/unavailable, instruct the user to unlock it through Linux and retry; fail closed.
- Do not start a custom D-Bus/keyring implementation for MVP unless the selected library fails a required safety test.

The dependency's D-Bus blocking risk must be tested and mitigated before production integration. No automatic fallback to key files, keyutils, or plaintext is permitted. Keep the already-built key-file provider available only as the documented current/intermediate state until an explicit, tested migration and cutover task is approved. Never delete or migrate real key material implicitly.

Windows credential storage remains deferred. Linux is the active MVP implementation/verification target; do not expand platform work without owner approval.

## 7. UI/API boundary

The QFAT UI should use the existing server API patterns and components. Keep the browser-facing contract small and task-driven:

- Account list/connect/disconnect.
- Media intake and media library.
- Create/publish request with selected destinations.
- Job list/detail and per-destination status.
- Progress events and history.

Do not create a large generic API schema system before the actual endpoints require it. Validate all untrusted input at the server boundary. Bind the server to loopback for the local MVP and retain the existing local-origin/session protections.

## 8. MVP scope

- Multiple YouTube channels.
- Multiple Facebook Pages.
- YouTube standard video and Shorts via the standard video upload path.
- Facebook long-form video and Reels.
- Facebook single-image posts.
- Separate YouTube and Facebook metadata editors.
- Immediate publishing only.
- Per-destination progress, status, errors, and history.
- Local media library and encrypted credential storage.

Out of scope: Facebook albums, scheduling, hosted SaaS, team collaboration, Electron/Tauri packaging, Rust rewrite, analytics, transcoding, AI metadata, and unnecessary framework/package restructuring.

## 9. Implementation order

Work in small, independently verifiable tasks. Prefer the shortest dependency path:

1. Inspect the current `apps/server` and existing Spoolcast modules together; define the smallest invocation/wrapper changes required.
2. Connect account/OAuth operations to the QFAT Accounts UI while preserving Spoolcast provider logic.
3. Connect existing upload paths to QFAT's media and publishing flow; fix only the required immediate-publish, progress, memory, and duplicate-upload issues.
4. Complete Facebook single-image publishing.
5. Complete job status/history and safe retry/reconciliation behavior.
6. Integrate the agreed Linux credential key store when required by the account connection/publishing flow, including explicit migration from the existing key-file state.
7. Run local Linux verification and owner-approved sandbox smoke tests.

Do not start multiple dependent tasks in parallel. Each task must identify exact files, acceptance criteria, local checks, and explicit exclusions.

## 10. Verification and platform policy

- Run all checks locally on Linux; no GitHub Actions or hosted CI.
- Do not use real credentials or perform live authorization/uploads unless a task and the owner explicitly authorize them.
- Use mocked HTTP/provider responses for automated tests.
- Record exact commands and outcomes; distinguish source inspection from executed tests.
- Windows remains deferred. A successful Linux test does not imply Windows compatibility.

## 11. Architecture change control

This document intentionally favors pragmatic reuse over theoretical modularity. Refactoring is allowed only when it directly reduces an identified MVP risk or enables a required user flow. Any proposed rewrite, new framework, major dependency, new package boundary, or platform expansion requires a concrete justification and owner approval before implementation.

Historical task and report documents remain evidence of work performed under earlier plans. They are not current architecture instructions where they conflict with this owner-directed baseline.
