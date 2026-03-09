# DMS Architecture Map

> Superseded: canonical architecture documentation now lives in [`docs/canonical/INDEX.md`](./canonical/INDEX.md) and [`docs/canonical/ARCHITECTURE_CANONICAL.md`](./canonical/ARCHITECTURE_CANONICAL.md). This file is retained for historical reference and may drift from current code.

Reference for applications, packages, modules, and infrastructure. All rules in `.cursorrules`.

## Applications

| Application | Path | Purpose |
|-------------|------|---------|
| **dealer** | `apps/dealer/` | Main dealer SaaS. Next.js App Router. Inventory, customers, deals, CRM, reports, dashboard, auth, admin. |
| **platform** | `apps/platform/` | Platform admin (dealerships, users, invites). Next.js, own Prisma. |
| **mobile** | `apps/mobile/` | React Native (Expo). Shares auth and API with dealer. |
| **worker** | `apps/worker/` | Background job runner (BullMQ consumers). |

## Shared Packages

**contracts** (`packages/contracts/`) — Shared Zod schemas + types. Exports: `platform/` (applications, monitoring, users, dealerships, audit), `internal/` (owner-invite, provision), `dealer/` (invite, monitoring), `constants`. Consumed by dealer and platform.

## Modules

All under `apps/dealer/modules/`. Each: `db/` (Prisma queries, tenant-scoped) · `service/` (business logic) · `ui/` (React, optional) · `tests/`.

| Module | DB | Svc | UI | Notes |
|--------|----|-----|----|-------|
| core | — | — | — | TTL cache fallback; tests for cache/events/jobs/metrics/rate-limit. |
| core-platform | ✓ | ✓ | ✓ | Dealership, membership, role, permission, file, audit, user-admin; platform UI pages. |
| crm-pipeline-automation | ✓ | ✓ | ✓ | Pipelines, stages, opportunities, sequences, automation rules, jobs, journey bar. |
| customers | ✓ | ✓ | ✓ | Customers, notes, tasks, activity, timeline, callbacks, saved filters/searches. |
| dashboard | — | ✓ | ✓ | V3 data aggregation, layout persistence, widget registry. No db layer. |
| dealer-application | ✓ | ✓ | — | Application draft/submit (public + invite), internal list/detail/update; lifecycle; activation. |
| deals | ✓ | ✓ | ✓ | Deal CRUD, calculations, pipeline, fees, trade, history, deal-desk. |
| documents | ✓ | ✓ | ✓ | Deal documents, upload, signed URLs. |
| finance-shell | ✓ | ✓ | ✓ | Finance per deal, CONTRACTED lock, calculations. |
| inventory | ✓ | ✓ | ✓ | Vehicle, VIN decode, bulk import, floorplan, recon, alerts, book values, photos. |
| lender-integration | ✓ | ✓ | ✓ | Applications, submissions, stipulations, lenders. |
| platform-admin | ✓ | ✓ | — | Invite, pending-users; used by platform routes and dealer invite flows. |
| provisioning | — | ✓ | — | Dealership provisioning (service only). |
| reports | ✓ | ✓ | ✓ | Sales summary, finance penetration, inventory aging, mix, pipeline, export. |
| search | — | ✓ | ✓ | Global search (customers, deals, inventory); permission-gated. |
| settings | — | — | ✓ | Settings UI only (SessionsBlock, SettingsContent). |

## Infrastructure (`apps/dealer/lib/`)

