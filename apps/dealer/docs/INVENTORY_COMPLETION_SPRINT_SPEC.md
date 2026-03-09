# Inventory Completion Sprint — Specification

**Document path:** `apps/dealer/docs/INVENTORY_COMPLETION_SPRINT_SPEC.md`  
**Mode:** Execute through strict 4-step flow (Spec → Backend → Frontend → Security & QA).  
**Goal:** Finish remaining inventory V1 gaps so the dealer app inventory system is production-complete for V1.

---

## 1. Goal / scope

**Sprint objective:** Finish remaining inventory V1 gaps.

**In-scope (6 areas):**

1. **Legacy vehicle photo backfill** — Complete backfill of FileObject → VehiclePhoto; idempotent, dry-run/real-run, batch-safe, tenant-safe; script + audit + reporting.
2. **Bulk import jobs list** — GET endpoint for BulkImportJob list with status filter and pagination; minimal UI visibility for job history/status.
3. **Edit Vehicle / Media Manager polish** — Zero-photo large empty-state/dropzone; clearer preview/thumbnail affordances; modal centering and spacing; optional ghost placeholders only if clean.
4. **Price-to-market intelligence** — Per-vehicle (or list-level where appropriate) market position: Below/At/Above Market or No Market Data; delta amount/percent; honest source/confidence label; reuse book value/internal comps.
5. **Days-to-turn analytics** — Grounded operational metric: days in stock, aging bucket, target turn threshold, turn-risk status; no fake ML; show in list/detail and optionally alerts.
6. **Final inventory QA / security / hardening** — Step 4 checklists and three reports (Security, Smoke, Perf).

**Out of scope:** Full redesign of inventory list; stack/architecture changes; speculative marketplace integrations; unrelated dashboard/CRM; broad refactors unless needed for correctness.

---

## 2. Current implemented state

**Existing inventory assets to reuse:**

| Area | Location | Notes |
|------|----------|--------|
| Inventory list | `modules/inventory/service/inventory-page.ts`, `ListPage.tsx`, `InventoryPageContentV2.tsx` | Server-first; filters, sort, pagination. |
| Serializers | `modules/inventory/api-response.ts`, route-level responses | Vehicle, photos, etc. |
| Alerts | `modules/inventory/service/alerts.ts`, `InventoryAlertsCard` | Missing photos, stale, recon, floorplan. |
| VIN decode cache | `modules/inventory/service/vin-decode-cache.ts` | Cached decode. |
| Book values | `modules/inventory/service/book-values.ts`, `db/book-values.ts` | Retail/trade/wholesale/auction; source. |
| Recon workflow | `modules/inventory/service/recon.ts`, recon routes | Items, line items. |
| Floorplan | `modules/inventory/service/floorplan.ts`, floorplan loans | Integration. |
| Add Vehicle | `app/(app)/inventory/new/`, `VehicleForm`, addVehicle schema | Full flow. |
| VehiclePhoto | `modules/inventory/db/vehicle-photo.ts`, photos API | CRUD, reorder, primary, max 20. |
| FileObject legacy | `vehicle-photo.ts` → `listFileObjectsForVehicleWithoutVehiclePhoto` | Legacy blob metadata. |
| Backfill service | `modules/inventory/service/vehicle-photo-backfill.ts` | previewBackfillForDealership, runBackfillForDealership, runBackfillForAllDealerships. |
| Backfill script | `scripts/backfill-vehicle-photos.ts` | --dealership, --apply, --dry-run, --limit-vehicles, --cursor. |
| Backfill API | `app/api/admin/inventory/vehicle-photos/backfill/preview/route.ts`, `apply/route.ts` | Admin preview/apply. |
| BulkImportJob | `modules/inventory/db/bulk-import-job.ts` | create, getById, update, **listBulkImportJobs** (limit, offset, status). |
| Bulk import API | `app/api/inventory/bulk/import/[jobId]/route.ts`, preview, apply | No **list** route yet. |
| Bulk schemas | `app/api/inventory/schemas.ts` | `listBulkImportJobsQuerySchema` (limit, offset, status). |
| Intelligence dashboard | `modules/inventory/service/inventory-intelligence-dashboard.ts` | KPIs, priceToMarket (fleet-level), turnPerformance (aging buckets), alert center; **daysToTurn.valueDays currently null**; **priceToMarket is fleet-level only**. |
| Vehicle DB | `modules/inventory/db/vehicle.ts` | listVehicles, getFleetInternalCompsAvgCents, countByAgingBuckets, listForAging. |
| Media manager UI | `modules/inventory/ui/components/VehiclePhotosManager.tsx` | Used in Edit vehicle tab and in Dialog in `EditVehicleUi.tsx`. |
| Edit vehicle | `app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx` | Tabs; Dialog for "Manage media" with VehiclePhotosManager. |

