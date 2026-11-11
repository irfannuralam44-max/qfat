# QFAT Backend Server

Minimal local HTTP server for QFAT MVP. Provides a health-check endpoint and serves as the foundation for future API routes.

## Prerequisites

- Node.js 24 LTS (preferred) or Node.js >= 22
- npm (bundled with Node.js)

## Installation

From the `apps/server/` directory:

```bash
npm ci
```

This installs dependencies from the committed `package-lock.json` for reproducible builds.

## Development

```bash
npm run dev
```

Runs the server with `tsx` for TypeScript execution and hot reloading. Defaults to `http://127.0.0.1:3001`.

## Production Build

```bash
npm run build
npm start
```

- `npm run build` compiles TypeScript to `dist/`
- `npm start` runs the compiled server from `dist/index.js`

## Configuration

### Port

Default: `3001`

Override with the `PORT` environment variable (must be an integer 1–65535):

```bash
PORT=4001 npm start
```

Invalid values (non-integer, out of range, empty, decimal, or partial strings) cause the server to exit with an error.

### Host

Hardcoded to `127.0.0.1` (loopback only). The server never binds to `0.0.0.0` or LAN interfaces.

## Health Check

```bash
curl http://127.0.0.1:3001/api/v1/health
```

Response (HTTP 200):
```json
{
  "status": "ok",
  "timestamp": "2026-11-11T07:30:00.000Z"
}
```

The response contains only `status` and `timestamp`. No secrets, environment variables, filesystem paths, or machine information are included.

## Graceful Shutdown

The server handles `SIGINT` (Ctrl+C) and `SIGTERM`:

1. Stops accepting new connections
2. Closes existing connections
3. Exits cleanly

## Testing

```bash
npm test
```

Runs the full test suite (23 tests):
- SQLite connection and migration tests (14 existing)
- Health server endpoint, loopback binding, graceful shutdown (3)
- Port validation: valid, default, empty, alphabetic, numeric suffix, decimal, zero, negative, 65536, leading zeros, whitespace (10)

## Dependencies

- `better-sqlite3@12.11.1` — SQLite driver
- `drizzle-orm@0.45.4` — Typed query/schema layer
- `fastify@5.12.8` — HTTP framework
- `drizzle-kit@0.31.11` — Migration generation (dev)
- `tsx@4.23.15` — TypeScript execution (dev)
- `typescript@7.0.2` — TypeScript (dev)

## Data Safety

- No real QFAT database, credentials, tokens, or platform accounts are accessed
- All tests use isolated temporary databases
- No network calls to Google, YouTube, Meta, or Facebook