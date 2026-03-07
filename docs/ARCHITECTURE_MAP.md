# DMS Architecture Map

This document describes the repository architecture as discovered from the codebase. It is the single reference for applications, shared packages, modules, infrastructure, and cross-cutting concerns.

---

## 1. System Overview

The DMS (Dealer Management System) is a monorepo containing:

- **Applications**: `apps/dealer` (main dealer SaaS), `apps/platform` (platform admin), `apps/mobile` (React Native/Expo), `apps/worker` (background jobs).
- **Shared packages**: `packages/contracts` (Zod schemas and types shared across apps).
- **Domain modules**: Live under `apps/dealer/modules/`. Each module owns db, service, and optionally ui/tests. Routes in `apps/dealer/app/api/` call module services only; no route imports db directly.
- **Infrastructure**: Centralized in `apps/dealer/lib/` (auth, tenant, RBAC, audit, API handler, cache, event bus, metrics, jobs). No module imports another module’s db layer; cross-module coordination is via service-to-service or domain events.

**Stack (pinned):** Next.js 16.1.6, React 19.2.4, TypeScript (strict), Prisma 6.7.0, Supabase (Auth + Storage + Postgres), Zod 3.25.76, shadcn/ui + Tailwind, Jest, Node 24.x.

---

## 2. Applications

| Application    | Path               | Purpose                                                                 |
|----------------|--------------------|-------------------------------------------------------------------------|
| **dealer**     | `apps/dealer/`     | Main dealer-facing SaaS: inventory, customers, deals, CRM, reports, dashboard, auth, admin (roles/memberships). Next.js App Router. |
| **platform**   | `apps/platform/`   | Platform admin app (dealerships, users, invites). Next.js, own Prisma.  |
| **mobile**     | `apps/mobile/`     | React Native (Expo); shares auth and API with dealer.                   |
| **worker**     | `apps/worker/`     | Background job runner (e.g. BullMQ/pg-boss consumers).                |

All API and module structure described below refers to **apps/dealer** unless stated otherwise.

---

## 3. Shared Packages

| Package      | Path                   | Contents                                                                 |
|-------------|------------------------|--------------------------------------------------------------------------|
| **contracts** | `packages/contracts/` | Shared Zod schemas and types. Exports: `platform/` (applications, monitoring, users, dealerships, audit), `internal/` (owner-invite, provision), `dealer/` (invite, monitoring), `constants`. Consumed by dealer and platform for API contracts. |

---

## 4. Module Architecture

Modules live under `apps/dealer/modules/`. Each follows:

