# Inventory Depth Sprint — Specification

**Document path:** `apps/dealer/docs/INVENTORY_DEPTH_SPRINT_SPEC.md`  
**Stack:** Node 24, npm 11, React 19, Prisma 6.7, Jest 30, TypeScript 5.9. Next 16 App Router, Prisma, Supabase.  
**Non-negotiables:** Multi-tenant (`dealership_id` from auth only), RBAC on every route, Zod at edge, pagination on lists, audit on create/update/delete and sensitive reads, cents-only money, server-first (`noStore`, `force-dynamic`), modal intercepting routes (Option B), Jest only.

---

## Context (existing)

- **Vehicle:** `dealershipId`, `vin`, `stockNumber`, `status`, `salePriceCents`, `reconCostCents`, etc. `VehicleStatus`: AVAILABLE, HOLD, SOLD, WHOLESALE, REPAIR, ARCHIVED.
- **FileObject:** Links to Vehicle via `entityType = "Vehicle"`, `entityId = vehicleId`; bucket `"inventory-photos"`. No order/primary today.
- **Routes:** `GET/POST /api/inventory/[id]/photos`, `DELETE /api/inventory/[id]/photos/[fileId]`. Services: `listVehiclePhotos`, `uploadVehiclePhoto`, `deleteVehiclePhoto`.
- **CSV export:** `GET /api/reports/export/inventory` (query: `asOf?`, `format: "csv"`); permission `reports.export`.
- **InventoryAlertsCard:** Placeholder links (Missing Photos, Units > 90 days, Units Need Recon).

---

# Slice A — Photo/media pipeline beyond basics

## A.1 Scope

- Multi-photo per vehicle: **display order**, **primary flag** (exactly one per vehicle), delete, per-vehicle and global limits (e.g. max 20 per vehicle, max file size 10MB).
- Audit for: add, reorder, set-primary, delete.
- Data model: either extend `FileObject` with `sortOrder` + `isPrimary` for `entityType = Vehicle`, or a join table `VehiclePhoto(vehicleId, fileObjectId, sortOrder, isPrimary)`. Prefer minimal schema change; choice documented below.

## A.2 Schema choice (Slice A)

**Option 1 — Extend FileObject:** Add nullable `sortOrder Int?`, `isPrimary Boolean?` on `FileObject`. Only used when `bucket = 'inventory-photos'` and `entityType = 'Vehicle'`. Minimal schema change (no new table). Downside: pollutes generic FileObject with vehicle-specific semantics; unique constraint for “one primary per vehicle” requires partial unique (e.g. `@@unique([dealershipId, entityType, entityId], where: isPrimary = true)` — Prisma 2.20+ partial unique not in all dialects).

**Option 2 — Join table VehiclePhoto:** New model `VehiclePhoto` with `vehicleId`, `fileObjectId`, `sortOrder`, `isPrimary`. Keeps `FileObject` generic; one clear place for vehicle-photo metadata; straightforward `@@unique([vehicleId])` for primary (one row with `isPrimary = true` per vehicle). Slightly more schema but cleaner boundaries.

**Recommendation:** **Option 2 — VehiclePhoto join table.** Clear ownership, simple uniqueness for primary, no nullable vehicle-only columns on shared `FileObject`. Audit and reorder/set-primary logic live in inventory module.

## A.3 Prisma schema (Slice A)

- **New model: VehiclePhoto**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `vehicleId String @map("vehicle_id") @db.Uuid`
  - `fileObjectId String @map("file_object_id") @db.Uuid`
  - `sortOrder Int` (display order, 0-based or 1-based; consistent per vehicle)
  - `isPrimary Boolean @default(false) @map("is_primary")`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - Relations: `dealership Dealership`, `vehicle Vehicle`, `fileObject FileObject`
  - `@@unique([dealershipId, vehicleId, fileObjectId])` — same file not linked twice to same vehicle
  - At most one primary per vehicle: application-layer enforced (or DB check constraint if desired: one row per vehicle with `isPrimary = true`)
  - `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`
  - FK to Vehicle and FileObject; both scoped by dealership (Vehicle.dealershipId, FileObject.dealershipId)

- **FileObject:** No schema change.

- **Vehicle:** Add relation `vehiclePhotos VehiclePhoto[]` (optional for backward compatibility with existing photo listing that uses FileObject by entityType/entityId).

- **Audit:** Treat VehiclePhoto create/update/delete as critical: audit `vehicle_photo.added`, `vehicle_photo.reordered`, `vehicle_photo.primary_set`, `vehicle_photo.removed`. FileObject delete for inventory photo continues to be audited (document/file delete). No new audit table; use existing AuditLog.

## A.4 API (Slice A)

- **GET /api/inventory/[id]/photos** (existing; extend response)
  - Purpose: List photos for vehicle with order and primary.
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`.
  - Response: `{ data: Array<{ id: string, fileObjectId: string, filename: string, mimeType: string, sizeBytes: number, sortOrder: number, isPrimary: boolean, createdAt: string }> }`. Sorted by `sortOrder`.
  - Dealership from auth; vehicle must belong to dealership.
  - Pagination: not required (bounded by max photos per vehicle, e.g. 20).

- **POST /api/inventory/[id]/photos** (existing; extend behavior)
  - Purpose: Upload a photo; assign next `sortOrder`; if first photo, set as primary.
  - Params: same. Body: multipart form with `file`. Validation: max 20 photos per vehicle (after upload), MIME whitelist `image/jpeg`, `image/png`, `image/webp`, max size 10MB.
  - Response: 201 `{ data: { id, fileObjectId, filename, mimeType, sizeBytes, sortOrder, isPrimary, createdAt } }`.
  - Audit: vehicle_photo.added.

- **PATCH /api/inventory/[id]/photos/reorder** (new)
  - Purpose: Set display order of photos.
  - Body: `reorderBodySchema`: `{ fileIds: z.array(z.string().uuid()).min(1).max(20) }` — ordered list of fileObjectIds for this vehicle.
  - Response: 200 `{ data: { ok: true } }` or return updated list. Audit: vehicle_photo.reordered.

- **PATCH /api/inventory/[id]/photos/primary** (new)
  - Purpose: Set one photo as primary.
  - Body: `setPrimaryBodySchema`: `{ fileId: z.string().uuid() }`.
  - Response: 200 `{ data: { ok: true } }`. Audit: vehicle_photo.primary_set.

- **DELETE /api/inventory/[id]/photos/[fileId]** (existing)
  - Purpose: Remove photo; delete VehiclePhoto row and soft-delete or remove FileObject (per existing behavior). If deleted photo was primary, assign primary to next (e.g. lowest sortOrder).
  - Audit: vehicle_photo.removed (and existing file/entity delete audit as applicable).

**Validation rules (Slice A):**
- Max photos per vehicle: 20.
- Max file size: 10MB.
- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`.
- `dealershipId` from auth only; never from client.

---

# Slice B — Bulk operations

## B.1 Scope

- **Export CSV:** Already exists at `GET /api/reports/export/inventory`. Document it and any extensions (e.g. filter by status).
- **Import:** Preview (validate rows, return validation errors + row numbers), validate-only (no apply), apply (apply validated import). File/row limits: e.g. max 1MB file, max 500 rows per file. Job model for long-running: `BulkImportJob`.
- **Bulk update:** Common fields (e.g. status, locationId) for a list of vehicle IDs; max 50 per request. Validation: all vehicleIds must belong to dealership.

## B.2 Prisma schema (Slice B)

