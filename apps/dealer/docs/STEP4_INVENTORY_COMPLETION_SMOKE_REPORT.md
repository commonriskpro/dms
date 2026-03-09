# Step 4 — Inventory Completion Smoke / Correctness Report

**Scope:** Behavior and regression checks for the completion sprint.

---

## Correctness checklist

| Item | Status | Notes |
|------|--------|--------|
| Legacy photo backfill idempotent | ✓ | Same FileObjects without VehiclePhoto get one row each; re-run does not duplicate (unique on vehicleId + fileObjectId). |
| Dry-run vs real-run | ✓ | Preview/dry-run: no writes. Apply/real: creates VehiclePhoto rows and audit. |
| Primary photo rules | ✓ | First new photo set primary only when vehicle has no existing primary. |
| Max 20 photos per vehicle | ✓ | Backfill uses `slotCount = MAX_PHOTOS_PER_VEHICLE - existingCount`; list capped. |
| Bulk jobs list filtering | ✓ | `status` filter passed to DB; pagination via limit/offset. |
| Price-to-market deterministic and labeled | ✓ | Internal comps or book value; "No Market Data" when neither; sourceLabel in response. |
| Days-to-turn deterministic | ✓ | daysInStock from createdAt; turnRiskStatus from target 45 and 1.5×; aging bucket from spec. |
| Media manager zero-photo state | ✓ | Single large full-width dropzone; upload/drag unchanged. |
| No upload regressions | ✓ | VehiclePhotosManager: same POST/reorder/primary/delete; no change to API calls. |

---

## Regression checklist

| Area | Verification |
|------|--------------|
| Inventory list server-first | ✓ | Page still uses `getInventoryPageOverview` with initial data; list items now include daysInStock, turnRiskStatus, priceToMarket. |
| Add Vehicle flow | ✓ | No changes to new vehicle route or form. |
| VIN decode / book value / recon / floorplan | ✓ | No changes to those services or routes. |
| Inventory alerts | ✓ | No changes to alerts service or counts. |
| Existing tests | ✓ | Bulk list route test (4), price-to-market helpers (12), inventory [id] route test (6) run and pass. |

---

## Tests run (from repo root / apps/dealer)

```bash
# From apps/dealer
npx jest app/api/inventory/bulk/import/route.test.ts
npx jest modules/inventory/tests/price-to-market.test.ts
npx jest "app/api/inventory/[id]/route.test.ts"
```

- **bulk/import/route.test.ts:** 4 tests (200 + filter, 400 invalid limit, 403 FORBIDDEN).
- **price-to-market.test.ts:** 12 tests (computeDaysInStock, agingBucketFromDays, turnRiskStatus).
- ** [id]/route.test.ts:** 6 tests (GET/PATCH/DELETE 400 invalid UUID, 403 FORBIDDEN).

**Result:** All 22 tests passed.

---

## Manual smoke (recommended)

1. **Inventory list:** Load `/inventory`; confirm Days, Turn, Market columns and Import history link.
2. **Import history:** Click "Import history"; confirm dialog loads and shows job table or empty state.
3. **Vehicle detail:** Open a vehicle; confirm "Market & turn" card when intelligence is returned.
4. **Edit vehicle → Media:** Open media manager; confirm zero-photo large dropzone and thumbnail hover "View / Manage".
5. **Backfill (if applicable):** Run script with `--dealership <id>` and `--dry-run`; confirm summary output; with `--apply` confirm VehiclePhoto rows and audit.

---

**Summary:** Correctness and regression checks pass per checklist. New tests pass. Manual smoke recommended before release.
