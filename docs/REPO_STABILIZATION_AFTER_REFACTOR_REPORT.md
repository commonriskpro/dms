# Repo Stabilization After Refactor — Report

**Sprint:** Repo Stabilization (post code polish/refactor)  
**Date:** 2026-03-07  
**Scope:** Get repo as close to green as possible: tests, lint, build, migration consistency. No feature work; minimal, targeted fixes.

---

## 1. Repo inspection summary

### 1.1 Known issues (pre-sprint)

| Issue | Cause |
|-------|--------|
| **@testing-library/dom missing** | `@testing-library/react` v16 expects `@testing-library/dom`; it was not in dealer devDependencies. |
| **DB/schema mismatch (Deal.delivery_status)** | Prisma schema has `Deal.deliveryStatus` and `deliveredAt`; tests that create deals did not set them; integration tests fail with "column does not exist" if test DB has not had migrations applied. |
| **Build error in acquisition [id] route** | `toLeadResponse` typed for full get shape; update returns narrower shape (e.g. appraisal with only `id`, `vin`, `status`). |
| **Tests require migrations** | Integration tests (e.g. tenant-isolation, profit-calc) that create `Deal` need `TEST_DATABASE_URL` pointing at a DB with migrations applied (including `Deal.delivery_status`). |

### 1.2 Additional issues found during stabilization

- **Deal funding/title Prisma types:** `DealFundingStatus` readonly arrays not assignable to Prisma `EnumDealFundingStatusFilter`; `dealTitle` where clause (`isNot: null` + `titleStatus`) incompatible with Prisma nullable relation filter.
- **Funding queue serializeDeal:** `listDealsForFundingQueue` include only selected `lenderName`; `serializeDeal` / `serializeDealFundingItem` expect `lenderApplication.id` as well.
- **UI/API type and component mismatches:** `parseDollarsToCents` returns string; comparison with `BigInt(0)` invalid. `PageHeader` has no `description` prop. `Pagination` expects `meta` object, not `total`/`limit`/`offset` separately. `StatusBadge` variant is `neutral` not `default`. Button variant is `danger` not `destructive`.
- **Prisma update inputs:** Nullable Json (`generatedPayloadJson`) must use `Prisma.JsonNull` for explicit null. Relation FKs (`appraisalId`, `appraisedByUserId`, `vehicleId`) must use relation form (`connect`/`disconnect`) in update inputs.
- **Compliance service:** `updateComplianceFormInstance` returns `null`; audit used `updated.id` without null check.
- **DealCreditTab:** Promise chain could pass `undefined` to second `.then`; `list` possibly undefined. StatusBadge variants and Button variant mismatches.
- **DealDocumentVaultTab:** Button `variant="destructive"` not in dealer Button API.

---

## 2. Fix plan

1. **Package/config:** Add `@testing-library/dom` to dealer devDependencies.
2. **Acquisition route:** Widen `toLeadResponse` (and appraisals/auction-purchases serializers) to accept get/update/list/create return shapes; handle optional `vehicle` safely.
3. **Schemas:** Replace BigInt literals (`0n`) with `BigInt(0)` for ES target compatibility.
4. **Deal tests:** Add `deliveryStatus: null`, `deliveredAt: null` to deal create payloads in tenant-isolation and profit-calc tests.
5. **Lender-applications list:** Cast list item to serializer parameter type where list shape is narrower.
6. **Inventory-permissions tests:** Relax regex for “don’t” (curly vs straight quote); fix “no mutation when !inventory.write” assertion (no dependency on fetch).
7. **Deal db (deal.ts):** Use `DealFundingStatus[]` cast for `fundingStatus: { in: [...] }`; add `id` to funding queue `lenderApplication` select.
8. **Title db (title.ts):** Use `dealTitle: { is: { titleStatus: { not: "TITLE_COMPLETED" } } }` for title queue where.
9. **DealDeliveryFundingTab:** Compare `cents` to `"0"` or `""` (string), not `BigInt(0)`.
10. **Queue pages (Delivery/Funding/Title):** Remove `description` from `PageHeader`; pass `meta` to `Pagination` instead of total/limit/offset.
11. **Compliance-form db:** Use `Prisma.JsonNull` for null `generatedPayloadJson` in update.
12. **Compliance service:** Null-check `updated` before audit and return.
13. **DealCreditTab:** Guard `list?.length`; use `StatusBadge` variant `neutral` and fallbacks; fix LENDER_STATUS_VARIANT.
14. **DealDocumentVaultTab:** Use Button `variant="danger"` instead of `"destructive"`.
15. **Finance-core/ui DealCreditTab:** `list` possibly undefined in `.then` — use `list?.length`.
16. **Inventory db (acquisition, appraisal, auction-purchase):** Use relation `connect`/`disconnect` for `appraisalId`, `appraisedByUserId`, `vehicleId` in update payloads.

