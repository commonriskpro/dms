# Infrastructure Hardening V2 — Architecture Spec

**Date:** 2026-03-06  
**Status:** Approved  
**Scope:** `apps/dealer` (primary), `apps/worker` (new)

---

## 1. Current State

### 1.1 API Route Patterns

The dealer app exposes ~160 API route handlers organized into namespaces:

| Namespace | Routes | Pattern |
|---|---|---|
| `/api/auth/*` | 12 | OAuth callback, session, password-reset, verify-email |
| `/api/me/*` | 3 | Profile, active dealership, memberships |
| `/api/admin/*` | 15 | Dealership management, RBAC, user admin |
| `/api/platform/*` | 10 | Platform admin only (impersonate, pending users) |
| `/api/internal/*` | 8 | Service-to-service (monitoring, provision) |
| `/api/customers/*` | 25 | Full CRUD + timeline + callbacks |
| `/api/deals/*` | 20 | Deal CRUD, desk, finance, lender integration |
| `/api/inventory/*` | 30 | Vehicles, VIN decode, photos, floorplan, alerts, bulk import |
| `/api/crm/*` | 15 | Pipeline, opportunities, automation, sequences |
| `/api/reports/*` | 10 | Sales, finance, pipeline, export |
| `/api/dashboard/*` | 6 | v1/v3 data, layout persistence |
| `/api/documents/*` | 5 | Upload, signed URLs |
| Other | ~15 | Search, files, invite, support-session, health, audit |

**Common route shape:**
```ts
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    // optional: guardPermission(ctx, 'key')
    // optional: checkRateLimit(identifier, type)
    // service call
    return jsonResponse(data);
  } catch (e) {
    return handleApiError(e);
  }
}
```

### 1.2 Service / Module Boundaries

```
apps/dealer/
├── app/api/         ← Route handlers (thin: auth, validation, response)
├── modules/         ← Domain modules (15 total)
│   ├── core/        ← Shared utilities (TTL cache)
│   ├── core-platform/  ← Auth/RBAC/audit/files/user-admin
│   ├── crm-pipeline-automation/
│   ├── customers/
│   ├── dashboard/
│   ├── deals/       ← Deal desk, deal math, pipeline
│   ├── documents/
│   ├── finance-shell/
│   ├── inventory/   ← VIN decode, photos, floorplan, intelligence dashboard
│   ├── lender-integration/
│   ├── platform-admin/
│   ├── provisioning/
│   ├── reports/
│   ├── search/
│   └── settings/
└── lib/             ← Cross-cutting: auth, tenant, rbac, db, audit, rate-limit, logger
```

Each module: `db/` (Prisma queries) + `service/` (business logic) + `ui/` (React components) + `tests/`.

### 1.3 Tenant Isolation

- Every authenticated route resolves `dealershipId` via `getAuthContext()` → `requireDealershipContext()`
- `requireDealershipContext()` checks: active membership, dealership lifecycle (`ACTIVE|SUSPENDED|CLOSED`), `UserActiveDealership` DB table (cookie fallback)
- `auditLog()` always includes `dealershipId` — append-only, PII-redacted
- Rate limit keys: `dealership:{type}:{dealershipId}` for resource-heavy ops (1-hour window)

### 1.4 `instrumentation.ts` Usage

