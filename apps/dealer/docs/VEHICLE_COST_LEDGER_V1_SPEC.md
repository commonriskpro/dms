# Vehicle Cost Ledger V1 — Product & Technical Spec

**Sprint:** Vehicle Cost Ledger V1  
**Step:** Architect (Step 1)  
**Status:** Approved for implementation

This spec defines a per-vehicle cost ledger as the **primary and only cost source of truth** for V1. It is a greenfield/clean build: no coexistence with legacy flat vehicle cost fields, no dual-write, no sync layer.

---

## Architecture: Ledger as sole source of truth

- **VehicleCostEntry** and **VehicleCostDocument** are the **canonical** cost storage. All acquisition, recon, fees, and total invested are **derived from ledger entries only**.
- **Legacy flat vehicle cost fields** (e.g. `Vehicle.auctionCostCents`, `transportCostCents`, `reconCostCents`, `miscCostCents`) are **not** the active model:
  - Do **not** keep them as the active source for cost in V1.
  - All vehicle cost summary logic **reads from ledger-derived totals**, not from these fields.
  - Any pricing, gross, or reporting logic touched in this sprint **uses derived ledger totals only**.
- **No dual-write and no sync layer.** Nothing writes cost to both the ledger and Vehicle flat fields. Totals are always computed from the ledger at read time (or via a single derived view/service); no copying ledger sums back onto Vehicle.
- **Clean DB build:** Implement VehicleCostEntry + VehicleCostDocument as the only cost storage used by this feature. Legacy cost columns on Vehicle may be deprecated/removed in schema or left unused; no code path in this sprint shall read or write them for cost purposes.

---

## 1. Product scope

### 1.1 V1 includes

- **Acquisition summary** — Purchase price, purchase date, acquisition source/vendor, and “total invested” **derived only from the ledger** (e.g. from the acquisition cost entry and sum of all entries).
- **Cost ledger entries** — Line-item costs per vehicle with category, amount, vendor name fallback, date, memo, optional status, and optional attachment(s). This is the **only** cost storage used for vehicle cost in V1.
- **Vendor association** — **vendorName-only** on each cost entry for V1 (no Vendor table); see Data model.
- **Document uploads** — Invoice, receipt, bill of sale, title doc, and other cost-related documents; linkable to a cost entry or to the vehicle (general).
- **Derived totals** — Acquisition subtotal, recon subtotal, fees subtotal, total invested — **all derived from ledger entries only**. Vehicle cost summary and any pricing/gross/reporting logic touched in this sprint use these derived totals only.

### 1.2 V1 explicitly excludes

- Full AP (accounts payable) or payables workflow.
- Invoice OCR or automated extraction.
- Automatic accounting journal entries or general-ledger integration.
- Multi-vehicle bulk cost imports (single-vehicle flows only).
- Deep vendor management (CRUD vendor directory, vendor statements, etc.) beyond what is needed to record “who we paid” on a cost entry.
- **Using legacy flat vehicle cost fields as the active model** — no reads from or writes to Vehicle.auctionCostCents, transportCostCents, reconCostCents, miscCostCents for cost in V1; no dual-write or sync from ledger to those fields.

---

## 2. Data model design

### 2.1 Entity: VehicleCostEntry

Ledger row per cost line item.