**Conventions to preserve:** Server-first data loading; `unstable_noStore` from `next/cache`; Prisma + Postgres; Supabase auth/session; multi-tenant isolation; RBAC; Zod at edge; Jest; semantic design tokens only (no Tailwind palette); shadcn/ui; audit and rate-limit utilities.

---

## 3. Legacy vehicle photo backfill

**Source of truth:** VehiclePhoto. FileObject is legacy blob metadata only.

**Backfill behavior:**

- **Input:** Legacy FileObjects (bucket `inventory-photos`, entityType `Vehicle`, entityId = vehicleId) that have no corresponding VehiclePhoto.
- **Ordering:** Deterministic order by `FileObject.createdAt` ascending (existing helper `listFileObjectsForVehicleWithoutVehiclePhoto` already returns in this order).
- **Max photos per vehicle:** 20. If existing VehiclePhoto count + legacy count > 20, create only the first `(20 - existingCount)` legacy rows; log skipped count and include in audit/summary.
- **Primary:** Set `isPrimary: true` only on the first new VehiclePhoto (first in createdAt order) when the vehicle has **no** existing primary. Otherwise do not change primary.
- **Duplicates:** Skip safely (only create VehiclePhoto for FileObjects that do not already have a VehiclePhoto row).
- **Tenant safety:** All operations scoped by `dealershipId`. Script and API support dealership-scoped runs; service supports all-dealership via `runBackfillForAllDealerships` (batch of dealerships).
- **Batching:** Per dealership: list vehicle IDs in batches (e.g. 100 vehicles, cap 500 for API). Use offset-based cursor for script resumability.
- **Dry-run vs real run:** Default dry-run; explicit `--apply` (script) or POST apply endpoint (API) for real execution. No DB writes in dry-run.
- **Idempotency:** Re-running after a successful run must not create duplicate VehiclePhoto rows (same fileObjectId for same vehicle); safe to run multiple times.
- **Audit:** Emit `vehicle_photo.backfilled` per vehicle with metadata `{ countCreated, countSkipped, fileObjectIds }`; dealershipId and actorUserId (null for script).
- **Reporting/summary:** Output: vehiclesProcessed, vehiclesWithLegacy, photosCreated, photosSkipped; optional nextOffset/nextCursor for resumable runs. Per-vehicle detail in preview only.

**Script and service entrypoints:**

- **Script:** `scripts/backfill-vehicle-photos.ts`. Run from repo root: `npm -w apps/dealer run db:backfill-vehicle-photos -- [options]`. Options: `--dealership <uuid>` (required for V1), `--apply`, `--dry-run`, `--limit-vehicles`, `--cursor`. V1: single-dealership only from script; all-dealership remains API/service only unless we add `--all-dealership` later.
- **Service:** `modules/inventory/service/vehicle-photo-backfill.ts` — already implements preview and run; ensure summary and nextOffset are returned and audit is consistent.
- **API:** Existing admin backfill preview/apply routes; no change required unless RBAC or rate-limit needs tightening.

**Deliverables:** Backfill behavior is already implemented; ensure script outputs summary clearly, supports cursor for resumable batches, and tests cover preview/run/cap/primary/idempotency. Add or update backend doc section.

---

## 4. Bulk import jobs list

**Endpoint:** `GET /api/inventory/bulk/import` (or `GET /api/inventory/bulk/jobs` — choose one and stick to repo convention).

**Behavior:**

- **Purpose:** Return paginated list of BulkImportJob for the authenticated dealership.
- **Query (validated):** Use existing `listBulkImportJobsQuerySchema`: `limit` (1–100, default 25), `offset` (default 0), optional `status` (`PENDING` | `RUNNING` | `COMPLETED` | `FAILED`).
- **Pagination shape:** Response: `{ data: BulkImportJobListItem[], total: number }` (or `nextOffset` if cursor-style; for V1 offset-based is sufficient). No total count required if expensive; at least `data` and a way to request more (e.g. next page via offset).
- **RBAC:** Require `inventory.read` (listing jobs is read). Optionally restrict to `inventory.write` if only import users should see jobs; spec recommends `inventory.read` for visibility.
- **Tenant isolation:** All jobs filtered by `dealershipId` from auth context.
- **Serializer:** Client-safe fields only: id, status, totalRows, processedRows, createdAt, completedAt, createdBy (optional; or omit for privacy). errorsJson only if needed for support (optional; can be omitted in list).
- **Response schema:** Document in spec; backend implements consistent with existing inventory API response shape.