Currently loads Sentry for `nodejs` and `edge` runtimes only:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}
```

Will be extended to initialize Prometheus registry and event bus listeners.

### 1.5 Logging / Metrics Signals

- `lib/logger.ts` — structured JSON per request via `withApiLogging(handler)` (generates `X-Request-Id`, measures duration)
- `lib/rate-limit-events.ts` — records rate limit breach events to DB
- `lib/rate-limit-stats.ts` — aggregates rate limit stats
- `lib/job-run-stats.ts` — aggregates job run stats
- `lib/monitoring/sentry.ts` — Sentry capture (currently stubs)
- **No Prometheus/OpenTelemetry** — gap to be filled

### 1.6 Existing Rate Limiter (`lib/api/rate-limit.ts`)

- In-process `Map<string, {count, resetAt}>` (sliding window)
- 24 `RateLimitType` buckets (auth, upload, vin_decode, customers_list, deals_mutation, etc.)
- Two time windows: 1 min (most types) and 1 hour (dealership-level: vin_decode, valuation, floorplan)
- **Limitation:** per-process only, does not survive restarts, not distributed

### 1.7 Async Operations

Current async/long-running work:
- **VIN decode** — external API call (sync, blocks route handler, ~500ms–2s)
- **Bulk vehicle import** — row-by-row Prisma upsert (sync, can be 100s)
- **Inventory alerts** — analytics job checked via `DealerJobRun` model
- **CRM automation** — `Job` + `DealerJobRun` models; `/api/crm/jobs/run` triggers via cron

**Gap:** No proper job queue — long operations block route handlers or rely on cron scripts.

---

## 2. Target Architecture

### 2.1 Guiding Principles

1. **Infrastructure ≠ depend on modules.** `lib/infrastructure/*` has zero imports from `modules/*`.
2. **Modules may call infrastructure.** `modules/*/service/*.ts` may call job enqueue functions or emit events.
3. **No circular dependencies.** `lib/infrastructure/*` may import from `lib/db`, `lib/logger`, `lib/auth` only.
4. **Redis optional.** All infrastructure degrades gracefully when `REDIS_URL` is absent (in-memory fallback, sync execution).
5. **Non-breaking.** All existing API route signatures, response shapes, and module interfaces remain unchanged.

### 2.2 Integration Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    apps/dealer                          │
│                                                         │
│  app/api/*  ──────►  lib/infrastructure/rate-limit      │
│                              │                          │
│  modules/*/service  ────────►  lib/infrastructure/jobs  │
│                    ────────►  lib/infrastructure/events  │
│                                                         │
│  instrumentation.ts ────────►  lib/infrastructure/metrics│
│  app/api/metrics/route.ts ──►  lib/infrastructure/metrics│
└─────────────────────────────────────────────────────────┘
                                         │
                                         │ BullMQ (Redis)
                                         ▼
                            ┌────────────────────────┐
                            │      apps/worker        │
                            │  queues: vinDecode      │
                            │         bulkImport      │
                            │         analytics       │
                            │         alerts          │
                            └────────────────────────┘
```

### 2.3 Dependency Rules (enforced by module placement)

```
lib/infrastructure/rate-limit   → lib/logger, lib/db (for Redis check only)
lib/infrastructure/events       → lib/logger (no other lib deps)
lib/infrastructure/jobs         → lib/logger, lib/infrastructure/events (optional)
lib/infrastructure/metrics      → (standalone, no internal deps)
```

---

## 3. Module Placement

All infrastructure lives under:

```
apps/dealer/lib/infrastructure/
├── rate-limit/
│   └── rateLimit.ts          ← Redis-aware rate limiter (wraps existing lib/api/rate-limit.ts)
├── events/
│   └── eventBus.ts           ← Node EventEmitter-based domain event bus
├── jobs/
│   ├── enqueueVinDecode.ts   ← Producer: VIN decode job
│   ├── enqueueBulkImport.ts  ← Producer: Bulk import job
│   └── enqueueAnalytics.ts   ← Producer: Analytics/alerts job
└── metrics/
    └── prometheus.ts         ← Prometheus registry + metric helpers
