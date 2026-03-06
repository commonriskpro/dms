# Inventory Completion Sprint — Frontend Report

**Step 3 deliverables.** Bulk import jobs visibility, Edit Vehicle / Media Manager polish, price-to-market and days-to-turn UI, and types for intelligence.

---

## A. Bulk import jobs visibility

**Implemented.**

- **Location:** Inventory page (`InventoryPageContentV2`).
- **UI:** "Import history" link (when `canWrite`) next to "View aging report". Opens a dialog that fetches `GET /api/inventory/bulk/import?limit=10&offset=0` and shows a table: Status, Rows (processed/total), Created, Completed.
- **Behavior:** Client-side fetch when dialog opens; loading and error states; empty state when no jobs. Token-based styling only. No overbuilding.

---

## B. Edit Vehicle / Media Manager polish

**Implemented.**

1. **Zero-photo state**
   - Single full-width dropzone: `min-h-[280px]`, `rounded-xl`, `border-2` dashed, larger padding (`px-8 py-14`). Centered content; "Add vehicle photos" and "Drag photos here or click to upload". Removed small ghost tiles to keep focus on the dropzone. Hover: `hover:border-[var(--accent)]`, `hover:bg-[var(--surface)]`; focus-visible ring.

2. **Media preview / thumbnails**
   - Tile: `hover:border-[var(--accent)]`, `hover:ring-2`, `focus-within:ring-2` for clear affordance.
   - Overlay on image: "View / Manage" text on hover (`group-hover/item:opacity-100`), `bg-[var(--surface)]/70`.
   - Actions dropdown already had hover/focus; aligned group name to `group/item` for overlay and menu.

3. **Modal composition (EditVehicleUi)**
   - `DialogContent`: `max-w-3xl`, `flex flex-col`, `max-h-[90vh]`, `py-6`. Header with `pb-4`. Content wrapper: `flex flex-1 min-h-0 overflow-auto justify-center px-1` so content is scrollable and centered. Reduces top-heavy layout.

4. **Ghost placeholders**
   - Not added; zero-photo state is one clear dropzone without extra placeholders.

**Constraints:** Upload, reorder, set primary, delete unchanged. Token-only styling. Accessibility preserved (keyboard, aria-labels).

---

## C. Price-to-market / days-to-turn UI

**Implemented.**

1. **Inventory list (`VehicleInventoryTable`)**
   - **Days:** Column uses `v.daysInStock` when present (fallback to existing `daysInInventory(createdAt)`).
   - **Turn:** New column with `TurnRiskBadge`: "On track" (good), "Aging" (warn), "At risk" (bad), "—" (na). Uses `badgeSuccess`, `badgeWarning`, `badgeDanger`.
   - **Market:** New column with `MarketBadge`: shows `priceToMarket.marketStatus` (Below Market, At Market, Above Market, or "—" for No Market Data). `title={sourceLabel}` for honesty. Token-based badge styles.

2. **Vehicle detail (`VehicleDetailContent`)**
   - **VehicleIntelligenceCard:** New card "Market & turn" shows:
     - Market position: badge + optional source label + delta % vs baseline.
     - Days to turn: days in stock, turn-risk badge, aging bucket and target when present.
   - Rendered only when `vehicle.intelligence` is present (API now returns it from `GET /api/inventory/[id]`).

3. **Types**
   - `VehicleDetailResponse` extended with optional `intelligence?: VehicleIntelligence`.
   - `VehicleIntelligence`: `priceToMarket` (marketStatus, marketDeltaCents, marketDeltaPercent, sourceLabel), `daysToTurn` (daysInStock, agingBucket, targetDays, turnRiskStatus).

**No-data / fallback:** List shows "—" for missing market or turn. Detail card returns null when no intelligence. No fake confidence.

---

## D. Frontend tests

- **Existing:** Inventory list and detail flows remain covered by existing tests.
- **New:** No new Jest/component tests added in this step (spec allowed "where appropriate"). Manual verification: list columns render with new fields; import history dialog fetches and shows table; media manager empty state and thumbnails; intelligence card when data present.

---

## E. Files added

- `modules/inventory/ui/components/VehicleIntelligenceCard.tsx` — Market & turn card for detail page.
- `modules/inventory/ui/components/VehicleIntelligenceCard.tsx` (and types in `types.ts`).

## Files modified

- `modules/inventory/ui/types.ts` — `VehicleIntelligence`, `VehicleDetailResponse.intelligence`.
- `modules/inventory/ui/InventoryPageContentV2.tsx` — Import history dialog (state, fetch, table), "Import history" link.
- `modules/inventory/ui/components/VehicleInventoryTable.tsx` — Days column (use `daysInStock`), Turn column (`TurnRiskBadge`), Market column (`MarketBadge`).
- `modules/inventory/ui/components/VehiclePhotosManager.tsx` — Zero-photo large dropzone; thumbnail hover/focus and "View / Manage" overlay.
- `app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx` — Modal spacing and centering for media manager dialog.
- `modules/inventory/ui/VehicleDetailContent.tsx` — `VehicleIntelligenceCard` in left column.

---

*Frontend step complete. Proceed to Step 4 (Security & QA).*