**Minimal V1 UI:** At least one of: recent import jobs panel on inventory import flow/page; jobs table/section with status, created time, counts, result summary; or lightweight history modal. No overbuilding.

**Files:** Add `app/api/inventory/bulk/import/route.ts` (GET) or `app/api/inventory/bulk/jobs/route.ts` (GET); use `listBulkImportJobs` from `modules/inventory/db/bulk-import-job.ts`; validate query with `listBulkImportJobsQuerySchema`; enforce RBAC and tenant; return serialized list.

---

## 5. Edit Vehicle / Media Manager polish

**Exact UX requirements:**

1. **Zero-photo state**
   - Becomes a **large full-width centered empty-state/dropzone** (not a small tile).
   - Clearly centered in the available space.
   - Generous breathing room (padding/spacing).
   - Visually primary when there are no photos; click/tap to upload remains easy.
   - When used inside the modal, this empty state should dominate the modal content area.

2. **Media preview and thumbnails**
   - Left media preview and thumbnails should feel **clearly clickable/manageable**.
   - **Hover/focus affordance:** visible hover and focus-visible states (e.g. ring, background change).
   - **Helper text or overlay** that makes actions obvious (e.g. "Click to manage", "Set primary", "Delete").
   - Selected state more obvious where applicable.
   - Preserve current management behavior (upload, reorder, set primary, delete).

3. **Modal composition / spacing**
   - **Center content vertically** better inside the modal.
   - **Reduce top-heavy feeling:** avoid crowding content at the top; add spacing rhythm.
   - **Improve spacing** between header and body and within body.
   - Keep modal usable on smaller screens (no overflow issues).

4. **Optional ghost placeholders**
   - Only add **if clean and not visually noisy**.
   - Subtle ghost/example placeholder tiles behind empty state.
   - Must stay within semantic token styling (e.g. `var(--surface)`, `var(--border)`).
   - If in doubt, omit for V1.

**Constraints:**

- Preserve current upload behavior and routes (POST photos, reorder, primary, delete).
- Preserve accessibility and keyboard usability.
- Token-based styling only; no random Tailwind palette classes.
- No regression to upload or delete flows.

**Where:** `VehiclePhotosManager.tsx` (zero-photo block and thumbnail/preview affordances); `EditVehicleUi.tsx` (Dialog/DialogContent styling for centering and spacing). If the media manager is also rendered inline in the Media tab, the same zero-photo and thumbnail rules apply there.

---

## 6. Price-to-market intelligence

**Product behavior:**

- **Data source strategy:** Use existing patterns in order of preference:
  1. **Internal comps:** Same dealership, same make+model (or make/model group), average sale price from non-SOLD vehicles; require minimum cohort size (e.g. ≥ 3) for stability. Reuse or extend `getFleetInternalCompsAvgCents`-style logic for **per-vehicle** comparison (e.g. get average for vehicle’s make+model, compare to this vehicle’s salePriceCents).
  2. **Book value retail:** If available for the vehicle, use as market baseline when internal comps are not available.
  3. **Fallback:** If neither internal comps nor book value is available, return explicit **"No Market Data"** state; do not invent external comps.
- **Output shape (per-vehicle or fleet):**
  - **marketStatus:** `Below Market` | `At Market` | `Above Market` | `No Market Data`
  - **marketDeltaCents:** number | null (vehicle price minus market baseline; only when baseline exists)
  - **marketDeltaPercent:** number | null (e.g. (price - baseline) / baseline; only when baseline exists)
  - **sourceLabel:** string (e.g. "Internal comps", "Book value", "No data") for honesty.
- **Thresholds:** Use existing fleet logic: e.g. ±2% for "At Market"; outside that band = Below/Above. Constants: e.g. `PRICE_TO_MARKET_THRESHOLD_PCT = 0.02`.
- **Where shown:**
  - **Inventory list:** Concise badge or column (e.g. "At Market", "Above Market", "—" for no data).
  - **Vehicle detail/edit page:** Small intelligence card or row with status, delta, and source label.
  - **Dashboard/alerts:** Already have fleet-level PRICE_OVER_MARKET alert; keep scope controlled; optional per-vehicle in alert list later.
