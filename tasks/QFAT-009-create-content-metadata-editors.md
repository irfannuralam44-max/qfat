# Task QFAT-009 — Create Content and Metadata Editors

- **Status:** OWNER-AUTHORIZED FOR IMPLEMENTATION — 2026-11-12
- **Task type:** Frontend product workflow / metadata editor
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Preferred runtime:** Node.js 24 LTS
- **Expected report:** `reports/QFAT-009-create-content-metadata-editors-report.md`
- **Product authority:** `docs/PRD-QFAT-MVP.md`
- **Design foundation:** QFAT-008 app shell, design tokens, and current frontend source
- **Predecessor:** QFAT-008 accepted by owner on 2026-11-12
- **Owner authorization:** Owner explicitly approved QFAT-009 in chat on 2026-11-12. Authorization applies only to the scope in this task.
- **Workflow:** GitHub-first; one OpenCode agent serially; GPT audit and owner approval gate

## 1. Objective

Implement the first usable Create Content page inside the existing QFAT application shell. Establish separate YouTube and Facebook editors with a consistent metadata-input experience, clear platform-specific fields, functional local form state, and honest preview/validation behavior.

This task implements the editor experience only. It must not pretend that account connections, media storage, publishing destinations, upload execution, or publishing history already exist.

## 2. Product decisions and UX contract

The owner has approved these decisions:

1. YouTube and Facebook remain **separate editors**. Do not combine their metadata into one cross-platform form.
2. The **behavior and visual treatment of metadata inputs must be consistent** across YouTube and Facebook. Reuse common field components and interaction patterns rather than creating platform-specific input behavior.
3. Consistent input behavior means consistent labels, spacing, focus, typing/editing, multiline handling, helper text, inline validation presentation, and character-count presentation when a verified limit exists.
4. The metadata fields themselves remain platform-specific where the provider requires different concepts:
   - YouTube: title, description, tags, and standard-video/Shorts intent.
   - Facebook: caption/message.
5. Facebook video, Reels, and single-image posts use the **same Facebook metadata form**. Switching Facebook media intent must not create a second image-only form or discard the caption.
6. Platform-specific validation and media preview may differ where required. Do not invent provider limits or imply that a local UI check guarantees API acceptance.
7. Facebook single-image posting is in MVP. Facebook albums/multiple-image posts are post-MVP and must not be offered.
8. Publishing is immediate-only in the MVP, but publishing and final confirmation are outside this task.

## 3. Repository and source inspection

Before editing, verify the synchronized source and inspect at minimum:

- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/PRD-QFAT-MVP.md`
- `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- `apps/web/package.json` and lockfile
- `apps/web/src/App.tsx`
- `apps/web/src/design-tokens.css`
- `apps/web/src/styles.css`
- Existing frontend tests and routing setup, if any

Confirm the current navigation, shell, theme, health behavior, and dependency state. If source differs materially from this task or the QFAT-008 foundation, stop and report the discrepancy.

## 4. Required implementation

### 4.1 Create Content route and navigation

- Turn the existing Create Content navigation item into a working route/page.
- Preserve Overview and the QFAT-008 application shell, theme behavior, mobile navigation, and local-network same-origin behavior.
- Use the existing routing setup if present; add only the minimum routing needed if absent.
- Direct loading and browser refresh of the Create Content route must work.
- Keep Accounts, Media Library, Queue, History, and Settings clearly unavailable/coming soon until their tasks are implemented.
- Keep page layout responsive and consistent with QFAT-008 tokens and visual language.

### 4.2 Platform editor selection

- Provide a clear platform switcher for YouTube and Facebook.
- Switching platform changes the editor and its field set; it must not silently merge or map one platform's fields into another platform's metadata.
- Preserve each platform's entered values while switching back and forth during the current page session.
- Clearly identify the active platform.
- Do not imply that a platform account is connected. Account selection is not part of this task.

### 4.3 Shared metadata input behavior

Build or reuse a small set of shared field primitives for text, multiline text, and tag entry as appropriate. Apply the same interaction contract to both editors:

