# Task QFAT-006 — Private-Network Web Entry Point (Frontend Vertical Slice)

- **Status:** READY FOR EXECUTION — owner-directed scope
- **Task type:** Narrow frontend + local network access foundation
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Execution PC:** Linux PC only
- **Preferred runtime:** Node.js 24 LTS
- **Expected report:** `reports/QFAT-006-private-network-web-entrypoint-report.md`
- **Product authority:** `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`
- **Architecture authority:** `docs/ARCHITECTURE-QFAT-BETA-ACCESS-ADDENDUM.md`
- **Decision:** `docs/decisions/ADR-003-beta-network-access-and-pwa.md`
- **Workflow:** `docs/AI-DEVELOPMENT-WORKFLOW.md`

## 1. Objective

Create the smallest real browser frontend entry point for QFAT and make it reachable from another device through the host PC's LAN IP or Tailscale IP.

This is a vertical-slice foundation task, not the full QFAT UI. It must prove that:

- the frontend listens on `0.0.0.0:5173`;
- the user opens the actual PC IP on port `5173`;
- the browser frontend reaches the existing backend through a same-origin proxy;
- the backend itself remains bound to `127.0.0.1:3001`;
- the page clearly reports whether the backend health endpoint is reachable.

Do not turn this task into a Tailscale integration or a general web-platform architecture project.

## 2. Current repository facts

At task authoring time:

- The backend exists at `apps/server/`.
- Backend entry point is `apps/server/src/index.ts`.
- Backend default listener is `127.0.0.1:3001`.
- The only current backend route is `GET /api/v1/health`.
- There is no existing `apps/web/` frontend.
- The repository root still contains the imported Spoolcast CLI. Do not alter its behavior.

Verify these facts against the synchronized checkout before editing. If source differs, stop and report the discrepancy rather than guessing.

## 3. Required implementation

### 3.1 Minimal frontend application

1. Create `apps/web/` using the agreed stack:
   - React
   - Vite
   - TypeScript
   - Tailwind CSS 3.4
   - React Router 6 only if routing is actually needed for this single-screen slice; do not add it merely for future speculation.
2. Keep dependencies and scripts scoped to `apps/web/`. Do not reorganize the repository or convert the root CLI into a monorepo workspace in this task.
3. Create one responsive QFAT landing/status screen:
   - QFAT product label;
   - clear backend status (connected / unavailable);
   - a manual retry action;
   - no mock accounts, jobs, upload cards, or fabricated data.
4. Fetch the health endpoint using a relative same-origin path: `/api/v1/health`. Do not hardcode localhost, a LAN IP, a Tailscale IP, or backend port 3001 in browser code.
5. Show loading, success, and error states honestly. Do not poll aggressively; a manual retry plus a modest initial request is sufficient.

### 3.2 Vite listener and proxy

1. Configure the Vite dev server to bind to `0.0.0.0` and use port `5173` by default.
2. Keep `strictPort: true` so the documented port does not silently change.
3. Proxy only the required `/api/v1/health` path (or the narrowest required API prefix) to `http://127.0.0.1:3001`.
4. Do not expose the backend listener on `0.0.0.0`; preserve its current loopback binding.
5. Do not enable wildcard host acceptance such as `allowedHosts: true`. Inspect the installed Vite version's default IP-host behavior and configure the narrowest compatible policy that allows actual LAN/Tailscale IP Host headers while rejecting arbitrary DNS hostnames. Document the exact policy and its rationale.
6. Do not add permissive CORS. Browser-to-Vite requests are same-origin; Vite proxies the health request server-side.
7. Do not trust client-supplied forwarded-host headers. Do not add forwarded-header behavior that is not required by this task.

### 3.3 Start workflow

1. Add minimal documented commands to start the backend and frontend in separate terminals.
2. Keep logs visible and processes independently stoppable.
3. Document that the PC must remain powered on and both processes must be running.
4. Document the access patterns:
   - desktop: `http://localhost:5173`;
   - LAN: `http://<PC-LAN-IP>:5173`;
   - Tailscale: `http://<PC-TAILSCALE-IP>:5173`.
5. Explain that `0.0.0.0` is the bind address, not the address entered into the browser.
6. Do not add Tailscale CLI/API/SDK, Serve, Funnel, cloud relay, router port forwarding, or automatic IP discovery.
7. Do not silently modify OS firewall rules. If a firewall blocks the connection, document the manual host-firewall requirement without opening broad rules automatically.

### 3.4 Security boundary

- Backend remains on `127.0.0.1:3001`.
- Only the frontend listener is reachable on network interfaces.
- The health endpoint is read-only and must not disclose secrets, environment variables, filesystem paths, account details, or machine-specific sensitive information.
- Do not implement OAuth, account management, upload routes, publishing actions, session cookies, CSRF middleware, or credentials in this task. There are no state-changing browser endpoints in this vertical slice.
- Do not claim that network reachability authenticates a user. This task is suitable only for the owner's trusted private LAN/tailnet.
- No public internet exposure or router port forwarding.

### 3.5 PWA boundary