---

## 3. Changes made

### 3.1 Package and config

| File | Change |
|------|--------|
| `apps/dealer/package.json` | Added `"@testing-library/dom": "^10.4.0"` to devDependencies. |

### 3.2 API routes and serializers

| File | Change |
|------|--------|
| `apps/dealer/app/api/inventory/acquisition/[id]/route.ts` | `toLeadResponse` accepts union of get/update return types. |
| `apps/dealer/app/api/inventory/appraisals/route.ts` | `toAppraisalResponse` accepts get/update/list/create shapes; safe read of `vehicle`. |
| `apps/dealer/app/api/inventory/appraisals/[id]/route.ts` | `toAppraisalResponse` accepts get/update return types. |
| `apps/dealer/app/api/inventory/auction-purchases/[id]/route.ts` | `toAuctionPurchaseResponse` accepts get/update; safe `vehicle` read. |
| `apps/dealer/app/api/lender-applications/route.ts` | List serialized with cast to `serializeLenderApplication` parameter type. |

### 3.3 Schemas (BigInt / ES target)

| File | Change |
|------|--------|
| `apps/dealer/app/api/inventory/appraisals/schemas.ts` | Replaced `0n` with `BigInt(0)`. |
| `apps/dealer/app/api/inventory/auction-purchases/schemas.ts` | Replaced `0n` with `BigInt(0)`. |

### 3.4 Deal DB and service

| File | Change |
|------|--------|
| `apps/dealer/modules/deals/db/deal.ts` | `fundingStatus: { in: [...] }` cast to `DealFundingStatus[]`; funding queue `lenderApplication` select includes `id`; import `DealFundingStatus`. |
| `apps/dealer/modules/deals/db/title.ts` | Title queue where: `dealTitle: { is: { titleStatus: { not: "TITLE_COMPLETED" } } }`. |

### 3.5 Deal UI (queue pages and funding tab)

| File | Change |
|------|--------|
| `apps/dealer/modules/deals/ui/DeliveryQueuePage.tsx` | Removed `description` from `PageHeader`; `Pagination` receives `meta` and `onPageChange`. |
| `apps/dealer/modules/deals/ui/FundingQueuePage.tsx` | Same PageHeader and Pagination fixes. |
| `apps/dealer/modules/deals/ui/TitleQueuePage.tsx` | Same PageHeader and Pagination fixes. |
| `apps/dealer/modules/deals/ui/DealDeliveryFundingTab.tsx` | Validate funding amount with `cents === "0" \|\| cents === ""` instead of `BigInt(0)`. |

### 3.6 Finance-core

| File | Change |
|------|--------|
| `apps/dealer/modules/finance-core/db/compliance-form.ts` | Import `Prisma`; update payload `generatedPayloadJson` uses `Prisma.JsonNull` when null. |
| `apps/dealer/modules/finance-core/service/compliance.ts` | After `updateComplianceFormInstance`, throw `ApiError("NOT_FOUND", ...)` if `updated` is null before audit. |
| `apps/dealer/modules/finance-core/ui/DealCreditTab.tsx` | `list?.length` guard; CREDIT_STATUS_VARIANT / LENDER_STATUS_VARIANT use `neutral` and fallback `"neutral"`; removed `"default"`. |
| `apps/dealer/modules/finance-core/ui/DealDocumentVaultTab.tsx` | Button `variant="danger"` (replacing `"destructive"`). |

### 3.7 Inventory DB (Prisma relation updates)

| File | Change |
|------|--------|
| `apps/dealer/modules/inventory/db/acquisition.ts` | `appraisalId` update via `appraisal: { connect: { id } }` or `{ disconnect: true }`. |
| `apps/dealer/modules/inventory/db/appraisal.ts` | `appraisedByUserId` update via `appraisedBy: { connect }` / `disconnect`. |
| `apps/dealer/modules/inventory/db/auction-purchase.ts` | `vehicleId` update via `vehicle: { connect }` / `disconnect`. |

### 3.8 Tests

| File | Change |
|------|--------|
| `apps/dealer/modules/deals/tests/tenant-isolation.test.ts` | Deal create payload includes `deliveryStatus: null`, `deliveredAt: null`. |
| `apps/dealer/modules/accounting-core/tests/profit-calc.test.ts` | Deal create payload includes `deliveryStatus: null`, `deliveredAt: null`. |
| `apps/dealer/modules/inventory/ui/__tests__/inventory-permissions.test.tsx` | Regex relaxed for “don’t” (`don.t`); “no mutation when !inventory.write” no longer depends on fetch completion. |

