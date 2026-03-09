# Step 4 — Inventory Acquisition & Pricing Engine — Security / QA / Performance Report

**Scope:** Appraisals · Acquisition · Auctions (MOCK) · Valuation · Pricing rules/apply · Listings/publish · Step 3 frontend pages · Vehicle detail cards.

**Hardening pass only — no redesign, no unrelated refactors.**

---

## 1. Summary

- **Backend:** All new routes and services audited for tenant isolation, RBAC, input validation, output hygiene, audit logging, and invalid state transitions. Fixes applied: acquisition API serializes nested appraisal BigInt to string; acquisition create/update validate `appraisalId` same-tenant; appraisal body cents validated as non-negative integer strings; pricing rule schema bounds `adjustmentPercent` and `adjustmentCents`; pricing service skips disabled rules defensively.
- **Frontend:** Server-first appraisals/acquisition/auctions pages; vehicle detail cards and pricing-rules page use loading/empty/error states; no raw BigInt in client props; acquisition server page and API responses serialize cents and dates.
- **Tests:** Jest tests added/updated for tenant isolation (cross-tenant appraisalId blocked), appraisal workflow (reject→convert blocked, already-converted→convert blocked), pricing (negative result blocked, disabled rule skipped), publish readiness (no price, no identity, requirePhoto), unpublish non-existent. All 21 tests in `acquisition-pricing.test.ts` pass when run from `apps/dealer` after `prisma generate`.
- **Performance:** Appraisals/acquisition/auctions pages are server-first; no refetch-on-mount for initial load; vehicle cards and pricing-rules page fetch on mount (acceptable). No N+1 in new list endpoints; heavy logic in services.

---

## 2. Security matrix (reviewed)

| Area | Tenant isolation | RBAC | Input validation | Output hygiene | Audit | Invalid transitions / money |
|------|------------------|------|------------------|----------------|------|-----------------------------|
| Appraisals | ✓ ctx.dealershipId on all | read/write per route | Zod + cents refine | BigInt→string, Date→ISO | create, approve, reject, convert | Reject→convert blocked; CONVERTED→convert blocked; DRAFT-only update |
| Acquisition | ✓ ctx.dealershipId | read/write per route | Zod + appraisalId same-tenant | BigInt→string in lead + nested appraisal | — | Valid stages only; linked appraisal same tenant |
| Auctions | ✓ ctx.dealershipId | read / appraisals.write | provider MOCK only, query schema | BigInt→string, Date→ISO | — | MOCK only; cache tenant-scoped |
| Valuation | ✓ ctx.dealershipId | inventory.read / pricing.write | [id] from path | Int (number) safe | — | No negative in engine |
| Pricing rules | ✓ ctx.dealershipId | read/write per route | Zod + finite/bounds | — | apply logs before/after | No negative price; disabled rules skipped |
| Listings/publish | ✓ ctx.dealershipId | publish.read/write | platform enum, requirePhoto | — | — | Price + identity + optional photo |

---

## 3. Tenant isolation

- **Appraisals:** `listAppraisals`, `getAppraisalById`, `updateAppraisal`, `approveAppraisal`, `rejectAppraisal`, `convertAppraisalToInventory` all take `dealershipId` from auth; DB layers use `where: { id, dealershipId }` or equivalent. Cross-tenant ID → NOT_FOUND.
- **Acquisition:** List/get/patch/move-stage scoped by `dealershipId`. **Hardening:** Create and update now validate `appraisalId`: when provided, `appraisalDb.getAppraisalById(dealershipId, appraisalId)` is called; if null, throw `VALIDATION_ERROR` ("Appraisal not found or not in this dealership") so cross-tenant link is rejected.
- **Auctions:** Search and get by id use `dealershipId`; cache upsert and get by id are tenant-scoped. Create appraisal from auction uses same-tenant listing only.
- **Valuation:** Get/recalculate use `dealershipId`; vehicle and snapshot are tenant-scoped.
- **Pricing rules:** List/create/update/get by id use `dealershipId`. Preview/apply use vehicle by `dealershipId` and `vehicleId`.
- **Listings:** List/publish/unpublish use `dealershipId` and resolve vehicle by `dealershipId` and `vehicleId`; cross-tenant → NOT_FOUND.

**Tests added:** Cross-tenant `appraisalId` on acquisition create and update → VALIDATION_ERROR; getAppraisal / getInventorySourceLead with wrong dealership → NOT_FOUND.

---

## 4. RBAC