- **Caching:** If computation is expensive (e.g. per-vehicle comps for large lists), cache per vehicle or per list batch with short TTL; otherwise compute on demand. Document strategy in backend report.
- **Validation and fallback:** If salePriceCents is missing or zero, treat as "No Market Data". No fake precision; round percentages to one decimal when displaying.

**Implementation note:** Dashboard currently has fleet-level priceToMarket only. Add either:
- A **per-vehicle** price-to-market helper (e.g. `getPriceToMarketForVehicle(dealershipId, vehicleId)` or batch `getPriceToMarketForVehicles(dealershipId, vehicleIds)`) that returns the output shape above, **or**
- Extend list/detail payloads to include a `priceToMarket` field computed from existing book value + internal comps. Architect choice: per-vehicle helper used by list serializer and detail endpoint.

---

## 7. Days-to-turn analytics

**Chosen V1 behavior (operational, no fake ML):**

- **Metrics:**
  - **daysInStock:** `floor((now - createdAt) / 86400000)`. Already used in aging page and list; ensure consistent definition.
  - **agingBucket:** `"<30"` | `"30-60"` | `"60-90"` | `">90"` based on daysInStock.
  - **targetTurnDays:** Configurable constant (e.g. 45); same as `DAYS_TO_TURN_TARGET` in intelligence dashboard.
  - **turnRiskStatus:** `good` (daysInStock ≤ target) | `warn` (daysInStock ≤ target × 1.5) | `bad` (above that) | `na` (e.g. no createdAt).
- **Historical average days-to-sale:** If the codebase has sold-vehicle or deal data with sale date, we can compute historical average days-to-sale by make/model or fleet and show it as "Avg days to sell" for context. If not available or not reliable, omit for V1 and label only operational metrics.
- **Where shown:**
  - **Inventory list:** Column for days in stock and/or turn-risk badge.
  - **Vehicle detail/edit:** Small card or row: days in stock, aging bucket, target, turn-risk status.
  - **Alerts:** Existing "Units > 90 Days" and aging buckets; turn-risk can feed into alert center or filters if natural.
- **Formulas and fallbacks:**
  - daysInStock: use vehicle.createdAt; if missing, treat as `na` and do not show misleading number.
  - agingBucket: derived from daysInStock; boundaries: 0–29 → "<30", 30–59 → "30-60", 60–89 → "60-90", 90+ → ">90".
  - turnRiskStatus: good ≤ 45, warn ≤ 67 (45×1.5), bad > 67; target = 45 unless overridden by config.

**Implementation:** Reuse `countByAgingBuckets` and aging list logic where applicable. Add daysInStock and turnRiskStatus (and optionally agingBucket) to list item payload and to vehicle detail payload. Dashboard KPIs can set `daysToTurn.valueDays` to a fleet average of daysInStock if we have no sold-date data (optional); otherwise keep "na" and show aging buckets + per-vehicle metrics in list/detail.

---

## 8. Server / data-flow expectations

- **Server-first:** Keep server-first patterns for list, detail, and dashboard; no fetch-on-mount regressions.
- **Service-direct loads:** Use service layer and serializers consistently; avoid ad-hoc Prisma in route handlers.
- **Determinism:** Price-to-market and days-to-turn outputs must be deterministic for the same inputs; caching must invalidate appropriately (e.g. when vehicle or book values change).

---

## 9. RBAC / security

- **Backfill:** Admin-only (e.g. `admin.roles.write` or `admin.permissions.manage`); script runs with system context (no user); API apply/preview must check admin permission.
- **Bulk import jobs list:** `inventory.read` (or `inventory.write` if we restrict to import users); tenant isolation by dealershipId from auth.
- **Price-to-market / days-to-turn:** Read-only; same permission as inventory list/detail (`inventory.read`).
- **Media manager:** Existing permissions (`documents.read`, `documents.write`, `inventory.write`); no new routes.
- **Tenant isolation:** All new routes and services must scope by `dealershipId` from auth/session; backfill script must only process the given dealership(s).
- **Rate limiting:** Apply existing rate-limit standards to any new mutation routes; list endpoints can use same limits as other inventory list endpoints.
- **Validation:** Strict Zod validation for bulk jobs list query (limit, offset, status); reject invalid with 400.

---

## 10. Acceptance criteria

**Legacy backfill**