- **New model: BulkImportJob**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `status String` — enum or string: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`
  - `totalRows Int @default(0) @map("total_rows")`
  - `processedRows Int @default(0) @map("processed_rows")`
  - `errorsJson Json? @map("errors_json")` — array of `{ row?: number, message: string }` or similar
  - `createdBy String? @map("created_by") @db.Uuid`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - `completedAt DateTime? @map("completed_at")`
  - Relations: `dealership Dealership`, `createdByProfile Profile?`
  - `@@index([dealershipId])`, `@@index([dealershipId, createdAt])`, `@@index([dealershipId, status])`

- **Audit:** BulkImportJob create and status transitions (e.g. started, completed, failed) are critical; log `bulk_import_job.created`, `bulk_import_job.completed`, `bulk_import_job.failed`. Bulk update of vehicles: audit as vehicle.updated (per vehicle or single audit with count).

- **Optional:** Store import file in blob (e.g. Supabase bucket) or discard after apply; spec leaves this optional (document in “Optional” under B.4).

## B.3 API (Slice B)

**Export (existing):**
- **GET /api/reports/export/inventory**
  - Purpose: CSV export of inventory (existing). Document: query `asOf?` (ISO date), `format: "csv"`. Optional extension: add query `status?` (VehicleStatus) to filter exported rows.
  - Zod: `exportInventoryQuerySchema`: `{ asOf?: isoDate }, format: "csv"`. Optional: `status: vehicleStatusSchema.optional()`.
  - Response: CSV body; `Content-Disposition: attachment; filename="inventory-{date}.csv"`.
  - Permission: `reports.export`. Dealership from auth.

**Import:**
- **POST /api/inventory/bulk/import/preview**
  - Purpose: Validate file and return validation errors with row numbers; no DB write.
  - Body: multipart form with `file` (CSV). Limits: max file size 1MB, max 500 rows.
  - Response: 200 `{ data: { valid: boolean, totalRows: number, errors: Array<{ row: number, field?: string, message: string }> } }`.
  - Permission: `inventory.write`. Dealership from auth.

- **POST /api/inventory/bulk/import/apply**
  - Purpose: Create a bulk import job and optionally start processing (or queue job). Request body: CSV file (same limits). Creates `BulkImportJob` (PENDING → RUNNING); returns jobId.
  - Body: multipart form `file`. Same limits.
  - Response: 202 `{ data: { jobId: string, status: "PENDING" | "RUNNING" } }`.
  - Permission: `inventory.write`. Dealership from auth.

- **GET /api/inventory/bulk/import/[jobId]**
  - Purpose: Get job status and progress.
  - Params: `jobIdParamSchema`: `{ jobId: z.string().uuid() }`.
  - Response: 200 `{ data: { id, status, totalRows, processedRows, errorsJson, createdAt, completedAt } }`. Scoped by dealership from auth.
  - Permission: `inventory.read` (or `inventory.write` for consistency with import).

**Bulk update:**
- **PATCH /api/inventory/bulk/update**
  - Purpose: Update common fields (e.g. status, locationId) for a list of vehicle IDs.
  - Body: `bulkUpdateBodySchema`: `{ vehicleIds: z.array(z.string().uuid()).min(1).max(50), status?: vehicleStatusSchema, locationId?: z.string().uuid().nullable() }`. At least one of status or locationId required.
  - Response: 200 `{ data: { updated: number, errors?: Array<{ vehicleId: string, message: string }> } }`.
  - Permission: `inventory.write`. All vehicleIds must belong to dealership (from auth); no client-supplied dealershipId.

**Pagination:** List of jobs: if added, use `limit`/`offset` (e.g. `GET /api/inventory/bulk/import` with query `limit`, `offset`). Schema: `listBulkImportJobsQuerySchema`: `limit`, `offset`, `status?`.

## B.4 Validation rules (Slice B)

- Import file: max 1MB, max 500 rows per file.
- Bulk update: max 50 vehicleIds per request; at least one of `status` or `locationId` present; vehicleIds must belong to dealership (resolved from auth).
- Optional: store import file in blob or discard after apply — document in implementation notes.

---

# Slice C — Inventory alerts rules engine

## C.1 Scope

- **Rules:** (1) Stale: days in stock > threshold (e.g. 90). (2) Missing photos: vehicle has 0 photos. (3) Recon overdue: status REPAIR or recon due date past (if we add `reconDueDate` to Vehicle or a recon table). Per-dealership rule config optional (e.g. `staleDaysThreshold`).
- **Alert instances:** Not stored as rows initially; computed on read (e.g. GET counts, GET list).
- **Per-user dismiss/snooze:** `InventoryAlertDismissal` (dealershipId, userId, vehicleId, alertType, action, snoozedUntil?). List alerts (paginated) can exclude dismissed/snoozed for current user. Dashboard widget and list badges consume counts and list.
- **API:** GET counts, GET list (paginated, filter by type, exclude dismissed/snoozed for user), POST dismiss (body: vehicleId, alertType, action DISMISS | SNOOZE, snoozedUntil?), and undo (DELETE or PATCH).

## C.2 Prisma schema (Slice C)

- **Optional per-dealership config:** If desired, add to `Dealership.settings` JSON or a small table `InventoryAlertConfig(dealershipId, staleDaysThreshold Int default 90)`. Spec treats threshold as configurable (e.g. 90 default); storage is optional (can be in settings JSON).

- **New model: InventoryAlertDismissal**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `userId String @map("user_id") @db.Uuid`
  - `vehicleId String @map("vehicle_id") @db.Uuid`
  - `alertType String` — enum or string: `MISSING_PHOTOS`, `STALE`, `RECON_OVERDUE`
  - `action String` — `DISMISSED`, `SNOOZED`
  - `snoozedUntil DateTime? @map("snoozed_until")`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - Relations: `dealership Dealership`, `user Profile`, `vehicle Vehicle`
  - `@@unique([dealershipId, userId, vehicleId, alertType])` — one dismissal/snooze per user per vehicle per alert type
  - `@@index([dealershipId])`, `@@index([dealershipId, userId])`, `@@index([vehicleId])`, `@@index([dealershipId, alertType])`

- **Vehicle:** Optional: add `reconDueDate DateTime? @map("recon_due_date")` for recon-overdue rule; else derive from status REPAIR only (no due date). Spec allows either; document in implementation.

- **Audit:** Dismissals are user-preference data; optional audit (e.g. `inventory_alert.dismissed`, `inventory_alert.snoozed`). Not required for critical table audit; product decision.

## C.3 API (Slice C)

- **GET /api/inventory/alerts/counts**
  - Purpose: Return counts of alerts by type for the dealership (excluding dismissed/snoozed for current user when applicable, or global counts — spec: counts exclude user’s dismissals/snoozes for dashboard).
  - Query: none (dealershipId from auth). Optional: `excludeDismissedForUser: true` (default).
  - Response: 200 `{ data: { missingPhotos: number, stale: number, reconOverdue: number } }`.
  - Permission: `inventory.read`.

- **GET /api/inventory/alerts**
  - Purpose: List alert instances (paginated); each item identifies vehicle and alert type. Exclude dismissed/snoozed for current user (snoozed = snoozedUntil in future).
  - Query: `alertsListQuerySchema`: `limit`, `offset`, `alertType?: enum('MISSING_PHOTOS'|'STALE'|'RECON_OVERDUE')`.
  - Response: 200 `{ data: Array<{ vehicleId, vehicleSummary?, alertType, daysInStock? }>, meta: { total, limit, offset } }`.
  - Permission: `inventory.read`. Dealership from auth.

- **POST /api/inventory/alerts/dismiss**
  - Purpose: Dismiss or snooze an alert for the current user.
  - Body: `dismissBodySchema`: `{ vehicleId: z.string().uuid(), alertType: z.enum(["MISSING_PHOTOS","STALE","RECON_OVERDUE"]), action: z.enum(["DISMISS","SNOOZE"]), snoozedUntil?: isoDate }`. If action SNOOZE, snoozedUntil required (future date).
  - Response: 201 `{ data: { id, vehicleId, alertType, action, snoozedUntil } }`.
  - Permission: `inventory.read` or `inventory.write` (spec: `inventory.write` to avoid noise from read-only users).

- **DELETE /api/inventory/alerts/dismiss/[id]** or **PATCH /api/inventory/alerts/dismiss/[id]/undo**
  - Purpose: Undo dismiss/snooze (remove or mark inactive).
  - Params: `dismissalIdParamSchema`: `{ id: z.string().uuid() }`. Must belong to current user and dealership.
  - Response: 204 or 200 `{ data: { ok: true } }`.
  - Permission: `inventory.write`.

**Validation:** snoozedUntil must be future when action is SNOOZE. vehicleId must belong to dealership. DealershipId from auth only.

---

# Slice D — VIN Decode Depth

## D.1 Scope

- Store decoded VIN data (make, model, year, trim, body style, engine, etc.) either on Vehicle (new columns) or in a separate **VehicleVinDecode** table (immutable snapshot per decode). One canonical place; choice documented below.
- **API:** (1) Trigger decode for a vehicle (may call external provider). (2) Get decoded data for vehicle. Rate limit decode calls (e.g. per dealership or per user). Zod validation and abuse limits.
- **RBAC:** `inventory.read` for get; `inventory.write` for trigger decode.
- **Audit:** `vin_decode.requested` (or similar) for decode trigger.
- **UI plan:** Inventory detail modal panel **"Specs / VIN"** showing VIN and decoded specs.

## D.2 Schema choice (Slice D)

**Option 1 — Vehicle columns:** Add nullable columns on Vehicle: `vinDecodedAt DateTime?`, `vinBodyStyle String?`, `vinEngine String?`, `vinDrivetrain String?`, etc. Overwrites on each decode; no history. Keeps all data on Vehicle; simple reads.

**Option 2 — VehicleVinDecode table:** New model `VehicleVinDecode` (vehicleId, decodedAt, make, model, year, trim, bodyStyle, engine, drivetrain, …). Immutable snapshot per decode; latest-by-date or single “current” row per vehicle. Keeps Vehicle clean; preserves decode history; clear boundary between editable inventory fields and provider snapshot.

**Recommendation:** **Option 2 — VehicleVinDecode table.** One canonical place for decoded data; immutable snapshots; no overwriting Vehicle core fields with third-party data; optional “latest” view per vehicle (e.g. latest row by decodedAt).

## D.3 Prisma schema (Slice D)

- **New model: VehicleVinDecode**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `vehicleId String @map("vehicle_id") @db.Uuid`
  - `decodedAt DateTime @default(now()) @map("decoded_at")`
  - `vin String` (stored at decode time)
  - `make String?`, `model String?`, `year Int?`, `trim String?`
  - `bodyStyle String? @map("body_style")`, `engine String?`, `drivetrain String?`, `transmission String?`
  - `fuelType String? @map("fuel_type")`, `manufacturedIn String? @map("manufactured_in")`
  - `rawJson Json? @map("raw_json")` (optional: full provider response for debugging)
  - Relations: `dealership Dealership`, `vehicle Vehicle`
  - `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`, `@@index([vehicleId, decodedAt(sort: Desc)])`
  - No unique on (vehicleId) — multiple snapshots allowed; “current” is application-layer (e.g. latest decodedAt).

- **Vehicle:** Add relation `vinDecodes VehicleVinDecode[]`. No new columns on Vehicle for decoded data (canonical place is VehicleVinDecode).

- **Audit:** Decode trigger is critical: audit `vin_decode.requested` (and optionally `vin_decode.completed` / `vin_decode.failed` if async). Use existing AuditLog.

## D.4 API (Slice D)

- **POST /api/inventory/[id]/vin/decode**
  - Purpose: Trigger VIN decode for vehicle (calls provider, creates VehicleVinDecode row).
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`. Vehicle must belong to dealership (from auth).
  - Body: none or `vinDecodeTriggerBodySchema`: `{}` (optional force re-decode flag if needed).
  - Response: 202 `{ data: { decodeId: string, status: "pending" | "completed" } }` or 200 with decoded payload if synchronous. Dealership from auth.
  - Rate limit: e.g. 30 decode requests per dealership per hour, or 10 per user per hour (document exact limit in validation).
  - Audit: vin_decode.requested.
  - Permission: `inventory.write`.

- **GET /api/inventory/[id]/vin**
  - Purpose: Get decoded VIN data for vehicle (latest snapshot or list of snapshots).
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`.
  - Query: `vinGetQuerySchema`: `{ latestOnly?: z.boolean().default(true) }` — if false, paginate snapshots.
  - Response (latestOnly true): 200 `{ data: { vin, decoded: VehicleVinDecode | null } }`. (latestOnly false): `{ data: VehicleVinDecode[], meta: { total, limit, offset } }`.
  - Pagination: when listing snapshots, `limit`, `offset` (e.g. max 50 per page).
  - Permission: `inventory.read`. Dealership from auth.

**Zod (Slice D):** `idParamSchema`, `vinDecodeTriggerBodySchema` (empty or `{ force?: boolean }`), `vinGetQuerySchema`: `{ latestOnly?: boolean, limit?, offset? }`. Abuse: rate limit decode (per dealership or per user); optional max decode requests per vehicle per day (e.g. 5).

## D.5 RBAC (Slice D)

| Action | inventory.read | inventory.write |
|--------|----------------|-----------------|
| GET decoded VIN data | ✓ | ✓ |
| POST trigger decode | — | ✓ |

## D.6 Validation / abuse limits (Slice D)

- Rate limit: decode requests — e.g. 30 per dealership per hour or 10 per user per hour; document in implementation.
- Optional: max decodes per vehicle per day (e.g. 5) to prevent abuse.
- `dealershipId` from auth only; vehicle must belong to dealership.

## D.7 UI plan (Slice D)

- **Inventory detail modal:** Panel **"Specs / VIN"** — display VIN (from Vehicle), “Decode” button (calls POST decode), and decoded specs (make, model, year, trim, body style, engine, etc.) from GET vin. Show “Last decoded at” and optional history if multiple snapshots.

## D.8 Acceptance criteria and test plan (Slice D)

- **Unit:** Zod schemas; rate-limit counter logic (per dealership / per user).
- **Integration:** Tenant isolation (decode and get only for dealership’s vehicles); RBAC (inventory.read for GET; inventory.write for POST decode); POST decode creates VehicleVinDecode; GET returns latest or paginated snapshots; rate limit returns 429 when exceeded; audit vin_decode.requested on trigger.
- **Jest:** RBAC negative (403 without permission); cross-dealership no access; validation (400 invalid id); happy path decode → get.

## D.9 Rollout / migration (Slice D)

- Migration: Add `VehicleVinDecode` model and indexes. No backfill (decodes are on-demand).
- Order: After Slices A–C; can run in parallel with E if desired.

---

# Slice E — Book Values provider abstraction + immutable valuation snapshots

## E.1 Scope

- Abstract “book value” provider (e.g. KBB/NADA mock or real); return value in **cents**. Snapshot model: **VehicleValuation** (vehicleId, source e.g. "KBB", valueCents, capturedAt, optional condition/odometer). **Immutable** — no updates, only new rows.
- **API:** Get valuations for vehicle (list snapshots, paginated); request new valuation (calls provider, appends snapshot). Rate limit valuation requests.
- **RBAC:** `inventory.read` for list; **finance.read** for request (valuations are pricing/finance data; finance users can pull values without inventory write).
- **Audit:** `vehicle_valuation.captured`.
- **UI plan:** Inventory detail modal panel **"Valuations"** listing snapshots and trigger **"Get value"**.

## E.2 Prisma schema (Slice E)

- **New model: VehicleValuation**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `vehicleId String @map("vehicle_id") @db.Uuid`
  - `source String` — e.g. `"KBB"`, `"NADA"`, `"MOCK"`
  - `valueCents Int @map("value_cents")`
  - `capturedAt DateTime @default(now()) @map("captured_at")`
  - `condition String?` — e.g. "fair", "good", "excellent"
  - `odometer Int?` — at time of valuation (optional)
  - Relations: `dealership Dealership`, `vehicle Vehicle`
  - `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`, `@@index([vehicleId, capturedAt(sort: Desc)])`
  - Immutable: no update/delete in API; only create.

- **Vehicle:** Add relation `valuations VehicleValuation[]`.

- **Audit:** Create is critical: audit `vehicle_valuation.captured` (with vehicleId, source, valueCents, capturedAt).

## E.3 API (Slice E)

- **GET /api/inventory/[id]/valuations**
  - Purpose: List valuation snapshots for vehicle (paginated).
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`.
  - Query: `valuationsListQuerySchema`: `{ limit: z.number().min(1).max(50).default(20), offset: z.number().min(0).default(0), source?: z.string().optional() }`.
  - Response: 200 `{ data: Array<{ id, source, valueCents, capturedAt, condition?, odometer? }>, meta: { total, limit, offset } }`.
  - Permission: `inventory.read`. Dealership from auth.

