# Implementation Report — QFAT-006

- **Status:** PASS WITH FINDINGS
- **Task specification:** `tasks/QFAT-006-private-network-web-entrypoint.md`
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Base SHA:** `0ff1f2ce8eb3d1d5293c8ac338f1334856d54d82`
- **Implementation commit message:** `feat(web): add private-network QFAT status entry point`
- **Implementation commit SHA:** Pending commit at report authoring; will be recorded in post-commit metadata.
- **Execution environment:** Linux x86_64 (`Linux 7.0.0-42-generic`), Node.js `v24.22.2`, npm `11.19.0`, Firefox `160.0`.

## Scope

Added the smallest browser entry point for private beta access: one responsive status screen, a relative health request proxied to the existing loopback backend, and local startup/network guidance. The frontend listens on all interfaces at port `5173`; the backend implementation and its `127.0.0.1:3001` binding were not changed.

No PWA, OAuth, publishing UI, credentials, session/CSRF middleware, Tailscale integration, CI, or firewall automation was added. The root Spoolcast CLI was not changed.

## Implementation

- Added `apps/web/` with React 18, Vite 8.3.8, TypeScript, and Tailwind CSS 3.4.19. Dependencies and scripts remain scoped to this app; an app-local lockfile supports reproducible installation.
- The landing/status view performs one initial `GET /api/v1/health` request, displays loading/connected/unavailable states, and provides a manual retry. It does not include mock accounts, jobs, or upload data.
- Vite binds to `0.0.0.0:5173` with `strictPort: true`. Its only proxy rule is the exact `/api/v1/health` route to `http://127.0.0.1:3001` with `changeOrigin: true`.
- Set `server.allowedHosts: []` explicitly. Inspection of the installed Vite 8.3.8 `isHostAllowed` implementation confirmed that this policy accepts IPv4/IPv6 literals and `localhost`/`.localhost`, while rejecting other DNS hostnames when no names are added to the list. IP literals are needed because the PC interface addresses can change. `allowedHosts: true` is not used.
- Added `apps/web/README.md` with separate backend/frontend terminal commands, desktop/LAN/Tailscale URL patterns, manual firewall guidance, and the warning that `0.0.0.0` is a bind address only.

## Files changed

| Path | Purpose |
|---|---|
| `apps/web/package.json` | App-local scripts and pinned frontend dependencies |
| `apps/web/package-lock.json` | Reproducible frontend dependency lock |
| `apps/web/index.html` | Browser document shell |
| `apps/web/src/main.tsx` | React entry point |
| `apps/web/src/App.tsx` | Health status screen and manual retry |
| `apps/web/src/styles.css` | Responsive styling and Tailwind entry |
| `apps/web/vite.config.ts` | All-interface listener, strict port, IP-compatible host policy, exact health proxy |
| `apps/web/tsconfig.json` | Frontend TypeScript configuration |
| `apps/web/tsconfig.node.json` | Vite configuration TypeScript check |
| `apps/web/tailwind.config.js` | Tailwind content configuration |
| `apps/web/postcss.config.js` | Tailwind/Autoprefixer processing |
| `apps/web/README.md` | Startup and private-network access instructions |
| `reports/QFAT-006-private-network-web-entrypoint-report.md` | Task evidence and handoff report |

No backend source, backend manifest, root CLI source, PRD, architecture, ADR, test, or CI file was changed.

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 Minimal real React/Vite frontend under `apps/web/` | PASS | App files created; frontend typecheck and production build pass. |
| AC-02 Listener binds `0.0.0.0:5173`, strict port | PASS | Vite config and `dev` script; startup log and `ss` listener inspection showed `0.0.0.0:5173`. |
| AC-03 Relative health URL works through same-origin proxy | PASS | Frontend code uses `/api/v1/health`; `curl http://localhost:5173/api/v1/health` returned HTTP 200 and the expected health JSON. Requests to both host interface addresses also returned HTTP 200. |
| AC-04 Backend remains loopback-only and is not directly reachable from a second device | PASS WITH FINDINGS | Existing backend source and tests retain `127.0.0.1`; `ss` showed `127.0.0.1:3001`. Direct access from a second device was **NOT RUN** because no second client was available in this execution environment. |
| AC-05 Host policy accepts IP Host values and rejects arbitrary DNS names | PASS | Vite 8.3.8 source inspection; LAN and Tailscale IP Host requests returned HTTP 200; `untrusted.example:5173` returned HTTP 403. |
| AC-06 Desktop and same-LAN second-device access | PASS WITH FINDINGS | Desktop localhost page returned HTTP 200 and Firefox headless rendered the page. The host's own LAN-interface request returned HTTP 200. A second-device LAN test was **NOT RUN** because no second client was available. |
| AC-07 Tailscale second-device access when available | NOT RUN | The host has a Tailscale interface; requests through that interface from the same host returned HTTP 200. No separate Tailscale-connected test device was available, so remote-device access is unverified. |
| AC-08 Responsive screen with truthful health states | PASS WITH FINDINGS | Firefox headless rendered desktop and 390×844 viewport screenshots; the initial loading state was visible. The health proxy returned valid success JSON. The unavailable-state branch was inspected in source but not exercised in a browser. |
| AC-09 Startup and network instructions documented | PASS | `apps/web/README.md` documents commands, address patterns, bind-address meaning, process lifetime, firewall boundary, and PWA limitation. |
| AC-10 Existing backend and root CLI behavior unchanged; required checks pass | PASS | Backend typecheck/build and all 29 backend tests pass; root CLI typecheck passes; no backend or CLI source changed. |
| AC-11 No excluded features or unrelated changes | PASS | Diff review limited changes to the new `apps/web/` app and the required task report. |

