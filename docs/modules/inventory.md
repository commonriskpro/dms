# Inventory Module

## Purpose and scope

- Vehicle CRUD (create, read, update, soft delete).
- VIN decode via NHTSA vPIC API (no persistence).
- Vehicle photos in Supabase Storage bucket `inventory-photos`, linked via FileObject (entityType=Vehicle, entityId=vehicleId).
- Pricing and acquisition cost on Vehicle (purchasePrice, reconditioningCost, otherCosts, listPrice).
- Status workflow: AVAILABLE, PENDING, SOLD, WHOLESALE.
- Inventory aging report (days in stock).

## Routes

| Method | Path | Purpose | Permission(s) | Audit |
|--------|------|---------|----------------|--------|
| GET | /api/inventory | List vehicles (paginated, filterable) | inventory.read | No |
| POST | /api/inventory | Create vehicle | inventory.write | vehicle.created |
| GET | /api/inventory/[id] | Get vehicle detail + photo metadata | inventory.read | No |
| PATCH | /api/inventory/[id] | Update vehicle | inventory.write | vehicle.updated, vehicle.status_changed (if status changed) |
| DELETE | /api/inventory/[id] | Soft-delete vehicle | inventory.write | vehicle.deleted |
| POST | /api/inventory/vin-decode | Decode VIN (no persist) | inventory.read | vin.decode.requested |
| POST | /api/inventory/[id]/photos | Upload vehicle photo | inventory.write, documents.write | file.uploaded, vehicle.photo_uploaded |
| GET | /api/inventory/[id]/photos | List vehicle photo metadata | inventory.read, documents.read | No (signed URL request audits file.accessed) |
| DELETE | /api/inventory/[id]/photos/[fileId] | Delete vehicle photo | inventory.write, documents.write | file.deleted |
| GET | /api/inventory/aging | Aging report (days in stock) | inventory.read | No |

## Permissions

- **inventory.read** — List vehicles, get vehicle detail, list photo metadata, VIN decode, aging report.
- **inventory.write** — Create/update/delete vehicles, upload/delete vehicle photos (requires also **documents.write** for photo operations).
- **documents.read** — Required to list vehicle photos and obtain signed URLs (GET /api/files/signed-url).
- **documents.write** — Required to upload or delete vehicle photos.

## Data model summary

- **Vehicle** — Tenant-scoped; id, dealershipId, vin, year, make, model, trim, stockNumber, mileage, color, status (enum), salePriceCents, auctionCostCents, transportCostCents, reconCostCents, miscCostCents, locationId (FK DealershipLocation), timestamps, deletedAt, deletedBy. Stock number uniqueness enforced in app layer (no DB unique) so stock can be reused after soft delete. **VIN unique per dealership:** `@@unique([dealershipId, vin])`. Indexes: dealershipId; (dealershipId, status); (dealershipId, createdAt); (dealershipId, stockNumber); (dealershipId, vin).

## VIN dedupe before migration

Before applying migration `20250303000000_inventory_vehicle_lifecycle_costs` on a database that may have duplicate VINs per dealership, run: `npx tsx scripts/dedupe-vins.ts`. The script keeps the newest vehicle (by createdAt) per (dealershipId, vin) and sets `vin = null` on older duplicates. See **docs/DEPLOYMENT.md** (§ Prisma migrations).
- **FileObject** (core-platform) — Links photos to vehicles via entityType=Vehicle, entityId=vehicleId; bucket `inventory-photos`; path prefixed by dealershipId and vehicleId. Indexes: dealershipId; (dealershipId, createdAt); (dealershipId, bucket, entityType, entityId).

## Security

- **Tenant scoping:** All DB access uses `dealershipId` from auth/session. Vehicle `[id]` and photo `fileId` are validated against the active dealership before any read/update/delete; cross-tenant requests return 404/403.
- **Upload validation (photos):** Mime allowlist `image/jpeg`, `image/png`, `image/webp`; max size 10MB; path/filename sanitized (no path traversal or control chars); storage path prefixed by `dealershipId` and `vehicleId`.
- **Audit metadata:** No PII in audit log (vehicleId, stockNumber, status, fileId, bucket only).