- **Appraisals:** GET list/get one → `inventory.appraisals.read`; POST create, PATCH, approve, reject, convert → `inventory.appraisals.write`.
- **Acquisition:** GET list/get one → `inventory.acquisition.read`; POST create, PATCH, move-stage → `inventory.acquisition.write`.
- **Auctions:** GET search, GET [id] → `inventory.auctions.read`; POST [id]/appraise → `inventory.appraisals.write`.
- **Valuation:** GET [id]/valuation → `inventory.read`; POST recalculate → `inventory.pricing.write`.
- **Pricing rules:** GET list → `inventory.pricing.read`; POST create, PATCH [id] → `inventory.pricing.write`. GET preview → `inventory.pricing.read`; POST apply → `inventory.pricing.write`.
- **Listings:** GET [id]/listings → `inventory.publish.read`; POST publish/unpublish → `inventory.publish.write`.

All routes use `getAuthContext` and `guardPermission` before service calls; no frontend-only enforcement.

---

## 5. Validation

- **Appraisals:** `listAppraisalsQuerySchema` (limit, offset, status, sourceType, vin, sortBy, sortOrder). `createAppraisalBodySchema` / `updateAppraisalBodySchema`: VIN min 1 max 17; cents fields use `centsOptional` refine: non-negative integer string (BigInt(val) >= 0n), rejects negative and non-numeric.
- **Acquisition:** List query (limit, offset, status, sourceType, vin). Create/update: VIN, sourceType, optional appraisalId (UUID). **Hardening:** Service validates appraisalId same-tenant before create/update.
- **Auctions:** Search query: provider enum `["MOCK"]` only, vin/make/model/year optional, limit 1–100. Service rejects non-MOCK provider with VALIDATION_ERROR.
- **Pricing rules:** Create/update: name 1–256, ruleType enum, daysInStock ≥ 0, **adjustmentPercent** `.finite().min(-100).max(100)`, **adjustmentCents** `.int().finite()` (optional).
- **Publish/unpublish:** Body: platform enum; publish has optional `requirePhoto` boolean. Vehicle readiness (price, VIN or stock number, optional photo) enforced in service.

**Tests:** Invalid stage in move-stage; cross-tenant appraisalId; publish with no price, no identity, requirePhoto with no photos.

---

## 6. Appraisal workflow safety

- **Convert:** Only DRAFT or APPROVED can be converted; REJECTED → CONFLICT; already CONVERTED with vehicleId → CONFLICT. Convert creates one vehicle, links appraisal, sets status CONVERTED, audit + event.
- **Approve/Reject:** Only DRAFT can be approved or rejected; CONFLICT otherwise.
- **Update:** Only DRAFT can be updated (DB layer returns null otherwise).

**Tests added:** convertAppraisalToInventory when status CONVERTED and vehicleId set → throws ApiError (CONFLICT).

---

## 7. Acquisition pipeline safety

- **Stages:** Valid enum NEW | CONTACTED | NEGOTIATING | WON | LOST; move-stage validates via schema and service `VALID_STAGES`.
- **Linked appraisal:** Create/update with `appraisalId` now require appraisal to exist and belong to same dealership.

**Tests:** Invalid stage rejected; cross-tenant appraisalId rejected on create and update.

---

## 8. Auction MOCK provider

- **Provider:** Only MOCK supported; search query schema restricts provider to `["MOCK"]`; service throws if effective provider !== MOCK.
- **Cache:** Upsert and get by id are dealership-scoped; no raw unvalidated payload written unsafely.
- **Appraisal from auction:** Uses listing from same-tenant cache; buyNow/currentBid default to 0; expected retail/profit derived deterministically.

**Tests:** Non-MOCK provider rejected; MOCK search returns cached results.

---

## 9. Valuation engine

- **Math/fallback:** Missing book value uses vehicle sale price; price-to-market optional; recommended prices derived from retail/wholesale or market average; no negative outputs (Int in DB).
- **Recalculation:** Requires vehicle; getVehicleById scoped by dealershipId; snapshot created with dealershipId.

**Tests:** getVehicleValuation returns null when no snapshot; recalculate creates snapshot.

---

## 10. Pricing engine (high-risk)

- **Preview:** Uses only enabled rules (`listPricingRules(dealershipId, true)`); **hardening:** loop now skips `if (!rule.enabled) continue;`. Suggested price clamped with `Math.max(0, currentCents + delta)`.
- **Apply:** Calls preview again, recomputes; persists only if newPrice !== previous; audit log with previousPriceCents and newPriceCents (string). No trust of client preview payload.
- **Rules:** adjustmentPercent bounded -100..100; adjustmentCents finite int.

**Tests added:** Preview with aggressive negative rule → suggestedPriceCents ≥ 0; list returns one disabled rule → steps length 0 and suggested equals current.

---

## 11. Listings / publish