## Verification

All commands were run locally on the Linux PC. No GitHub Actions or CI was created or run.

| Command / check | Result | Notes |
|---|---|---|
| `npm ci` (`apps/web/`) | PASS | Installed from the new app lockfile. npm's install summary reported one high-severity vulnerability; no separate `npm audit` was run and no dependency updates were made in response. |
| `npm run typecheck` (`apps/web/`) | PASS | Checked app TypeScript and Vite config. |
| `npm run build` (`apps/web/`) | PASS | Vite 8.3.8 production build completed. |
| `npm run typecheck` (`apps/server/`) | PASS | Existing backend. |
| `npm run build` (`apps/server/`) | PASS | Existing backend. |
| `npm test` (`apps/server/`) | PASS | 29 tests passed, 0 failed. |
| `npm run typecheck` (repository root) | PASS | Existing Spoolcast CLI typecheck. |
| `npm run dev` (`apps/server/`) | PASS | Started at `http://127.0.0.1:3001`; process was stopped with Ctrl+C. |
| `npm run dev` (`apps/web/`) | PASS | Vite 8.3.8 started on `0.0.0.0:5173`; process was stopped with Ctrl+C. |
| `curl http://localhost:5173/` | PASS | HTTP 200. |
| `curl http://localhost:5173/api/v1/health` | PASS | HTTP 200; response contained only `status` and `timestamp`. |
| `curl http://<host-LAN-IP>:5173/` and `/api/v1/health` | PASS | Run from the host PC; both returned HTTP 200. This is not a second-device test. The private IP is omitted from this report. |
| `curl http://<host-Tailscale-IP>:5173/` and `/api/v1/health` | PASS | Run from the host PC; both returned HTTP 200. This is not a second-device test. The Tailscale IP is omitted from this report. |
| Requests with `Host: <host-LAN-IP>:5173` and `Host: <host-Tailscale-IP>:5173` | PASS | Both returned HTTP 200. |
| Request with `Host: untrusted.example:5173` | PASS | Vite returned HTTP 403. |
| `ss -ltnp '( sport = :5173 or sport = :3001 )'` | PASS | Showed Vite on `0.0.0.0:5173` and Fastify on `127.0.0.1:3001`. |
| Firefox headless desktop screenshot | PASS | Rendered page at 1280×900; screenshot captured the initial loading state. |
| Firefox headless narrow-viewport screenshot | PASS | Rendered page at 390×844; screenshot captured the initial loading state. This is viewport rendering, not a physical phone test. |
| `git diff --check` | Pending | Run before commit. |

The Vite host behavior evidence came from source inspection of the installed package at `node_modules/vite/dist/node/chunks/node.js` and the observed HTTP results. No permissive host wildcard was configured.

## Manual / network evidence

- No physical second device was available to this execution session. Same-LAN phone access, Tailscale phone access, and direct backend access from another device are **NOT RUN**.
- The host PC itself reached the frontend and health proxy through its own LAN and Tailscale interface addresses. This confirms local listener/interface routing only; it does not establish remote-device reachability or firewall behavior.
- No firewall rules were changed. The owner must allow TCP `5173` narrowly on trusted private networks if the host firewall blocks it. Port `3001` remains loopback-only.
- PWA installation, service workers, HTTPS, and browser secure-context behavior are not implemented or verified.
- The unavailable health UI state was not manually exercised in a browser. No platform credentials or publishing APIs were accessed.

## Findings and limitations

- Remote-device access acceptance remains unverified until a phone/laptop tests from the owner's LAN and, if available, the owner's Tailscale network. Do not treat the host-interface requests as that evidence.
- Backend exposure from a second device was not tested directly; source and socket inspection show the backend listener bound to loopback only.
- npm's clean-install summary surfaced one high-severity vulnerability. A separate dependency audit was outside the requested checks and was not run; investigate in a separately scoped dependency review before relying on the app beyond this read-only slice.
- The frontend is a read-only health/status slice. It has no user authentication, session, CSRF, account, upload, or publishing flows. Network reachability does not authenticate a user.

## Git publication

- **Remote:** `origin` (`https://github.com/irfannuralam44-max/qfat.git`)
- **Branch:** `main`
- **Commit message:** `feat(web): add private-network QFAT status entry point`
- **Implementation commit SHA:** Pending at report authoring; will be recorded in post-commit metadata.
- **Push / remote verification:** Pending publication.
- **Report:** `reports/QFAT-006-private-network-web-entrypoint-report.md`

## Handoff

This work is ready for GPT/owner audit after commit and remote publication. Agent-reported PASS WITH FINDINGS is not owner acceptance. Remote-device checks remain outstanding; PWA installation is explicitly not implemented or verified.