Do not implement or claim PWA installation in this task. Plain HTTP on LAN/Tailscale IPs is not a standard secure context for service workers/PWA installation. Responsive browser access is the acceptance target here. PWA/HTTPS is a separate follow-up and must not be solved by introducing Tailscale-specific infrastructure in this task.

## 4. Explicit exclusions

Do NOT implement:

- Full dashboard, accounts, media library, create-content editor, queue, history, settings, or publishing UI.
- OAuth or platform API integration.
- Any real YouTube/Facebook upload or credential access.
- State-changing browser API routes.
- Session/authentication/CSRF middleware; defer until the first state-changing browser workflow is scoped, while preserving the security requirements in ADR-002/ADR-003.
- PWA manifest, service worker, HTTPS certificates, or install prompts.
- Tailscale integration, Serve, Funnel, router configuration, cloud services, or public hosting.
- Backend bind changes; backend must remain loopback-only.
- SQLite schema changes or migration changes.
- CI/GitHub Actions, Docker, Electron, Tauri, installers, or auto-start services.
- Unrelated dependency upgrades, broad refactors, or Spoolcast CLI changes.

If the required Vite Host policy cannot safely support raw IP access without wildcard hostname acceptance, stop and report the exact blocker and options. Do not weaken host validation to force a PASS.

## 5. Safe repository procedure

Before work:

1. Verify repository identity and that `origin` points to `irfannuralam44-max/qfat`.
2. Verify branch is `main`; record HEAD and working-tree status.
3. Preserve all local changes. If dirty, wrong branch, or diverged, stop and report `BLOCKED`.
4. If clean and safe, synchronize using `git pull --ff-only origin main`.
5. Read `AGENTS.md`, `docs/AI-DEVELOPMENT-WORKFLOW.md`, this task, `README.md`, `CLAUDE.md`, the PRD/architecture addenda, ADR-002, ADR-003, and `apps/server/README.md`.
6. Inspect actual Vite compatibility/security behavior and current backend source before implementation.
7. Use one OpenCode agent serially. No parallel agents.

Never reset, clean, stash, rebase, force-push, or discard user changes.

## 6. Local verification — Linux PC only

Record OS, architecture, Node, and npm versions.

Required checks:

1. Clean install of the new frontend dependencies from its lockfile.
2. Frontend typecheck and production build.
3. Existing backend typecheck, build, and tests remain passing.
4. Start backend and frontend using documented commands.
5. Verify desktop access through `http://localhost:5173`.
6. Verify the Vite listener is bound to `0.0.0.0:5173` (or equivalent IPv4 all-interface listener).
7. Verify backend remains bound only to `127.0.0.1:3001`.
8. Verify `/api/v1/health` works through the frontend same-origin proxy.
9. Verify a second device on the same LAN can load the page and see backend health. Record the actual test device/browser and address class; do not expose private IP values in the report unless necessary.
10. If the owner has a Tailscale-connected second device available, verify access through the host's Tailscale IP without adding QFAT-specific integration. If unavailable, mark this check NOT RUN; do not claim it passed.
11. Verify an arbitrary hostname Host header is rejected by the configured frontend host policy, while a valid IP Host is accepted.
12. Verify no backend listener is exposed on the LAN interface.
13. Run `git diff --check`.

Do not run GitHub Actions/CI. Do not use live platform credentials or perform publishing.

## 7. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | A minimal real React/Vite frontend exists under `apps/web/`. |
| AC-02 | Frontend binds to `0.0.0.0:5173` by default with strict port behavior. |
| AC-03 | Browser health request uses relative same-origin URL and works through Vite proxy. |
| AC-04 | Backend remains bound to `127.0.0.1:3001` and is not directly reachable from another device. |
| AC-05 | Vite Host policy accepts actual IP access without wildcard hostname acceptance. |
| AC-06 | Desktop localhost access and same-LAN second-device access work. |
| AC-07 | Tailscale IP access is verified if a connected test device is available; otherwise accurately marked NOT RUN. |
| AC-08 | Status screen is responsive and shows truthful loading/connected/unavailable states. |
| AC-09 | Startup and network access instructions are documented. |
| AC-10 | Existing backend and root CLI behavior remain unchanged; required local checks pass. |
| AC-11 | No PWA, OAuth, credentials, state-changing APIs, public exposure, or unrelated features are added. |

## 8. Report and delivery

Create `reports/QFAT-006-private-network-web-entrypoint-report.md`.

The report must include:

- task path, base SHA, branch, final commit SHA;
- changed files and rationale;
- exact Node/npm/OS environment;
- exact commands and actual results;
- desktop, LAN, and Tailscale checks separately;
- Vite Host policy behavior and evidence;
- frontend/backend listener addresses;
- checks not run and why;
- explicit statement that PWA installation is not implemented/verified;
- any limitations or security findings.

Review `git diff`, `git status`, and staged paths. Commit only task-related files, push to `main`, and verify the remote commit/report.

Stop after the handoff. Agent PASS is not owner acceptance.

## 9. Required final handoff

Return exactly:

Branch:
Commit message:
Full SHA:
Report path:
