# Inventory Module — Full SPEC (Step 1/4)

**Module:** inventory  
**Scope:** Vehicle CRUD, VIN decode (vPIC/NHTSA), vehicle photos (Supabase Storage), pricing & acquisition cost, status workflow, list filters/pagination/sorting, aging report. No implementation code in this step.

References: AGENT_SPEC.md, DONE.md, MODULES.md, core-platform-spec.md, DMS Non-Negotiables, Coding Standards.

---

## 1) Prisma Models (Prisma-Ready)

### 1.1 Table Summary

| Table | Tenant-scoped? | Soft delete? | Notes |
|-------|----------------|--------------|--------|
| Vehicle | Yes | Yes (deletedAt, deletedBy) | Core inventory entity |
| FileObject (extended) | Yes | Yes | Vehicle photos: bucket `inventory-photos`, entityType/entityId link |

**Vehicle photos:** Reuse **FileObject** (core-platform) with bucket `inventory-photos` and optional entity association. Do **not** add a separate VehiclePhoto table. To link files to vehicles, add optional fields to FileObject: `entityType String?`, `entityId String? @db.Uuid`. For vehicle photos: `entityType = 'Vehicle'`, `entityId = vehicleId`. List photos by `dealershipId`, `bucket = 'inventory-photos'`, `entityType = 'Vehicle'`, `entityId = vehicleId`, `deletedAt = null`.

**Acquisition cost:** Store on **Vehicle** only (no separate VehicleAcquisitionCost table): `purchasePrice`, `reconditioningCost?`, `otherCosts?`. Total acquisition = purchasePrice + (reconditioningCost ?? 0) + (otherCosts ?? 0). No cost history in this scope.

---

### 1.2 Vehicle