- **db/** — Prisma query functions only (tenant-scoped by `dealershipId`).
- **service/** — Business logic; calls db and may emit domain events or call other modules’ services.
- **ui/** — React components/pages for the module (optional).
- **tests/** or **service/__tests__** — Jest tests.

**Modules (as found in repo):**

| Module                    | Directory                          | DB | Service | UI | Notes |
|---------------------------|------------------------------------|----|---------|----|-------|
| core                      | `modules/core/`                    | —  | —       | —  | Cache (ttl-cache), tests for cache/events/jobs/metrics/rate-limit. |
| core-platform             | `modules/core-platform/`           | ✓  | ✓       | ✓  | Dealership, membership, role, permission, file, audit, user-admin; platform UI (DealershipPage, RolesPage, UsersPage, etc.). |
| crm-pipeline-automation   | `modules/crm-pipeline-automation/`| ✓  | ✓       | ✓  | Pipelines, stages, opportunities, sequences, automation rules, jobs, journey bar. |
| customers                 | `modules/customers/`               | ✓  | ✓       | ✓  | Customers, notes, tasks, activity, timeline, callbacks, last-visit, saved filters/searches, team-activity. |
| dashboard                 | `modules/dashboard/`               | —  | ✓       | ✓  | Dashboard V3 data, layout persistence, merge layout, widget registry; config/schemas. |
| deals                     | `modules/deals/`                   | ✓  | ✓       | ✓  | Deal CRUD, calculations, pipeline, fees, trade, history, deal-desk. |
| documents                 | `modules/documents/`               | ✓  | ✓       | ✓  | Deal documents, upload, signed URLs. |
| finance-shell             | `modules/finance-shell/`            | ✓  | ✓       | ✓  | Finance shell per deal, CONTRACTED lock, calculations; listens to `deal.status_changed`. |
| inventory                  | `modules/inventory/`               | ✓  | ✓       | ✓  | Vehicle, VIN decode, bulk import, floorplan, recon, alerts, book values, dashboard, photos. |
| lender-integration        | `modules/lender-integration/`      | ✓  | ✓       | ✓  | Applications, submissions, stipulations, lenders; listens to `deal.status_changed`. |
| platform-admin            | `modules/platform-admin/`          | ✓  | ✓       | —  | Invite, pending-users; used by platform routes and dealer invite flows. |
| provisioning              | `modules/provisioning/`            | —  | ✓       | —  | Dealership provisioning (service only). |
| reports                   | `modules/reports/`                 | ✓  | ✓       | ✓  | Sales summary, finance penetration, inventory aging, mix, pipeline, export. |
| search                    | `modules/search/`                  | —  | ✓       | ✓  | Global search (customers, deals, inventory); permission-gated, uses other modules’ db. |
| settings                  | `modules/settings/`                | —  | —       | ✓  | Settings UI (e.g. SessionsBlock, SettingsContent). |

---

## 5. Layer Responsibilities

- **Route handler** (`app/api/**/route.ts`): Validates input (Zod), calls `getAuthContext` (or `requirePlatformAdmin` for platform routes), `guardPermission`, then **service layer only**. Returns `jsonResponse` or `handleApiError`; never imports db or Prisma directly.
- **Service**: Business logic, orchestration, audit logging, domain events. Calls **db layer** of its own module only; may call other modules’ **services** or react to events.
- **DB**: Prisma queries only; every query scoped by `dealershipId` (and other tenant context). No business logic.
- **UI**: Calls API routes (fetch); never imports service or db. Uses shared `components/` and `lib/ui/` tokens.

---

## 6. Infrastructure Systems

All under `apps/dealer/lib/` (and `lib/infrastructure/`).

| System      | Key locations / functions | Responsibility |
|------------|----------------------------|----------------|
| **Auth**   | `lib/auth.ts`               | `getCurrentUser`, `getCurrentUserFromRequest`, `requireUser`, `requireUserFromRequest`, `getOrCreateProfile`. Supabase session (cookie) or Bearer token. |
| **API handler** | `lib/api/handler.ts` | `getAuthContext`, `getSessionContextOrNull`, `guardPermission`, `guardAnyPermission`, `jsonResponse`, `handleApiError`, `getRequestMeta`. |
| **Tenant** | `lib/tenant.ts`             | `getFirstActiveDealershipIdForUser`, `getStoredActiveDealershipId`, `getActiveDealershipId`, `requireDealershipContext`, `getSessionDealershipInfo`. Cookie + membership; platform admin can impersonate. |
| **RBAC**   | `lib/rbac.ts`               | `getDealerAuthContext`, `loadUserPermissions`, `requirePermission`. Role union + membership role + user permission overrides. |
| **Platform admin** | `lib/platform-admin` (e.g. `isPlatformAdmin`, `requirePlatformAdmin`) | DB-backed platform admin check; used by `/api/platform/*` before any handler logic. |
| **Audit**  | `lib/audit.ts`              | `auditLog`. Append-only; metadata sanitized (no PII). |
| **DB**     | `lib/db.ts`, `lib/db/*.ts`  | Singleton Prisma client; `paginate`, `common-selects`, `date-utils`, `update-helpers`. |
| **Cache**  | `lib/infrastructure/cache/`  | `cacheClient.ts` (get/set/del/delPrefix; Redis or in-memory TTL), `cacheKeys.ts` (tenant-safe key builders), `cacheHelpers.ts`, `cacheInvalidation.ts` (event-driven invalidation). |
| **Event bus** | `lib/infrastructure/events/eventBus.ts` | `emitEvent`, `registerListener`, `clearListeners`, `getListenerCount`. Synchronous dispatch; all payloads include `dealershipId`. |
| **Metrics** | `lib/infrastructure/metrics/prometheus.ts` | Prometheus registry; API duration, DB duration, VIN decode, inventory/deal metrics, rate-limit breaches. |
| **Jobs**   | `lib/infrastructure/jobs/`   | `redis.ts` (BullMQ connection), `enqueueAnalytics`, `enqueueBulkImport`, `enqueueVinDecode`. Job payloads include `dealershipId`. |
| **Rate limit** | `lib/api/rate-limit.ts`  | `checkRateLimit`, `incrementRateLimit`; applied to auth, VIN decode, upload, finance session. |
| **Validation** | `lib/api/validate.ts`     | `validationErrorResponse` for Zod. |
| **Pagination** | `lib/api/pagination.ts`   | `parsePagination` (default limit 25, max 100). |

---

## 7. Security Model

- **Authentication**: Supabase Auth (cookie for web, Bearer for mobile). Profile created/linked via `getOrCreateProfile`.
- **Tenancy**: Every business table has `dealership_id`; all queries scoped by `ctx.dealershipId` from session. Cross-tenant ID returns 404 (NOT_FOUND).
- **Authorization**: `guardPermission(ctx, "module.action")` on every route. Permission format: `inventory.read`, `deals.write`, `finance.read`, `reports.export`, `admin.roles.write`, etc. No client-supplied `dealership_id` for auth; platform routes use `requirePlatformAdmin()` first.
- **Platform routes**: `/api/platform/*` — `requirePlatformAdmin()` before handler logic; non-platform users get 403.
- **Audit**: Required for create/update/delete of Vehicle, Customer, Deal, DealFinance, Document, Role, Membership, etc.; and for signed URL access and sensitive reads.

---

## 8. Event System

- **Defined in**: `lib/infrastructure/events/eventBus.ts`. Typed `DomainEventMap`; all payloads include `dealershipId`.
- **Events**: `vehicle.created`, `vehicle.updated`, `vehicle.vin_decoded`, `deal.created`, `deal.status_changed`, `deal.sold`, `customer.created`, `customer.task_completed`, `bulk_import.requested`, `analytics.requested`, `opportunity.created`, `opportunity.stage_changed`, `opportunity.status_changed`.
- **Emitters**: inventory (vehicle, bulk, vin-decode), deals (deal), customers (customer, task), crm-pipeline-automation (opportunity).
- **Consumers**: Cache invalidation (vehicle/deal/customer events); lender-integration and finance-shell (`deal.status_changed`); crm-pipeline-automation automation-engine (opportunity/task events); instrumentation (enqueue analytics/bulk import).

---

## 9. Cache Layer

- **Client**: Redis when `REDIS_URL` set; else in-memory TTL cache (`modules/core/cache/ttl-cache`). Keys tenant-prefixed: `dealer:{dealershipId}:cache:...`.
- **Key helpers**: `cacheKeys.ts` — dashboard KPIs, inventory intel, pipeline, reports (with query hash); prefix helpers for invalidation.
- **Invalidation**: `cacheInvalidation.ts` registers listeners for vehicle.created/updated, deal.sold, customer.created, deal.status_changed; invalidates by prefix so tenant data stays isolated.

---

## 10. Background Jobs

- **Queue**: BullMQ (Redis). Connection in `lib/infrastructure/jobs/redis.ts`.
- **Producers**: `enqueueAnalytics`, `enqueueBulkImport`, `enqueueVinDecode`. Wired in `instrumentation.ts` from event bus (vehicle.created, vehicle.vin_decoded, deal.sold, bulk_import.requested, analytics.requested).
- **Payload**: All include `dealershipId`. Jobs must be idempotent where possible.

---

## 11. Financial Rules

- **Money**: Stored as BIGINT cents; API uses string cents. No float math; use `lib/money` for format/parse only.
- **CONTRACTED**: When `Deal.status === "CONTRACTED"`, finance shell is locked (finance-shell lock service); no edits to financial fields/fees/trades; only status → CANCELED allowed. Enforced in service layer; 409 on mutation attempts.

---

## 12. Performance Rules

- **Pagination**: All list endpoints use `parsePagination`; default limit 25, max 100.
- **Queries**: Indexed on `dealership_id`, FKs, status, created_at; no unbounded findMany; N+1 avoided via batch/createMany/grouped queries.
- **Cache**: Used for dashboard, inventory intel, pipeline, reports; invalidated on domain events.

---

## 13. Feature Implementation Flow

1. **Schema**: Prisma model (dealership_id, created_at, updated_at; indexes).
2. **DB**: Module `db/` functions (tenant-scoped).
3. **Service**: Module `service/` (calls db, audit, events).
4. **API**: Route in `app/api/` (getAuthContext, guardPermission, validate, call service, jsonResponse).
5. **UI**: Components call API; loading/empty/error states; tokens-only styling.

---

*Generated from repo scan. Do not invent modules or services; update this doc when structure changes.*
