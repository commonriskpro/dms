# Architecture Canonical

This document should be read together with [ARCHITECTURE_DECISIONS_CANONICAL.md](./ARCHITECTURE_DECISIONS_CANONICAL.md), which fixes the deploy branch, rule source, platform control-plane boundary, and async execution model.

## 1. Repository Shape

Top-level workspaces:
- `apps/dealer`: primary dealer-facing product, Next.js App Router, Prisma schema, most business logic.
- `apps/platform`: platform control-plane app, separate Next.js app and separate Prisma schema.
- `apps/mobile`: Expo/React Native mobile client for dealer workflows.
- `apps/worker`: standalone BullMQ worker process.
- `packages/contracts`: shared Zod schemas and response/request contracts used primarily by the platform app and internal dealer/platform bridge.

Root orchestration:
- Package manager: `npm@11.0.0`
- Node engine: `24.x`
- Workspaces: `apps/*`, `packages/*`
- Root build entrypoint: `scripts/vercel-build.js`
- Root deployment config: `vercel.json`
- Root CI migration workflow: `.github/workflows/deploy.yml`
- Canonical deploy branch: `main`
- Canonical rule source: `.cursorrules`

## 2. Primary Architectural Pattern

Dealer app pattern:
- Modular monolith.
- Most business domains are under `apps/dealer/modules/<domain>/`.
- Common module shape: `db/`, `service/`, `ui/`, `tests/`.

Dealer request flow pattern:
1. Next.js route handler under `apps/dealer/app/api/...`
2. Auth and tenant resolution through `apps/dealer/lib/api/handler.ts`
3. Permission checks via `guardPermission` or `guardAnyPermission`
4. Zod validation
5. Domain service under `apps/dealer/modules/*/service`
6. Prisma access through service/db layer
7. JSON response

Platform app pattern:
- Separate control-plane app with its own DB.
- Platform routes live under `apps/platform/app/api/platform/*`.
- Platform auth is independent from dealer tenancy.
- Platform roles are enforced with `requirePlatformAuth()` plus `requirePlatformRole(...)`.
- This is the canonical location for future platform/admin/operator growth.

Mobile pattern:
- Thin client over dealer APIs.
- Uses Supabase auth directly and calls dealer routes with Bearer tokens.
- No independent backend.

Worker pattern:
- Separate Node process with BullMQ queue consumers.
- Queue definitions exist and dealer app can enqueue jobs when Redis is configured.
- Worker consumers call signed dealer internal job endpoints so tenant-aware business writes stay inside the dealer app.
- BullMQ is the canonical execution layer for background work.
- Postgres remains the durable workflow-state layer for progress, auditability, and user-visible status.
- Current worker behavior is real for the shipped queues, with remaining risk concentrated in rollout/operations rather than placeholder handlers.

## 3. App Boundaries

### `apps/dealer`

Responsibility:
- Dealer-facing UI.
- Dealer API surface.
- Dealer tenancy, RBAC, onboarding, inventory, CRM, deals, finance, documents, reporting, and internal platform-bridge endpoints.

Key directories:
- `app/(app)`: authenticated dealer UI.
- `app/api`: dealer/public/internal API routes.
- `lib`: shared auth, tenant, RBAC, API helpers, monitoring, infra helpers.
- `modules`: dealer business domains.
- `prisma`: primary dealer schema and seed.

### `apps/platform`

Responsibility:
- Platform operators manage applications, platform dealerships, subscriptions, monitoring, audit, and platform users.
- Calls dealer internal endpoints over signed JWT.

Key directories:
- `app/(platform)/platform/*`: platform UI routes.
- `app/api/platform/*`: platform APIs.
- `lib`: platform auth, audit, DB services, internal dealer bridge, monitoring, email.
- `prisma`: platform schema.

### `apps/mobile`

Responsibility:
- Dealer mobile access to dashboard, inventory, customers, deals, auth, and dealership switching.

Important constraint:
- Talks only to dealer APIs, not platform APIs.

### `apps/worker`

Responsibility:
- Consume Redis/BullMQ queues:
  - analytics
  - bulk import
  - vin decode
  - alerts