- **Publish readiness:** `assertPublishReadiness`: salePriceCents > 0; vehicle has VIN or stock number. If `requirePhoto`, at least one photo required.
- **Unpublish:** Vehicle must exist (same tenant); set status UNPUBLISHED; getVehicleListingByPlatform may return null (handled).

**Tests added:** Publish with no VIN and empty stock number → ApiError; unpublish when listing not found returns null.

---

## 12. Serialization / frontend

- **API responses:** All BigInt (cents) sent as `.toString()`; Dates as `.toISOString()`. Acquisition list/get now serialize nested `appraisal.expectedRetailCents`, `expectedProfitCents`, and `vehicleId` (where present).
- **Server pages:** Appraisals and acquisition pages serialize server-fetched data (BigInt→string, Date→ISO) before passing to client; no raw BigInt in props.
- **Vehicle detail cards:** Use string cents from API; token-based styling; loading/empty/error states.

---

## 13. Performance notes

- Appraisals, acquisition, and auctions list pages: server-first; initial data loaded in page component; client receives serialized initialData/initialStages.
- Pricing rules page: client fetches on mount (acceptable for secondary settings page).
- Vehicle valuation/pricing/marketing cards: fetch on mount when vehicle id present; no duplicate requests identified for single vehicle.
- List endpoints: paginated (limit max 100); no unbounded queries. N+1 avoided via include/select and batch where applicable.

---

## 14. Files changed (Step 4 hardening)

| File | Change |
|------|--------|
| `app/api/inventory/acquisition/route.ts` | Serialize nested appraisal (expectedRetailCents, expectedProfitCents, vehicleId) to string/null in toLeadResponse |
| `app/api/inventory/acquisition/[id]/route.ts` | Same serialization for lead response |
| `modules/inventory/service/acquisition.ts` | Validate appraisalId same-tenant on create and update (getAppraisalById); throw VALIDATION_ERROR if not found |
| `app/api/inventory/pricing-rules/schemas.ts` | adjustmentPercent `.finite().min(-100).max(100)`; adjustmentCents `.int().finite()` |
| `app/api/inventory/appraisals/schemas.ts` | Cents fields: `centsOptional` refine (non-negative integer string) |
| `modules/inventory/service/pricing.ts` | Defensive `if (!rule.enabled) continue;` in preview loop |
| `modules/inventory/tests/acquisition-pricing.test.ts` | New tests: cross-tenant appraisalId (create/update), convert when CONVERTED, pricing negative/disabled, publish no identity, unpublish returns null |

---

## 15. Tests added/updated

- **Tenant isolation:** createInventorySourceLead with cross-tenant appraisalId throws VALIDATION_ERROR; updateInventorySourceLead with cross-tenant appraisalId throws VALIDATION_ERROR.
- **Appraisal workflow:** convertAppraisalToInventory when already CONVERTED with vehicleId throws CONFLICT.
- **Pricing engine:** preview never returns negative suggestedPriceCents; only enabled rules applied (disabled rule in list → no steps).
- **Publish readiness:** publishVehicleToPlatform throws when vehicle has no VIN and no stock number.
- **Listings:** unpublishVehicleListing returns listing or null when not found.

---

## 16. Commands run

- `cd /Users/saturno/Desktop/dms && npm run test:dealer -- --testPathPattern="acquisition-pricing|serializers-and-pricing"`  
  **Result:** Many suite failures (Prisma not initialized, missing @testing-library/dom, etc.) — **pre-existing env issues** when running from repo root.
- `cd /Users/saturno/Desktop/dms/apps/dealer && npx prisma generate && npx jest modules/inventory/tests/acquisition-pricing.test.ts`  
  **Result:** **PASS** — 21 tests, 1 suite.

---

## 17. Pass/fail and blockers

- **Code hardening:** Complete. Security/validation/serialization fixes applied; tests added.
- **Test run (scope):** **PASS** when running `modules/inventory/tests/acquisition-pricing.test.ts` from `apps/dealer` after `prisma generate`.
- **Blocker (pre-existing):** From repo root, `npm run test:dealer` hits `@prisma/client did not initialize yet` and/or `Cannot find module '@testing-library/dom'` for many suites. Not introduced by this feature; document and fix in env/CI separately.

---

## 18. Deferred follow-ups

- Consider server-first data load for pricing-rules page (consistent with appraisals/acquisition) if product prefers.
- Rate limits: auth/VIN/file upload/finance session are called out in .cursorrules; no new rate limits added for appraisals/acquisition/auctions in this pass.
- WEBSITE-only UI for marketing card is already in place; backend supports all platforms for publish/unpublish.
- Optional: add RBAC/route integration tests that call API with missing permission and assert 403 (currently covered by guardPermission pattern and unit-level service tests).