- **POST /api/inventory/[id]/valuations**
  - Purpose: Request new valuation (calls provider, appends VehicleValuation row).
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`.
  - Body: `requestValuationBodySchema`: `{ source: z.enum(["KBB","NADA","MOCK"]), condition?: z.string().optional(), odometer?: z.number().int().nonnegative().optional() }`.
  - Response: 201 `{ data: { id, source, valueCents, capturedAt, condition?, odometer? } }`. Or 202 if async with job id.
  - Rate limit: e.g. 20 valuation requests per dealership per hour or 5 per user per hour.
  - Audit: vehicle_valuation.captured.
  - Permission: `finance.read` (request is a finance-sensitive read/derive action).

## E.4 RBAC (Slice E)

| Action | inventory.read | finance.read |
|--------|----------------|--------------|
| GET valuations list | ✓ | ✓ |
| POST request valuation | — | ✓ |

## E.5 Validation / abuse limits (Slice E)

- Rate limit: valuation requests — e.g. 20 per dealership per hour or 5 per user per hour.
- Pagination: limit max 50; offset ≥ 0.
- Money: valueCents only (integer). `dealershipId` from auth only.

## E.6 UI plan (Slice E)

- **Inventory detail modal:** Panel **"Valuations"** — list snapshots (source, value, date, condition/odometer if present); **"Get value"** button opens flow to select source (and optional condition/odometer) and calls POST valuations; new row appears in list.

## E.7 Acceptance criteria and test plan (Slice E)

- **Unit:** Zod schemas; provider abstraction (mock returns cents); rate-limit logic.
- **Integration:** Tenant isolation; RBAC (inventory.read for GET; finance.read for POST); GET paginated list; POST creates immutable row; rate limit 429; audit vehicle_valuation.captured.
- **Jest:** RBAC negative; tenant isolation; validation; happy path request → list.

## E.8 Rollout / migration (Slice E)

- Migration: Add `VehicleValuation` model and indexes. No backfill.
- Order: After D (or in parallel); before F/G if dependencies allow.

---

# Slice F — Reconditioning workflow (status + line items + totals) integrated with alerts

## F.1 Scope

- **Recon:** Status (e.g. NOT_STARTED, IN_PROGRESS, COMPLETE), due date (reconDueDate on Vehicle or on a Recon record), line items (description, costCents, category?), total recon cost. **RECON_OVERDUE** alert (Slice C) integrates so recon due date and status drive the alert.
- **Data:** Either extend Vehicle (reconStatus, reconDueDate; reconCostCents already exists) + VehicleReconLineItem(vehicleId, …), or VehicleRecon(vehicleId, status, dueDate) + VehicleReconLineItem(reconId, …). One recon per vehicle; choice documented below.
- **API:** Get recon for vehicle; update recon status/due date; add/update/delete line items; recompute total and sync to Vehicle.reconCostCents. Audit all mutations.
- **RBAC:** `inventory.read` for get; `inventory.write` for mutations.
- **UI plan:** Inventory detail modal panel **"Reconditioning"** (status, due date, line items, total); alerts card links to vehicles with recon overdue.

## F.2 Schema choice (Slice F)

**Option 1 — Vehicle + VehicleReconLineItem:** Add `reconStatus`, `reconDueDate` on Vehicle; add `VehicleReconLineItem(vehicleId, description, costCents, category?, sortOrder)`. Total = sum(line items); sync to Vehicle.reconCostCents. Single place for status/due date on Vehicle.

**Option 2 — VehicleRecon + VehicleReconLineItem:** New model `VehicleRecon(vehicleId, status, dueDate)` 1:1 with Vehicle; `VehicleReconLineItem(reconId, description, costCents, category?, sortOrder)`. Total synced to Vehicle.reconCostCents for list views. Clear aggregate root; status/due date live on Recon.

**Recommendation:** **Option 2 — VehicleRecon + VehicleReconLineItem.** One recon per vehicle (1:1); clear aggregate; line items belong to recon; Vehicle.reconCostCents denormalized from sum of line items for list/dashboard.

## F.3 Prisma schema (Slice F)

- **New model: VehicleRecon**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `vehicleId String @unique @map("vehicle_id") @db.Uuid` — one recon per vehicle
  - `status String` — `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`
  - `dueDate DateTime? @map("due_date")`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - `updatedAt DateTime @updatedAt @map("updated_at")`
  - Relations: `dealership Dealership`, `vehicle Vehicle`, `lineItems VehicleReconLineItem[]`
  - `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`, `@@index([dealershipId, status])`

- **New model: VehicleReconLineItem**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `reconId String @map("recon_id") @db.Uuid`
  - `description String`, `costCents Int @map("cost_cents")`
  - `category String?` (e.g. "labor", "parts", "other")
  - `sortOrder Int @default(0) @map("sort_order")`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - `updatedAt DateTime @updatedAt @map("updated_at")`
  - Relations: `dealership Dealership`, `recon VehicleRecon`
  - `@@index([dealershipId])`, `@@index([reconId])`

- **Vehicle:** Add relation `recon VehicleRecon?`; keep `reconCostCents` — updated when line items change (sum of line items). Optional: add `reconDueDate` on Vehicle for alert queries (denormalized from VehicleRecon.dueDate) or derive RECON_OVERDUE from VehicleRecon only.

- **RECON_OVERDUE (Slice C):** Alert fires when vehicle has a VehicleRecon with status IN_PROGRESS or NOT_STARTED and dueDate < today (or dueDate null with status not COMPLETE — product rule). Use VehicleRecon.dueDate (and status) as source of truth; no need for Vehicle.reconDueDate if recon is always present when due date is set.

- **Audit:** VehicleRecon create/update (status, dueDate); VehicleReconLineItem create/update/delete; Vehicle.reconCostCents update. Events: `vehicle_recon.created`, `vehicle_recon.updated`, `vehicle_recon_line_item.added`, `vehicle_recon_line_item.updated`, `vehicle_recon_line_item.removed`.

## F.4 API (Slice F)

- **GET /api/inventory/[id]/recon**
  - Purpose: Get reconditioning record for vehicle (status, due date, line items, total).
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`.
  - Response: 200 `{ data: { id, vehicleId, status, dueDate, totalCents, lineItems: Array<{ id, description, costCents, category?, sortOrder }> } }`. Total = sum(lineItems.costCents); or sync from Vehicle.reconCostCents. If no VehicleRecon, return 200 `{ data: null }` or create-on-read (spec: return null; create via explicit POST/PATCH).
  - Permission: `inventory.read`.

- **PUT /api/inventory/[id]/recon** or **PATCH /api/inventory/[id]/recon**
  - Purpose: Create or update recon (status, due date). Create VehicleRecon if missing.
  - Body: `reconUpdateBodySchema`: `{ status?: z.enum(["NOT_STARTED","IN_PROGRESS","COMPLETE"]), dueDate?: z.string().datetime().nullable() }`.
  - Response: 200 `{ data: { id, vehicleId, status, dueDate, totalCents, lineItems } }`.
  - Audit: vehicle_recon.created / vehicle_recon.updated.
  - Permission: `inventory.write`.