Current state:
- Queue and worker process structure is real.
- Business execution is real for:
  - bulk import processing
  - analytics cache invalidation and signal recomputation
  - alerts/signal refresh
  - VIN follow-up cache warming and decode attachment
- Worker depends on dealer internal job endpoints and shared JWT secret configuration.

## 4. Data Topology

There are two Prisma databases, not one.

Dealer database:
- File: `apps/dealer/prisma/schema.prisma`
- 96 models.
- Stores business tenant data and dealer-side access control.

Platform database:
- File: `apps/platform/prisma/schema.prisma`
- 11 models.
- Stores control-plane entities such as platform users, applications, platform dealerships, subscriptions, audit, and monitoring state.

Bridge between the two:
- `apps/platform/lib/call-dealer-internal.ts`
- Dealer internal endpoints under `apps/dealer/app/api/internal/*`
- Signed JWT secret: `INTERNAL_API_JWT_SECRET`
- Mapping table lives in platform DB: `DealershipMapping`

## 5. Tenancy Model

Dealer-side tenancy is code-backed and centered on `dealershipId`.

Resolution path:
- Web: encrypted active-dealership cookie.
- Mobile/API bearer mode: Supabase Bearer token, then dealership resolution from stored active dealership or membership fallback.

Core files:
- `apps/dealer/lib/auth.ts`
- `apps/dealer/lib/tenant.ts`
- `apps/dealer/lib/api/handler.ts`

Important behavior:
- Tenant scope is server-derived, never trusted from client payloads.
- Business tables are keyed by `dealershipId`.
- Cross-tenant lookups are generally normalized to `NOT_FOUND` in services/tests.
- Platform support access now flows through the standalone platform app and dealer support-session/internal bridge endpoints rather than dealer-hosted `/platform/*` pages.

Lifecycle states:
- `ACTIVE`
- `SUSPENDED`
- `CLOSED`

Effects:
- Non-platform users lose normal tenant access when a dealership is suspended/closed.
- Session helpers expose lifecycle state back to the UI.

## 6. Auth and RBAC

### Dealer auth

Provider:
- Supabase Auth

Patterns:
- Cookie-backed server session for web.
- Bearer token support for mobile and API callers.
- Profile rows are auto-created if missing.

Core files:
- `apps/dealer/lib/auth.ts`
- `apps/dealer/lib/rbac.ts`
- `apps/dealer/lib/constants/permissions.ts`

RBAC model:
- Membership-scoped roles.
- Role-to-permission mapping via `RolePermission`.
- User-specific role attachments via `UserRole`.
- User-specific permission overrides via `UserPermissionOverride`.
- Final effective permissions are a union of applicable grants and overrides.
- Canonical dealer permission vocabulary is defined in `apps/dealer/lib/constants/permissions.ts`.
- Canonical naming rules are:
  - `domain.read`
  - `domain.write`
  - `domain.subdomain.read`
  - `domain.subdomain.write`
- Intentional dealer exceptions currently kept in the canonical model:
  - `reports.export`
  - `admin.settings.manage`
  - `inventory.auctions.read`
  - `inventory.publish.write`
- Dealer-side `platform.*` permission strings are not part of the canonical runtime model.
- Existing non-reset databases are normalized through `apps/dealer/scripts/normalize-rbac-permissions.ts`.

### Platform auth

Provider:
- Separate Supabase session plus `platformUser` DB row lookup.

Roles:
- `PLATFORM_OWNER`
- `PLATFORM_COMPLIANCE`
- `PLATFORM_SUPPORT`

Core file:
- `apps/platform/lib/platform-auth.ts`

Important distinction:
- Platform web app auth uses the platform DB `PlatformUser` table and platform roles.
- Dealer-side platform compatibility now consists of invite/support bridge endpoints only; it does not keep a separate dealer `PlatformAdmin` overlay anymore.
- The canonical platform control plane is `apps/platform`; dealer-hosted platform pages and public `/api/platform/*` control-plane routes were removed in the cutover.

## 7. Server and Client Boundaries

