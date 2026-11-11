# QFAT Web Entry Point

This is the minimal private-beta browser entry point. It shows the health of the existing local backend; it does not include publishing, OAuth, account, or PWA features.

## Install

From `apps/web/`:

```bash
npm ci
```

Install the backend dependencies from `apps/server/` separately with `npm ci` if they are not installed yet.

## Start QFAT

Keep both processes running in separate terminals. Their logs remain visible, and each can be stopped with `Ctrl+C`.

Terminal 1 — from the repository root:

```bash
cd apps/server
npm run dev
```

The backend remains bound to `127.0.0.1:3001`.

Terminal 2 — from the repository root:

```bash
cd apps/web
npm run dev
```

The frontend binds to `0.0.0.0:5173`. This is a bind address, not a URL to enter in the browser. The PC must remain powered on and both processes must keep running.

Open QFAT at:

- Desktop on the PC: `http://localhost:5173`
- Home network: `http://<PC-LAN-IP>:5173`
- Tailscale network: `http://<PC-TAILSCALE-IP>:5173`

Use the PC's actual address shown by its operating system or network tools. QFAT does not discover addresses or configure Tailscale. If the host firewall blocks access, configure a narrow inbound rule for TCP port `5173` on the trusted LAN/tailnet yourself. No firewall rules are changed automatically. Do not configure router port forwarding or expose QFAT to the public internet.

The Vite server accepts IP-literal Host values for LAN/Tailscale access, plus `localhost` and its `.localhost` subdomains. The explicit empty `allowedHosts` list retains Vite's default policy: these special cases are accepted, and other DNS hostnames are rejected. Its only proxy route is `/api/v1/health`, forwarded to the backend loopback listener. Browser requests stay same-origin and require no permissive CORS configuration.

This is responsive browser access over HTTP, not PWA installation. PWA/service-worker support and HTTPS are not implemented or verified.