- Consistent label placement, field height, typography, spacing, border, focus, disabled, and error states.
- Proper semantic labels and accessible descriptions.
- Predictable keyboard behavior and visible focus.
- Unicode and line-break preservation.
- Inline validation adjacent to the relevant field; no alert-only validation.
- Character counts only when a reliable, platform-verified limit is defined. Do not invent limits or show arbitrary counters.
- Preserve the user's input on validation errors and when switching platform tabs.
- Do not silently rewrite, truncate, translate, or auto-generate metadata.
- Shared input behavior does not require identical field names or identical platform-specific business rules.

Tags may use a chip/token interaction for YouTube if supported by the existing design patterns, but it must be keyboard accessible, editable, and must not silently discard text. Do not add a dependency solely for tag entry.

### 4.4 YouTube Editor

Provide the YouTube-specific metadata fields:

- Title.
- Description.
- Tags.
- Content intent: Standard video or Shorts.

Requirements:

- Use the shared input behavior defined in §4.3.
- Keep the content-intent choice explicit and understandable.
- Do not invent title/description/tag limits. If a limit is shown, cite the verified official YouTube documentation in the implementation report and implement the same rule in validation.
- Do not implement account/channel selection or upload settings in this task.

### 4.5 Facebook Editor

Provide the Facebook-specific metadata field:

- Caption/message.

Provide a clear media-intent selector for:
- Video.
- Reels.
- Single image.

Requirements:

- Video, Reels, and single image must retain and use the same caption field and same metadata form.
- Changing media intent may update explanatory text and a truthful preview placeholder, but must not replace the metadata form.
- Do not offer album/multiple-image.
- Do not invent caption limits. If a limit is shown, cite the verified official Meta documentation in the implementation report and implement the same rule in validation.
- Do not implement Page selection or media upload in this task.

### 4.6 Validation and draft behavior

- Implement client-side form state and deterministic basic validation appropriate to the fields and product requirements.
- Clearly distinguish missing input, invalid input, and valid local editor state.
- Do not mark a draft as publishable or provider-approved when provider account, media, and API validation are not yet implemented.
- Do not save drafts to localStorage, browser storage, SQLite, or backend in this task. State is in-memory for the current page session only.
- Do not add fake account names, fake media records, sample posts, or mock publishing outcomes.
- A Reset/Clear action, if included, must ask for confirmation before discarding non-empty user input.
- No automatic publishing, autosave, or network mutation is allowed.

### 4.7 Preview and workflow boundary

- Provide a useful, honest metadata preview for the active editor.
- Preview content must derive from the user's current form values, not hardcoded sample content.
- Facebook preview should reflect the selected media intent without pretending an actual media file has been uploaded.
- YouTube preview should reflect title, description, tags, and selected content intent.
- Explain in the UI that media selection, connected destinations, and publishing actions will become available in subsequent phases.
- Do not provide a working Publish button. A disabled, clearly labeled future action may be shown only if it does not suggest that publishing is currently possible.

### 4.8 Responsive and accessibility requirements

Verify at minimum:

- 360 px small phone.
- 768 px large phone/narrow tablet.
- 1440 px desktop.

Requirements:

- No horizontal overflow at required widths.
- Platform switching and all form controls usable by pointer and keyboard.
- Correct label associations, heading order, landmarks, accessible names, and visible focus.
- Validation errors announced appropriately to assistive technology without excessive live announcements.
- Respect dark/light/system themes and reduced-motion preference.
- Preview remains legible and does not crowd or obscure the editor on small screens.

### 4.9 Preserve existing architecture and security

- Frontend remains served on the existing configured listener and uses relative/same-origin API URLs.
- Do not add frontend calls to Google, Meta, or any external service.
- Do not add OAuth, credentials, sessions, CSRF, new backend routes, database tables, migrations, SSE, or upload endpoints.
- Do not store metadata in localStorage, sessionStorage, IndexedDB, URL query parameters, logs, or telemetry.
- Do not add analytics, telemetry, or external data transfer.
- Do not add dependencies unless essential; justify any dependency in the report.
- Do not change backend listener/proxy behavior, existing health endpoint behavior, or the private-network access architecture.

## 5. Explicit exclusions

Do NOT implement:

- YouTube or Facebook OAuth/account management.
- Media Library, local file upload, streaming, staging, or media persistence.
- Destination/Page/channel selection.
- Final publishing confirmation or live publishing.
- Upload adapters, queue, SSE progress, retry, cancellation, history, or reconciliation.
- Persistent draft storage or autosave.
- Facebook albums/multiple-image posts.
- Scheduling, CSV import/export, AI metadata, analytics, transcoding, or editing.
- New backend APIs, database schemas, or migrations.
- PWA, HTTPS, Docker, CI/GitHub Actions, Electron, Tauri, installers, or auto-start.
- Unrelated refactors, dependency upgrades, or Spoolcast CLI changes.