- **POST /api/inventory/[id]/recon/line-items**
  - Purpose: Add line item; recompute total; sync Vehicle.reconCostCents.
  - Body: `reconLineItemBodySchema`: `{ description: z.string().min(1).max(500), costCents: z.number().int().nonnegative(), category?: z.string().max(50), sortOrder?: z.number().int().nonnegative() }`.
  - Response: 201 `{ data: { id, description, costCents, category, sortOrder } }`.
  - Audit: vehicle_recon_line_item.added.
  - Permission: `inventory.write`.

- **PATCH /api/inventory/[id]/recon/line-items/[lineItemId]**
  - Purpose: Update line item; recompute total; sync Vehicle.reconCostCents.
  - Params: `reconLineItemIdParamSchema`: `{ id, lineItemId }` (both UUIDs).
  - Body: same shape as create (description, costCents, category?, sortOrder?).
  - Audit: vehicle_recon_line_item.updated.
  - Permission: `inventory.write`.

- **DELETE /api/inventory/[id]/recon/line-items/[lineItemId]**
  - Purpose: Remove line item; recompute total; sync Vehicle.reconCostCents.
  - Audit: vehicle_recon_line_item.removed.
  - Permission: `inventory.write`.

**Pagination:** Line items bounded per vehicle (e.g. max 100); no pagination on line items in GET recon. List of vehicles with recon overdue is via alerts API (Slice C).

## F.5 RBAC (Slice F)

| Action | inventory.read | inventory.write |
|--------|----------------|-----------------|
| GET recon | ✓ | ✓ |
| PATCH/PUT recon, add/update/delete line items | — | ✓ |

## F.6 Validation / abuse limits (Slice F)

- costCents: non-negative integer (cents only). description max length 500; category max 50.
- Max line items per vehicle: e.g. 100 (document in implementation).
- `dealershipId` from auth only; vehicle and recon must belong to dealership.

## F.7 UI plan (Slice F)

- **Inventory detail modal:** Panel **"Reconditioning"** — status dropdown, due date picker, list of line items (description, cost, category) with add/edit/delete, total displayed; sync total to vehicle summary.
- **Alerts (Slice C):** Alerts card links to vehicles with recon overdue (RECON_OVERDUE driven by VehicleRecon.status and VehicleRecon.dueDate).

## F.8 Acceptance criteria and test plan (Slice F)

- **Unit:** Zod schemas; total recompute and sync to Vehicle.reconCostCents; RECON_OVERDUE rule (status + dueDate).
- **Integration:** Tenant isolation; RBAC; GET recon (null when none); create/update recon; add/update/delete line items; total and Vehicle.reconCostCents updated; audit events; alerts list includes RECON_OVERDUE when recon due date past and status not COMPLETE.
- **Jest:** RBAC; tenant isolation; validation; happy path full recon workflow.

## F.9 Rollout / migration (Slice F)

- Migration: Add `VehicleRecon`, `VehicleReconLineItem`; indexes. Optional backfill: create VehicleRecon NOT_STARTED for vehicles that have reconCostCents > 0 or status REPAIR (product decision).
- Order: After C (alerts); RECON_OVERDUE rule updated to use VehicleRecon.

---

# Slice G — Floorplan management (lender/principal/apr, curtailments, payoff quotes) integrated with alerts

## G.1 Scope

- **Floorplan:** Vehicle-level inventory financing. Model: **VehicleFloorplan** (vehicleId, lenderId, principalCents, aprBps?, startDate, curtailmentCents?, nextCurtailmentDueDate?, payoffQuoteCents?, payoffQuoteExpiresAt?). Curtailments reduce principal; payoff quote from lender with expiry. One active floorplan per vehicle (or multiple with "active" flag); document choice.
- **API:** Get floorplan for vehicle; create/update floorplan (lender, principal, apr, dates); record curtailment (amount, date); request/store payoff quote. Finance-grade RBAC: **finance.read** for read; **finance.write** for mutations. Rate limit payoff/curtailment mutations.
- **Prisma:** VehicleFloorplan (and optionally VehicleFloorplanCurtailment, VehicleFloorplanPayoffQuote as separate tables or JSON). Indexes, relations to Vehicle, Lender.
- **Audit:** vehicle_floorplan.created, vehicle_floorplan.updated, vehicle_floorplan.curtailment, vehicle_floorplan.payoff_quote.
- **Alerts:** Optional "floorplan due" or "payoff expiring" — mentioned in UI plan.
- **UI plan:** Inventory detail modal panel **"Floorplan"** (lender, principal, APR, curtailments, payoff quote); integrate with alerts if applicable.

## G.2 Schema choice (Slice G)

- **One active per vehicle:** Application-layer: only one VehicleFloorplan per vehicle with `active = true`; or single row per vehicle (replace on new assignment). Prefer **one row per vehicle** (no active flag): create replaces or deactivates previous; or allow multiple with `isActive Boolean` and enforce one active per vehicle in service layer.
- **Curtailments / Payoff:** Option A — columns on VehicleFloorplan: `curtailmentCents Int?`, `nextCurtailmentDueDate?`, `payoffQuoteCents?`, `payoffQuoteExpiresAt?` (single current quote). Option B — separate tables: VehicleFloorplanCurtailment(floorplanId, amountCents, paidAt), VehicleFloorplanPayoffQuote(floorplanId, amountCents, expiresAt, requestedAt). Option B allows history of curtailments and quotes.
- **Recommendation:** **VehicleFloorplan** with nullable payoff columns (payoffQuoteCents, payoffQuoteExpiresAt) for “current” quote; **VehicleFloorplanCurtailment** as separate table for history. So: VehicleFloorplan (vehicleId, lenderId, principalCents, aprBps?, startDate, nextCurtailmentDueDate?; optional running total curtailments or derive from sum of curtailments). Add VehicleFloorplanCurtailment(floorplanId, amountCents, paidAt) and payoff on VehicleFloorplan (single current quote). One floorplan per vehicle: VehicleFloorplan.vehicleId unique (one active floorplan) or isActive flag; spec: **unique vehicleId** (one row per vehicle; update in place or soft-replace).

## G.3 Prisma schema (Slice G)

- **New model: VehicleFloorplan**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `vehicleId String @unique @map("vehicle_id") @db.Uuid` — one floorplan per vehicle
  - `lenderId String @map("lender_id") @db.Uuid`
  - `principalCents Int @map("principal_cents")`
  - `aprBps Int? @map("apr_bps")` — basis points
  - `startDate DateTime @map("start_date")`
  - `nextCurtailmentDueDate DateTime? @map("next_curtailment_due_date")`
  - `payoffQuoteCents Int? @map("payoff_quote_cents")`
  - `payoffQuoteExpiresAt DateTime? @map("payoff_quote_expires_at")`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - `updatedAt DateTime @updatedAt @map("updated_at")`
  - Relations: `dealership Dealership`, `vehicle Vehicle`, `lender Lender`, `curtailments VehicleFloorplanCurtailment[]`
  - `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`, `@@index([lenderId])`, `@@index([dealershipId, nextCurtailmentDueDate])`, `@@index([dealershipId, payoffQuoteExpiresAt])`

- **New model: VehicleFloorplanCurtailment**
  - `id String @id @default(uuid()) @db.Uuid`
  - `dealershipId String @map("dealership_id") @db.Uuid`
  - `floorplanId String @map("floorplan_id") @db.Uuid`
  - `amountCents Int @map("amount_cents")`
  - `paidAt DateTime @map("paid_at")`
  - `createdAt DateTime @default(now()) @map("created_at")`
  - Relations: `dealership Dealership`, `floorplan VehicleFloorplan`
  - `@@index([dealershipId])`, `@@index([floorplanId])`

- **Vehicle:** Relation `floorplan VehicleFloorplan?`. **Lender:** Relation `vehicleFloorplans VehicleFloorplan[]`.

- **Audit:** vehicle_floorplan.created, vehicle_floorplan.updated, vehicle_floorplan.curtailment (per curtailment), vehicle_floorplan.payoff_quote (when quote stored/updated).

