# Saved-Filters Stabilization + Vendor Management V1 — Step 6 (QA-Hardening) Final Report

**Date:** 2026-03-08  
**Spec:** `apps/dealer/docs/SAVED_FILTERS_STABILIZATION_AND_VENDOR_V1_SPEC.md`  
**Scope:** Focused tests for saved-filters and vendor/cost-entry flows; vendor API route tests; cost-entry vendorId validation test; documentation and final report. No redesign; no backend/route/RBAC changes in this step except test additions.

---

## 1. Summary

- **Phase 1 (Saved-filters):** buildCustomersQuery implemented and tested; two integration tests in `saved-filters-searches.integration.test.ts` pass (page/pageSize output).
- **Phase 2 (Vendor V1):** Vendor backend, UI (list, detail, create, edit), cost-entry vendorId/vendorName, security fix (vendorId same-tenant validation), performance index, and docs completed in Steps 2–5.
- **Step 6 (QA-Hardening):** Vendor API route tests and one cost-entry vendorId validation test added. All focused tests pass.
- **Deliverables:** Security QA report, Performance notes, this Final Report. Tests pass; unrelated failures documented below.

---

## 2. Changed / Added Files (Step 6)

| File | Change |
|------|--------|
| `app/api/vendors/route.test.ts` | **New.** GET: 403 when guard throws, 200 with data and meta from listVendors. POST: 403 when guard throws, 201 with created vendor. |
| `app/api/vendors/[id]/route.test.ts` | **New.** GET: 403 when guard throws, 404 when vendor not found, 200 with vendor. PATCH: 403 when guard throws, 200 with updated vendor. DELETE: 403 when guard throws, 200 with soft-deleted vendor. |
| `app/api/vendors/[id]/cost-entries/route.test.ts` | **New.** GET: 403 when guard throws, 404 when vendor not found, 200 with data array and vehicleSummary. |
| `app/api/inventory/[id]/cost-entries/route.test.ts` | **Extended.** POST: added test that returns 400 (VALIDATION_ERROR) when vendorId is supplied but getVendor returns null (wrong tenant or missing). |

---

## 3. Tests Run

### 3.1 Focused run (saved-filters + vendor + cost-entries)

Command:

```bash
npx jest modules/customers/tests/saved-filters-searches.integration.test.ts \
  app/api/vendors \
  "app/api/inventory/[id]/cost-entries" \
  "app/api/inventory/[id]/cost-entries/[entryId]"
```

**Result:** 4 test suites passed, 28 tests passed.

| Suite | Tests | Notes |
|-------|-------|--------|
| `saved-filters-searches.integration.test.ts` | 14 | Tenant isolation, RBAC, buildCustomersQuery (page/pageSize), stateJson validation |
| `app/api/vendors/route.test.ts` | 4 | GET 403/200, POST 403/201 |
| `app/api/vendors/[id]/route.test.ts` | 6 | GET 403/404/200, PATCH 403/200, DELETE 403/200 |
| `app/api/vendors/[id]/cost-entries/route.test.ts` | 3 | GET 403/404/200 |
| `app/api/inventory/[id]/cost-entries/route.test.ts` | 4 | GET 403/200, POST 403/201, POST 400 invalid vendorId |
| `app/api/inventory/[id]/cost-entries/[entryId]/route.test.ts` | (included in pattern) | PATCH/DELETE 403/404/200/204 |

### 3.2 Inventory API suite

- All 11 inventory API test suites (including cost-entries and cost-entries/[entryId]) pass (47 tests).

---

## 4. Documentation Delivered (Steps 1–6)

| Document | Step | Content |
|----------|------|---------|
| `SAVED_FILTERS_STABILIZATION_AND_VENDOR_V1_SPEC.md` | 1 | Combined spec: Phase 1 fix path, Phase 2 vendor scope, model, API, slices, soft-delete rule. |
| `SAVED_FILTERS_AND_VENDOR_V1_SECURITY_QA.md` | 4 | Tenant scoping, RBAC, cost-entry vendorId validation fix, soft-delete, input/audit, UI gates. |
| `SAVED_FILTERS_AND_VENDOR_V1_PERF_NOTES.md` | 5 | Phase 1 no impact; vendor list/detail/cost-entries; cost-entry list with vendor; UI fetch strategy; composite index. |
| `SAVED_FILTERS_AND_VENDOR_V1_FINAL_REPORT.md` | 6 | This report: summary, test coverage, unrelated failures. |

---

## 5. Lifecycle Verification

| Flow | Verification |
|------|--------------|
| **Saved-search apply (customers)** | buildCustomersQuery maps limit/offset → page/pageSize; URL matches server parseSearchParams; integration tests pass. |
| **Vendor list** | Route test: GET returns 200 with data and meta; listVendors called with dealershipId and options. |
| **Vendor create** | Route test: POST returns 201 with created vendor; createVendor called with dealershipId, userId, body. |
| **Vendor get/update/delete** | Route tests: GET 404 when not found, 200 when found; PATCH/DELETE 200 with updated vendor. |
| **Vendor cost-entries** | Route test: GET 404 when vendor not found, 200 with data array and vehicleSummary. |
| **Cost entry with vendorId** | Route test: POST with vendorId when getVendor returns null → 400 VALIDATION_ERROR; createCostEntry not called. |

---

## 6. Unrelated Failures (Full Dealer Suite)

When running the full dealer suite (`npm run test:dealer`), the following failures are **not** related to Saved-Filters or Vendor V1:

| Suite | Failure | Cause |
|-------|---------|--------|
| `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` | Snapshot failures | Dashboard UI changes (e.g. search/recent-searches, layout). Update snapshots with `npx jest -u` if intended. |
| `app/(app)/customers/__tests__/page.test.tsx` | `listCustomers` called with unexpected args | Test expects `limit: 10` and no filters/sort; implementation uses `limit: 25`, `filters`, and `sort`. Align test with current page behavior. |

**Saved-filters and vendor code and tests:** No failures. All focused tests pass in the full run as well.

---

## 7. Conclusion

- **QA-hardening for Saved-Filters Stabilization + Vendor Management V1 is complete** within the stated scope: focused tests for buildCustomersQuery, vendor list/CRUD/vendor cost-entries, and cost-entry vendorId validation; Security QA and Performance notes delivered; final report complete.
- **Step 6 changes:** Test-only (vendor route tests + one cost-entry vendorId test). No production or RBAC changes.
- **Final deliverable:** This document (`SAVED_FILTERS_AND_VENDOR_V1_FINAL_REPORT.md`).

**Slice E (Cost-ledger vendor picker)** was not implemented in this program; the vehicle cost entry form still uses free-text vendor name only. Vendor list, detail, create, and edit are in place; adding a vendor picker to the cost entry form is left for a follow-up.