- [ ] Preview (dry-run) returns correct counts and per-vehicle fileObjectIdsToCreate/skipped/wouldSetPrimary.
- [ ] Apply creates VehiclePhoto rows only for legacy FileObjects without a VehiclePhoto; max 20 per vehicle; primary set only when vehicle had no primary.
- [ ] Re-running apply is idempotent (no duplicate VehiclePhoto rows).
- [ ] Script runs from repo root with --dealership; summary output is printed; --apply performs writes.
- [ ] Audit event vehicle_photo.backfilled is emitted per vehicle with correct metadata.
- [ ] Tenant isolation: only vehicles of the given dealership are processed.

**Bulk import jobs list**

- [ ] GET list endpoint returns paginated jobs for the authenticated dealership only.
- [ ] Status filter works; invalid query returns 400; forbidden returns 403.
- [ ] Response is serialized (client-safe); total or nextOffset provided as per design.
- [ ] Minimal UI shows recent jobs with status and key counts (V1).

**Edit Vehicle / Media Manager polish**

- [ ] Zero-photo state is a large full-width centered empty-state/dropzone with breathing room.
- [ ] Preview and thumbnails have clear hover/focus and helper text/overlay; selected state is obvious.
- [ ] Modal content is better centered and spaced; less top-heavy.
- [ ] Upload, reorder, set primary, delete still work; no accessibility regression.

**Price-to-market**

- [ ] Per-vehicle (or list-level) market status, delta, and source label returned where specified.
- [ ] "No Market Data" when no internal comps or book value; no fake data.
- [ ] Shown in list (badge/column) and vehicle detail/edit (card/row).
- [ ] Deterministic and honestly labeled.

**Days-to-turn**

- [ ] daysInStock and turnRiskStatus (and aging bucket where specified) available in list and/or detail.
- [ ] Formulas match spec (target 45, warn at 1.5×).
- [ ] Shown in list and vehicle detail; optional in alerts.

**Regression**

- [ ] Inventory list still loads server-first; Add Vehicle flow works; VIN decode, book value, recon, floorplan, alerts unchanged.
- [ ] Existing tests pass; new tests added for new behavior.

---

## 11. File plan (Steps 2–4)

**Step 2 — Backend**

| Action | File(s) |
|--------|--------|
| Keep/complete | `modules/inventory/service/vehicle-photo-backfill.ts` |
| Keep/complete | `scripts/backfill-vehicle-photos.ts` (summary output, cursor) |
| Add | `app/api/inventory/bulk/import/route.ts` (GET list) or equivalent |
| Add/update | Service helper for list bulk jobs (if not in bulk.ts) + serializer |
| Add/update | Per-vehicle price-to-market helper + integration in list/detail |
| Add/update | Days-to-turn fields in list/detail payloads (daysInStock, turnRiskStatus, agingBucket) |
| Add/update | Zod schemas where needed (bulk list response) |
| Add | Jest tests: backfill (preview/run/cap/primary/idempotency), bulk list (list, filter, 400, 403, tenant), price-to-market, days-to-turn |
| Add | `apps/dealer/docs/INVENTORY_COMPLETION_BACKEND_REPORT.md` |

**Step 3 — Frontend**

| Action | File(s) |
|--------|--------|
| Add/update | Bulk import jobs UI (panel/table/modal) on import flow or inventory page |
| Update | `modules/inventory/ui/components/VehiclePhotosManager.tsx` (zero-photo state, thumbnail affordances) |
| Update | `app/(app)/inventory/[id]/edit/ui/EditVehicleUi.tsx` (Dialog spacing/centering) |
| Update | List table/cards: price-to-market badge/column, days-to-turn column/badge |
| Update | Vehicle detail/edit: price-to-market card/row, days-to-turn card/row |
| Add/update | Jest/component tests: media manager empty state, jobs list, price-to-market/days-to-turn display, no-data states |
| Add | `apps/dealer/docs/INVENTORY_COMPLETION_FRONTEND_REPORT.md` |

**Step 4 — Security & QA**

| Action | File(s) |
|--------|--------|
| Add | `apps/dealer/docs/STEP4_INVENTORY_COMPLETION_SECURITY_REPORT.md` |
| Add | `apps/dealer/docs/STEP4_INVENTORY_COMPLETION_SMOKE_REPORT.md` |
| Add | `apps/dealer/docs/STEP4_INVENTORY_COMPLETION_PERF_REPORT.md` |

---

*End of spec. No code until spec is complete; implementation follows Steps 2–4.*