## G.4 API (Slice G)

- **GET /api/inventory/[id]/floorplan**
  - Purpose: Get floorplan for vehicle (lender, principal, apr, dates, curtailments list, payoff quote).
  - Params: `idParamSchema`: `{ id: z.string().uuid() }`.
  - Response: 200 `{ data: { id, vehicleId, lenderId, lenderName?, principalCents, aprBps, startDate, nextCurtailmentDueDate, curtailments: Array<{ id, amountCents, paidAt }>, payoffQuoteCents, payoffQuoteExpiresAt } | null }`.
  - Permission: `finance.read`. Dealership from auth.

- **PUT /api/inventory/[id]/floorplan** or **POST** create + **PATCH** update
  - Purpose: Create or update floorplan (set lender, principal, apr, startDate, nextCurtailmentDueDate).
  - Body: `floorplanUpsertBodySchema`: `{ lenderId: z.string().uuid(), principalCents: z.number().int().nonnegative(), aprBps?: z.number().int().nonnegative(), startDate: z.string().datetime(), nextCurtailmentDueDate?: z.string().datetime().nullable() }`.
  - Response: 200 or 201 `{ data: VehicleFloorplan }`.
  - Audit: vehicle_floorplan.created / vehicle_floorplan.updated.
  - Permission: `finance.write`.

- **POST /api/inventory/[id]/floorplan/curtailments**
  - Purpose: Record curtailment (amount, date); reduce principal or track payment; update nextCurtailmentDueDate if needed (product rule).
  - Body: `curtailmentBodySchema`: `{ amountCents: z.number().int().nonnegative(), paidAt: z.string().datetime() }`.
  - Response: 201 `{ data: { id, amountCents, paidAt } }`.
  - Rate limit: e.g. 50 curtailments per dealership per hour.
  - Audit: vehicle_floorplan.curtailment.
  - Permission: `finance.write`.

- **POST /api/inventory/[id]/floorplan/payoff-quote** or **PATCH …/floorplan** (payoff fields)
  - Purpose: Request/store payoff quote (amount, expiresAt).
  - Body: `payoffQuoteBodySchema`: `{ payoffQuoteCents: z.number().int().nonnegative(), payoffQuoteExpiresAt: z.string().datetime() }`.
  - Response: 200 `{ data: { payoffQuoteCents, payoffQuoteExpiresAt } }`.
  - Rate limit: e.g. 20 payoff quote requests per dealership per hour.
  - Audit: vehicle_floorplan.payoff_quote.
  - Permission: `finance.write`.

**Pagination:** GET floorplan returns single record; curtailments list bounded (e.g. max 200); if paginated, use limit/offset on curtailments sub-resource (e.g. GET …/floorplan?curtailmentsLimit=50).

## G.5 RBAC (Slice G)

| Action | finance.read | finance.write |
|--------|--------------|---------------|
| GET floorplan | ✓ | ✓ |
| Create/update floorplan, curtailment, payoff quote | — | ✓ |

## G.6 Validation / abuse limits (Slice G)

- All money in cents (principalCents, amountCents, payoffQuoteCents). aprBps non-negative. Rate limits: curtailments 50/dealership/hour; payoff quote 20/dealership/hour (or per user).
- lenderId must belong to dealership (Lender.dealershipId). `dealershipId` from auth only.

## G.7 UI plan (Slice G)

- **Inventory detail modal:** Panel **"Floorplan"** — lender (select from dealership lenders), principal, APR, start date, next curtailment due date; list of curtailments (amount, date); current payoff quote and expiry; actions: "Record curtailment", "Store payoff quote". Optional alerts: "Floorplan due" (nextCurtailmentDueDate near/past), "Payoff expiring" (payoffQuoteExpiresAt near).

## G.8 Acceptance criteria and test plan (Slice G)

- **Unit:** Zod schemas; principal/curtailment math; rate-limit logic.
- **Integration:** Tenant isolation; RBAC (finance.read for GET; finance.write for mutations); lender must belong to dealership; create/update floorplan; add curtailment; store payoff quote; audit events; optional alert integration for due/payoff expiring.
- **Jest:** RBAC; tenant isolation; validation; happy path floorplan lifecycle.

## G.9 Rollout / migration (Slice G)

- Migration: Add `VehicleFloorplan`, `VehicleFloorplanCurtailment`; indexes; relations on Vehicle and Lender. No backfill required.
- Order: After F; finance permissions already exist in codebase.

---

# 1. Prisma schema summary (all slices)

- **Slice A:** New model `VehiclePhoto` (dealershipId, vehicleId, fileObjectId, sortOrder, isPrimary); indexes and unique as above. Audit: vehicle_photo.* via AuditLog.
- **Slice B:** New model `BulkImportJob` (dealershipId, status, totalRows, processedRows, errorsJson, createdBy, createdAt, completedAt); indexes as above. Audit: bulk_import_job.* and vehicle.updated for bulk update.
- **Slice C:** New model `InventoryAlertDismissal` (dealershipId, userId, vehicleId, alertType, action, snoozedUntil, createdAt); @@unique(dealershipId, userId, vehicleId, alertType); indexes as above. Optional: Vehicle.reconDueDate; optional Dealership.settings or InventoryAlertConfig for staleDaysThreshold.
- **Slice D:** New model `VehicleVinDecode` (dealershipId, vehicleId, decodedAt, vin, make, model, year, trim, bodyStyle, engine, drivetrain, transmission, fuelType, manufacturedIn, rawJson?); indexes on dealershipId, vehicleId, (vehicleId, decodedAt). Audit: vin_decode.requested.
- **Slice E:** New model `VehicleValuation` (dealershipId, vehicleId, source, valueCents, capturedAt, condition?, odometer?); immutable; indexes on dealershipId, vehicleId, (vehicleId, capturedAt). Audit: vehicle_valuation.captured.
- **Slice F:** New model `VehicleRecon` (dealershipId, vehicleId @unique, status, dueDate, createdAt, updatedAt); new model `VehicleReconLineItem` (dealershipId, reconId, description, costCents, category?, sortOrder). Vehicle.reconCostCents synced from sum of line items. Audit: vehicle_recon.*, vehicle_recon_line_item.*.
- **Slice G:** New model `VehicleFloorplan` (dealershipId, vehicleId @unique, lenderId, principalCents, aprBps?, startDate, nextCurtailmentDueDate?, payoffQuoteCents?, payoffQuoteExpiresAt?); new model `VehicleFloorplanCurtailment` (dealershipId, floorplanId, amountCents, paidAt). Relations to Vehicle, Lender. Audit: vehicle_floorplan.created/updated/curtailment/payoff_quote.

**Tables requiring audit (create/update/delete or sensitive reads):**
- Vehicle (existing): create/update/delete — already audited.
- VehiclePhoto: add/reorder/set-primary/delete — audited.
- BulkImportJob: create and status completion — audited.
- Bulk update: vehicle updates — audited (per vehicle or batch).
- InventoryAlertDismissal: optional audit.
- VehicleVinDecode: decode trigger — vin_decode.requested.
- VehicleValuation: create — vehicle_valuation.captured.
- VehicleRecon / VehicleReconLineItem: create/update/delete — audited.
- VehicleFloorplan / VehicleFloorplanCurtailment: create/update/curtailment/payoff_quote — audited.

---

# 2. API route table (all slices)

