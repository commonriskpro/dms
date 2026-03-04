# Step 4 — Dashboard V3.1 Test Report

**Feature:** Dealer Dashboard V3.1  
**Test runner:** Jest (only)  
**Scope:** `apps/dealer`

---

## 1. What Was Tested

### getDashboardV3Data.test.ts (service)

| Test | Purpose |
|------|---------|
| Returns full DashboardV3Data shape | Contract: dashboardGeneratedAt, metrics (with deltas), WidgetRow arrays, floorplan, appointments, financeNotices |
| Scopes vehicle count by dealershipId | Tenant isolation: vehicle.count receives where.dealershipId |
| Uses other dealershipId in queries when provided | Tenant isolation: same for opportunity; different id passed ⇒ same id in all calls |
| **All data-access calls use the same dealershipId** | **Step 4:** No cross-tenant mix; vehicle, opportunity, listNewProspects, listMyTasks, getCachedFloorplan all use single dealershipId |
| Returns empty widgets and zero metrics when user has no permissions | RBAC: no permission ⇒ no DB calls, zero metrics, empty arrays |
| **Partial permissions: only allowed widgets populated (inventory only)** | **Step 4:** Only inventory.read ⇒ inventory count and inventoryAlerts; leads/deals/bhph 0, other widgets empty |
| Enforces query limit: listNewProspects called with limit 5 | Abuse: row limit 5 |
| Caps financeNotices at 5 | Abuse: financeNotices length ≤ 5 |
| Metric deltas null when not computed | Contract: deltas null |
| Logs dashboard_v3_load_start and dashboard_v3_load_complete without PII | Logging: no email/token/cookie in context |
| **Complete log context contains only allowed keys** | **Step 4:** No forbidden keys in load_complete context |
| **Error log context contains only safe fields (no stack or PII)** | **Step 4:** On throw, error log has requestId, tails, loadTimeMs, errorCode; no stack, email, token |
| FinanceNotices use severity info\|success\|warning\|danger only | Contract: severity enum |

### floorplan-cache.test.ts

| Test | Purpose |
|------|---------|
| Returns provider result and caches by dealershipId | Cache key = dealershipId |
| Does not call provider twice within TTL for same dealershipId | Cache hit within TTL |
| Calls provider for different dealershipId | Different dealership ⇒ different cache entry |

### dashboard-v3-render.test.tsx (client)

| Test | Purpose |
|------|---------|
| Renders metric cards and key widgets when user has permissions | Happy path |
| Quick Actions has correct hrefs when user has write permissions | Links point to /inventory/new, /customers/new, /deals/new |
| **Quick Actions shows no action links when user has only read permissions (RBAC gating)** | **Step 4:** Only read ⇒ "No actions available.", no write links |
| Does not render email or token-like content | No Bearer, email regex, JWT in HTML |
| **Step 4 red-flag: rendered output must not contain token, cookie, authorization, bearer, supabase, or email** | **Step 4:** No sensitive strings in output; token/cookie patterns restricted |
| Shows Last updated and Refresh button | UX |
| Renders metric delta chip (positive green, null shows —) | Deltas |
| Applies severity to widget rows (warning/danger) | Severity styling |
| Widget rows with href are clickable | Links |
| Renders Recommended actions when rules match | Recommended actions card |

---

## 2. What Was Changed (Step 4)

- **Added tests (all Jest):**
  - Tenant: "all data-access calls use the same dealershipId (no cross-tenant mix)".
  - RBAC: "partial permissions: only allowed widgets populated (inventory only)".
  - Logging: "complete log context contains only allowed keys", "error log context contains only safe fields (no stack or PII)".
  - Client: "Step 4 red-flag" (no token, cookie, authorization, bearer, supabase, email), "Quick Actions shows no action links when user has only read permissions".
- **No Vitest;** no new product behavior.

---

## 3. How to Run

From repo root:

```bash
npm -w apps/dealer run test
```

To run only dashboard-related tests:

```bash
npm -w apps/dealer run test -- apps/dealer/modules/dashboard/tests/getDashboardV3Data.test.ts apps/dealer/modules/dashboard/tests/floorplan-cache.test.ts apps/dealer/app/dashboard/__tests__/dashboard-v3-render.test.tsx
```

---

## 4. Results (Step 4 run)

- **Suites:** 3 passed (getDashboardV3Data, floorplan-cache, dashboard-v3-render).
- **Tests:** 26 passed.
- **Status:** PASS.

---

## 5. How to Reproduce Failures

- **Tenant:** Change service to pass a different `dealershipId` to one of the Prisma/db/cache calls ⇒ "all data-access calls use the same dealershipId" should fail.
- **RBAC:** Return non-empty widget for a permission the user doesn’t have ⇒ "partial permissions" or "returns empty widgets when user has no permissions" should fail.
- **Sensitive output:** Pass initialData containing an email or token string ⇒ "Step 4 red-flag" or "does not render email or token-like content" should fail.
- **Logging:** Log full `dealershipId` or `email` in logger context ⇒ "complete log context contains only allowed keys" or "logs ... without PII" should fail.

---

**Status:** PASS — All listed tests added and passing; Jest only; no product behavior changed.