| System | Location | Key functions |
|--------|----------|---------------|
| **Auth** | `lib/auth.ts` | `getCurrentUser`, `getCurrentUserFromRequest`, `requireUser`, `requireUserFromRequest`, `getOrCreateProfile`. Supabase session (cookie) or Bearer token. |
| **API handler** | `lib/api/handler.ts` | `getAuthContext`, `getSessionContextOrNull`, `guardPermission`, `guardAnyPermission`, `jsonResponse`, `handleApiError`, `getRequestMeta`. |
| **Tenant** | `lib/tenant.ts` | `getFirstActiveDealershipIdForUser`, `getStoredActiveDealershipId`, `getActiveDealershipId`, `requireDealershipContext`, `getSessionDealershipInfo`. Cookie + membership; platform admin can impersonate. |
| **RBAC** | `lib/rbac.ts` | `getDealerAuthContext`, `loadUserPermissions`, `requirePermission`. Role union + membership role + user permission overrides. |
| **Platform admin** | `lib/platform-admin` | `isPlatformAdmin`, `requirePlatformAdmin`. DB-backed; used by `/api/platform/*` before handler logic. |
| **Audit** | `lib/audit.ts` | `auditLog`. Append-only; metadata sanitized. |
| **DB** | `lib/db.ts`, `lib/db/*.ts` | Singleton Prisma client; `paginate`, `common-selects`, `date-utils`, `update-helpers`. |
| **Cache** | `lib/infrastructure/cache/` | `cacheClient.ts` (get/set/del/delPrefix; Redis or in-memory TTL), `cacheKeys.ts` (tenant-safe builders), `cacheHelpers.ts`, `cacheInvalidation.ts`. |
| **Event bus** | `lib/infrastructure/events/eventBus.ts` | `emitEvent`, `registerListener`, `clearListeners`, `getListenerCount`. |
| **Metrics** | `lib/infrastructure/metrics/prometheus.ts` | Prometheus registry; API/DB duration, VIN decode, inventory/deal metrics, rate-limit breaches. |
| **Jobs** | `lib/infrastructure/jobs/` | `enqueueAnalytics`, `enqueueBulkImport`, `enqueueVinDecode`. Wired via `instrumentation.ts` from event bus. |
| **Rate limit** | `lib/api/rate-limit.ts` | `checkRateLimit`, `incrementRateLimit`. |
| **Validation** | `lib/api/validate.ts` | `validationErrorResponse`. |
| **Pagination** | `lib/api/pagination.ts` | `parsePagination` (default 25, max 100). |

## Event System

Defined in `lib/infrastructure/events/eventBus.ts`. Typed `DomainEventMap`; all payloads include `dealershipId`.

| Event | Emitter | Consumers |
|-------|---------|-----------|
| `vehicle.created` | inventory | cache-invalidation, instrumentation |
| `vehicle.updated` | inventory | cache-invalidation |
| `vehicle.vin_decoded` | inventory | instrumentation |
| `bulk_import.requested` | inventory | instrumentation |
| `deal.created` | deals | — |
| `deal.status_changed` | deals | finance-shell, lender-integration, cache-invalidation |
| `deal.sold` | deals | cache-invalidation, instrumentation |
| `customer.created` | customers | cache-invalidation |
| `customer.task_completed` | customers | crm automation-engine |
| `analytics.requested` | instrumentation | worker |
| `opportunity.created` | crm | crm automation-engine |
| `opportunity.stage_changed` | crm | crm automation-engine |
| `opportunity.status_changed` | crm | crm automation-engine |

## Cache

Redis when `REDIS_URL` set; else in-memory TTL (`modules/core/cache/ttl-cache`). Keys tenant-prefixed: `dealer:{dealershipId}:cache:...`. Key helpers in `cacheKeys.ts` (dashboard KPIs, inventory intel, pipeline, reports with query hash). Invalidation via `cacheInvalidation.ts` — registers listeners for vehicle.created/updated, deal.sold, customer.created, deal.status_changed; invalidates by prefix.

## Background Jobs

Producers: `enqueueAnalytics`, `enqueueBulkImport`, `enqueueVinDecode`. Wired in `instrumentation.ts` from event bus (vehicle.created, vehicle.vin_decoded, deal.sold, bulk_import.requested, analytics.requested). BullMQ connection in `lib/infrastructure/jobs/redis.ts`. All payloads include `dealershipId`.

*Do not invent modules or services. Update when structure changes.*
