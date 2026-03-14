# Architecture Fitness Suite — Phase 1 + Phase 2 Report

## Summary

Phase 1 added an automated architecture fitness suite under `apps/dealer/tests/architecture/`. Phase 2 added four further invariant groups: shared contract discipline, RBAC permission consistency, cache key shape, and event payload shape. All invariants are enforced by Jest file-scan tests. No new runtime tooling; tests run with existing `test:dealer` (and targeted `test:dealer:architecture` from repo root).

## Files Added / Changed

### Added

| File | Purpose |
|------|--------|
| `docs/ARCHITECTURE_FITNESS_SUITE_SPEC.md` | Spec: invariants, scope, blind spots, enforcement |
| `docs/ARCHITECTURE_FITNESS_SUITE_REPORT.md` | This report |
| `apps/dealer/tests/architecture/helpers.ts` | Shared helpers: listFiles, toRelative, readFile, REPO_ROOT |
| `apps/dealer/tests/architecture/tenant-invariants.test.ts` | Tenant-scope: no client dealershipId for scope; protected routes use auth context |
| `apps/dealer/tests/architecture/rbac-coverage.test.ts` | Platform API routes use requirePlatformAuth/requirePlatformRole |
| `apps/dealer/tests/architecture/app-boundaries.test.ts` | Platform ≠ dealer imports; mobile ≠ platform/dealer server; worker ≠ dealer module service/db |
| `apps/dealer/tests/architecture/public-safety.test.ts` | Public vehicle serializer: no internal fields; price as string |
| `apps/dealer/tests/architecture/money-discipline.test.ts` | Deals serializer string cents; lib/money exports; no float in serializers |
| `apps/dealer/tests/architecture/phase2-fitness.test.ts` (Phase 2) | Shared contracts; RBAC guard consistency; cache key import + pattern; event payload dealershipId |

### Modified

| File | Change |
|------|--------|
| `apps/dealer/tests/architecture/modular-boundaries.test.ts` | Use shared helpers (listFiles, toRelative, isTestFile, readFile) |
| `package.json` | Added script `test:dealer:architecture` |

## Tests Added

| Suite | Tests |
|-------|--------|
| modular-boundaries.test.ts | 4 (route→Prisma, UI→db, cross-module db, lib→module) |
| tenant-invariants.test.ts | 2 (no client dealershipId for scope; protected routes use auth) |
| rbac-coverage.test.ts | 1 (platform routes use platform auth) |
| app-boundaries.test.ts | 3 (platform, mobile, worker boundaries) |
| public-safety.test.ts | 2 (no internal fields; price as string) |
| money-discipline.test.ts | 3 (deals serialize string cents; lib/money; no float) |
| phase2-fitness.test.ts | 5 (shared contracts; RBAC guard; cache key import; cache key pattern; event payload) |
| **Total** | **20 tests** |

## Commands Run and Results

From repo root:

```bash
npm run test:dealer:architecture
```

- **Result**: PASS (7 suites, 20 tests including Phase 2).

```bash
npm run test:dealer -- tests/architecture
```

- **Result**: PASS (same).

## Explicit Exceptions (Allowlists)

- **Tenant / dealershipId in payload**: `internal/*`, `admin/inventory/vehicle-photos/backfill/*`, `auth/session/switch/*` (membership-validated switch).
- **Auth pattern**: Routes under `public/`, `invite/`, `apply/`, `auth/`, `support-session/`, `webhooks/`, `health/`, `metrics/`, `cache/`, `internal/` are not required to use getAuthContext. Routes using `requireUser` (e.g. admin/bootstrap-link-owner) satisfy the “auth pattern” check.
- **Platform RBAC**: Routes under `auth/callback/`, `auth/logout/`, `auth/forgot-password/`, `auth/reset-password/`, `auth/verify-email/`, `auth/debug/`, `bootstrap/` are allowlisted from requirePlatformAuth check.
- **Phase 2 RBAC**: Routes under `me/`, `me/current-dealership/`, `me/dealerships/`, `auth/session/`, `dashboard/layout/`, `dashboard/layout/reset/`, `admin/bootstrap-link-owner/`, `search/` are allowlisted from guardPermission requirement.
- **Phase 2 cache key**: `board.ts`, `inventory-page.ts`, `cacheHelpers.ts`, and cache test files are allowlisted from “must import cacheKeys” when using withCache.

## Recommended Next Expansions (Phase 3)

1. **Migrate allowlisted cache usage**: Move `board.ts` and `inventory-page.ts` to use key builders from `cacheKeys.ts` (e.g. add `boardKey(dealershipId)` and inventory-overview keys) and remove from allowlist.
2. **RBAC permission map**: Optionally maintain a route path → expected permission key map and assert guardPermission(..., key) (high maintenance; only if needed).
3. **More shared contract checks**: Extend to other contract types (e.g. platform applications, invite) where `@dms/contracts` has a canonical shape.

## Quality Gates

- Architecture tests: **PASS** (run via `npm run test:dealer:architecture` or `npm run test:dealer -- tests/architecture`).
- Lint (changed files): **PASS** (no linter errors in `tests/architecture/`).
- Typecheck: Pre-existing failures in dealer (e.g. dashboard test types, removed internal routes) remain; no new failures from this suite.
- Full dealer test suite: run `npm run test:dealer` to confirm no regressions elsewhere (recommended before merge).