- **Purpose:** Single vehicle record per unit; tenant-scoped; status workflow; pricing and location.
- **Fields:**
  - `id` — UUID, PK
  - `dealershipId` — UUID, FK → Dealership, required
  - `vin` — String?, max 17 (nullable for pre-decode or non-standard)
  - `year` — Int?
  - `make` — String?
  - `model` — String?
  - `trim` — String?
  - `stockNumber` — String, required (dealer stock #)
  - `mileage` — Int? (odometer)
  - `color` — String?
  - `status` — Enum: `AVAILABLE` | `PENDING` | `SOLD` | `WHOLESALE`
  - `purchasePrice` — Decimal? (acquisition: what dealer paid)
  - `reconditioningCost` — Decimal? (optional breakdown)
  - `otherCosts` — Decimal? (optional breakdown)
  - `listPrice` — Decimal? (asking/sale price)
  - `locationId` — UUID?, FK → DealershipLocation (which lot)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
  - `deletedAt` — DateTime?
  - `deletedBy` — UUID? (FK → Profile)
- **Relations:**
  - `dealership` → Dealership
  - `location` → DealershipLocation (optional)
  - `deletedByProfile` → Profile (optional)
- **Indexes:**
  - `@@index([dealershipId])` — tenant scoping; every list/get/update/delete filters by dealershipId.
  - `@@index([dealershipId, status])` — filter list by status (available, pending, sold, wholesale).
  - `@@index([dealershipId, createdAt])` — sort by newest; time-bounded lists; aging report.
  - **Stock number uniqueness:** Do **not** add `@@unique([dealershipId, stockNumber])` in DB so that a stock number can be reused after a vehicle is soft-deleted. Enforce in **app layer**: on create/update, ensure no other row has same `dealershipId` + `stockNumber` and `deletedAt` is null. Add `@@index([dealershipId, stockNumber])` for lookups and uniqueness checks.
  - `@@index([dealershipId, vin])` — lookups by VIN; non-unique (allow duplicate VIN if needed).
- **Constraints:** Foreign keys; status enum; non-negative numeric fields enforced in app or check constraints (Prisma does not support check constraints in all versions—document in app layer).
- **Audit:** Vehicle is critical. Audit: create, update, delete, and optionally status_changed when status field changes.

---

### 1.3 FileObject (Extension for Inventory Photos)

- **Purpose:** Core-platform FileObject stores all file metadata; inventory photos use the same model with bucket `inventory-photos` and optional entity link.
- **Add to FileObject (if not present):**
  - `entityType` — String?, optional (e.g. `'Vehicle'`, `'Deal'`, `'Customer'`)
  - `entityId` — UUID?, optional (e.g. vehicleId)
- **Index (add for inventory):**
  - `@@index([dealershipId, bucket, entityType, entityId])` — list files by entity (e.g. all photos for a vehicle).
- **Usage for vehicle photos:** Upload to bucket `inventory-photos`; path e.g. `{dealershipId}/{vehicleId}/{uuid}.{ext}`; set `entityType = 'Vehicle'`, `entityId = vehicleId`. List: filter by dealershipId, bucket, entityType, entityId.

---

### 1.4 Audit

- **Critical tables for audit:** Vehicle (create, update, delete, and optionally status_changed). File upload/access already audited in core-platform (file.uploaded, file.accessed).
- **Actions to log:** `vehicle.created`, `vehicle.updated`, `vehicle.deleted`, `vehicle.status_changed`, `vehicle.photo_uploaded` (or rely on `file.uploaded` with metadata entityType=Vehicle, entityId).

---

## 2) RBAC Mapping

- **inventory.read** — View vehicles, vehicle detail, list photos metadata, call VIN decode, view aging report.
- **inventory.write** — Create/update/delete vehicles, upload/delete vehicle photos (and if using FileObject: **documents.write** for upload/delete; **documents.read** for listing photo metadata and obtaining signed URLs). See below.

**Route → permission:**

| Route | Permission(s) | Note |
|-------|----------------|------|
| GET /api/inventory | inventory.read | |
| POST /api/inventory | inventory.write | |
| GET /api/inventory/[id] | inventory.read | |
| PATCH /api/inventory/[id] | inventory.write | |
| DELETE /api/inventory/[id] | inventory.write | |
| POST /api/inventory/vin-decode | inventory.read | No persist; read-only external call. |
| POST /api/inventory/[id]/photos | inventory.write + **documents.write** | FileObject create + Storage upload. |
| GET /api/inventory/[id]/photos | inventory.read + **documents.read** | List FileObject metadata; signed URLs via existing GET /api/files/signed-url (documents.read). |
| DELETE /api/inventory/[id]/photos/[fileId] (if implemented) | inventory.write + **documents.write** | |
| GET /api/inventory/aging | inventory.read | |

**Tenant scoping:** Every route uses `dealershipId` from auth/context (active dealership). Never from client body or query. Cross-tenant access forbidden.

---

## 3) API Contract List (No Code)

All responses use standard error shape on failure: `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.

Pagination: `limit` (default 25, max 100), `offset` (0-based). List response: `{ data: T[], meta: { total, limit, offset } }`.

**Dealership scoping:** `dealershipId` is always resolved from auth/context (active dealership). Never from client. All list/get/update/delete are scoped by that dealership.

---

### 3.1 GET /api/inventory

- **Purpose:** Paginated list with filters and sort.
- **Permission:** inventory.read
- **Audit:** No

**Query (Zod shape):**
- `limit` — number, optional, default 25, max 100
- `offset` — number, optional, default 0, min 0
- `status` — enum optional: `AVAILABLE` | `PENDING` | `SOLD` | `WHOLESALE`
- `locationId` — UUID optional
- `year` — number optional
- `make` — string optional
- `model` — string optional
- `vin` — string optional (partial match or exact, specify: exact match)
- `stockNumber` — string optional (partial or exact)
- `sortBy` — enum optional: `createdAt` | `listPrice` | `mileage` | `stockNumber` | `updatedAt`
- `sortOrder` — enum optional: `asc` | `desc`, default `desc` for date fields, `asc` for others (or default `desc` for createdAt)

**Response:** `{ data: Vehicle[], meta: { total, limit, offset } }`. Vehicle: id, dealershipId, vin, year, make, model, trim, stockNumber, mileage, color, status, purchasePrice, listPrice, locationId, createdAt, updatedAt; optionally location name (from join). Exclude soft-deleted (deletedAt null only).

---

### 3.2 POST /api/inventory

- **Purpose:** Create vehicle.
- **Permission:** inventory.write
- **Audit:** Yes — entity Vehicle, action `vehicle.created`, metadata (vehicleId, status, stockNumber).

**Body (Zod shape):**
- `vin` — string optional, max 17
- `year` — number optional, integer
- `make` — string optional
- `model` — string optional
- `trim` — string optional
- `stockNumber` — string required, non-empty
- `mileage` — number optional, integer, min 0
- `color` — string optional
- `status` — enum optional, default `AVAILABLE`: `AVAILABLE` | `PENDING` | `SOLD` | `WHOLESALE`
- `purchasePrice` — number optional, min 0
- `reconditioningCost` — number optional, min 0
- `otherCosts` — number optional, min 0
- `listPrice` — number optional, min 0
- `locationId` — UUID optional (must belong to active dealership)

**Response:** 201, `{ data: Vehicle }` (full created vehicle). Conflict if stockNumber already exists for dealership (and not deleted).

---

### 3.3 GET /api/inventory/[id]

- **Purpose:** Single vehicle by id.
- **Permission:** inventory.read
- **Audit:** No (or optional sensitive read if vehicle data is considered sensitive; spec: no audit for basic get)

**Params (Zod):** `id` — UUID

**Response:** `{ data: Vehicle }` with optional `location` (id, name) and optional `photos` (array of file metadata: id, filename, mimeType, sizeBytes, createdAt; client uses GET /api/files/signed-url with fileId for URL). 404 if not found or wrong dealership.

---

### 3.4 PATCH /api/inventory/[id]

- **Purpose:** Partial update.
- **Permission:** inventory.write
- **Audit:** Yes — entity Vehicle, action `vehicle.updated`, metadata (fields changed, before/after safe). If `status` changed, also emit or log `vehicle.status_changed` (metadata: previousStatus, newStatus).

**Params:** `id` — UUID

**Body (Zod, all optional):** Same fields as create (vin, year, make, model, trim, stockNumber, mileage, color, status, purchasePrice, reconditioningCost, otherCosts, listPrice, locationId). Partial; no required fields.

**Response:** `{ data: Vehicle }`. 404 if not found or wrong dealership. Conflict if stockNumber changed and already in use by another vehicle (deletedAt null).

---

### 3.5 DELETE /api/inventory/[id]

- **Purpose:** Soft delete (set deletedAt, deletedBy).
- **Permission:** inventory.write
- **Audit:** Yes — entity Vehicle, action `vehicle.deleted`, metadata (vehicleId, stockNumber).

**Params:** `id` — UUID

**Response:** 204 or 200. 404 if not found or wrong dealership. Idempotent if already deleted (return 204).

---

### 3.6 POST /api/inventory/vin-decode

- **Purpose:** Server-side call to NHTSA vPIC API; return decode result; do not persist.
- **Permission:** inventory.read (treat as read-only helper for form fill).
- **Audit:** No

**Body (Zod):** `{ vin: string }` — required, length 17 (or allow 8–17 per NHTSA).

**Response:** 200, `{ data: { year?, make?, model?, trim?, ... } }` — shape per NHTSA vPIC response (map to flat fields useful for vehicle form). On vPIC error or invalid VIN: 400 or 502 with error shape. Never store decode result in DB from this endpoint.

---

### 3.7 POST /api/inventory/[id]/photos

- **Purpose:** Multipart upload to bucket `inventory-photos`; create FileObject with entityType=Vehicle, entityId=vehicleId.
- **Permission:** inventory.write and documents.write
- **Audit:** Yes — either `vehicle.photo_uploaded` (entity Vehicle, entityId=vehicleId, metadata fileId) or rely on core `file.uploaded` (entity FileObject, metadata bucket, entityType, entityId). Prefer `file.uploaded` for consistency; optional extra `vehicle.photo_uploaded` for inventory module if needed for consumers.

**Params:** `id` — UUID (vehicleId)

**Body:** multipart/form-data with `file` (required). Validate: mime allowlist (e.g. image/jpeg, image/png, image/webp), max size (e.g. 10MB). Path in Storage: e.g. `{dealershipId}/{vehicleId}/{uuid}.{ext}`. FileObject: dealershipId from auth, bucket=`inventory-photos`, path, filename, mimeType, sizeBytes, uploadedBy, entityType=`Vehicle`, entityId=vehicleId.

**Response:** 201, `{ data: { id, filename, mimeType, sizeBytes, createdAt } }`. 404 if vehicle not found or wrong dealership.

---

### 3.8 GET /api/inventory/[id]/photos

- **Purpose:** List photo metadata for vehicle (fileIds for client to call GET /api/files/signed-url).
- **Permission:** inventory.read and documents.read
- **Audit:** Optional sensitive read when issuing signed URLs; if client calls GET /api/files/signed-url per file, core-platform already audits file.accessed. This list endpoint may not issue URLs directly; response can include file ids only—then audit happens when client requests signed URL. Spec: list returns file metadata (id, filename, mimeType, sizeBytes, createdAt); no signed URLs in this response; client uses GET /api/files/signed-url?fileId= for each. So no audit on this list; audit on signed-url when used.

**Params:** `id` — UUID (vehicleId)

**Response:** `{ data: FileObject[] }` (id, filename, mimeType, sizeBytes, createdAt) — only files for this vehicle in bucket inventory-photos, not deleted. 404 if vehicle not found or wrong dealership.

---

### 3.9 DELETE /api/inventory/[id]/photos/[fileId] (optional)

- **Purpose:** Soft-delete one vehicle photo (FileObject).
- **Permission:** inventory.write and documents.write
- **Audit:** Yes — file.deleted (or vehicle.photo_deleted with metadata fileId)
- **Params:** `id` — vehicleId (UUID); `fileId` — FileObject id (UUID). Must belong to this vehicle (entityId=id) and bucket inventory-photos.
- **Response:** 204. 404 if vehicle or file not found or wrong dealership.

---

### 3.10 GET /api/inventory/aging

- **Purpose:** Simple aging report: vehicles with days in stock (or similar). Paginated list.
- **Permission:** inventory.read
- **Audit:** No

**Query (Zod):**
- `limit` — number, optional, default 25, max 100
- `offset` — number, optional, default 0
- `status` — optional, filter (e.g. AVAILABLE only for “current inventory aging”)
- `sortBy` — e.g. `daysInStock` (desc = oldest first)
- `sortOrder` — asc | desc

**Response:** `{ data: { vehicleId, stockNumber, year, make, model, status, listPrice, createdAt, daysInStock }[], meta: { total, limit, offset } }`. `daysInStock` = floor((now - createdAt) in days). Exclude soft-deleted.

---

## 4) UI Screen Map (For Later Implementation)

- **Inventory list**
  - Table: columns (e.g. stock #, year/make/model, VIN, mileage, status, list price, location, days in stock).
  - Filters: status, location, year, make, model, VIN, stock number.
  - Sort: createdAt, listPrice, mileage, stockNumber, etc.
  - Pagination: limit/offset with meta.
  - Bulk actions: optional (e.g. bulk status change, export).

- **Inventory detail**
  - Tabs: **Overview** (vehicle info, pricing, location, status), **Photos** (list + upload; use signed URLs for display), **History** (audit or activity for this vehicle).
  - Edit button → navigate to edit form or inline edit.

- **Create / Edit vehicle form**
  - Fields per API (vin, year, make, model, trim, stockNumber, mileage, color, status, purchasePrice, reconditioningCost, otherCosts, listPrice, locationId).
  - **VIN decode:** Input VIN → button “Decode VIN” → call POST /api/inventory/vin-decode → map response to form fields (year, make, model, trim, etc.); user can override.
  - Validation: client + server (Zod). Clear error states.

- **VIN decode workflow**
  - User enters VIN in form → clicks Decode → frontend calls POST /api/inventory/vin-decode with { vin } → server calls NHTSA vPIC → returns decode → frontend maps to form fields (year, make, model, trim, etc.). No persistence until user submits create/update.

- **Aging report view**
  - Call GET /api/inventory/aging with filters (e.g. status=AVAILABLE), sort by daysInStock desc.
  - List: vehicle, days in stock, list price, status. Export optional (CSV later).

---

## 5) Events

**Emitted by inventory module:**
- `vehicle.created` — payload: `{ vehicleId, dealershipId, status, stockNumber }`
- `vehicle.updated` — payload: `{ vehicleId, dealershipId, changedFields?, before?, after? }`
- `vehicle.deleted` — payload: `{ vehicleId, dealershipId, deletedBy }`
- `vehicle.status_changed` — payload: `{ vehicleId, dealershipId, previousStatus, newStatus }`
- `vehicle.photo_uploaded` — payload: `{ vehicleId, fileId, dealershipId, uploadedBy }` (or rely on core `file.uploaded` with metadata entityType=Vehicle, entityId=vehicleId)

**Consumed (cross-module, not designed here):**
- Deals module may subscribe to `vehicle.status_changed` (e.g. when vehicle moves to SOLD, link to deal or update deal status). Do not implement consumers in this step.

---

## 6) FileObject Schema Addition (Summary)

To support vehicle photos without a separate VehiclePhoto table, add to **FileObject** (in core-platform or shared schema):

- `entityType` — String?, optional
- `entityId` — String? @db.Uuid, optional
- Index: `@@index([dealershipId, bucket, entityType, entityId])`

Storage bucket: `inventory-photos`. Path pattern: `{dealershipId}/{vehicleId}/{uniqueId}.{ext}`.

---

## 7) Module Boundary

- **Owns:** Vehicle model; inventory db/service; inventory API routes (list, CRUD, vin-decode, photos, aging). Vehicle photos are FileObject rows + Supabase bucket `inventory-photos`; inventory module uses core-platform file upload/signed-url and optionally extends FileObject with entityType/entityId.
- **Depends on:** core-platform (Dealership, DealershipLocation, Profile, AuditLog, FileObject, RBAC, auth/session). No direct dependency on customers, deals, or documents modules.
- **Consumed by (later):** Deals module may reference vehicleId and subscribe to vehicle.status_changed. Reports module may read inventory for turn/aging. No implementation of consumers in this step.
- **Shared types:** Vehicle status enum; API response shapes (Vehicle, list meta). No cross-module DB access; service-to-service only when other modules are built.

---

## Backend implementation checklist

- [ ] Add Vehicle model to Prisma (dealershipId, vin, year, make, model, trim, stockNumber, mileage, color, status enum, purchasePrice, reconditioningCost, otherCosts, listPrice, locationId, timestamps, deletedAt, deletedBy). Add relation to Dealership, DealershipLocation, Profile (deletedBy).
- [ ] Add indexes: dealershipId; (dealershipId, status); (dealershipId, createdAt); app-level unique (dealershipId, stockNumber) where deletedAt is null; optional (dealershipId, vin).
- [ ] Add optional entityType, entityId to FileObject; add index (dealershipId, bucket, entityType, entityId). Create migration(s).
- [ ] Implement modules/inventory/db: list (paginated, filters, sort), getById, create, update, softDelete, listPhotos (by vehicleId), aging list. All functions take dealershipId; every query scoped by dealershipId.
- [ ] Implement modules/inventory/service: business logic; call db; write audit (vehicle.created, vehicle.updated, vehicle.deleted, vehicle.status_changed); emit events.
- [ ] Implement route handlers under app/api/inventory: GET list, POST create, GET [id], PATCH [id], DELETE [id], POST vin-decode, POST [id]/photos, GET [id]/photos, GET aging. Thin: Zod parse → requirePermission → service → respond.
- [ ] Zod: list query (limit, offset, status, locationId, year, make, model, vin, stockNumber, sortBy, sortOrder); id param; create body; update body (partial); vin-decode body; photo upload multipart validation (mime, size); aging query.
- [ ] VIN decode: server-side call to NHTSA vPIC API; map response to flat shape; do not persist. Handle errors (invalid VIN, API down).
- [ ] Photos: upload to Supabase Storage bucket `inventory-photos`; create FileObject with bucket, path, entityType=Vehicle, entityId=vehicleId; enforce documents.write and inventory.write; audit file.uploaded (or vehicle.photo_uploaded).
- [ ] Enforce RBAC on every route (inventory.read / inventory.write; documents.read/documents.write for photo list/upload/signed-url).
- [ ] Tenant scoping: dealershipId from auth only; no client-supplied dealershipId.
- [ ] Standard error shape; pagination max limit 100 default 25.
- [ ] Add /lib/events.ts emits for vehicle.created, vehicle.updated, vehicle.deleted, vehicle.status_changed, vehicle.photo_uploaded (or use file.uploaded).
- [ ] Tests: tenant isolation (Dealer A cannot read/update/delete Dealer B vehicles); RBAC (insufficient permission → 403); audit (create/update/delete/status change write audit rows); VIN decode and photo upload flows.

---

## Frontend implementation checklist

- [ ] Inventory list page: table with columns (stock #, year/make/model, VIN, mileage, status, list price, location, days in stock); filters (status, location, year, make, model, VIN, stock number); sort (createdAt, listPrice, mileage, stockNumber); pagination (limit/offset); loading, empty, error states.
- [ ] Inventory detail page: tabs Overview, Photos, History; Overview shows vehicle info and location; Photos lists images (fetch GET /api/inventory/[id]/photos, then GET /api/files/signed-url per fileId for display) and upload (POST /api/inventory/[id]/photos); History shows audit for entity Vehicle, entityId.
- [ ] Create vehicle form: all fields; VIN decode button → POST /api/inventory/vin-decode with { vin } → map result to year, make, model, trim; submit POST /api/inventory. Client and server validation; error display.
- [ ] Edit vehicle form: load GET /api/inventory/[id]; PATCH /api/inventory/[id] on submit. Same VIN decode helper as create.
- [ ] Aging report view: GET /api/inventory/aging with filters and sort; table (vehicle, days in stock, list price, status); pagination; optional export later.
- [ ] Use shared components and Notion-like neutrals + blue accent; loading/empty/error on all screens; accessibility (labels, keyboard nav, focus).