```

---

## 4. Event Model

### 4.1 Domain Events

| Event | Emitted When | Payload |
|---|---|---|
| `vehicle.created` | New vehicle added to inventory | `{ dealershipId, vehicleId, vin? }` |
| `vehicle.updated` | Vehicle fields updated | `{ dealershipId, vehicleId, fields[] }` |
| `vehicle.vin_decoded` | VIN decode completed | `{ dealershipId, vehicleId, vin, source }` |
| `deal.created` | New deal opened | `{ dealershipId, dealId, customerId }` |
| `deal.status_changed` | Deal status transition | `{ dealershipId, dealId, from, to }` |
| `deal.sold` | Deal reaches SOLD status | `{ dealershipId, dealId, amount }` |
| `customer.created` | New customer created | `{ dealershipId, customerId }` |
| `bulk_import.requested` | Bulk import triggered | `{ dealershipId, importId, rowCount }` |
| `analytics.requested` | Analytics job needed | `{ dealershipId, type, context }` |

### 4.2 Payload Contract

```ts
type DomainEventPayload = {
  dealershipId: string;  // REQUIRED on all events
  [key: string]: unknown;
};
```

### 4.3 Event → Job Mapping

```
vehicle.created      → enqueueAnalytics (update inventory dashboard)
vehicle.vin_decoded  → enqueueAnalytics (update VIN stats)
deal.sold            → enqueueAnalytics (update sales metrics)
bulk_import.requested → enqueueBulkImport
analytics.requested  → enqueueAnalytics
```

---

## 5. Worker Architecture (`apps/worker`)

### 5.1 New Workspace

```
apps/worker/
├── package.json          ← "worker" package, bullmq + ioredis deps
├── tsconfig.json
├── src/
│   ├── index.ts          ← Entry point: starts all workers
│   ├── redis.ts          ← ioredis connection singleton
│   ├── queues/
│   │   └── index.ts      ← Queue definitions (shared with dealer producers)
│   └── workers/
│       ├── vinDecode.worker.ts
│       ├── bulkImport.worker.ts
│       ├── analytics.worker.ts
│       └── alerts.worker.ts
```

### 5.2 Queue Definitions

| Queue | Concurrency | Job Data |
|---|---|---|
| `vinDecode` | 5 | `{ dealershipId, vehicleId, vin }` |
| `bulkImport` | 2 | `{ dealershipId, importId, rows[] }` |
| `analytics` | 10 | `{ dealershipId, type, context }` |
| `alerts` | 5 | `{ dealershipId, ruleId, triggeredAt }` |

### 5.3 Sync Fallback

All producers in `lib/infrastructure/jobs/enqueue*.ts` check `REDIS_URL`:
- **Redis available** → push to BullMQ queue
- **No Redis** → execute job logic synchronously (imported handler function)

This ensures local dev and test environments work without Redis.

---

## 6. Metrics

### 6.1 Prometheus Metrics

| Metric | Type | Labels |
|---|---|---|
| `api_request_duration_ms` | Histogram | `route`, `method`, `status_code` |
| `db_query_duration_ms` | Histogram | `operation`, `model` |
| `vin_decode_duration_ms` | Histogram | `source`, `cache_hit` |
| `inventory_query_duration_ms` | Histogram | `query_type` |
| `deal_save_duration_ms` | Histogram | `operation` |
| `rate_limit_breaches_total` | Counter | `type`, `dealership_id` |
| `job_enqueue_total` | Counter | `queue` |
| `job_process_duration_ms` | Histogram | `queue`, `status` |

### 6.2 `recordApiMetric(route, duration, status?)`

Helper that observes into `api_request_duration_ms`. Called from `withApiLogging` or route middleware.

### 6.3 Metrics Endpoint

`GET /api/metrics` — platform admin only, returns Prometheus text format, `Content-Type: text/plain; version=0.0.4; charset=utf-8`.

---

## 7. Acceptance Criteria

| # | Criterion |
|---|---|
| A1 | All existing API routes return identical response shapes |
| A2 | Rate limiting: 429 returned on breach; existing `checkRateLimit` callers unaffected |
| A3 | Events emitted in inventory/deals service calls without breaking sync response |
| A4 | Job producers execute sync fallback when `REDIS_URL` absent (unit-testable) |
| A5 | Metrics endpoint returns valid Prometheus text format |
| A6 | No circular dependencies (`lib/infrastructure` ← modules) |
| A7 | `apps/worker` builds with `tsc --noEmit` |
| A8 | All existing tests pass; new tests added for each infrastructure module |
| A9 | `withRateLimit` wrapper composes cleanly with `getAuthContext` |
| A10 | `npm run build` in `apps/dealer` succeeds with no type errors |

---

## 8. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `REDIS_URL` | No | Redis connection for BullMQ + rate limiter. Falls back to in-memory. |
| `METRICS_SECRET` | Recommended | Secret for metrics endpoint auth (fallback: platform admin check) |

---

*Generated by Infrastructure Hardening V2 — Architect phase, 2026-03-06*