| Method | Path | Purpose | Pagination |
|--------|------|---------|------------|
| GET | /api/inventory/[id]/photos | List photos with order + primary | No (bounded) |
| POST | /api/inventory/[id]/photos | Upload photo, assign order/primary | — |
| PATCH | /api/inventory/[id]/photos/reorder | Reorder by fileIds array | — |
| PATCH | /api/inventory/[id]/photos/primary | Set primary photo | — |
| DELETE | /api/inventory/[id]/photos/[fileId] | Delete photo | — |
| GET | /api/reports/export/inventory | CSV export (existing; optional status filter) | — |
| POST | /api/inventory/bulk/import/preview | Preview/validate CSV import | — |
| POST | /api/inventory/bulk/import/apply | Start bulk import job | — |
| GET | /api/inventory/bulk/import/[jobId] | Get import job status | — |
| GET | /api/inventory/bulk/import | List import jobs (optional) | limit/offset |
| PATCH | /api/inventory/bulk/update | Bulk update vehicles (status, locationId) | — |
| GET | /api/inventory/alerts/counts | Alert counts by type | — |
| GET | /api/inventory/alerts | List alerts (paginated) | limit/offset |
| POST | /api/inventory/alerts/dismiss | Dismiss or snooze alert | — |
| DELETE or PATCH | /api/inventory/alerts/dismiss/[id] (or undo) | Undo dismiss/snooze | — |
| POST | /api/inventory/[id]/vin/decode | Trigger VIN decode for vehicle | — |
| GET | /api/inventory/[id]/vin | Get decoded VIN data (latest or list) | limit/offset when list |
| GET | /api/inventory/[id]/valuations | List valuation snapshots | limit/offset |
| POST | /api/inventory/[id]/valuations | Request new valuation (provider) | — |
| GET | /api/inventory/[id]/recon | Get recon (status, due date, line items) | No (bounded) |
| PUT or PATCH | /api/inventory/[id]/recon | Create/update recon status and due date | — |
| POST | /api/inventory/[id]/recon/line-items | Add recon line item | — |
| PATCH | /api/inventory/[id]/recon/line-items/[lineItemId] | Update recon line item | — |
| DELETE | /api/inventory/[id]/recon/line-items/[lineItemId] | Delete recon line item | — |
| GET | /api/inventory/[id]/floorplan | Get floorplan (lender, principal, curtailments, payoff) | No (curtailments bounded) |
| PUT or POST/PATCH | /api/inventory/[id]/floorplan | Create/update floorplan | — |
| POST | /api/inventory/[id]/floorplan/curtailments | Record curtailment | — |
| POST | /api/inventory/[id]/floorplan/payoff-quote | Store payoff quote | — |

**Zod schema names and shapes (summary):**
- Params: `idParamSchema` `{ id: uuid }`, `photoFileIdParamSchema` `{ id, fileId }`, `jobIdParamSchema` `{ jobId: uuid }`, `dismissalIdParamSchema` `{ id: uuid }`, `reconLineItemIdParamSchema` `{ id, lineItemId }`.
- Query: `listBulkImportJobsQuerySchema` `{ limit, offset, status? }`, `alertsListQuerySchema` `{ limit, offset, alertType? }`, `vinGetQuerySchema` `{ latestOnly?, limit?, offset? }`, `valuationsListQuerySchema` `{ limit, offset, source? }`.
- Body: `reorderBodySchema` `{ fileIds: uuid[] }`, `setPrimaryBodySchema` `{ fileId: uuid }`, `bulkUpdateBodySchema` `{ vehicleIds: uuid[].max(50), status?, locationId? }`, `dismissBodySchema` `{ vehicleId, alertType, action: DISMISS|SNOOZE, snoozedUntil? }`, `vinDecodeTriggerBodySchema` `{} or { force? }`, `requestValuationBodySchema` `{ source: KBB|NADA|MOCK, condition?, odometer? }`, `reconUpdateBodySchema` `{ status?, dueDate? }`, `reconLineItemBodySchema` `{ description, costCents, category?, sortOrder? }`, `floorplanUpsertBodySchema` `{ lenderId, principalCents, aprBps?, startDate, nextCurtailmentDueDate? }`, `curtailmentBodySchema` `{ amountCents, paidAt }`, `payoffQuoteBodySchema` `{ payoffQuoteCents, payoffQuoteExpiresAt }`.
- Response shape: success `{ data: T }` or list `{ data: T[], meta: { total, limit, offset } }`. Error shape: `{ error: { code, message, details? } }`.
- **Dealership scoping:** `dealershipId` is always resolved from auth/context; never from client body or path for tenant-scoped resources.

---

# 3. RBAC matrix

| Resource / Action | inventory.read | inventory.write | reports.export | documents.read | documents.write | finance.read | finance.write |
|-------------------|----------------|-----------------|----------------|----------------|------------------|--------------|---------------|
| List vehicles / photos | ✓ | ✓ | — | ✓ (photos) | — | — | — |
| Upload / reorder / set primary / delete photo | — | ✓ | — | — | ✓ | — | — |
| Export CSV (inventory) | — | — | ✓ | — | — | — | — |
| Bulk import preview/apply, get job | ✓ (get job) | ✓ (preview, apply) | — | — | — | — | — |
| Bulk update vehicles | — | ✓ | — | — | — | — | — |
| Alerts counts / list | ✓ | — | — | — | — | — | — |
| Dismiss / snooze alert | — | ✓ | — | — | — | — | — |
| GET decoded VIN (Slice D) | ✓ | ✓ | — | — | — | — | — |
| POST trigger VIN decode (Slice D) | — | ✓ | — | — | — | — | — |
| GET valuations list (Slice E) | ✓ | — | — | — | — | ✓ | — |
| POST request valuation (Slice E) | — | — | — | — | — | ✓ | — |
| GET recon (Slice F) | ✓ | ✓ | — | — | — | — | — |
| PATCH/PUT recon, line items (Slice F) | — | ✓ | — | — | — | — | — |
| GET floorplan (Slice G) | — | — | — | — | — | ✓ | — |
| Create/update floorplan, curtailment, payoff (Slice G) | — | — | — | — | — | — | ✓ |

- **Least privilege:** No admin bypass; all routes enforce the above. Existing permissions `inventory.read`, `inventory.write`, `reports.export`, `documents.read`, `documents.write`; Slices D–G add use of `finance.read` (valuations list + request, floorplan read) and `finance.write` (floorplan mutations).
- **Tenant isolation:** Every list/get/update/delete is scoped by `dealershipId` from auth. No endpoint returns or mutates another tenant’s data. No client-supplied `dealershipId` for tenant scoping. Floorplan lenderId must belong to dealership.
- **Sensitive reads:** Inventory list/detail and alert list are inventory data; audit for sensitive read is not required by spec beyond existing audit policy. Export is already audited (report.exported). Floorplan and valuations are finance-sensitive; read access via finance.read; mutations and capture events audited.

---

# 4. Validation rules (consolidated)

- **Photos (Slice A):** Max 20 per vehicle; MIME `image/jpeg`, `image/png`, `image/webp`; max file size 10MB.
- **Bulk import (Slice B):** Max file size 1MB, max 500 rows per file.
- **Bulk update (Slice B):** Max 50 vehicleIds per request; at least one of status or locationId; all vehicleIds belong to dealership.
- **Alerts (Slice C):** snoozedUntil required and must be future when action = SNOOZE; vehicleId belongs to dealership.
- **VIN decode (Slice D):** Rate limit decode (e.g. 30/dealership/hour or 10/user/hour); optional max decodes per vehicle per day (e.g. 5). Params/query Zod; vehicle belongs to dealership.
- **Valuations (Slice E):** Rate limit valuation request (e.g. 20/dealership/hour or 5/user/hour). valueCents only; list pagination limit max 50. source enum KBB|NADA|MOCK.
- **Recon (Slice F):** costCents non-negative integer; description max 500; category max 50; max line items per vehicle (e.g. 100). status enum NOT_STARTED|IN_PROGRESS|COMPLETE.
- **Floorplan (Slice G):** All money in cents; aprBps non-negative. Rate limit curtailments (e.g. 50/dealership/hour), payoff quote (e.g. 20/dealership/hour). lenderId must belong to dealership.

---

# 5. UI plans

- **Slice A — Photo pipeline**
  - **Inventory detail (modal or page):** Photo gallery with reorder (drag-and-drop or up/down), “Set as primary” per photo, delete. List view can show primary thumbnail (e.g. in table row or card).
  - **Inventory list:** Optional primary thumbnail column or first photo in card.