| Field            | Type        | Required | Notes |
|------------------|-------------|----------|--------|
| id               | UUID        | ✓        | PK, default uuid() |
| dealershipId     | UUID        | ✓        | Tenant scope, FK Dealership |
| vehicleId        | UUID        | ✓        | FK Vehicle, onDelete Cascade |
| category         | Enum        | ✓        | See Cost categories |
| amountCents      | BigInt      | ✓        | Cents; per repo money rules (DB: BigInt, API: string) |
| vendorId         | UUID?       | —        | FK Vendor, nullable; use if Vendor table exists |
| vendorName       | String?     | —        | Fallback when no Vendor or free text (e.g. "Auction Co") |
| occurredAt       | DateTime    | ✓        | When the cost was incurred |
| memo             | String?     | —        | Optional notes, max length TBD (e.g. 500) |
| status           | Enum?       | —        | Optional: ESTIMATED | ACTUAL (see below) |
| createdByUserId  | UUID        | ✓        | FK Profile, who created the entry |
| createdAt        | DateTime    | ✓        | |
| updatedAt        | DateTime    | ✓        | |
| deletedAt        | DateTime?   | —        | Soft delete if desired |
| deletedBy        | UUID?       | —        | Optional |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`, `@@index([dealershipId, occurredAt])`. Consider composite `@@index([dealershipId, vehicleId, category])` for totals by category.

**Relations:** Dealership, Vehicle, Profile (createdBy). Optional: Vendor.

---

### 2.2 Entity: VehicleCostDocument

Links a file (invoice, receipt, PDF, etc.) to a vehicle and optionally to a cost entry.

| Field          | Type    | Required | Notes |
|----------------|---------|----------|--------|
| id             | UUID    | ✓        | PK |
| dealershipId   | UUID    | ✓        | Tenant scope |
| vehicleId      | UUID    | ✓        | FK Vehicle, onDelete Cascade |
| costEntryId    | UUID?   | —        | FK VehicleCostEntry, nullable = vehicle-level doc |
| fileObjectId   | UUID    | ✓        | FK FileObject, onDelete Cascade; reuse existing FileObject |
| kind           | Enum    | ✓        | invoice \| receipt \| bill_of_sale \| title_doc \| other |
| createdAt      | DateTime| ✓        | |
| createdByUserId| UUID?   | —        | Optional, for audit |

**Indexes:** `@@index([dealershipId])`, `@@index([dealershipId, vehicleId])`, `@@index([vehicleId])`, `@@index([costEntryId])`.

**Relations:** Dealership, Vehicle, FileObject; optional VehicleCostEntry, Profile.

Documents are stored as **FileObject**; this table is a join with kind and optional cost-entry link. Reuse existing upload and signed-URL flow (e.g. new bucket like `vehicle-cost-docs` or entityType `VehicleCostDocument`).

---

### 2.3 Vendor: V1 recommendation

- **Recommendation for V1:** **No Vendor table.** Use **vendorName** (String, nullable) on **VehicleCostEntry** only. This keeps V1 simple and avoids vendor CRUD, deduplication, and UI. If product later wants a vendor directory, add a Vendor table and add **vendorId** to VehicleCostEntry with **vendorName** as fallback.
- **If a minimal Vendor table is required:** Add **Vendor** with: id, dealershipId, name, contactName?, phone?, email?, address?, type? (e.g. auction, transport, repair_shop). VehicleCostEntry gets vendorId? and vendorName?; display name = Vendor.name ?? vendorName.

**Spec lock:** V1 proceeds with **vendorName-only** unless explicitly overridden; no Vendor table in initial implementation.

---

### 2.4 Totals: ledger-derived only (no legacy fields, no sync)

- **All totals are derived from VehicleCostEntry only.** Sum `amountCents` by vehicle and by category (acquisition, recon_parts, recon_labor, fee categories, etc.) at read time. No cached cost fields on Vehicle; no dual-write; no sync layer from ledger to Vehicle.
- Vehicle cost summary logic (vehicle detail API, pricing card, projected gross, any reporting or list views touched in this sprint) **must read from these derived totals**, not from legacy Vehicle flat cost columns.

---

## 3. Cost categories

Controlled enum for **VehicleCostEntry.category**:

| Value           | Label (example)   | Use for |
|-----------------|-------------------|---------|
| acquisition     | Acquisition       | Purchase price / buy cost |
| auction_fee     | Auction Fee       | Auction buyer fee |
| transport       | Transport         | Shipping, hauling |
| title_fee       | Title Fee         | Title/registration |
| doc_fee         | Doc Fee           | Document fee |
| recon_parts     | Recon (Parts)     | Parts for reconditioning |
| recon_labor     | Recon (Labor)     | Labor for reconditioning |
| detail          | Detail            | Detailing |
| inspection      | Inspection        | Inspection cost |
| storage         | Storage           | Storage fee |
| misc            | Miscellaneous     | Other costs |

**Status (optional):** If included, use **ESTIMATED** | **ACTUAL**. ESTIMATED = planned or not yet paid; ACTUAL = confirmed/paid. V1 can omit status and add later.

---

## 4. Attachments and file strategy

- **Allowed file types:** Align with existing document upload allowlist (e.g. PDF, JPEG, PNG, WebP); max size per repo rules (e.g. 25MB PDF, 10MB images).
- **Linkage:** **VehicleCostDocument** links **FileObject** to **vehicleId** and optionally **costEntryId**. Attachments can be **per cost entry** (costEntryId set) or **vehicle-level** (costEntryId null).
- **Storage:** Reuse **FileObject** and existing upload pipeline (e.g. `core-platform` file service or documents module). New bucket or entityType for vehicle-cost docs (e.g. bucket `vehicle-cost-docs`, path prefix by dealershipId and vehicleId). No new file storage system.
- **Upload flow:** Same pattern as vehicle photos or deal documents: POST multipart → validate → upload to storage → create FileObject → create VehicleCostDocument row (with vehicleId, optional costEntryId, kind). Download via existing signed-URL pattern; audit file.accessed.

---

## 5. UI / page structure

### 5.1 Surface

- **Vehicle detail page** → add a **“Costs & Documents”** section (or tab within existing layout). Do not redesign the whole vehicle detail page; integrate into current card stack or tab set (see `VehicleDetailContent` and existing cards like VehiclePricingCard, VehicleReconCard).

### 5.2 Blocks (in order)

1. **Acquisition summary** — Compact block: acquisition source/vendor, purchase price, purchase date, total invested — **all derived from cost entries** (e.g. first/only `acquisition` entry for price/date/vendor; sum of all entries for total invested).
2. **Cost totals** — Subtotals: acquisition, recon (recon_parts + recon_labor), fees (auction_fee, title_fee, doc_fee, etc.), and **total invested**. Shown near top of Costs section.
3. **Cost ledger table** — Rows: category, amount, vendor (name), date, memo (truncated or indicator), attachment indicator, actions (edit/delete if permitted). Use shared table components and compact density.
4. **Add Cost Entry** — Form (inline or modal per spec choice): category, amount, vendor name, date, memo, optional status; optional “attach document” that links upload to this entry. Required fields: category, amountCents, occurredAt.
5. **Documents list** — List of VehicleCostDocument for this vehicle: kind, filename, linked-to entry (if any), created date; actions: open/download (signed URL), optionally remove link. Upload control to add vehicle-level or entry-linked document.

### 5.3 Placement and UX

- **Totals:** At top of “Costs & Documents” section for quick scan.
- **Upload actions:** In “Add Cost Entry” (attach to entry) and in Documents list (add vehicle-level or link to entry).
- **Viewing/downloading:** Documents open in new tab or download via signed URL; no inline PDF/image viewer required for V1.
- **Inline vs modal:** Add/Edit cost entry can be modal to avoid cluttering the page; Documents list inline with “Add document” button.

---

## 6. Behavior rules

- **Vendor:** Cost entry may have no vendor (vendorName null); adding a cost without vendor is allowed.
- **Documents:** A document may be **vehicle-level** (costEntryId null) or **linked to a cost entry** (costEntryId set). Both allowed.
- **Edit/delete:** Cost entries are editable and soft-deletable (or hard delete) per RBAC; documents are unlink/delete per RBAC. Deletion of a cost entry does not delete linked FileObjects; VehicleCostDocument rows for that entry can be unlinked (set costEntryId to null) or removed.
- **Required vs optional:** Required on cost entry: vehicleId, category, amountCents, occurredAt, createdByUserId. Optional: vendorId, vendorName, memo, status.
- **Acquisition summary source:** Acquisition summary is **derived only from cost entries**: the first (or only) entry with category `acquisition` supplies purchase price, date, and vendor name. If no such entry exists, show “—” or “Not set.” Total invested = sum of all cost entries’ amountCents for the vehicle.
- **Purchase price:** Represented **only** as a cost ledger entry with category `acquisition` (not a separate vehicle-level field). Vehicle cost summary and pricing/gross logic use **ledger-derived totals only**; legacy Vehicle cost fields are not read or written for cost in V1.

---

## 7. API / backend contract plan

- **Cost entries**
  - `GET /api/inventory/[id]/cost-entries` — List cost entries for vehicle (tenant-scoped, inventory.read).
  - `POST /api/inventory/[id]/cost-entries` — Create cost entry (inventory.write); body: category, amountCents, vendorName?, occurredAt, memo?, status?.
  - `PATCH /api/inventory/[id]/cost-entries/[entryId]` — Update cost entry (inventory.write).
  - `DELETE /api/inventory/[id]/cost-entries/[entryId]` — Delete (or soft-delete) cost entry (inventory.write).
- **Totals**
  - `GET /api/inventory/[id]/cost` — **Must return only ledger-derived totals**: acquisition subtotal, recon subtotal, fees subtotal, total invested (all from VehicleCostEntry). Do not read or return legacy Vehicle flat cost fields. Update this route (and any callers) to use the new cost-ledger service for totals.
- **Documents**
  - `GET /api/inventory/[id]/cost-documents` — List VehicleCostDocument for vehicle (inventory.read + documents.read).
  - `POST /api/inventory/[id]/cost-documents` — Create link (upload file → FileObject → VehicleCostDocument with vehicleId, costEntryId?, kind). Requires inventory.write and documents.write. Rate-limit uploads.
  - `GET /api/files/signed-url?fileId=...` — Existing; use for download after checking user has access to the vehicle’s cost documents.
  - Optional: `DELETE /api/inventory/[id]/cost-documents/[docId]` — Remove VehicleCostDocument link (and optionally soft-delete FileObject per policy).
- **Vendor:** No vendor endpoints in V1 if vendorName-only.

Use standard auth (getAuthContext), RBAC (guardPermission inventory.read/write, documents.read/write), tenant scoping (dealershipId from context only), and Zod validation; return shapes consistent with existing API (e.g. jsonResponse, error codes).

---

## 8. RBAC / tenant rules

- **View costs:** `inventory.read` — can list cost entries and cost documents for vehicles in their dealership.
- **Add/edit/delete cost entries:** `inventory.write`.
- **View documents (list + metadata):** `inventory.read` and `documents.read`.
- **Upload/link cost documents:** `inventory.write` and `documents.write`.
- **Download (signed URL):** Enforce that the file belongs to a VehicleCostDocument for a vehicle in the user’s dealership and user has `documents.read` (or equivalent); audit file.accessed.
- **Tenant:** All queries and mutations scoped by `ctx.dealershipId`; no client-supplied dealershipId. Cross-tenant ID in path → 404.

---

## 9. Slice plan with acceptance criteria

| Slice | Scope | Acceptance criteria |
|-------|--------|----------------------|
| **A — Cost ledger architecture/spec** | This document; no app code. | Spec approved; data model, API, and UI blocks defined; risks documented. |
| **B — Backend data model and services** | Prisma schema (VehicleCostEntry, VehicleCostDocument; enums); migration; db + service layer for list/create/update/delete cost entries, list/create cost documents, **derive all totals from ledger**. Vehicle cost summary logic reads from ledger-derived totals only; no writes to legacy Vehicle cost fields; no sync layer. | Schema applies; services tenant-safe; totals correct by category and total invested; no dual-write. |
| **C — API routes and upload/link behavior** | Routes for cost-entries and cost-documents; reuse file upload and signed URL; validation and RBAC. | All routes respond correctly; upload creates FileObject + VehicleCostDocument; download gated and audited. |
| **D — Vehicle detail UI integration** | “Costs & Documents” section/tab; Acquisition summary, Cost totals, Cost ledger table, Add/Edit cost entry, Documents list. | Section visible on vehicle detail; add/edit/delete and document list/upload work; design system tokens only. |
| **E — Totals and derived summaries** | Acquisition/recon/fees/total invested **derived only from ledger**; vehicle cost summary and any pricing/gross/reporting logic touched use these totals. | Totals match sum of entries; no use of legacy Vehicle cost fields; displayed in UI and available in API. |
| **F — Tests/docs/hardening** | Service and route tests; vehicle cost UI tests; permission and tenant tests; docs update. | Tests pass; docs reflect V1 behavior; no regressions. |

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|-------------|
| **Cost duplication** | **Single source of truth: ledger only.** No use of legacy Vehicle flat cost fields for cost in V1; no dual-write; no sync layer. All cost summary and pricing/gross logic read from ledger-derived totals. |
| **Vendor ambiguity** | vendorName-only in V1 avoids vendor table complexity; same vendor can be typed differently (e.g. “Auction Co” vs “Auction Co.”). Accept for V1; optional Vendor table later for normalization. |
| **Attachment sprawl** | Limit docs per vehicle or per entry if needed (e.g. max 20 per vehicle); clear kinds (invoice, receipt, etc.); list UX shows kind and link to entry. |
| **Stale totals** | Totals are always derived at read time from VehicleCostEntry; no cached cost on Vehicle and no sync, so no staleness. |
| **UI clutter on vehicle detail** | Costs & Documents as one section or tab; compact table; Add/Edit in modal; avoid long forms on main canvas. |
| **Security of uploaded docs** | Reuse existing file storage; signed URLs only; access check that file is attached to a vehicle cost doc for a vehicle in user’s dealership; audit file.accessed; no public URLs. |
| **Overbuilding vendor management** | V1: no Vendor table, no vendor CRUD UI, no vendor search; only vendorName on cost entry. |

---

## References (current codebase)

- **Vehicle model:** `apps/dealer/prisma/schema.prisma` — Vehicle (legacy cost fields **not used for cost in V1**); VehicleRecon, VehicleReconLineItem (recon workflow may remain for recon status/line items; cost totals for vehicle come from VehicleCostEntry in V1).
- **Vehicle detail:** `modules/inventory/ui/VehicleDetailContent.tsx`, `VehiclePricingCard`, `VehicleReconCard`; `app/(app)/inventory/vehicle/[id]/page.tsx`. Update cost summary and pricing/gross display to use **ledger-derived totals only**.
- **Cost API:** `app/api/inventory/[id]/cost/route.ts` — **Update** to return ledger-derived totals only (from VehicleCostEntry), not Vehicle flat fields. `modules/inventory/service/vehicle.ts` — `calculateVehicleCost`, `projectedGrossCents` and any callers touched in this sprint must use **ledger-derived totals** (new cost-ledger service), not legacy Vehicle fields.
- **FileObject / upload:** `prisma/schema.prisma` (FileObject, VehiclePhoto); `modules/core-platform/service/file.ts` (uploadFile, getSignedUrl); `app/api/inventory/[id]/photos/route.ts` (POST upload); DealDocument pattern for deal-linked docs.
- **Documents module:** `modules/documents/` — upload, signed URL; DealDocument category enum.
- **Recon:** `modules/inventory/db/recon.ts` — Recon line items are separate from cost ledger; any **cost totals** shown for the vehicle (e.g. recon subtotal in cost summary) must come from VehicleCostEntry categories (recon_parts, recon_labor), not from Vehicle.reconCostCents.
- **Architecture:** `docs/ARCHITECTURE_MAP.md`, `docs/MODULE_REGISTRY.md` — module and API patterns.

---

*End of Vehicle Cost Ledger V1 Spec. Implementation proceeds in Step 2 (Backend), Step 3 (Frontend), then Steps 4–6 (Security, Performance, QA).*
