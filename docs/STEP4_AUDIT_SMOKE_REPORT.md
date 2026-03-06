# Step 4 — Smoke / sanity report

**Date:** 2025-03-04  
**Scope:** Post–audit smoke checks.

## Commands run

| Command | Status | Notes |
|---------|--------|------|
| npm ci | FAIL (env) | EPERM on Windows (Prisma engine file in use). Run in clean state. |
| npm -w packages/contracts run build | FAIL (env) | npx tsc not finding TypeScript (install/hoisting). Run after successful npm ci. |
| npm -w apps/platform run build | FAIL (env) | Prisma not in PATH when run from root; script updated to npx prisma. |
| npm -w apps/dealer run build | Not run | Depends on npm ci. |
| npm -w apps/platform run test:ci | Not run | Depends on install. |
| npm -w apps/dealer run test | Not run | Depends on install. |

## Code / config changes made this audit

- **apps/platform/package.json:** Added `@dms/contracts` dependency; build script uses `npx prisma generate && npx next build`.
- **docs/AUDIT_STACK_REPORT.md, ROUTE_COMPLIANCE_MATRIX.md, FIX_PLAN.md:** Created (Step 1).
- **docs/STEP4_*_REPORT.md:** Stubs created (this file and below).

## Smoke conclusion

Environment blocked full verification. After resolving file locks and running `npm ci` from repo root, re-run:

- `npm -w packages/contracts run build`
- `npm -w apps/platform run build`
- `npm -w apps/dealer run build`
- `npm -w apps/platform run test:ci`
- `npm -w apps/dealer run test`

Then run `npm -ws run lint --if-present`, `npm -ws run test --if-present`, `npm -ws run build --if-present`.
