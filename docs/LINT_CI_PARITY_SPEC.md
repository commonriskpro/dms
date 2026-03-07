# Lint & CI Parity — Spec

**Sprint:** Lint & CI Parity Fix  
**Date:** 2026-03-07  
**Scope:** Fix remaining lint/tooling blocker, verify commands from repo root, document integration-test DB prerequisites, produce CI/readiness report. No features.

---

## 1. Repo inspection summary

### 1.1 Current validated state

| Command | Status | Notes |
|---------|--------|--------|
| `npm run build` | PASS | Root runs vercel-build (contracts + dealer). |
| `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` | PASS | 142 suites, 877 tests pass; 41 skipped. |
| `npm run lint:dealer` | FAIL | "Invalid project directory provided, no such directory: …/apps/dealer/lint". |
| Full integration tests | Require migrated DB | Documented in jest.setup.ts. |

### 1.2 Command wiring

- **Root** `package.json`: `"lint:dealer": "npm run lint --prefix apps/dealer"` → runs the dealer app’s `lint` script in the context of `apps/dealer`.
- **Dealer** `package.json`: `"lint": "next lint"` → invokes the Next.js CLI with first positional argument `lint`.
- **Next.js 16.1.6** CLI (`node_modules/next/dist/bin/next`): There is **no** `lint` subcommand registered. The CLI defines: `build`, `dev` (default), `start`, `info`, `telemetry`, `typegen`, `upgrade`, `experimental-test`, `experimental-analyze`, `internal`. So when the user runs `next lint`, Commander parses `lint` as the first argument. Because `dev` is the default command, the effective invocation is **`next dev lint`**, and `lint` is passed as the optional `[directory]` argument to `dev`. Next then resolves the project directory to `.../apps/dealer/lint` (relative to cwd) and fails with "Invalid project directory provided, no such directory: …/apps/dealer/lint".

### 1.3 ESLint config

- **Dealer** uses `.eslintrc.json` (extends `next/core-web-vitals`, custom `no-restricted-imports`, override for `lib/ui/icons.ts`).
- **ESLint 9** (dealer devDependency) defaults to **flat config** (`eslint.config.*`). With `ESLINT_USE_FLAT_CONFIG=false`, ESLint loads `.eslintrc.json` but then hits a **circular structure** error when resolving `next/core-web-vitals` (eslintrc compatibility layer with Next’s flat-config-style export).
- **eslint-config-next@16.1.6** exports a **flat config array** (module.exports = array of config objects). It is designed for use with ESLint 9 flat config, not with `.eslintrc.json` extends.

---

## 2. Root cause of lint failure

1. **Immediate cause:** The dealer lint script runs `next lint`. Next.js 16 CLI does not implement a `lint` command, so `lint` is interpreted as the `[directory]` argument of the default command `dev`, producing "Invalid project directory …/lint".
2. **Underlying cause:** Next.js 16 has moved toward running ESLint directly (see Next docs and `next lint` removal in some flows). The repo still uses `next lint` and legacy `.eslintrc.json`; ESLint 9 + eslint-config-next work best with flat config.

---

## 3. Command wiring analysis

| Layer | Current | Note |
|-------|---------|------|
| Root | `npm run lint --prefix apps/dealer` | Correct: runs dealer’s lint script from root. |
| Dealer script | `next lint` | Fails: Next CLI has no lint command; "lint" becomes dev directory. |
| Fix | Use ESLint directly | Run `eslint .` (or equivalent) in apps/dealer with a config ESLint 9 can load. |

---

## 4. Config compatibility analysis

| Option | Pros | Cons |
|--------|------|------|
| A. Keep `next lint`, fix Next CLI | No config change | Next 16 does not ship a lint command; no fix available in our codebase. |
| B. `ESLINT_USE_FLAT_CONFIG=false` + keep .eslintrc | Minimal file change | Fails with circular structure when loading next/core-web-vitals. |
| C. Add flat config + run ESLint | Works with ESLint 9 and eslint-config-next | Requires new `eslint.config.mjs` and script change; preserve same rules/overrides. |

**Choice:** C. Add `eslint.config.mjs` that spreads `eslint-config-next` and reapplies the same `no-restricted-imports` rules and the `lib/ui/icons.ts` override. Change dealer lint script to `eslint .`.

---

## 5. Exact file plan

| # | File | Change |
|---|------|--------|
| 1 | `apps/dealer/eslint.config.mjs` | **Create.** Import `eslint-config-next`; export flat config array that extends it and adds: (a) global `no-restricted-imports` (same paths/patterns as .eslintrc), (b) override for `lib/ui/icons.ts` with `no-restricted-imports: off`. Use `ignores` for `.next/`, `out/`, etc. |
| 2 | `apps/dealer/package.json` | Change `"lint": "next lint"` to `"lint": "eslint ."`. |
| 3 | `apps/dealer/.eslintrc.json` | Keep for now (IDEs may still use it) or remove after verifying lint passes with flat config only. Prefer remove to avoid two sources of truth; if lint passes with only flat config, remove .eslintrc.json. |
| 4 | Docs / jest.setup | Integration-test DB prerequisite already in jest.setup.ts; add one-line pointer in LINT_CI_PARITY_FINAL_REPORT or README if useful. |

---

## 6. Acceptance criteria

1. From repo root, `npm run lint:dealer` **passes** (exit 0) or reports only intentional lint violations (no "Invalid project directory").
2. From `apps/dealer`, `npm run lint` passes (same).
3. Build still passes: `npm run build`.
4. Non-integration tests still pass: `SKIP_INTEGRATION_TESTS=1 npm run test:dealer`.
5. No product/runtime behavior change; lint-only and docs.
6. Integration-test DB prerequisite remains documented (jest.setup.ts already contains it).

---

## 7. CI expectations

- `.github/workflows/deploy.yml` runs migrations on push to main; it does **not** run lint or tests. This sprint does not require changing CI; the fix makes lint usable for local and future CI gating.
