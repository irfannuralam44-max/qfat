# ADR-006: Reuse Spoolcast as the QFAT MVP Platform Engine

- Status: Accepted
- Decision date: 2026-11-13
- Decision owner: Project owner
- Scope: QFAT MVP architecture and implementation approach

## Context

QFAT imports the Spoolcast Node.js/TypeScript project, which already contains useful YouTube and Facebook authorization and upload protocol implementations. QFAT also has an application server, web frontend, local persistence, media library, and encrypted credential foundation.

The previous architecture guidance proposed extensive package boundaries and a new upload-engine structure. That approach risks spending MVP time rebuilding or rearranging working platform code instead of completing the user-facing publishing workflow.

## Decision

Use the imported Spoolcast source as the platform integration engine for QFAT MVP.

- Reuse existing Spoolcast OAuth and YouTube/Facebook upload code wherever safe.
- Adapt only the boundaries needed to call those functions from the existing QFAT server and report progress/results to the existing QFAT web UI.
- Keep the existing `src/`, `apps/server/`, and `apps/web/` structure unless a concrete MVP requirement requires a narrowly scoped change.
- Do not create a replacement upload engine, broad adapter framework, new package hierarchy, or custom protocol implementation merely for architectural neatness.
- Preserve upstream MIT licensing and attribution.
- Retain essential correctness/security work: immediate publishing, multiple accounts, Facebook single-image publishing, bounded-memory Reels transfer, duplicate-upload protection, per-destination results, and encrypted credential storage.
- Scheduling, Facebook albums, hosted SaaS, desktop packaging, Rust rewrite, and Windows implementation remain outside the active Linux MVP scope.

## Implementation principle

Prefer the smallest safe change that completes a real MVP user flow. New dependencies, framework changes, broad refactors, and platform expansions require concrete technical evidence and explicit owner approval.

## Consequences

- Historical tasks and reports remain unchanged as evidence of earlier work and planning.
- Current implementation authority is `docs/PRD-QFAT-MVP.md`, `docs/ARCHITECTURE-QFAT-MVP.md`, `AGENTS.md`, and `CLAUDE.md`.
- The next implementation task should inspect the actual QFAT server-to-Spoolcast integration and specify the shortest safe connection path. It must not begin until GPT creates the bounded task and the owner authorizes it.
- Verification remains local-only on Linux; GitHub Actions/hosted CI are not used.