---

## 4. Validation results

### 4.1 Build

- **Command:** `npm run build` (root; runs contracts + dealer).
- **Result:** **PASS** (exit code 0).
- **Note:** Supabase realtime-js “Critical dependency” warnings remain; no change in this sprint.

### 4.2 Lint

- **Command:** `npm run lint:dealer` (root) or `npm run lint` from `apps/dealer`.
- **Result:** **FAIL** — `next lint` reports: “Invalid project directory provided, no such directory: …/apps/dealer/lint”.
- **Note:** Known pre-existing issue (Next.js CLI / project directory). ESLint config in `apps/dealer` is present; rule changes were not made in this sprint.

### 4.3 Tests

- **Command:** `SKIP_INTEGRATION_TESTS=1 npm run test:dealer` (Jest only; integration suites skipped when env set).
- **Result:** **Partial** — Build and type fixes allow test run; **8 tests failed** across **5 suites** (many tests skipped).

**Failed suites / tests (summary):**

| Suite | Failing tests | Cause |
|-------|----------------|--------|
| `modules/dashboard/tests/getDashboardV3Data.test.ts` | 4 | Mock vs implementation: logger.info not called with `dashboard_v3_load_complete`; listNewProspects call shape; complete log call missing; error test expects reject but implementation resolves. |
| `app/api/inventory/vin-decode/route.test.ts` | 1 | Expects 502 on AbortError; received 429 (rate limit) — test env or middleware order. |
| `modules/customers/ui/__tests__/lead-action-strip.test.tsx` | 1 | Expects link name `/send email/i`; actual aria-label is “Open email client”. |
| `modules/customers/ui/__tests__/customers-ui.test.tsx` | 1 | `waitFor` for “No customers” text times out (UI or mock behavior). |
| `components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx` | 1 | Snapshot guide link outdated (Jest upgrade); suite fails before running snapshots. |

**Counts:** Test Suites: 5 failed, 41 skipped, 137 passed. Tests: 8 failed, 480 skipped, 866 passed.

### 4.4 Migrations

- **Schema vs DB:** Prisma schema includes `Deal.deliveryStatus` and `deliveredAt`. Test code now supplies these in deal creates.
- **Integration tests:** Still require a migrated DB for `TEST_DATABASE_URL`. Run `npm run db:migrate` (or equivalent) against the test DB before integration tests.

---

## 5. Final stabilization report

### 5.1 Achieved

- **Build:** Green. All TypeScript and Next.js build errors addressed (deal funding/title Prisma types, funding queue serializer, queue page props, money/string comparison, StatusBadge/Button variants, Prisma Json null and relation updates, compliance null check, DealCreditTab guards).
- **Stability:** No feature work; behavior preserved; changes minimal and targeted.
- **Tests (unit/Jest):** Majority pass (137 suites, 866 tests). Integration suites skipped with `SKIP_INTEGRATION_TESTS=1`; deal-related test data aligned with schema.

### 5.2 Remaining blockers

1. **Lint:** `next lint` fails with “Invalid project directory” (pre-existing). Fixing requires resolving Next.js ESLint/project directory usage (e.g. run from correct cwd or adjust Next config); not addressed in this sprint.
2. **Unit test failures (8):**
   - **Dashboard V3:** Tests assume specific logger call order and error propagation; implementation or mocks need alignment.
   - **VIN decode:** Test expects 502 for timeout; response is 429 (rate limit) — test or middleware ordering.
   - **Lead action strip:** Assertion uses “send email”; UI uses “Open email client” — update test to match accessible name.
   - **Customers UI:** “No customers” waitFor timeout — flake or mock/data setup.
   - **Dashboard snapshots:** Jest snapshot guide link update; run snapshot update (e.g. `jest -u`) and commit if intended.
3. **Integration tests:** Require `TEST_DATABASE_URL` pointing at a DB with migrations applied (including `Deal.delivery_status`). Document in CI or runbooks.

### 5.3 Recommendations

- Fix `next lint` invocation (directory/config) so CI can run lint.
- Align dashboard V3 tests with current `getDashboardV3Data` behavior (logger calls, error path).
- In VIN-decode test, either bypass rate limit in test or expect 429 when rate-limited.
- Update lead-action-strip test to use “Open email client” (or the actual accessible name).
- Run Jest snapshot update for dashboard-v3 if the new guide link is intended; then re-run tests.
- Ensure integration test runbooks/CI document migration step for test DB.

---

**Summary:** Build is green; stabilization focused on type and runtime fixes only. Lint remains broken (pre-existing); a small set of unit tests and snapshot/setup issues remain and are documented above for follow-up.