Dealer:
- Next.js App Router with server components and route handlers.
- Client components exist mainly in UI-heavy screens and forms.
- Domain rules live in services, not in client components.

Platform:
- Similar App Router split.
- Server routes handle control-plane mutations and monitoring.

Mobile:
- Fully client-side app.
- Auth/session persisted in Expo Secure Store.
- API retries on 401 after refresh attempt.

## 8. Background Processing and Async Work

Canonical async rule:
- BullMQ handles execution.
- Postgres handles durable workflow state.
- New async features should not introduce new DB-polling runners as their primary execution path.

### Dealer in-process/background patterns

Implemented:
- CRM automation and job execution persisted in dealer DB:
  - `Job`
  - `DealerJobRun`
  - `DealerJobRunsDaily`
  - `AutomationRule`
  - `AutomationRun`
- Job runner service:
  - `apps/dealer/modules/crm-pipeline-automation/service/job-worker.ts`

Current classification:
- The Postgres workflow tables are canonical durable state.
- CRM execution is now BullMQ-triggered, while the existing Postgres claim/retry loop remains the implementation behind the worker-triggered dealer internal CRM endpoint.

### Redis/BullMQ patterns

Implemented:
- Queue enqueue helpers in dealer app.
- Redis connection helper.
- Separate worker app bootstrapping and queue registration.

Implemented:
- Queue handlers execute by calling dealer internal job endpoints under `apps/dealer/app/api/internal/jobs/*`.
- Dealer internal job routes persist `DealerJobRun` telemetry for worker-triggered executions.
- CRM execution now includes a dedicated `crmExecution` BullMQ queue and worker-triggered dealer internal CRM endpoint.
- Bulk import uses the same dealer-side execution path for Redis and no-Redis flows.

Remaining limitations:
- Worker is operationally coupled to the dealer app being reachable at `DEALER_INTERNAL_API_URL`.
- The repo does not prove every live environment is actually running the worker process.
- Some producer no-Redis fallbacks still exist as transitional compatibility behavior.

## 9. Observability and Operations

Implemented:
- Health endpoints in dealer and platform apps.
- Request logging helper docs and usage pattern via `withApiLogging`.
- Dealer metrics endpoint.
- Platform monitoring endpoints for dealer health, job runs, and rate limits.
- Slack and Resend alert paths in platform monitoring flows.

Key files:
- `apps/dealer/app/api/health/route.ts`
- `apps/platform/app/api/health/route.ts`
- `apps/dealer/instrumentation.ts`
- `apps/platform/app/api/platform/monitoring/*`

## 10. Architectural Rules Confirmed in Code

Confirmed:
- Separate dealer and platform DB schemas.
- Tenant-scoped dealer business data.
- Explicit RBAC guards in route handlers.
- Money stored as integer cents/BigInt in dealer data model.
- Shared contracts package exists and is used.
- Signed internal JWT bridge from platform to dealer.
- `main` is the deploy-sensitive branch in the current workflow.
- `.cursorrules` matches the active repo rules; `agent_spec.md` does not.

Confirmed but uneven:
- Request logging helper exists, but not every route is wrapped.
- BullMQ structure and execution are real, but rollout confidence still depends on live env supervision and config discipline.
- CRM execution is now BullMQ-triggered, but its preserved Postgres claim/lock loop still deserves future internal simplification and stronger Redis-backed integration coverage.

Not confirmed as current truth:
- Legacy docs that imply Vitest as the active test runner.
- Legacy guidance preferring `pg-boss`; current code uses BullMQ.
- Legacy claims of external marketplace syndication or Stripe billing.

## 11. Architecture Summary

Current system shape:
- A large dealer modular monolith is the operational core.
- A separate canonical platform control plane in `apps/platform` manages onboarding, provisioning, monitoring, and subscriptions.
- A mobile client consumes only dealer APIs.
- A worker process executes BullMQ jobs by authenticating into dealer internal job endpoints.
- Dealer Postgres models remain the source of truth for workflow state and job telemetry.
- CRM automation now follows the canonical split at the executor boundary: BullMQ triggers execution and Postgres remains the durable job/automation ledger.
