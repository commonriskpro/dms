# Inventory Intelligence Dashboard — Implementation Report (Step 4)

## Deliverables

1. **Spec:** `apps/dealer/docs/INVENTORY_INTELLIGENCE_DASHBOARD_SPEC.md`
2. **Backend:** `modules/inventory/service/inventory-intelligence-dashboard.ts` + DB helpers in `vehicle`, `book-values`, `floorplan-loan`
3. **Frontend:** Route `app/(app)/inventory/dashboard/page.tsx` + `InventoryDashboardContent.tsx` + components under `components/inventory/dashboard/`
4. **Tests:** `modules/inventory/tests/inventory-intelligence-dashboard.test.ts` (RBAC, validation, response shape when DB available)
5. **This report**

---

## Metrics Heuristics Used

- **Inventory Value:** Sum over non-SOLD vehicles of (book value retail when present, else total cost: auction + transport + recon + misc). Uses `getNonSoldVehicleCosts` and `getRetailCentsMap`.
- **Market Avg / Price to Market:** Fleet-level: `marketAvgCents = inventoryValueCents / totalUnits`; vehicle price = current aggregate sale price (non-SOLD). `deltaPct = (salePriceAggregate - marketAvg) / marketAvg`. Label: &lt;−2% Below Market, −2% to +2% At Market, &gt;+2% Above Market, else NA.
- **Days to Turn:** No sold-vehicle history in this pass → `valueDays: null`, `status: "na"`. Target = 45 days. When data exists, status: good (≤ target), warn (≤ 1.5× target), bad (&gt; 1.5× or &gt;90), na.
- **Demand Score:** No external or velocity data → `score: null`, `label: "NA"`.
- **Turn Performance:** `avgDaysToSell: null` (no history). Aging bucket percentages from current inventory counts (&lt;30, 30–60, 60–90, &gt;90 days in stock) from `countByAgingBuckets`.
- **Alert Center:** Reused `getAlertCounts` (missing photos, stale &gt;90d, recon overdue) + `countOverdue` for floor plan (ACTIVE loan with `curtailmentDate < today`). Added “Price Above Market” when fleet deltaPct &gt; 5% and totalUnits &gt; 0.

---

## N/A States

- **Days to Turn:** Shown as “—” when `valueDays` is null; status “N/A”.
- **Demand Score:** Shown as “N/A” when score is null.
- **Price to Market:** “—” when label is “NA” (e.g. no market baseline).
- **Turn Performance:** “—” for avg days to sell when null; aging buckets always show percentages (0–100).

---

## Future Integration Notes

- **External market data:** Plug in vAuto/KAR or similar for Price to Market and Demand Score.
- **Sold-vehicle history:** Persist sold date (or use deal/vehicle status history) to compute actual days to sell and turn performance.
- **Configurable targets:** Store days-to-turn target (and optionally alert thresholds) per dealership.
- **Alert list filters:** Backend list currently filters by `alertType=STALE` (createdAt ≤ 90d). `alertType=MISSING_PHOTOS`, `RECON_OVERDUE`, and `floorplanOverdue=1` are accepted in the URL and passed to the service but do not yet filter the vehicle list (counts and links are correct).

---

## RBAC & Tenant Isolation

- **RBAC:** Dashboard and service require `inventory.read`. No `deals.read`/`crm.read` for this view. Test: user without `inventory.read` receives FORBIDDEN.
- **Tenant isolation:** All reads scoped by `ctx.dealershipId`; `requireTenantActiveForRead(dealershipId)` before any data access. No cross-tenant caching; page uses `noStore()` and `dynamic = "force-dynamic"`.

---

## Verification

- **Lint:** Run `npm -w apps/dealer run lint` from repo root (may require correct Next.js project dir).
- **Build:** Run `npm -w apps/dealer run build` from repo root (requires Prisma generate + DB available as needed).
- **Tests:** Run `npm -w apps/dealer run test`; `inventory-intelligence-dashboard.test.ts` covers RBAC, validation, and (with DB) response shape.

---

## File List

| Area        | File |
|------------|------|
| Spec       | `apps/dealer/docs/INVENTORY_INTELLIGENCE_DASHBOARD_SPEC.md` |
| Backend    | `apps/dealer/modules/inventory/service/inventory-intelligence-dashboard.ts` |
| Backend    | `apps/dealer/modules/inventory/db/vehicle.ts` (getNonSoldVehicleCosts, createdAtLte filter) |
| Backend    | `apps/dealer/modules/inventory/db/book-values.ts` (getRetailCentsMap) |
| Backend    | `apps/dealer/modules/inventory/db/floorplan-loan.ts` (countOverdue) |
| Backend    | `apps/dealer/modules/inventory/service/index.ts` (export) |
| Frontend   | `apps/dealer/app/(app)/inventory/dashboard/page.tsx` |
| Frontend   | `apps/dealer/app/(app)/inventory/dashboard/InventoryDashboardContent.tsx` |
| Frontend   | `apps/dealer/components/inventory/dashboard/InventoryDashboardKpis.tsx` |
| Frontend   | `apps/dealer/components/inventory/dashboard/InventoryIntelligencePanel.tsx` |
| Frontend   | `apps/dealer/components/inventory/dashboard/PriceToMarketCard.tsx` |
| Frontend   | `apps/dealer/components/inventory/dashboard/DaysToTurnCard.tsx` |
| Frontend   | `apps/dealer/components/inventory/dashboard/TurnPerformanceCard.tsx` |
| Frontend   | `apps/dealer/components/inventory/dashboard/AlertCenterCard.tsx` |
| Tests      | `apps/dealer/modules/inventory/tests/inventory-intelligence-dashboard.test.ts` |
| Report     | `apps/dealer/docs/INVENTORY_INTELLIGENCE_DASHBOARD_REPORT.md` |
