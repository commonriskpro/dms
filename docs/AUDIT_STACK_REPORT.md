# DMS Stack Audit Report

**Date:** 2025-03-04  
**Scope:** Full repo (apps/dealer, apps/platform, packages/contracts)  
**Target stack:** Node 24.x, npm 11.x, Next.js 16.x, React 19.x, TypeScript strict, Prisma, Supabase Auth (server-first), Jest, Vercel.

---

## 1. Repo map (summary)

### Next.js app routes

| App | Page routes | API route count | Layouts |
|-----|-------------|----------------|---------|
| **apps/dealer** | 35+ (dashboard, deals, customers, inventory, crm, reports, files, lenders, admin, platform) | 115 route.ts | 11 layouts |
| **apps/platform** | 11 (platform/*, login, applications, dealerships, users, audit, monitoring, bootstrap) | 27 route.ts | 2 layouts |

### API route patterns

- **Dealer:** Uses `withApiHandler` + `getAuthContext()` / `getSessionContextOrNull()` from `lib/api/handler.ts`; auth via `lib/auth.ts` (`requireUser`), tenant via `lib/tenant.ts` (`requireDealershipContext`), RBAC via `lib/rbac.ts` (`requirePermission`). Internal routes under `api/internal/*` use JWT (INTERNAL_API_*).
- **Platform:** Uses `apiHandler` from `lib/api-handler.ts`; auth via `requirePlatformAuth()` / `requirePlatformRole()` from `lib/platform-auth.ts`. Session from Supabase server client (`lib/supabase/server.ts`).

### Service / lib

- **Dealer:** `lib/*` (auth, tenant, rbac, db, audit, api/handler, validate, pagination, supabase/server|browser, money, redact, etc.); domain logic in `modules/*/service/`.
- **Platform:** `lib/*` (platform-auth, platform-users-service, platform-invite-service, check-dealer-health-service, audit, db, monitoring-db, supabase/server|browser|admin, api-handler, call-dealer-internal, etc.).
- **packages/contracts:** Zod schemas and types for dealer (invite, monitoring, internal provision/owner-invite) and platform (applications, audit, dealerships, monitoring, users). Exported from `dist/index.js`.

### Auth / middleware

- **Supabase server client:** `apps/dealer/lib/supabase/server.ts`, `apps/platform/lib/supabase/server.ts`. Callback: `apps/platform/app/api/platform/auth/callback/route.ts` (inline createServerClient).
- **Dealer:** No middleware.ts. Auth in each route via handler. Platform admin: `lib/platform-admin.ts`; impersonation via cookie.
- **Platform:** No middleware.ts. Layout uses `getPlatformUserOrNull()`; unauthenticated users get `PlatformAuthRedirect` to `/platform/login`.

### Prisma

- **Dealer schema:** Multi-tenant; business tables have `dealership_id`. Global/user-scoped: Profile, PendingApproval, PlatformAdmin, Permission, RolePermission, InternalApiJti, DealerRateLimitEvent, DealerRateLimitStatsDaily.
- **Platform schema:** Single-tenant (platform-level). Models: PlatformUser, Application, PlatformDealership, DealershipMapping, PlatformAuditLog, PlatformEmailLog, PlatformInviteLog, PlatformMonitoringEvent, PlatformAlertState. No `dealership_id` on platform tables; Application has optional `dealershipId` (FK to PlatformDealership).

---

## 2. Compatibility audit (current stack)

### Next 16 + React 19

- **Status:** Root overrides pin next 16.1.6, react 19.2.4. Both apps use ^16.1.6 / ^19.2.4.
- **Risks:** Server/client boundary must be correct (no client-only APIs in server components). Dynamic/static: layout uses async `getPlatformUserOrNull()` (dynamic). No deprecated APIs identified in audit.
- **SSR cookie integration:** Platform and dealer use `@supabase/ssr` `createServerClient` with `cookies().getAll()` and `setAll`. Platform server.ts returns `cookieStore.getAll()` (no filtering)—compliant with server-first hybrid.

### Node 24 + npm 11

- **Status:** Root engines `node: "24.x"`, packageManager `npm@11.0.0`. Workspaces: `apps/*`, `packages/*`.
- **Risks:** Ensure `npm ci` is deterministic. Each workspace must declare deps it imports; **platform** uses `@dms/contracts` via `transpilePackages` in next.config but does **not** list it in package.json dependencies—relies on hoisting; non-compliant with “no relying on hoisting.”
- **Build order:** Root vercel-build runs contracts then app; contracts must build first.

### TypeScript strict

- **Status:** Both apps and contracts use TypeScript; strict mode assumed (to be confirmed in tsconfig).
- **Risk:** No loosening; any new code must satisfy strict.

### Jest (no Vitest)

- **Status:** Dealer and platform use Jest (jest in devDependencies). No Vitest in repo.
- **Requirement:** All new tests must be Jest.

### Vercel

- **Status:** Builds fixed per prompt; do not churn unless new blocker. Dispatcher uses VERCEL_PROJECT_NAME; root/build from app dir.

---

## 3. High-risk areas

| Area | Risk | Action |
|------|------|--------|
| Platform missing `@dms/contracts` in package.json | Workspace dep not declared; breaks if hoisting changes | Add `@dms/contracts` to apps/platform/package.json |
| Cookie filtering (platform) | Already removed; server uses getAll() only | Verify no regressions |
| Dealer list endpoints | Pagination and caps must be enforced on every list | Audit each list route for limit/offset or cursor + cap |
| Platform list endpoints | Same | Audit users, applications, dealerships, audit, monitoring lists |
| Internal routes (dealer) | JWT + tenant; no cross-tenant | Verify internal routes validate JWT and scope |
| Audit logging | Critical tables must have audit on create/update/delete | Confirm existing audit coverage; no regressions |
| RBAC | Every protected route must enforce permission | Matrix will mark PASS/FAIL per route |
| Validation | All API inputs (params, query, body) validated with Zod at edge | Matrix will mark per route |
| Log hygiene | No PII/tokens in logs; redact/sanitize | Spot-check logger and error handlers |
| Rate limiting | Auth and sensitive endpoints | Confirm rate limit on login/sensitive paths |

---

## 4. Verification commands (gates)

- **Step 1 gate:** Plan lists high-risk areas and verification commands (this section).
- **Step 2 gate (backend):**
  - `npm ci`
  - `npm -w packages/contracts run build`
  - `npm -w apps/platform run build`
  - `npm -w apps/dealer run build`
  - `npm -w apps/platform run test:ci`
  - `npm -w apps/dealer run test` (or test:ci if present)
- **Step 3 gate (frontend):** Same builds + Jest for touched areas.
- **Step 4 gate (final):**
  - `npm ci`
  - `npm -ws run lint --if-present`
  - `npm -ws run test --if-present`
  - `npm -ws run build --if-present`
