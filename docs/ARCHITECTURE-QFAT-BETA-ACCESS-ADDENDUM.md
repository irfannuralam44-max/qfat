# QFAT Beta Access — Architecture Addendum

- **Status:** OWNER-DIRECTED PRODUCT TOPOLOGY; SECURITY DETAILS REQUIRE IMPLEMENTATION VALIDATION
- **Date:** 2026-11-11
- **Related:** `docs/ARCHITECTURE-QFAT-MVP.md`, `docs/PRD-QFAT-BETA-ACCESS-ADDENDUM.md`, ADR-002, ADR-003

## 1. Target topology

The beta remains a web application hosted by the user's PC. The browser connects to the PC using whichever reachable interface address the user chooses.

```text
Phone / laptop browser
   |  http://<PC-LAN-IP>:5173
   |  or http://<PC-Tailscale-IP>:5173
   v
QFAT frontend web listener (0.0.0.0:5173)
   |  same-origin /api and /events proxy
   v
QFAT backend (127.0.0.1:3001)
   |-- session / CSRF
   |-- OAuth and credential access
   |-- upload jobs and platform adapters
   |-- SQLite and local media
   +--> Google / YouTube and Meta / Facebook APIs
```

The IP values are supplied by the operating system/network and are not configured as QFAT-specific Tailscale settings. `0.0.0.0` is only the server bind address; it is never shown to the user as the URL to open.

## 2. Listener and request routing

- Bind the Vite/frontend listener to `0.0.0.0` on port `5173` (or the existing configured frontend port).
- Keep the backend listener on `127.0.0.1:3001`.
- Keep API and SSE requests relative to the page origin (for example, `/api/v1/health` and `/events`). Do not make browser code call `http://localhost:3001` directly.
- The frontend server proxies only the required API and event paths to the fixed backend loopback address.
- The browser-facing Origin is the IP and port used to open QFAT. The upstream backend Host may be rewritten by the development proxy. The implementation must not confuse these two values.
- The frontend/proxy must validate the incoming Host against the actual local interface addresses/expected web port, or use an equivalently narrow verifiable rule. Do not accept arbitrary hostnames or wildcard origins.
- Preserve the browser Origin to the backend and apply the session-bound CSRF design. If the proxy rewrites Host, the backend must validate the expected upstream Host separately and must not pretend it represents the browser-facing Host.
- Do not trust client-supplied `Forwarded`, `X-Forwarded-Host`, or `X-Original-Host` values. Strip them unless a deliberately configured trusted proxy overwrites them.
- Keep the backend port inaccessible from other devices. Firewall rules should not be used as a substitute for backend authentication and request validation.

## 3. Network exposure

Binding to `0.0.0.0` exposes the frontend listener on all active interfaces. Reachability is controlled by the PC's firewall and network routes. The owner uses the LAN IP at home and the Tailscale IP remotely; QFAT itself does not need to detect or distinguish Tailscale.

Do not add Tailscale-specific code or require Tailscale Serve/Funnel. Do not add router port forwarding or public hosting. The PC must remain powered on with QFAT running.

## 4. Browser security implications

The previous loopback-only Origin/Host assumptions in ADR-002 are insufficient for this beta topology and must not be copied unchanged into implementation.

The implementation task must adapt the existing session-bound synchronizer-token proposal to the actual browser-facing IP origin:

- Issue a host-only HttpOnly session cookie for the exact browser-facing host used to open QFAT.
- Keep the session identifier out of JSON and frontend storage.
- Return the separate session-bound CSRF proof at bootstrap and keep it in JavaScript memory.
- Validate the proof against server-side session state for every state-changing request, including multipart uploads.
- Validate the exact browser Origin and the expected proxy/upstream Host as separate values.
- Reject unexpected origins, malformed/missing Origin on protected browser mutations, invalid session/proof, and unexpected Host values.
- Do not assume the Tailscale network alone authenticates the QFAT user. A reachable device is not automatically an authorized publishing operator.
- Keep platform credentials exclusively in the backend/OS credential store; never return them to the browser.

Because a browser-facing IP can change, the implementation must not hardcode one IP in an allowlist or frontend bundle. Define a narrow runtime rule tied to the actual frontend listener and validate it with LAN and Tailscale browser tests. Do not solve dynamic IP handling by allowing every Origin.

## 5. PWA constraint

Responsive browser access is required. PWA installation is a separate browser capability and has a secure-context requirement.

- Plain HTTP on a LAN IP or Tailscale IP is not a standard secure context for service workers/PWA installation.
- An installed PWA is tied to the exact origin from which it was installed; it does not automatically change from LAN IP to Tailscale IP.
- Do not claim PWA installation works on bare HTTP IP URLs.
- If installability is required for beta, select and verify a browser-trusted HTTPS origin strategy that remains simple for the owner. This can be a separate scoped implementation decision; do not add Tailscale SDK/Serve/Funnel automatically.
- Until verified, mobile browser usability is required and PWA installability is an explicitly unverified follow-up.

## 6. Required verification

- Local desktop browser still works.
- A phone on the same LAN opens the app by PC LAN IP and port.
- A phone on Tailscale opens the same app by PC Tailscale IP and port.
- API calls and SSE work from both browser-facing origins.
- Invalid Origin/Host and missing/incorrect CSRF proof are rejected.
- Backend port 3001 is not reachable directly from the phone.
- No secrets appear in frontend responses, storage, URLs, or logs.
- Test the PWA secure-context/install behavior separately; do not infer it from the successful HTTP page load.

This addendum is the current beta topology reference. It supersedes the loopback-only frontend access assumption in the earlier architecture proposal for the private-beta scope. It does not authorize code changes without a scoped implementation task.
