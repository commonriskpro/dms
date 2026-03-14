# Architecture Fitness Suite — Spec (Phase 1 + Phase 2)

## Purpose

Codify existing architectural invariants into automated Jest tests so regressions fail fast. This suite does not redesign the system; it enforces rules already present in the codebase and docs.

## Current Guardrails Map (Pre–Phase 1)

| Area | Existing enforcement | Source |
|------|----------------------|--------|
| Dealer route → Prisma | Jest: route files may not import `@/lib/db` | `apps/dealer/tests/architecture/modular-boundaries.test.ts` |
| UI → module db | Jest: app/module UI files may not import `modules/*/db/*` | Same file |
| Cross-module db | Jest: module source may not import another module's `db/*` | Same file |
| lib → module layers | Jest: lib may not import module db/service/ui | Same file |
| Tenant scope | Convention + handler pattern: `getAuthContext` → `ctx.dealershipId` | `.cursorrules`, `lib/api/handler.ts` |
| RBAC | Convention: `guardPermission` / `guardAnyPermission` on protected routes | `.cursorrules`, many route files |
| Platform auth | Convention: `requirePlatformAuth` + `requirePlatformRole` on platform API routes | `apps/platform/lib/platform-auth.ts` |
| App boundaries | Docs only: platform ≠ dealer; mobile → dealer API only; worker → internal bridge | `docs/canonical/ARCHITECTURE_CANONICAL.md` |
| Public serialization | Unit tests: `serializePublicVehicleSummary` does not expose internal fields | `modules/websites-public/tests/serialize.test.ts` |
| Money | Convention + SECURITY.md: cents/BigInt; API string cents; `lib/money.ts` | `.cursorrules`, `lib/money.ts` |
| Shared contracts | Convention: `packages/contracts` for shared Zod/types | Used by platform and bridge |

## Invariants Selected for Phase 1

### A. Dealer modular boundaries (strengthen existing)

- **Route → Prisma**: No `app/**/route.ts` imports `@/lib/db`. Allowlist: empty.
- **UI → db**: No app or module UI file imports `@/modules/*/db/*`.
- **Cross-module db**: No module non-db file imports another module's `db/*`. Allowlist: empty.
- **lib ownership**: No `lib/` file imports `@/modules/*/(db|service|ui)/*`. Allowlist: empty.

### B. Tenant-scope invariants

- **No client-supplied dealershipId for tenant scope**: Dealer API routes that derive tenant scope must not take `dealershipId` from request body or query for that purpose. Exception: `api/internal/*` and `api/admin/inventory/vehicle-photos/backfill/*` receive `dealershipId` from trusted internal/admin callers and are documented.
- **Tenant-sensitive routes use server context**: Protected dealer route handlers use `getAuthContext` (or `verifyInternalRequest` for internal, or session/support-session helpers where appropriate). Enforced by listing paths that are allowed to omit auth and asserting all other route files reference an approved context pattern.

### C. RBAC coverage

- **Dealer**: Route files under `app/api` that are not in the "no guard" list must reference `getAuthContext` or `verifyInternalRequest`. High-signal only; no semantic proof.
- **Platform**: Every route under `app/api/platform/**` that is not in a small allowlist (e.g. auth callback) must reference `requirePlatformAuth` or `requirePlatformRole`. Enforced by file scan.

### D. App boundary enforcement

- **Platform → dealer**: `apps/platform` must not import from `apps/dealer` (no cross-app module imports). Enforced by scanning platform source for dealer path/alias.
- **Mobile**: `apps/mobile` must not import from `apps/platform` or dealer server-only internals (e.g. `modules/*/db`, `lib/db`). Enforced by import scan.
- **Worker**: Worker must not import dealer business module internals (e.g. `modules/*/service` from dealer). Worker calls dealer via internal HTTP bridge. Enforced by import scan from repo root for worker app.

### E. Public safety / serialization

- **Public vehicle serializer**: `serializePublicVehicleSummary` / `serializePublicVehicleDetail` must not expose internal-only fields (e.g. `purchasePriceCents`, `dealershipId`, internal UUIDs). Already covered by existing unit tests; suite can add a small structural check that public serializer files exist and are used from public routes.
- **No raw BigInt in public JSON**: Public-facing serializers must not return raw BigInt; use string cents. Checked in money + public-safety tests.

### F. Money / numeric discipline

- **API money as string cents**: Critical dealer API serializers (deals, inventory, public vehicle) must not emit raw `BigInt` in JSON; use string. Pragmatic check on known serializer files.
- **No float-based money in serializers**: Known money fields in serializers should use integer/string cents, not float. High-signal grep/pattern check.

### G. Shared contract discipline (Phase 2)

- **Phase 2**: Dealer files that reference `PublicVehicleSummary` or `PublicVehicleDetail` must import from `@dms/contracts` (no local duplicate type definitions). Enforced in `phase2-fitness.test.ts`.

## Phase 2 Invariants (added after Phase 1)

### H. RBAC permission consistency

- **Dealer routes with auth must use guard**: Route files that use `getAuthContext` (or `requireUser`) must also call `guardPermission` or `guardAnyPermission` unless allowlisted (e.g. `me`, `auth/session`, `dashboard/layout`, `search`, `admin/bootstrap-link-owner`). Enforced in `phase2-fitness.test.ts`.

### I. Cache key shape

- **withCache must use cacheKeys**: Dealer source files that call `withCache(...)` must import key builders from `@/lib/infrastructure/cache/cacheKeys` unless allowlisted. Allowlist: `board.ts`, `inventory-page.ts` (local key helpers), cache test files, and the phase2 test file itself.
- **cacheKeys pattern**: Key builders in `cacheKeys.ts` must follow `dealer:${dealershipId}:cache:{resource}:...`. Enforced in `phase2-fitness.test.ts`.

### J. Event payload shape

- **emitEvent payloads must include dealershipId**: Non-test dealer source files that call `emitEvent(...)` must include `dealershipId` in the payload object (within the same call block). Enforced in `phase2-fitness.test.ts`.

## Intentionally Out of Scope

- Perfect semantic proof of RBAC (which route "should" have which permission).
- Full contract deduplication across all apps.
- Any change to testing stack (Jest only).
- Heavy new tooling (e.g. custom ESLint plugins); use file-scan tests only.

## Known Blind Spots

- Routes that use `getSessionContextOrNull` for optional auth (e.g. session endpoint) are treated as "auth pattern present."
- Internal job routes receive `dealershipId` in body from worker; that is trusted caller, not client.
- Some platform routes (e.g. auth callback) may not call `requirePlatformAuth`; allowlist used.
- Cross-repo app-boundary tests run from monorepo root; worker/mobile paths are relative to their app roots in scans.

## Enforcement Mechanism

- **Jest** only. Tests live under `apps/dealer/tests/architecture/` for dealer-focused rules; repo-root or app-specific patterns for app-boundary and platform RBAC as needed.
- **File/string scans**: `readFileSync` + regex or simple AST-free parsing. No new run-time dependencies.
- **Allowlists**: Explicit, small, and documented in test files and this spec. New violations fail the suite; new exceptions require updating the allowlist and this doc.

## References

- `.cursorrules` — API pattern, RBAC, money, layering.
- `docs/canonical/ARCHITECTURE_CANONICAL.md` — App boundaries, tenancy, worker.
- `apps/dealer/docs/MODULAR_BOUNDARY_HARDENING_SPEC.md` — Dealer modular rules.
- `apps/dealer/lib/api/handler.ts` — getAuthContext, guardPermission.
- `apps/platform/lib/platform-auth.ts` — requirePlatformAuth, requirePlatformRole.