## 6. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | Create Content is reachable from primary navigation and works on direct load and refresh. |
| AC-02 | YouTube and Facebook are distinct editors with distinct platform-specific metadata fields. |
| AC-03 | Metadata inputs use a consistent shared interaction and visual behavior across both platforms. |
| AC-04 | YouTube supports title, description, tags, and Standard video/Shorts intent in local form state. |
| AC-05 | Facebook supports caption/message and Video/Reels/Single image intent in one shared Facebook metadata form. |
| AC-06 | Switching Facebook media intent does not create another form or discard the caption. |
| AC-07 | Switching platform preserves each editor's current in-memory values without mixing fields. |
| AC-08 | Validation is accessible, preserves input, and does not invent provider limits. |
| AC-09 | Preview reflects current user-entered metadata and does not fabricate media, accounts, or publishing outcomes. |
| AC-10 | No working upload, account selection, persistent draft, publish, or backend functionality is introduced. |
| AC-11 | Responsive layout works at 360, 768, and 1440 px without horizontal overflow. |
| AC-12 | Dark/light/system themes, keyboard operation, visible focus, semantic labels, and reduced motion remain supported. |
| AC-13 | Existing frontend audits, typecheck, and production build pass; no unnecessary dependency is added. |
| AC-14 | Existing backend health and private-network frontend/proxy behavior remain unchanged. |
| AC-15 | No CI/GitHub Actions, live credentials, external API calls, or real publishing is performed. |

## 7. Verification — Linux PC only

Record OS, architecture, Node, npm, and browser versions.

Required checks:

1. Safe repository synchronization per `AGENTS.md` and the universal workflow.
2. `npm ci` from `apps/web/`.
3. `npm audit` from `apps/web/`.
4. `npm audit --omit=dev` from `apps/web/`.
5. `npm run typecheck` from `apps/web/`.
6. `npm run build` from `apps/web/`.
7. Run available relevant automated tests; add focused tests for editor state, platform switching, tag entry, and validation if a suitable test setup already exists. Do not add a large test framework without justification.
8. Verify YouTube and Facebook switching, and verify values remain intact when switching back and forth.
9. Verify Facebook Video/Reels/Single image changes keep the same caption field and preserve the caption.
10. Verify validation messages, keyboard interaction, Unicode, multiline text, and tag editing.
11. Verify preview updates from live form values and does not display fabricated media or account data.
12. Verify dark, light, and system themes.
13. Verify layouts at 360, 768, and 1440 px; record evidence and check horizontal overflow.
14. Verify direct loading and refresh of the Create Content route.
15. Verify existing Overview health check and same-origin relative API path still work.
16. Inspect browser console for errors and run `git diff --check`.
17. Confirm no backend, DB, credential, external network, or publishing changes.

Do not run GitHub Actions/CI. Do not connect accounts or use live credentials. Do not upload or publish real content.

## 8. Implementation report

Create `reports/QFAT-009-create-content-metadata-editors-report.md`.

Include:

- Task path, base SHA, target branch, implementation commit message, and full commit SHA.
- Changed files and rationale.
- Exact OS/runtime/browser environment.
- Acceptance criteria table with PASS / FAIL / NOT RUN and concrete evidence.
- Exact commands and actual outcomes.
- Editor behavior evidence, including switching, value retention, validation, tags, and previews.
- Responsive viewport evidence and screenshots where practical.
- npm audit results from `apps/web/`.
- Any official provider documentation used to justify user-facing field limits or validation.
- Checks not run and why.
- Confirmation that no accounts, media upload, persistent draft storage, backend, database, credentials, or publishing functionality was introduced.
- Findings, limitations, and residual risks.

Review `git diff`, `git status`, and staged paths. Commit only task-related files, push to `main`, and verify the remote commit and report.

## 9. Stop condition and required handoff

Stop after implementation and report publication. Do not start QFAT-010 or any subsequent task.

After successful push and remote verification, return exactly:

Branch:
Commit message:
Full SHA:
Report path:
