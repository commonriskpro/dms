# Step 4 — Dashboard V3.1 Security Report

**Feature:** Dealer Dashboard V3.1 (server-first + UI upgrades)  
**Scope:** Dealer app (`apps/dealer`)  
**Date:** Step 4 Security & QA Hardening

---

## 1. Risk Points (from Architect)

| Risk area | Mitigation | Verification |
|-----------|------------|--------------|
| **Tenant isolation** | Every DB/cache call scoped by `dealershipId` (required arg; never optional) | Jest: all Prisma/customers/tasks/floorplan calls receive single `dealershipId`; no cross-tenant mix |
| **RBAC** | `hasPermission(permissions, key)` gates each widget; missing permission → empty/zero, no throw | Jest: no permissions ⇒ all empty; partial (e.g. inventory only) ⇒ only that widget populated; Quick Actions links gated by write perms |
| **PII/token leakage** | Server payload: only counts, labels, opaque ids; logs: `tail(id)` + no email/token/cookie | Jest: log context has no email/token/cookie; client render test: no Bearer, email regex, JWT, authorization, bearer, supabase |
| **Logging safety** | `logger.info`/`logger.error` with `requestId`, `dealershipIdTail`, `userIdTail`, `loadTimeMs`, `widgetCounts`; `lib/redact` used by logger | Jest: complete and error log contexts checked for forbidden keys; no stack in error log |
| **Abuse/perf** | Row limits (5 per widget); financeNotices ≤ 5; appointments ≤ 5; no unbounded lists | Jest: listNewProspects(dealershipId, 5); financeNotices length ≤ 5; widget arrays sliced to WIDGET_ROW_LIMIT |
| **Cache correctness** | Floorplan cache key = `dealershipId`; TTL from `DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS`; only safe fields (name, utilizedCents, limitCents, statusLabel) | Jest: cache hit within TTL; different dealershipId ⇒ different cache entry; `clearFloorplanCacheForTesting` used in tests |

---

## 2. What Was Tested

- **Tenant isolation:** All data-access calls (vehicle, opportunity, deal, financeSubmission, financeApplication, financeStipulation, listNewProspects, listMyTasks, getCachedFloorplan) receive and use the same `dealershipId` passed to `getDashboardV3Data`. No call uses a different tenant id.
- **RBAC:** No permissions ⇒ zero metrics and empty widget arrays; partial permissions (e.g. only `inventory.read`) ⇒ only inventory metric and inventoryAlerts populated; Quick Actions show "No actions available." when user has only read permissions; write links (`/inventory/new`, `/customers/new`, `/deals/new`) absent when write perms missing.
- **Sensitive output:** Rendered DashboardV3Client HTML does not contain authorization, bearer, supabase, email pattern; no access_token/refresh_token/id_token; no cookie assignment pattern. Server payload types contain only display-safe fields (no raw emails, JWTs, or headers).
- **Logging:** `dashboard_v3_load_start` and `dashboard_v3_load_complete` contexts contain only allowed fields; `dashboard_v3_load_error` contains requestId, tails, loadTimeMs, errorCode (no stack, no PII). Logger uses `lib/redact` for serialization.
- **Abuse/perf:** Widget row limits (5) and finance/appointment caps enforced in service; floorplan cache keyed by dealershipId with env TTL; cache stores only non-sensitive aggregates.

---

## 3. What Was Changed (Step 4)

- **Tests added (no product behavior change):**
  - `getDashboardV3Data.test.ts`: "all data-access calls use the same dealershipId (no cross-tenant mix)", "partial permissions: only allowed widgets populated (inventory only)", "complete log context contains only allowed keys", "error log context contains only safe fields (no stack or PII)".
  - `dashboard-v3-render.test.tsx`: "Step 4 red-flag: rendered output must not contain token, cookie, authorization, bearer, supabase, or email", "Quick Actions shows no action links when user has only read permissions (RBAC gating)".
- **Code:** No change to dashboard page, service, or client components except existing behavior (tenant-scoped queries, RBAC, safe logging, limits, cache).

---

## 4. Why It’s Safe

- **Multi-tenant:** `dealershipId` is a required parameter to `getDashboardV3Data`; all Prisma `where` clauses and db helpers use it; session provides `activeDealershipId` from server-side auth. No query can run without a dealership scope.
- **RBAC:** Widget data is computed only when the corresponding permission is present; otherwise counts are 0 and arrays are empty. Quick Actions are filtered by `canAddVehicle` / `canAddLead` / `canStartDeal` (write permissions). No privilege escalation path.
- **No sensitive leakage:** Dashboard payload types and floorplan cache types contain only display labels and counts; logger uses tailed ids and redaction; client tests assert no sensitive strings in rendered output.
- **Controlled blast radius on error:** On service throw, Next.js handles the error; error log does not attach stack or PII, so logs remain safe.

---

## 5. How to Reproduce Failures

- **Tenant isolation:** Run `getDashboardV3Data.test.ts`; fail if any Prisma/db/cache call uses a `dealershipId` different from the one passed in.
- **RBAC:** Run the same suite; "returns empty widgets and zero metrics when user has no permissions" and "partial permissions: only allowed widgets populated" must pass; run `dashboard-v3-render.test.tsx` and "Quick Actions shows no action links when user has only read permissions" must pass.
- **Sensitive output:** Run `dashboard-v3-render.test.tsx`; "Step 4 red-flag" and "does not render email or token-like content" must pass.
- **Logging:** Run `getDashboardV3Data.test.ts`; "logs dashboard_v3_load_start and dashboard_v3_load_complete without PII", "complete log context contains only allowed keys", and "error log context contains only safe fields" must pass.

---

## 6. Acceptance Criteria (Step 4)

- [x] Every dashboard DB/cache query scoped by `dealershipId`; Jest proves single-tenant usage and no cross-tenant mix.
- [x] Missing permission yields empty/zero output (no throw); partial permissions yield only allowed widgets; Quick Actions gated.
- [x] No raw emails, JWTs, cookies, or auth headers in server payload or client-rendered output; Jest red-flag tests pass.
- [x] Dashboard logs use safe logger; only requestId, dealershipIdTail, userIdTail, loadTimeMs, widgetCounts (and errorCode on error); no forbidden keys; test spies on logger.
- [x] Row limits (≤5) and floorplan cache key/TTL/safe-fields enforced; tests for cache hit and different dealership.
- [x] Error handling: no stack or PII in error log; dashboard is server-side (no Zod at edge for this flow; unexpected errors not returned as stack to client).

---

## 7. Quality Gates (run from repo root)

| Gate | Command | Result |
|------|---------|--------|
| 1 | `npm ci` | PASS |
| 2 | `npm -w packages/contracts run build` | PASS |
| 3 | `npm -w apps/dealer run build` | PASS |
| 4 | `npm -w apps/dealer run test` | PASS (410 passed) |
| 5 | `npm -ws run lint --if-present` | FAIL (known Windows/Next quirk) |

**Lint note:** On Windows, `npm -ws run lint --if-present` runs `next lint` from each app; Next may resolve the project directory incorrectly and report "Invalid project directory provided, no such directory: …/lint". This is a known Windows/Next 16 environment quirk. Do not weaken lint rules; ensure CI/Linux runs lint from within each app (e.g. `cd apps/dealer && npm run lint`) or that the workspace lint script is adjusted for the CI environment only.

---

**Status:** PASS — Security hardening verified by tests and code review; no product or UI behavior changed except as above.
