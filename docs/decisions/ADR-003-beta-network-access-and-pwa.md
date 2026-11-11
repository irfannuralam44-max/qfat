# ADR-003: Private Beta Network Access and PWA Scope

- **Status:** OWNER-APPROVED PRODUCT DIRECTION; TECHNICAL IMPLEMENTATION DETAILS PENDING
- **Date:** 2026-11-11
- **Related:** QFAT-PRD-001, QFAT-ARCH-001, ADR-002
- **Supersedes:** ADR-002's loopback-only assumption for the frontend browser listener in private beta. ADR-002's session/CSRF security principles remain applicable and must be adapted to the new browser-facing origins.

## Context

QFAT is a local-first web app running on the owner's PC. The private beta needs real-world testing from a second device, including a family tester. The owner explicitly prefers a simple network model: open QFAT using the PC's LAN IP at home or its Tailscale IP remotely, using the same frontend port. QFAT must not become a Tailscale integration project.

## Decision

### Product behavior approved by owner

1. QFAT remains a web app hosted on the owner's PC.
2. The frontend listener binds to `0.0.0.0` on its configured port (currently `5173`).
3. The user opens the actual PC LAN IP or Tailscale IP plus that same port.
4. The same QFAT instance, backend, database, media directory, and publishing jobs are used through either address.
5. QFAT does not include Tailscale-specific code, setup, SDK, Serve, Funnel, cloud relay, router port forwarding, or public hosting.
6. The backend remains on loopback behind the frontend's same-origin API/event proxy; do not expose its port directly to other devices.
7. QFAT remains responsive and usable in a mobile browser. Native mobile apps are out of scope.

### PWA installation boundary

PWA installability is not identical to ordinary web reachability. Standard service workers and PWA installation require a secure context (normally HTTPS; localhost is a development exception). A plain HTTP LAN or Tailscale IP URL is not a standard secure context. Also, an installed PWA is bound to the exact origin used during installation and does not automatically switch between a LAN IP and a Tailscale IP.

Therefore:
- Responsive mobile browser access is an approved beta requirement.
- Do not claim PWA installation works on plain HTTP IP URLs.
- PWA installability remains a separate follow-up requiring a browser-trusted HTTPS origin choice and validation on the actual mobile browser.
- Do not introduce Tailscale-specific infrastructure merely to satisfy PWA installation without a separate owner decision.

## Security consequences

- Binding to `0.0.0.0` makes the frontend reachable on all active interfaces. Host firewall/network reachability must be limited to the owner's trusted LAN and tailnet; no public router exposure.
- A reachable network path is not user authentication. Session and CSRF protections remain mandatory.
- The session-bound synchronizer-token proposal from ADR-002 remains the baseline, but exact Origin/Host validation must be redesigned for the actual browser-facing LAN/Tailscale IP origin and the proxy's upstream Host. Never use wildcard Origin acceptance or trust client-supplied forwarded-host headers.
- Keep the backend bound to `127.0.0.1:3001` and proxy API/SSE through the frontend. The browser must use relative/same-origin API URLs, not a hardcoded localhost backend URL.
- Platform credentials remain backend-only and in OS-protected credential storage.
- A family beta tester must be treated as an authorized operator only if the owner deliberately grants that access. Network membership alone must not silently grant publishing authority.

## Implementation gate

This ADR records the owner's product direction, not proof that the security design or PWA behavior is implemented. Before implementation, create a scoped task that updates PRD/architecture references and adapts the security implementation to the LAN/Tailscale browser-facing origins. Required manual tests include LAN access, Tailscale access, backend-port isolation, Origin/Host/CSRF rejection, and mobile browser usability. PWA installation must be tested separately and must not be marked passed on plain HTTP IP origins.

No implementation, live publishing, credential changes, or CI/GitHub Actions are authorized by this ADR itself.
