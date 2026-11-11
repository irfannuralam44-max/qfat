# Task QFAT-008 — Design Foundations and Application Shell

- **Status:** OWNER-AUTHORIZED FOR IMPLEMENTATION — 2026-11-11
- **Task type:** Frontend foundation + responsive application shell
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Preferred runtime:** Node.js 24 LTS
- **Expected report:** `reports/QFAT-008-design-foundations-app-shell-report.md`
- **Product authority:** `docs/PRD-QFAT-MVP.md`
- **Network-access authority:** `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- **Architecture authority:** `docs/AI-DEVELOPMENT-WORKFLOW.md`, `AGENTS.md`
- **Predecessor:** QFAT-007 accepted by owner on 2026-11-11
- **Owner authorization:** Explicitly authorized to implement QFAT-008 on 2026-11-11. This authorization applies only to the scope in this task.
- **Workflow:** GitHub-first; one OpenCode agent serially; GPT audit and owner approval gate

## 1. Objective

Turn the current single-screen health-check frontend into the first real QFAT application experience by establishing:

1. A consistent QFAT visual foundation.
2. A responsive application shell with navigation.
3. A useful Overview/Dashboard landing page that reports only real information currently available.
4. A coherent light and dark theme.

This is the first UI implementation phase. It must establish reusable structure without pretending that accounts, media, jobs, or publishing features already exist.

The task is deliberately limited to foundations and the application shell. The Create Content workflow is a separate next phase and is not included here. The current owner-approved PRD also defines separate YouTube and Facebook editors for that later phase; Facebook video and single-image posts share the same metadata form. Do not implement or prototype those editors in QFAT-008.

## 2. Current repository facts

At task authoring time:

- Frontend exists at `apps/web/`.
- Frontend is React 18 + Vite + TypeScript + Tailwind CSS 3.4.
- Current frontend contains one backend-health screen in `apps/web/src/App.tsx`.
- Current backend health endpoint is `GET /api/v1/health`; do not assume other product APIs exist.
- The frontend dev server is configured for `0.0.0.0:5173`; the backend remains loopback-only on `127.0.0.1:3001`.
- QFAT is a local-first web application, not an Electron/Tauri desktop app or hosted SaaS.

Verify all facts against the synchronized checkout before editing. If source differs, stop and report the discrepancy.

## 3. Required implementation

### 3.1 QFAT design foundations

Create a small, maintainable design foundation in `apps/web/`:

- Define QFAT-specific color, typography, spacing, radius, border, shadow, and focus tokens.
- Provide both dark and light themes, with dark as the default.
- Support the system theme and a user-selectable theme control (Dark / Light / System).
- Persist the theme preference locally in a safe, non-sensitive browser preference mechanism.
- Use semantic color tokens for surfaces, text, borders, accent, interactive states, and status states.
- Use accessible contrast and visible keyboard focus.
- Respect `prefers-reduced-motion`.
- Use Lucide React only if icons are genuinely needed; do not add a second icon library.
- Keep the visual identity distinct to QFAT. Do not copy FATTECH branding or introduce unrelated product names.

Do not add a component library or new dependency unless there is a clear implementation need and it is justified in the report.

### 3.2 Application shell

Implement a responsive application shell with:

- QFAT brand/wordmark treatment.
- Primary navigation for:
  - Overview
  - Accounts
  - Media Library
  - Create Content
  - Queue
  - History
  - Settings
- A clear active-navigation state.
- A compact account/workspace context area that does not invent connected accounts.
- A theme selector.
- A responsive mobile navigation pattern that remains usable on narrow screens.
- A main content region with consistent page title/breadcrumb conventions.
- Accessible semantic landmarks, keyboard navigation, focus handling, and button labels.

Navigation destinations that are not implemented yet must be clearly identified as coming soon or otherwise safely non-functional. They must not display fabricated records, fake account names, fake job counts, or pretend to be complete product pages.

Do not create seven empty, full-featured page implementations. A single real Overview route plus honest disabled/coming-soon navigation entries is sufficient for this phase.

### 3.3 Overview / Dashboard

Replace the existing standalone health page with a genuine Overview page within the application shell.

The page must:

- Identify the QFAT workspace as local to the current PC.
- Retain the existing backend connection status and manual retry action.
- Show a concise explanation when the backend is unavailable.
- Provide a useful first-run empty state explaining that account connection and content creation will become available in later phases.
- Use no fake metrics, sample activity, placeholder account identities, invented publishing jobs, or fabricated chart data.
- Avoid decorative charts and vanity analytics.
- Avoid presenting unavailable future features as working actions.
- Remain readable and useful on desktop, tablet, and phone.

If the backend health response is the only real API data available, use only that data. Do not add new backend endpoints or SQLite tables in this task.

### 3.4 Routing and interaction behavior

- Use React Router 6 only if it is not already present and actual route handling is needed. Keep the implementation minimal.
- The Overview route must work on direct page load and browser refresh.
- Coming-soon destinations must not lead to broken URLs or blank screens.
- Theme selection and mobile navigation must be functional, not decorative.
- All buttons and controls must perform their stated actions.
- Preserve the health endpoint's same-origin relative URL behavior.
- Do not hardcode localhost, LAN IP, Tailscale IP, or backend port into browser code.

### 3.5 Responsive and accessibility requirements

Verify at minimum these viewport widths:

- Small phone: 360 px.
- Large phone / narrow tablet: 768 px.
- Desktop: 1440 px.

The layout must not introduce horizontal scrolling at these widths. Navigation must remain usable without hover. Use semantic HTML, appropriate heading order, accessible names, keyboard operability, visible focus, and reduced-motion support.

### 3.6 Preserve beta network behavior

Do not change the existing private-network access architecture:

- Frontend listener remains `0.0.0.0:5173`.
- Backend remains `127.0.0.1:3001`.
- Frontend API calls remain same-origin relative paths through the configured proxy.
- No public hosting, router port forwarding, cloud relay, or Tailscale-specific integration.
- No firewall automation.
- Do not claim PWA installation or HTTPS support for raw HTTP LAN/Tailscale IP origins.

## 4. Explicit exclusions

Do NOT implement:

- Create Content editor or publishing workflow.
- Media file selection, upload, staging, or library APIs.
- YouTube or Facebook account connection, OAuth, credentials, or account management.
- Publishing, queue execution, retry, cancellation, or history APIs.
- Fake/demo/sample dashboard metrics, accounts, posts, or activity.
- New backend routes, database schemas, migrations, or worker behavior.
- Session/authentication/CSRF implementation unless separately authorized by a security task.
- PWA manifest, service worker, HTTPS certificates, or install prompts.
- AI metadata, CSV import, scheduling, analytics, or album posts.
- CI/GitHub Actions, Docker, Electron, Tauri, installers, or auto-start services.
- Unrelated dependency upgrades, broad refactors, or Spoolcast CLI changes.

Do not add mock data merely to make the Overview appear populated. A truthful empty state is preferable to a polished but misleading dashboard.

## 5. Visual quality bar

The UI should feel like a practical publishing workspace rather than a generic admin template:

- Clear visual hierarchy and restrained use of accent color.
- Compact but comfortable navigation and content density.
- Consistent spacing and alignment.
- Distinct, legible surface layers.
- Deliberate empty and unavailable states.
- Light and dark themes that both look intentionally designed.
- No excessive gradients, oversized hero areas, decorative graphs, or gratuitous cards.
- Use platform brand colors only when platform identity is actually relevant.

Do not attempt to implement all 11 planned pages, all five prototype flows, or every possible breakpoint in this task. Establish the foundations that later phases can reuse.

## 6. Safe repository procedure

Before work:

1. Verify repository identity and that `origin` points to `irfannuralam44-max/qfat`.
2. Verify branch is `main`; record HEAD and working-tree status.
3. Preserve all local changes. If dirty, wrong branch, or diverged, stop and report `BLOCKED`.
4. If clean and safe, synchronize using `git pull --ff-only origin main`.
5. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, `docs/PRD-QFAT-MVP.md`, `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`, `apps/web/package.json`, and the affected frontend source.
6. Inspect the current implementation before editing; do not assume this task document describes source that has not been verified.
7. Use one OpenCode agent serially. No parallel agents.

Never reset, clean, stash, rebase, force-push, or discard user changes.

## 7. Local verification — Linux PC only

Record OS, architecture, Node, and npm versions.

Required checks:

1. Clean frontend dependency installation from `apps/web/package-lock.json`.
2. `npm audit` from `apps/web/`.
3. `npm audit --omit=dev` from `apps/web/`.
4. `npm run typecheck` from `apps/web/`.
5. `npm run build` from `apps/web/`.
6. Verify backend health status still loads through the same-origin proxy.
7. Verify manual health retry works and unavailable state is understandable.
8. Verify dark, light, and system theme behavior, including preference persistence.
9. Verify navigation and mobile menu behavior by keyboard and pointer.
10. Verify the Overview layout at 360 px, 768 px, and 1440 px; record actual evidence.
11. Verify direct loading and refresh of the Overview route if routing is introduced.
12. Inspect rendered UI for horizontal overflow, clipped controls, inaccessible contrast, and console errors.
13. Confirm no fake/sample dashboard data and no backend/DB changes.
14. Run `git diff --check`.

Do not run GitHub Actions/CI. Do not use live platform credentials or perform publishing.

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | QFAT-specific design tokens and reusable styling foundations exist. |
| AC-02 | Dark and light themes are complete; System mode and preference persistence work. |
| AC-03 | Responsive application shell includes the agreed primary navigation and active state. |
| AC-04 | Mobile navigation is usable at 360 px and 768 px without horizontal overflow. |
| AC-05 | Overview is a real landing page within the application shell. |
| AC-06 | Backend connection status and manual retry remain functional through the relative same-origin endpoint. |
| AC-07 | First-run empty state is clear and contains no fabricated data or fake metrics. |
| AC-08 | Unimplemented navigation destinations are clearly non-functional/coming soon and do not lead to broken screens. |
| AC-09 | Keyboard access, focus visibility, semantic structure, contrast, and reduced-motion behavior are addressed. |
| AC-10 | Desktop/tablet/mobile layouts are verified at 1440 px, 768 px, and 360 px. |
| AC-11 | Existing frontend dependency audits, typecheck, and production build pass. |
| AC-12 | Backend listener/proxy architecture remains unchanged; no backend, DB, OAuth, or publishing behavior is added. |
| AC-13 | No PWA, public exposure, live upload, CI, or unrelated changes are introduced. |

## 9. Report and delivery

Create `reports/QFAT-008-design-foundations-app-shell-report.md`.

The report must include:

- Task path, base SHA, branch, final commit SHA, and commit message.
- Changed files and rationale.
- Exact OS/runtime environment.
- Acceptance criteria table with PASS / FAIL / NOT RUN and evidence.
- Exact commands and actual results.
- Viewport sizes and responsive verification evidence.
- Theme, navigation, accessibility, and health-status verification.
- npm audit results from the frontend directory.
- Explicit list of checks not run and why.
- Confirmation that no fabricated data, backend/DB changes, OAuth, or publishing functionality was introduced.
- Findings, limitations, and residual risks.

Review `git diff`, `git status`, and staged paths. Commit only task-related files, push to `main`, and verify the remote commit/report.

Stop after the handoff. Agent PASS is not owner acceptance.

## 10. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:
