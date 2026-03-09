# Lint & CI Parity — Final Report

**Sprint:** Lint & CI Parity Fix  
**Date:** 2026-03-07  
**Scope:** Fix lint/tooling blocker, verify commands from root, document integration-test DB prerequisites.

---

## 1. Root cause

- **Symptom:** `npm run lint:dealer` (and `npm run lint` in apps/dealer) failed with:  
  `Invalid project directory provided, no such directory: …/apps/dealer/lint`.
- **Cause:** The dealer lint script was `next lint`. The Next.js 16 CLI does **not** register a `lint` subcommand. The default command is `dev`. So running `next lint` was interpreted as **`next dev lint`**, with `lint` as the optional `[directory]` argument. Next then resolved the project path to `.../apps/dealer/lint` and exited with "Invalid project directory".
- **Why not fix via Next:** There is no `lint` command in Next 16’s CLI to fix; the only fix is to stop using `next lint` and run ESLint directly.

---

## 2. Files changed

| File | Change |
|------|--------|
| **apps/dealer/eslint.config.mjs** | **Created.** Flat config that imports `eslint-config-next`, spreads it, and adds: (1) global `no-restricted-imports` (same paths/patterns as former .eslintrc), (2) override for `lib/ui/icons.ts` with `no-restricted-imports: off`. Export assigned to a variable to satisfy `import/no-anonymous-default-export`. |
| **apps/dealer/package.json** | Lint script changed from `"next lint"` to `"eslint ."`. |
| **apps/dealer/.eslintrc.json** | **Removed.** Single source of truth is now `eslint.config.mjs` (ESLint 9 flat config). |
| **docs/LINT_CI_PARITY_SPEC.md** | **Created.** Root cause, command wiring, config compatibility, file plan, acceptance criteria. |
| **docs/LINT_CI_PARITY_FINAL_REPORT.md** | **Created.** This report. |

**Integration-test DB:** Already documented in `apps/dealer/jest.setup.ts` (migrated DB required when running without `SKIP_INTEGRATION_TESTS=1`). No additional file change.

---

## 3. Commands run

| Command | Result |
|---------|--------|
| `npm run lint:dealer` (from root) | **Runs successfully.** ESLint executes and reports violations (see below). No "Invalid project directory" error. |
| `npm run lint` (from apps/dealer) | **Runs successfully.** Same behavior. |
| `npm run build` | **PASS** (exit 0). |
| `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` | **PASS** (142 suites, 877 tests, 0 failed). |

---

## 4. Final lint / test / build status

### 4.1 Lint

- **Status:** **Unblocked.** The lint command runs and completes; the previous tooling blocker is resolved.
- **Output:** ESLint reports **7 errors** and **19 warnings** (26 problems total) in existing code. These are pre-existing rule violations (e.g. `no-restricted-imports` for lucide-react in a few files, `react-hooks/purity`, `@next/next/no-html-link-for-pages`, etc.). They were not introduced by this sprint and were not fixed here (no feature/UI work).
- **CI:** Lint can be used for gating: run `npm run lint:dealer` and fail the job on non-zero exit (or on `--max-warnings 0` if you want to enforce zero warnings later).

### 4.2 Build

- **Status:** **PASS.**

### 4.3 Tests (unit baseline)

- **Status:** **PASS** with `SKIP_INTEGRATION_TESTS=1` (142 passed suites, 877 passed tests).

---

## 5. Remaining blockers

- **None** for the scope of this sprint. The lint **command** is fixed and usable.
- **Pre-existing lint findings:** 7 errors and 19 warnings remain in the codebase. Addressing them is out of scope for this sprint; they can be handled in a follow-up (fix or relax rules as appropriate).

---

## 6. Release-readiness verdict

- **Lint:** The blocker (“Invalid project directory”) is **resolved.** Lint runs via ESLint 9 and flat config; release gating can rely on `npm run lint:dealer` from root.
- **Build:** Green.
- **Unit tests:** Green with `SKIP_INTEGRATION_TESTS=1`.
- **Integration tests:** Require migrated test DB; documented in `jest.setup.ts`.

**Verdict:** Lint & CI parity fix is **complete** for the stated goal. The repo has a working lint command from root and app; no product behavior was changed.
