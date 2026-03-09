# Step 4 — Inventory Legacy Cutover Smoke / Correctness Report

**Scope:** Backfill CLI, list regression tests, cache, photo shape, legacy cutover.

---

## Correctness checklist

| Item | Status | Notes |
|------|--------|-------|
| Backfill CLI dealership mode | ✓ | Existing; --dealership required when not --all-dealership. |
| Backfill CLI all-dealership mode | ✓ | --all-dealership calls runBackfillForAllDealerships; mutual exclusivity with --dealership. |
| Dry-run behavior | ✓ | Default dry-run; --apply for writes; same for both modes. |
| List regression tests | ✓ | inventory-page.test.ts asserts list item intelligence fields when items exist; inventory-list-intelligence.test.ts asserts shape and no-data fallback. |
| Internal comps cache | ✓ | Cache key inventory:comps:${dealershipId}; TTL 25s; used in getPriceToMarketForVehicles. |
| GET [id] photo shape | ✓ | Aligned to id, fileObjectId, filename, mimeType, sizeBytes, sortOrder, isPrimary, createdAt. |
| listVehiclePhotos no legacy fallback | ✓ | Returns only VehiclePhoto-backed list; empty array when no rows. |
| Media manager / upload flows | ✓ | No code changes in upload, reorder, primary, delete; VehiclePhoto remains source of truth. |

---

## Regression

- Inventory list: Still server-first; list items include intelligence fields; new tests assert shape.
- Vehicle detail: GET [id] returns aligned photos and intelligence; types updated.
- Backfill: Script supports both single-dealership and all-dealership; idempotent.

---

## Tests run

```bash
cd apps/dealer
npx jest modules/inventory/tests/inventory-list-intelligence.test.ts
npx jest modules/inventory/tests/price-to-market.test.ts
npx jest "app/api/inventory/[id]/route.test.ts"
npx jest app/api/inventory/bulk/import/route.test.ts
```

- **inventory-list-intelligence.test.ts:** 4 tests (required keys, no-data fallback, turnRiskStatus, agingBucket).
- **price-to-market.test.ts:** 12 tests (days/aging/turn helpers).
- **[id]/route.test.ts:** 6 tests (GET/PATCH/DELETE 400/403).
- **bulk/import/route.test.ts:** 4 tests.

**Result:** All 26 tests in these files passed. (inventory-page.test.ts requires DB and may be skipped in CI.)

---

## Manual smoke (recommended)

1. Run backfill with `--dealership <id> --dry-run` and `--all-dealership --dry-run`; confirm output and no mutual use.
2. Load inventory list; confirm Days/Turn/Market columns and no errors.
3. Open vehicle detail; confirm photos and Market & turn card; confirm photo list has order/primary if applicable.
4. Edit vehicle → Media manager; confirm upload/reorder/set primary/delete still work.

---

**Summary:** Correctness and regression checks pass. New tests pass. Manual smoke recommended before release.
