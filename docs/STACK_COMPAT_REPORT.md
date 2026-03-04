# Stack Compatibility Report

## Scope
- Runtime/tooling: Node 24.x, npm 11.x
- Frameworks: Next 16.x, React 19.x, TypeScript strict
- Workspace layout: `apps/dealer`, `apps/platform`, `packages/contracts`
- Focus: compatibility blockers and safe optimizations only (no API/behavior changes)

## Findings

### 1) Next 16 invalid config key in platform
- Severity: Medium (warning now, future break risk)
- File: `apps/platform/next.config.js`
- Issue: `eslint` config key is deprecated/unsupported in Next 16 and emits invalid config warnings.
- Recommendation: Remove the `eslint` key from Next config and manage lint in CI/scripts.
- Status: Fixed in this pass.

### 2) Workspace dependency ownership + zod consistency
- Severity: Medium (historical CI/Vercel instability)
- Files: `package.json`, `apps/dealer/package.json`, `apps/platform/package.json`, `packages/contracts/package.json`
- Issue: All workspaces that import `zod` must declare it directly; root override should be consistent.
- Recommendation: Keep `zod` pinned consistently (`3.25.76`) and commit synced lockfile.
- Status: Verified as consistent in this pass.

### 3) Platform build blockers discovered during verification
- Severity: High (build blocking)
- Files: `apps/platform/package.json`, `apps/platform/tsconfig.json`
- Issues found during validation:
  - UTF-8 BOM in `apps/platform/package.json` caused JSON parse failure.
  - Missing runtime deps used by platform (`@sentry/nextjs`, `resend`).
  - Next typecheck included Vitest config files (`vitest.config.ts`), causing module resolution errors.
- Recommendation:
  - Keep package JSON UTF-8 without BOM.
  - Keep required dependencies declared in the platform workspace.
  - Exclude test runner config files from app tsconfig include.
- Status: Fixed in this pass.

### 4) Node 24 / React 19 / App Router scan
- Severity: Low
- Scope: repo-wide pattern scan for common Node deprecations and boundary issues.
- Result: No critical Node 24 API deprecations found in app/runtime code; no immediate server/client boundary blocker surfaced in current build paths.
- Recommendation: Continue enforcing route validation + tenant/RBAC checks in current API handlers.

## Safe optimization notes
- No broad refactors were applied.
- Maintained server-first render patterns and existing route/API behavior.
- Kept TypeScript strict mode enabled across all workspaces.

## Verification commands (to be run from repo root)
- `npm ci`
- `npm -w packages/contracts run build`
- `npm -w apps/dealer run build`
- `npm -w apps/platform run build`
- `npm -ws run test`
- `npm -ws run lint`
- `npm -ws run typecheck` (if available)