## Security guarantees

- **Tenant isolation:** All list, get, update, delete, and photo operations are scoped by the active dealership from the session. Cross-tenant vehicle or photo IDs return **404 NOT_FOUND**. List, search, filter, and pagination return only the current dealership’s vehicles.
- **RBAC:** Every route enforces **inventory.read** (list, detail, aging, VIN decode, photo metadata) or **inventory.write** (create, update, delete vehicles; upload/delete photos; photo write also requires **documents.write**). No undocumented admin bypass; missing permission returns **403 FORBIDDEN**.
- **Money integrity:** All prices and costs are stored and transmitted as integer cents (e.g. `salePriceCents`). No raw payment card data is stored; inventory does not handle payments.
- **VIN uniqueness:** VIN is unique per dealership (`@@unique([dealershipId, vin])`). Duplicate VIN create returns **409 CONFLICT**. A dedupe script is available for pre-migration cleanup (see VIN dedupe above).
- **Deprecated aliases:** Response fields `listPriceCents`, `purchasePriceCents`, `reconditioningCostCents`, `otherCostsCents` (and aging `listPriceCents`) are deprecated aliases for `salePriceCents`, `auctionCostCents`, `reconCostCents`, `miscCostCents`. Plan: remove deprecated aliases after Step 4 (UI and consumers updated to canonical names).

## Manual test steps

1. Run migrations and seed: `npm run db:migrate`, `npm run db:seed`.
2. Sign in and set active dealership. Ensure role has **inventory.read** and **inventory.write** (and **documents.read** / **documents.write** for photos).
3. **List:** `GET /api/inventory?limit=25&offset=0` — expect `{ data: [], meta: { total, limit, offset } }`.
4. **Create:** `POST /api/inventory` with body `{ "stockNumber": "STK-001", "make": "Honda", "model": "Civic", "year": 2022 }` — expect 201 and created vehicle. Repeat with same stockNumber — expect 409 CONFLICT.
5. **Get:** `GET /api/inventory/<id>` — expect vehicle with optional location and photos array.
6. **Update:** `PATCH /api/inventory/<id>` with `{ "status": "SOLD" }` — expect 200; verify audit has vehicle.status_changed and vehicle.updated.
7. **VIN decode:** `POST /api/inventory/vin-decode` with `{ "vin": "1HGBH41JXMN109186" }` — expect 200 and `{ data: { year, make, model, ... } }` (no persist).
8. **Upload photo:** `POST /api/inventory/<id>/photos` (multipart, field `file`, image/jpeg or image/png or image/webp, max 10MB) — expect 201; then `GET /api/inventory/<id>/photos` — expect list with file id; use `GET /api/files/signed-url?fileId=<id>` for URL. Disallowed mime or oversized file — expect 400/422.
9. **Delete photo:** `DELETE /api/inventory/<id>/photos/<fileId>` — expect 204.
10. **Aging:** `GET /api/inventory/aging?status=AVAILABLE&sortBy=daysInStock&sortOrder=desc` — expect `{ data: [{ vehicleId, stockNumber, daysInStock, ... }], meta }`.
11. **Tenant isolation:** As another dealership (switch context), GET /api/inventory — must not see first dealership’s vehicles. GET /api/inventory/<other-dealer-vehicle-id> — 404. Attempt to upload/delete photo for other dealer’s vehicle or with cross-tenant fileId — 404.
12. **RBAC:** As user with only inventory.read, POST /api/inventory — expect 403. As user without inventory.read, GET /api/inventory (list, detail, aging, photos, vin-decode) — expect 403. As user without inventory.write, PATCH/DELETE vehicle or POST/DELETE photos — expect 403. As user without documents.read, GET /api/inventory/<id>/photos — expect 403. As user without documents.write, POST/DELETE photos — expect 403.
