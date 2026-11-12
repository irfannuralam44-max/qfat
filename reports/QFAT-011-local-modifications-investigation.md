# QFAT-011 Local Modifications Investigation Report

- **Repository:** irfannuralam44-max/qfat
- **Branch:** main
- **HEAD:** 9ad46384b922a259c18ac6d4606c28772962b23a
- **Origin:** https://github.com/irfannuralam44-max/qfat.git
- **Worktree status:** 2 modified files (not staged)

---

## 1. File: `apps/server/src/security/index.ts`

### Local Diff
```diff
export function constantTimeEqual(a: string, b: string): boolean {
-  const left = Buffer.from(a, 'utf8');
-  const right = Buffer.from(b, 'utf8');
+  const left = new Uint8Array(Buffer.from(a, 'utf8'));
+  const right = new Uint8Array(Buffer.from(b, 'utf8'));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
```

### Comparison with `origin/main`
- **origin/main:** Uses raw `Buffer.from()` return values directly
- **Local:** Wraps each `Buffer` in `new Uint8Array()`

### Analysis
- **Type:** Legitimate TypeScript fix (not a test change, not accidental)
- **Reason:** `crypto.timingSafeEqual()` expects `ArrayBufferView` (Uint8Array/DataView). Raw `Buffer` is not assignable to `ArrayBufferView` in TypeScript 5.x strict mode.
- **Evidence:** The original code causes `TS2345: Argument of type 'Buffer' is not assignable to parameter of type 'ArrayBufferView'` at line 164.
- **Impact:** Without this fix, `npm run typecheck` fails. With it, typecheck passes.
- **Conflict with QFAT-011:** None — this fix is required for the QFAT-011 security module to compile.

---

## 2. File: `apps/server/test/security.test.ts`

### Local Diffs (3 test assertion updates)

**Diff 1: Multiple Origin error message case**
```diff
-      assert.ok(result.error?.includes('Multiple Origin'));
+      assert.ok(result.error?.includes('multiple Origin'));
```

**Diff 2: Public IPv4 rejection error message**
```diff
-      assert.ok(result.error?.includes('private IPv4'));
+      assert.ok(result.error?.includes('loopback, RFC1918, or Tailscale CGNAT'));
```

**Diff 3: Host header port mismatch error message**
```diff
-      assert.ok(result.error?.includes('port does not match'));
+      assert.ok(result.error?.includes('does not match Origin authority'));
```

### Comparison with `origin/main`
- **origin/main:** Contains the original (incorrect) expected strings
- **Local:** Updated to match actual error messages produced by the implementation

### Analysis
- **Type:** Test-only corrections (legitimate test fixes)
- **Reason:** The implementation in `index.ts` produces specific error messages that differ from what the original tests expected:
  - `validateOriginHeader` returns `'Null or multiple Origin values not allowed'` (lowercase "multiple")
  - `validateOriginHeader` returns `'Origin must use loopback, RFC1918, or Tailscale CGNAT IPv4'` for public IPs
  - `validateHostHeader` returns `'Host header does not match Origin authority'` for port mismatch
- **Evidence:** Running `npm test` on origin/main version would fail these 3 tests. With local changes, all 90 tests pass.
- **Impact:** These are **test assertion corrections only** — they do not change any production code behavior.
- **Conflict with QFAT-011:** None — they align tests with the actual QFAT-011 implementation.

---

## Summary of Findings

| File | Change Type | Legitimacy | Already in origin/main? | Risk if Discarded |
|------|-------------|------------|------------------------|-------------------|
| `apps/server/src/security/index.ts` | TypeScript fix (Buffer → Uint8Array) | **Required** — fixes TS2345 compile error | No | Typecheck fails; build fails |
| `apps/server/test/security.test.ts` | 3 test assertion string corrections | **Required** — tests match actual implementation | No | 3 tests fail; CI would fail |

---

## Resolution and Publication

**Commit:** `d8436428ca330ed7b3b87f03d9bb9be0bbc11dde`
**Message:** `fix(security): preserve timingSafeEqual typing and test assertions`

### Changes Included

1. **`apps/server/src/security/index.ts`** — `constantTimeEqual` function:
   - Changed `const left = Buffer.from(a, 'utf8')` to `const left = new Uint8Array(Buffer.from(a, 'utf8'))`
   - Changed `const right = Buffer.from(b, 'utf8')` to `const right = new Uint8Array(Buffer.from(b, 'utf8'))`
   - Resolves `TS2345: Argument of type 'Buffer' is not assignable to parameter of type 'ArrayBufferView'` in TypeScript 5.x strict mode.

2. **`apps/server/test/security.test.ts`** — Three test assertion corrections:
   - **Multiple Origin error message:** `'Multiple Origin'` → `'multiple Origin'` (matches actual lowercase output from `validateOriginHeader`)
   - **Public IPv4 rejection message:** `'private IPv4'` → `'loopback, RFC1918, or Tailscale CGNAT'` (matches actual error from `validateOriginHeader`)
   - **Host header port mismatch message:** `'port does not match'` → `'does not match Origin authority'` (matches actual error from `validateHostHeader`)

### Outcome

- Both identified local modifications were **retained and published**, not discarded.
- The changes were committed directly to `main` as part of the QFAT-011 follow-up correction.
- `npm run typecheck` and `npm test` (90 tests) pass with these changes.

### Current Repository State (as of investigation resolution)

- **Branch:** `main`
- **HEAD:** `d8436428ca330ed7b3b87f03d9bb9be0bbc11dde`
- **Remote:** `origin/main` synchronized
- **Working tree:** Clean (no uncommitted changes)

---

## Recommendation

**Do not discard these changes.** Both are legitimate and required:

1. The `index.ts` fix resolves a TypeScript compilation error that blocks `npm run typecheck` and `npm run build`.
2. The `security.test.ts` corrections align test expectations with the actual QFAT-011 security implementation error messages.

These changes were committed as part of the QFAT-011 verification flow in commit `d8436428ca330ed7b3b87f03d9bb9be0bbc11dde`. They do not introduce any behavioral changes — only fix compilation and test alignment.

**Note:** This investigation report documents historical local state before publication. It does not itself prove that tests were executed; the verification results are reported separately in `QFAT-011-browser-session-csrf-security-report.md`.