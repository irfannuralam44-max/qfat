# Implementation Report — QFAT-023

- **Status:** BLOCKED / OPEN OWNER DECISION (investigation and documentation deliverables completed)
- **Task specification:** `tasks/QFAT-023-spoolcast-invocation-boundary-design.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Synchronized remote HEAD before work:** `5e5c4b74c55abac709bbbf9f01ab0e502d0df83b`
- **Design commit:** `358aec4c28c16dc16a22d77f12b58d6f7520e1b6`
- **Design formatting follow-up:** `dc48019d9e7d121a6e9246ed6e38365b781ef8d9`
- **Commit message:** `docs(QFAT-023): design Spoolcast invocation boundary`

## Scope

Completed the source-grounded, read-only assessment of possible local invocation boundaries between the QFAT browser frontend and the existing Spoolcast publishing core.

The design compares:
- QFAT server calling existing upload adapters in-process;
- QFAT server invoking a one-shot Spoolcast child process;
- a supervised persistent child process / IPC.

It records the existing package/process topology, browser/server/Spoolcast trust boundaries, credential ownership, media handoff constraints, conceptual request/result/progress contract, lifecycle/cancellation limitations, and the current Spoolcast capability gaps.

**No invocation topology is selected.** The report is intentionally BLOCKED / OPEN OWNER DECISION for runtime architecture. The existing adapters make in-process invocation the narrowest candidate for further consideration, but the current source does not establish the package boundary, account/credential mapping, media resolution, publishing authorization, or progress transport needed to call it safely. This is not authorization to implement the candidate.

## Implementation

Created `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md`.

Key conclusions:

1. **CLI is not a service entry point.** `src/cli.ts` dynamically imports command modules because importing them runs their entrypoint. `src/run.ts` scans the entire Spoolcast queue, reads manifests, loads tokens, performs all pending item/target operations, writes the existing ledger, and emits human-readable console output. It has no one-item request contract, structured progress protocol, or QFAT immediate-mode flag.
2. **Adapters are reusable primitives, not a complete integration boundary.** QFAT-015 added explicit inputs, immediate/scheduled options, progress callbacks, quiet mode, and structured results to the YouTube, Facebook Page video, and Facebook Reels upload functions. They do not resolve QFAT media/account IDs, validate browser requests, orchestrate selected targets, or transport progress to the browser.
3. **Package boundary is not established.** Root Spoolcast is ESM with Node `>=20`, a CLI binary, `dist` output, and no declared service export. `@qfat/server` is a separate ESM package with Node `>=22`, a separate TypeScript build, and no declared dependency on Spoolcast.
4. **Credential ownership is unresolved.** Spoolcast uses `.secrets/tokens.json`, `google-client.json`, and Facebook app credentials/environment. QFAT's `CredentialProvider` is opaque encrypted Buffer storage keyed by internal `{id, purpose, provider}`; no implemented OAuth account model or verified alias mapping was found.
5. **Existing browser security is not publishing authorization.** Fastify binds to loopback, but Vite exposes the browser frontend on `0.0.0.0:5173` for LAN/Tailscale access. Existing Origin/Host, session, and CSRF checks protect browser request context, but there is no human identity or per-account authorization. Any publishing exposure over the same browser surface needs explicit Owner approval.
6. **Media handoff is not established.** QFAT media API exposes opaque metadata/IDs, not a trusted path contract for adapters. Intake supports images and additional video signatures; Spoolcast video input is limited to `.mp4` and `.mov`. Facebook single-image and album publishing remain unverified and excluded.
7. **Immediate mode remains blocked by manifest/CLI gaps.** `readManifest` requires and parses `publishAt`, and Facebook schedule-window checks run for a Facebook target. The legacy CLI does not pass QFAT-015's `immediate: true` option.
8. **Progress and cancellation remain unresolved.** Adapter callbacks expose measured bytes but there is no publishing event route/transport. Adapters do not accept a common AbortSignal. A browser disconnect or child kill cannot prove that an in-flight provider request was cancelled.

The design preserves QFAT-022: Publish Now and Schedule, one shared timezone-aware timestamp for all targets in MVP, independent per-target outcomes, provider-side future publication, and no local scheduler.

## Files Changed

Only the two authorized new Markdown deliverables were created/modified:

| Path | Purpose |
|---|---|
| `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md` | Source-grounded topology comparison, trust boundaries, credential mapping, conceptual invocation contract, source gaps, and Owner decisions |
| `reports/QFAT-023-spoolcast-invocation-boundary-design-report.md` | This execution report and verification evidence |

The task specification was read but not modified. No other paths are included in the final remote compare.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 Safely synchronize `main`, verify remote HEAD, preserve existing local work | PASS WITH FINDINGS | Verified remote `main` at `5e5c4b74c55abac709bbbf9f01ab0e502d0df83b`; compare from task's stated baseline `3fd8f4c060bc297acaf9cd2090fab42a2707ccae` showed exactly one task-specification commit ahead and zero behind. No local checkout/shell was available, so local working-tree state could not be inspected. No remote changes were overwritten. |
| AC-02 Read required docs and inspect relevant current source/tests | PASS | Read all ten §2 documents plus the complete QFAT-023 task; inspected root/server package and TS configs, CLI, manifest, token, adapter, state, server/security/media/credential and frontend security sources; inspected relevant upload-service, server security, and media tests read-only. |
| AC-03 Document current package/process/server topology | PASS | Design §§3.1–3.3 distinguish CLI behavior, adapter primitives, separate package boundaries, Fastify startup/shutdown, and Vite proxy. |
| AC-04 Compare in-process, one-shot child, and persistent child/IPC | PASS | Design §5 includes evidence, benefits, risks, security, complexity, required changes, and approvals for each option. No false claim that the existing CLI is a usable one-shot publishing endpoint. |
| AC-05 Document trust boundaries, local exposure, validation, lifecycle, progress, timeout, termination, errors | PASS WITH FINDINGS | Design §§3.3, 6.3–6.4, and 7 distinguish existing controls from proposed requirements and unresolved authorization/transport decisions. No route/process was implemented. |
| AC-06 Document credential/account ownership and mapping constraints | PASS | Design §4 records Spoolcast token shapes/files and QFAT opaque CredentialProvider context; no approved account mapping or token owner is inferred. |
| AC-07 Specify minimal conceptual request/result/progress contract | PASS | Design §6 is explicitly proposed-only and covers opaque media ID, content fields, target identifiers, mode/shared timestamp, per-target results, measured progress, and provider acceptance semantics without queue/job/ledger design. |
| AC-08 Re-verify manifest, adapter, target isolation, state, and media caveats | PASS | Design §8 cites `src/manifest.ts`, `src/run.ts`, `src/state.ts`, all three adapters, QFAT-015 report, and QFAT media intake constraints. |
| AC-09 Provide decision matrix and Owner decisions | PASS | Design §§5 and 10; no topology selected; nine explicit Owner decisions recorded. |
| AC-10 Preserve QFAT/Spoolcast and scheduling scope boundaries | PASS | Design §§1, 6, 9, and 12 retain QFAT frontend / Spoolcast core, one shared timestamp, independent outcomes, provider-side scheduling, and no local scheduler. |
| AC-11 Only authorized paths changed; no runtime/source/test/dependency/config/schema changes | PASS | Final remote compare from synchronized HEAD lists only the two authorized Markdown deliverables. Task file and all source/runtime paths are unchanged. |
| AC-12 Report includes commands/environment/results, source paths, findings, limitations, Git evidence | PASS | This report §§2, 5–8 and design §11. |

## Verification

| Command / Check | Result | Notes |
|---|---|---|
| Search remote branch `main` | PASS | Confirmed branch exists. |
| Fetch remote commit `main` | PASS | Resolved current HEAD to `5e5c4b74c55abac709bbbf9f01ab0e502d0df83b`. |
| Compare stated baseline to synchronized `main` | PASS | `3fd8f4c060bc297acaf9cd2090fab42a2707ccae...main`: 1 ahead, 0 behind; only QFAT-023 task file added. |
| Read required documents and source files | PASS | GitHub remote file reads; no source writes. |
| Read-only tests inspection | PASS | `test/upload-service.test.ts`, `apps/server/test/security.test.ts`, `apps/server/test/media.test.ts` inspected; not executed. |
| Internal Markdown link/reference check | PASS | Design contains no external or relative Markdown link destinations; all referenced repository source/document paths were fetched or verified during inspection. |
| Remote changed-path review | PASS | Final compare from synchronized HEAD to final publication contains only the two allowed deliverables. |
| `git diff --check` | NOT RUN | No local repository checkout/shell was available through the connected GitHub interface. |
| `git status --short`, staged-path review, local full diff | NOT RUN | No local checkout. Remote commit diffs and compare path inventory were used instead. |
| Typecheck/build/application tests | NOT RUN | Documentation-only task; no code was changed and these checks were not required. |
| Live OAuth/provider API/upload/external network tests | NOT RUN | Explicitly prohibited by QFAT-023. |
| GitHub Actions / hosted CI | NOT RUN | Explicitly prohibited by repository workflow. |

## Findings and Limitations

1. **Runtime architecture is blocked by Owner decisions.** The source contains adapter functions but no complete safe QFAT invocation path. The in-process option is a candidate, not a selected architecture.
2. **Credential ownership and account mapping are unresolved.** No account entity maps QFAT records to Spoolcast aliases; no token migration or duplication is proposed.
3. **Current browser session security is not user authentication.** Existing LAN/Tailscale reachability means publishing authorization requires a separate threat-model decision.
4. **Immediate-mode manifest validation and legacy CLI integration remain Spoolcast gaps.** No workaround or source change was made.
5. **Media compatibility is narrower than QFAT media intake.** Video-only Spoolcast input is verified; Facebook single-image and albums remain unsupported/unverified.
6. **Progress transport, request lifetime, cancellation, duplicate submission, and durable scheduled status remain unresolved.** No SSE, WebSocket, polling, IPC, background job, or persistence mechanism was introduced.
7. **Local Git checks could not be run.** The connected repository interface provides remote GitHub operations only; this limitation is explicit and not represented as a successful local command.

No source, tests, dependencies, configuration, database/schema, credentials, media, route, endpoint, child process, launcher, service, daemon, queue, scheduler, job engine, or runtime behavior was changed. No live provider operation or follow-on task was started.

## Git Publication

- Repository: irfannuralam44-max/qfat
- Branch: main
- Implementation commit: 358aec4c28c16dc16a22d77f12b58d6f7520e1b6
- Follow-up fix commit: dc48019d9e7d121a6e9246ed6e38365b781ef8d9
- Report update commit: f67f112f8f32bb1a657a21a91a7bb4adb4029520
- Push verification: PASS

The report-creation commit above was re-fetched from remote `main`; the design and report paths were confirmed present and readable. The final remote compare from the synchronized HEAD contains only the two authorized Markdown paths. This verifies source publication only, not CI.

## Handoff

This work is ready for GPT/Owner audit of the design evidence and the recorded OPEN OWNER DECISION items. It is not Owner-accepted and does not authorize runtime implementation. Stop after this task.


---

## Independent GPT Audit — 2026-11-14

- **Audit result:** PASS WITH FINDINGS — documentation deliverables accepted as source-grounded decision support; runtime architecture remains BLOCKED / OPEN OWNER DECISION.
- **Audited branch:** `main`
- **Agent publication-verification commit:** `7ed230dd9860e755b68a3e4715c29220bf0bc746`
- **Task-specification commit / compare base:** `5e5c4b74c55abac709bbbf9f01ab0e502d0df83b`

### Independent publication and scope verification

GPT re-fetched the agent report and design document from remote `main`, fetched the reported publication-verification commit, and compared the task-specification commit to that commit:

- Compare result: **4 commits ahead, 0 behind**.
- Final net changed paths: exactly:
  - `docs/design/QFAT-SPOOLCAST-INVOCATION-DESIGN.md` — added.
  - `reports/QFAT-023-spoolcast-invocation-boundary-design-report.md` — added.
- The four commits in the task range were inspected individually. The design commit and formatting follow-up touched only the design document; the report and remote-publication verification commits touched only the report.
- The reported task file remains unchanged after its creation commit. No source/runtime/test/dependency/configuration/schema path appears in the final net diff.

### Source spot-check

GPT independently re-fetched the relevant source at the design's stated baseline `5e5c4b74c55abac709bbbf9f01ab0e502d0df83b` and confirmed the central claims:

1. Root Spoolcast is an ESM package exposing a CLI binary, with Node `>=20`, `NodeNext` compilation rooted at `src/`, and no declared service export. `apps/server` is a separate ESM package with Node `>=22`, its own TypeScript build, and no declared Spoolcast dependency.
2. `src/cli.ts` dynamically imports command entry modules; `src/run.ts` scans queue items, loads token state, runs item/target operations, writes the existing ledger, and emits CLI output. It is not a one-item machine-request service interface.
3. `src/tokens.ts` stores aliased YouTube refresh tokens and Facebook Page tokens in Spoolcast's token store and reads app-level credentials separately. QFAT's `CredentialProvider` exposes opaque Buffer payloads with internal `id/purpose/provider` context; no account mapping is established by these interfaces.
4. `apps/server/src/index.ts` binds Fastify to `127.0.0.1` and registers health, security, and media routes only. `apps/web/vite.config.ts` binds the Vite server to `0.0.0.0:5173` and proxies API requests to loopback.
5. Security routes validate Origin/Host and mutation requests use a session plus CSRF token. The bootstrap route creates a session after Origin/Host validation; it does not authenticate a human identity or authorize a provider account. `createSessionCookie` does not set `Secure`, consistent with the documented HTTP-local topology but not a transport-security guarantee.
6. The media API response exposes opaque media metadata/IDs rather than a filesystem path. The managed storage uses a UUID `storageKey` without preserving the original extension in the stored filename. Spoolcast's `videoMimeType(filePath)` derives MIME from the path extension and treats every non-`.mov` path as `video/mp4`.

### Audit finding

**F-01 — Media handoff design needs an explicit extension/MIME compatibility caveat (non-blocking for this documentation-only task).**

The design correctly marks media handoff as unresolved and notes that Spoolcast adapters need a local video path. However, the exact source interaction adds an important detail not stated in the design: QFAT's media storage filename is an extensionless UUID, while Spoolcast's `videoMimeType()` derives MIME from the filename extension (`.mov` → QuickTime; everything else → MP4). The public media record retains `mimeType` and `originalFilename`, but the API does not expose the path.

Consequently, simply resolving a QFAT media ID to its current stored path would not preserve the source extension for the adapter. In particular, a MOV could be treated as MP4 by the current adapter helper. Any future media handoff must explicitly decide how to preserve/validate the true media type at the trusted Node boundary without trusting a browser-supplied path. This may require a separately authorized adapter/input or safe staging design; **do not implement a workaround under QFAT-023**.

### Limitations and final disposition

- The agent accurately disclosed that local `git diff --check`, `git status --short`, staged-path review, and local full-diff checks were not run because no local checkout/shell was available. GPT likewise audited remote GitHub content and source, not a local working tree or executed tests.
- Source spot-checks support the design's central conclusions. No claim of runtime readiness or live provider verification is accepted.
- The design's nine Owner decisions remain open. In particular, no invocation topology, credential owner/mapping, publishing authorization model, immediate-mode manifest path, media handoff, progress transport, cancellation policy, durable status model, or duplicate-submission behavior is approved.
- No QFAT-024 or implementation task is created by this audit.

**Disposition:** QFAT-023 documentation deliverables are accepted **PASS WITH FINDINGS** as decision-support documentation. Runtime integration remains **NOT AUTHORIZED**. The Owner must decide the open architecture/security/credential/media questions and authorize a separate bounded task before any implementation.
