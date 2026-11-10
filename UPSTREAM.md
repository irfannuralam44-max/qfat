# Upstream baseline: Spoolcast

This repository contains the unmodified source tree of **Spoolcast**, imported as the
traceable upstream baseline for Qfat. No Qfat features, CLI redesigns, account limits, or
adaptations have been applied in this commit.

| Field | Value |
| --- | --- |
| Upstream repository | https://github.com/jaycverg/spoolcast |
| Upstream branch | `master` |
| Upstream commit | `a52fdf61b75c19335953feee953132f4feb81f17` |
| Upstream commit date | 2026-08-16 13:23:27 +0800 |
| Upstream commit subject | `Rename to spoolcast and package for npm distribution (#1)` |
| Upstream license | MIT (`LICENSE`, Copyright (c) 2026 Jayrome Vergara) |
| Import date | 2026-11-10 |
| Import method | `git clone` (full history), files copied with `rsync -a --exclude='.git'` |

## License and attribution

The upstream `LICENSE` file is preserved unchanged. Per the MIT license, the copyright
notice and permission notice must remain in all copies or substantial portions of the
software. Do not remove or rewrite `LICENSE` when adapting the code.

## Files imported (22)

```
.gitignore
CLAUDE.md
LICENSE
README.md
docs/setup-facebook.md
docs/setup-youtube.md
package-lock.json
package.json
src/auth-facebook.ts
src/auth-youtube.ts
src/cli.ts
src/config.ts
src/manifest.ts
src/probe.ts
src/run.ts
src/state.ts
src/tokens.ts
src/upload-facebook-reel.ts
src/upload-facebook.ts
src/upload-youtube.ts
src/video.ts
tsconfig.json
```

## Verification

File integrity was verified by comparing SHA-256 of every file against
`git ls-tree -r HEAD` in the upstream clone: **22/22 hashes identical**. `.git` from the
upstream clone was intentionally not copied, so Qfat keeps its own history while this
commit records the upstream commit SHA above.

## Checks run

Environment: Node.js v24.22.2, npm 11.19.1 (upstream requires `node >= 20`).

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm ci` | PASS (5 moderate advisories in transitive deps) |
| Typecheck | `npm run typecheck` | PASS (exit 0) |
| Build | `npm run build` | PASS (exit 0, `dist/` generated and git-ignored) |

Not run, by design: no live upload, no credential/OAuth flow, and no `npm start`/CLI run.
`npm start` uses `tsx`, whose `esbuild` postinstall script was skipped by the npm
`allowScripts` policy; approve it only when the CLI actually needs to run.

## Known findings

- `npm audit`: 5 moderate advisories (`googleapis`, `googleapis-common`, `gaxios`, `uuid`,
  `qs`). Fixing them requires a semver-major upgrade of `googleapis` (189.0.0). Out of
  scope for a byte-identical baseline import; to be handled in a dedicated dependency task.
- Upstream targets Facebook Graph API v21.0 and stores OAuth tokens as JSON files. Both are
  explicitly flagged for change in issue #1; neither is addressed here.
- `package.json` still declares the upstream name, version, `repository`, and `bin`
  entries. It was left untouched to keep the baseline verifiable.

## Next step

Adaptation work is tracked in this repository's issue #1 (`Integrate Spoolcast upload
adapters for Qfat MVP`). This baseline commit is only the starting point.