- **Slice B — Bulk operations**
  - **Inventory page:** “Import” button → upload CSV → preview (show validation errors + row numbers) → confirm → apply (show jobId); job status polling or status page (GET job by id). “Bulk update” from table: select rows → toolbar “Bulk update” → modal with status/locationId → PATCH bulk/update.
  - **Export:** Existing Reports or inventory export entry point; optional filter by status in export dialog.

- **Slice C — Alerts**
  - **InventoryAlertsCard (right rail):** Real counts from GET /api/inventory/alerts/counts; links to filtered list (e.g. /inventory?alertType=missing_photos or /inventory/alerts?type=MISSING_PHOTOS). Optional dashboard widget with same counts + links.
  - **Inventory list:** Row badges for alert types (e.g. “No photos”, “90+ days”, “Recon overdue”) when applicable; optional filter by “Has alert” or by alert type.
  - **Alerts list page (optional):** Dedicated page or modal listing GET /api/inventory/alerts with dismiss/snooze actions and undo.

- **Slice D — VIN decode**
  - **Inventory detail modal:** Panel **"Specs / VIN"** — display VIN (from Vehicle), "Decode" button (POST /api/inventory/[id]/vin/decode), decoded specs from GET /api/inventory/[id]/vin (make, model, year, trim, body style, engine, etc.), "Last decoded at" and optional snapshot history.

- **Slice E — Valuations**
  - **Inventory detail modal:** Panel **"Valuations"** — list snapshots (source, value in dollars, date, condition/odometer); **"Get value"** button to select source (and optional condition/odometer) and call POST /api/inventory/[id]/valuations; new row appears in list.

- **Slice F — Reconditioning**
  - **Inventory detail modal:** Panel **"Reconditioning"** — status dropdown (NOT_STARTED, IN_PROGRESS, COMPLETE), due date picker, list of line items (description, cost, category) with add/edit/delete, total; sync total to vehicle summary. **Alerts card:** Links to vehicles with RECON_OVERDUE (driven by VehicleRecon.status and dueDate).

- **Slice G — Floorplan**
  - **Inventory detail modal:** Panel **"Floorplan"** — lender (select from dealership lenders), principal, APR, start date, next curtailment due date; list of curtailments (amount, date); current payoff quote and expiry; actions "Record curtailment", "Store payoff quote". Optional alerts: "Floorplan due" (nextCurtailmentDueDate near/past), "Payoff expiring" (payoffQuoteExpiresAt near).

---

# 6. Acceptance criteria and test plan

- **Slice A**
  - Unit: Validation (max photos, MIME, size); reorder/set-primary logic (one primary per vehicle).
  - Integration: Tenant isolation (photos only for vehicles in dealership); RBAC (no inventory.write → 403 on POST/PATCH/DELETE photos); happy path upload → reorder → set primary → delete; audit entries for add/reorder/set-primary/delete.
  - Backfill: Existing vehicles with photos get VehiclePhoto rows created; first photo (e.g. by createdAt) set as primary.

- **Slice B**
  - Unit: CSV parse and validate (row limits, file size); bulk update validation (vehicleIds in dealership, max 50).
  - Integration: Tenant isolation (import and bulk update only for dealership’s vehicles); RBAC (reports.export for export; inventory.write for import/bulk update); preview returns errors with row numbers; apply creates job and processes (or mocks job progress); GET job scoped by dealership; bulk update only updates vehicles in dealership; audit for job and vehicle updates.
  - Export: Existing export tests; optional filter by status.

- **Slice C**
  - Unit: Counts and list logic (stale days threshold, missing photos, recon overdue); dismiss/snooze and exclusion from list/counts.
  - Integration: Tenant isolation (alerts and dismissals scoped by dealership); RBAC (inventory.read for counts/list; inventory.write for dismiss); GET counts and list exclude current user’s dismissed/snoozed; POST dismiss/snooze and undo; list pagination and filter by alertType.
  - Alerts card: Real counts and links (manual or E2E).

- **Slice D**
  - Unit: Zod schemas; rate-limit counter (per dealership / per user).
  - Integration: Tenant isolation (decode and get only for dealership's vehicles); RBAC (inventory.read GET; inventory.write POST decode); POST creates VehicleVinDecode; GET returns latest or paginated snapshots; rate limit 429; audit vin_decode.requested.
  - Jest: RBAC negative; cross-dealership no access; validation; happy path decode → get.

- **Slice E**
  - Unit: Zod schemas; provider abstraction (mock returns cents); rate-limit logic.
  - Integration: Tenant isolation; RBAC (inventory.read GET list; finance.read POST request); GET paginated list; POST creates immutable VehicleValuation; rate limit 429; audit vehicle_valuation.captured.
  - Jest: RBAC negative; tenant isolation; validation; happy path request → list.

- **Slice F**
  - Unit: Zod schemas; total recompute and sync to Vehicle.reconCostCents; RECON_OVERDUE rule (VehicleRecon.status + dueDate).
  - Integration: Tenant isolation; RBAC (inventory.read GET; inventory.write mutations); GET recon null when none; create/update recon; add/update/delete line items; total and Vehicle.reconCostCents updated; audit events; alerts RECON_OVERDUE when dueDate past and status not COMPLETE.
  - Jest: RBAC; tenant isolation; validation; full recon workflow.

- **Slice G**
  - Unit: Zod schemas; principal/curtailment math; rate-limit logic.
  - Integration: Tenant isolation; RBAC (finance.read GET; finance.write mutations); lender belongs to dealership; create/update floorplan; add curtailment; store payoff quote; audit events; optional alert for due/payoff expiring.
  - Jest: RBAC; tenant isolation; validation; floorplan lifecycle.

**Test framework:** Jest only. No Vitest. RBAC negative tests (403 when permission missing); tenant isolation (cross-dealership no access); validation (400 for invalid body/params); happy paths for each route.

---

# 7. Rollout order and migration notes

- **Order:** Implement **Slice A → Slice B → Slice C** (photo pipeline first, then bulk, then alerts); then **Slice D (VIN decode)**, **Slice E (Valuations)** (can be parallel); then **Slice F (Recon)** (integrates RECON_OVERDUE with VehicleRecon); then **Slice G (Floorplan)**.
- **Migrations:**
  1. Slice A: Add `VehiclePhoto` model and indexes; backfill: for each FileObject with `bucket = 'inventory-photos'` and `entityType = 'Vehicle'`, create VehiclePhoto with `sortOrder` by createdAt; set first photo per vehicle as `isPrimary = true`.
  2. Slice B: Add `BulkImportJob` model and indexes.
  3. Slice C: Add `InventoryAlertDismissal`; optional Vehicle.reconDueDate and/or Dealership.settings for threshold.
  4. Slice D: Add `VehicleVinDecode` model and indexes. No backfill (on-demand decode).
  5. Slice E: Add `VehicleValuation` model and indexes. No backfill.
  6. Slice F: Add `VehicleRecon`, `VehicleReconLineItem` and indexes. Optional backfill: create VehicleRecon NOT_STARTED for vehicles with reconCostCents > 0 or status REPAIR (product decision). Update RECON_OVERDUE rule to use VehicleRecon.status and VehicleRecon.dueDate.
  7. Slice G: Add `VehicleFloorplan`, `VehicleFloorplanCurtailment` and indexes; relations on Vehicle, Lender. No backfill.
- **Data backfill (Slice A):** After migration, run backfill job or one-off: create VehiclePhoto for every existing inventory photo (FileObject); assign sortOrder (e.g. 0, 1, 2 by createdAt); set isPrimary = true for the first photo per vehicle only.
- **Runtime:** All tenant-facing API routes must export `dynamic = "force-dynamic"`. Server components that read alerts or inventory call `noStore()` where appropriate to avoid cross-tenant caching. Rate limits (D, E, G) implemented at route or middleware layer (per dealership or per user).

---

*End of spec. No implementation code; implementation follows this document.*
