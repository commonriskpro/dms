# Integration DB Connection Stabilization Spec

**Sprint:** Integration DB Connection Stabilization  
**Goal:** Reduce integration-test DB pressure so the full dealer suite can pass honestly (no skip-based solutions).

**Context:**
- Schema drift (AuctionPurchase @@map) fixed; acquisition-engine passes in isolation.
- Full suite: 20 failed suites, 87 failed tests; dominant failure: too many database connections / remaining connection slots reserved (Supabase).

---

## 1. Remaining failing suites (20)

| # | Suite | Primary cause |
|---|-------|----------------|
| 1 | modules/crm-pipeline-automation/tests/integration.test.ts | Timeout / VIN unique / connection |
| 2 | modules/core-platform/tests/platform-admin.test.ts | OOM / connection |
| 3 | modules/core-platform/tests/session-switch.test.ts | Connection exhaustion |
| 4 | modules/core-platform/tests/audit.test.ts | Connection exhaustion |
| 5 | modules/core-platform/tests/rbac.test.ts | Connection exhaustion |
| 6 | modules/core-platform/tests/rbac-dealercenter.test.ts | Connection exhaustion |
| 7 | modules/core-platform/tests/tenant-isolation.test.ts | Connection exhaustion |
| 8 | modules/customers/tests/activity.test.ts | Connection exhaustion |
| 9 | modules/customers/tests/soft-delete.test.ts | Connection exhaustion |
| 10 | modules/customers/tests/timeline-callbacks-lastvisit.test.ts | Connection exhaustion |
| 11 | modules/deals/tests/rbac.test.ts | Connection exhaustion |
| 12 | modules/inventory/tests/acquisition-engine.test.ts | Connection exhaustion (full run only) |
| 13 | modules/inventory/tests/audit.test.ts | Connection exhaustion |
| 14 | modules/inventory/tests/dashboard.test.ts | Connection / shared state |
| 15 | modules/inventory/tests/rbac.test.ts | Connection exhaustion |
| 16 | modules/inventory/tests/tenant-isolation.test.ts | Connection exhaustion |
| 17 | modules/accounting-core/tests/tenant-isolation.test.ts | Connection exhaustion |
| 18 | modules/finance-core/tests/audit.test.ts | Connection exhaustion |
| 19 | modules/reporting-core/tests/dealer-profit.test.ts | Connection exhaustion |
| 20 | modules/reporting-core/tests/tenant-isolation.test.ts | Connection exhaustion |

---

## 2. Where Prisma clients are created

| Location | Usage | Used by tests? |
|----------|--------|-----------------|
| **apps/dealer/lib/db.ts** | Singleton via `globalThis`; `createPrisma()` when missing. Single shared client for app and all tests that import `@/lib/db`. | **Yes** — all integration tests import `prisma` from `@/lib/db`. |
| apps/dealer/prisma/seed.ts | `new PrismaClient()` for seed script | No (script only) |
| scripts/audit-db-schema.ts | `new PrismaClient()` for audit script | No |
| scripts/repair-provisioned-roles.ts | `new PrismaClient()` | No |
| scripts/test-db-connection.mjs | `new PrismaClient()` | No |
| apps/platform/* | Platform app; not used by dealer tests | No |

**Conclusion:** Tests do not create any PrismaClient; they all use the singleton from `@/lib/db`. With `maxWorkers: 1`, one process runs all test files sequentially, so one client and one connection pool for the entire run.

---

## 3. Connection usage and hotspots

- **Current test runtime:** `getDatabaseUrl()` in lib/db.ts appends `connection_limit=2` when `TEST_DATABASE_URL` is set. So the pool has max 2 connections.
- **Holding pattern:** The singleton is created on first import and never disconnected during the test run. So 2 connections are held for the full duration (~120 s for 183 files).
- **Supabase:** Free/tier often has low `max_connections` (e.g. 15–20). Other sessions (dashboard, local dev) can consume slots; 2 connections held for the whole run can contribute to exhaustion when combined with connection churn or other clients.
- **Heavy setup hotspots:** Suites with large `beforeAll` (ensureTestData) that run many upserts: platform-admin.test.ts, crm-pipeline-automation integration.test.ts, dashboard.test.ts, and most integration suites that create dealers/roles/memberships. Each such suite holds the shared client and uses the same pool.

---

## 4. Heavy setup hotspots

- **platform-admin.test.ts:** Single `beforeAll(ensureTestData)` — dealership, profiles, platformAdmin, role, membership. Many queries in sequence.
- **crm-pipeline-automation/tests/integration.test.ts:** Large `ensureTestData()` — dealers, profiles, permissions, roles, memberships, pipelines, stages, opportunities; already has `jest.setTimeout(15000)`.
- **dashboard.test.ts:** Dashboard data setup; can hit shared vehicle/deal state.
- Other integration suites: Similar pattern — one beforeAll that upserts dealers, profiles, roles, then tests run. No per-test disconnect; all share the same pool.

---

## 5. Exact file/config plan

| Item | Action |
|------|--------|
| **apps/dealer/lib/db.ts** | When `TEST_DATABASE_URL` is set, use `connection_limit=1` (instead of 2) to reduce pool size to a single connection per process. |
| **apps/dealer/jest.setup.ts** | Add `afterAll` that calls `prisma.$disconnect()` so the shared client releases its connection(s) after each test file. Next file’s first use of `prisma` will reconnect. This avoids holding connections for the entire run. |
| **apps/dealer/jest.config.js** | Keep `maxWorkers: 1` when integration is enabled (no change). |
| **Heavy suites** | No structural changes in this sprint; only connection/infra levers. If timeouts persist (CRM), keep existing `jest.setTimeout(15000)`. |
| **docs/INTEGRATION_DB_CONNECTION_STABILIZATION_REPORT.md** | Final report after fixes. |

---

## 6. Acceptance criteria

- Build and lint unchanged; unit-only path passes.
- Full integration suite (`npm run test:dealer` with `TEST_DATABASE_URL`) materially improves (fewer failed suites/tests) or reaches green.
- No skip-based solutions; integration tests remain real.
- No tenant/RBAC/audit/API regressions.
- Remaining blockers (if any) documented honestly in the report.
