# QFAT Beta Access — Product Requirements Addendum

- **Status:** OWNER-DIRECTED PRODUCT REQUIREMENT
- **Date:** 2026-11-11
- **Applies to:** QFAT MVP / private beta
- **Supersedes:** Conflicting loopback-only access statements in `docs/PRD-QFAT-MVP.md` for the private-beta browser access scope only.

## 1. Product decision

QFAT remains a local-first web application running on the owner's PC. During private beta, the owner and invited testers (including family testers) must be able to open the same running QFAT instance from another device using the PC's reachable IP address and the configured web port.

The intended simple usage is:

- At home, open QFAT using the PC's LAN IP and web port, for example `http://192.168.1.20:5173`.
- Away from home, when the PC and phone are connected to the same Tailscale network, open QFAT using the PC's Tailscale IP and the same web port, for example `http://100.x.y.z:5173`.
- The examples are illustrative. QFAT must not hardcode or guess the user's IP address.
- The PC must be powered on, QFAT must be running, and the chosen network path must be reachable.
- QFAT does not need Tailscale-specific code, SDKs, APIs, account integration, Serve, Funnel, or a separate relay service. Tailscale is simply one network path provided by the user's operating system/network setup.
- QFAT remains a browser-based web app. No native mobile app is required for this access requirement.

## 2. Frontend and backend scope

- The web frontend listener must bind to `0.0.0.0` on its configured web port (currently `5173`) so it can accept connections addressed to the PC's LAN or Tailscale interface IPs.
- The frontend must continue to use the same configured port for both LAN and Tailscale access.
- The backend remains a separate local process and must not be exposed directly on a second network port merely to enable phone access. In development, the frontend proxy continues forwarding API and event paths to the backend's loopback listener.
- The application must use relative/same-origin frontend API URLs so the browser uses the exact IP and port through which the page was opened.
- Do not hardcode `localhost`, a LAN address, a Tailscale address, or a specific network interface into frontend API calls.
- Do not treat `0.0.0.0` as a destination address. It is the listener bind address only; users open the actual LAN or Tailscale IP assigned to the PC.

## 3. Beta access boundary

Binding the frontend to `0.0.0.0` makes it reachable on all active network interfaces, subject to host firewall and network routing. It is not a public-hosting feature and must not be described as safe for arbitrary public networks.

For private beta:

- The owner controls who can reach the PC through the LAN and Tailscale network membership/firewall.
- QFAT must retain session and CSRF protections for all browser origins; network reachability is not authentication.
- Do not weaken Origin/Host checks to wildcard acceptance. The implementation must explicitly support the actual browser-facing IP-and-port origins used for the running instance.
- Do not expose the backend listener directly to LAN/Tailscale when the frontend proxy can keep it loopback-only.
- Do not open router ports or expose QFAT to the public internet as part of this requirement.
- A tester must not receive platform credentials or access to the host PC's credential store merely by being able to load the page. Account-use authorization and the single-operator beta trust model must be addressed before inviting an untrusted tester to perform publishing actions.

## 4. PWA and browser installation constraint

QFAT must be responsive and usable from a phone browser. The owner also wants an installable PWA experience where the browser supports it.

There is an important browser-platform constraint: standard PWA installation and service workers require a secure context (normally HTTPS; localhost is a special development exception). A plain HTTP URL using a LAN IP or Tailscale IP is not a secure context. Therefore this addendum does **not** claim that `http://<LAN-IP>:5173` or `http://<Tailscale-IP>:5173` can be installed as a PWA in standard browsers.

A PWA installation is tied to the exact origin from which it is installed. A PWA installed from one IP/port does not automatically switch to another IP/port when the device changes networks. Supporting installation from LAN and remote access requires a browser-trusted HTTPS origin for each intended access path, or another owner-approved simple approach. This must be validated on the actual Android/browser combination before being promised as beta acceptance.

Until that HTTPS/PWA detail is validated, the guaranteed beta requirement is responsive browser access through LAN IP or Tailscale IP. Do not block basic web access on PWA packaging.

## 5. Acceptance criteria

1. The frontend listens on `0.0.0.0` at the configured web port.
2. A second device on the same LAN can open the running QFAT instance using the PC's LAN IP and that port.
3. A second device connected through the owner's Tailscale network can open the same instance using the PC's Tailscale IP and the same port, without QFAT-specific Tailscale integration.
4. Frontend API and SSE calls continue to work using the exact origin used to open QFAT; no hardcoded localhost API URL is required by a remote browser.
5. The backend remains inaccessible directly from the second device unless a separately approved design explicitly changes that boundary.
6. Session, CSRF, upload validation, credential isolation, and publishing confirmation protections remain enforced.
7. Phone layout is usable in a current mobile browser.
8. PWA installability is reported separately and is not marked PASS for plain HTTP IP origins without verified secure-context support.

## 6. Scope exclusions

- No Tailscale SDK, API, CLI automation, Serve, Funnel, or QFAT-managed VPN setup.
- No cloud relay, public hosting, router port forwarding, or public internet exposure.
- No native Android/iOS application.
- No automatic IP discovery/selection UI unless later shown to be necessary.
- No change to publishing workflows, provider credentials, or platform account permissions.

This addendum changes the beta network-access product requirement only. It does not authorize implementation by itself; implementation still requires a scoped task and the normal owner/GPT stage gate.
