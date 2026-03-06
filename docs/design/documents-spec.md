# Documents Module — Full SPEC (Step 1/4)

**Module:** documents  
**Scope:** Deal jackets and document storage; upload, organize, list, and secure download of documents tied to Deal (primary), Customer (optional), Vehicle (optional). Uses existing core-platform FileObject + signed URL pattern (Supabase Storage) and RBAC/audit conventions. No implementation code in this step.

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards, core-platform-spec.md.

**Out of scope (v1):** OCR, full document template engine (except optional Buyer’s Order PDF stub), e-signature, lender submission portals.

**Module boundary:** Documents module owns the `/api/documents/*` routes and document-specific validation, categories (docType), and list/upload/delete/signed-url flows. It reuses core-platform FileObject (and optionally core file storage helpers), RBAC (`documents.read` / `documents.write`), and AuditLog. Storage buckets and path rules are defined here; actual Supabase Storage calls may live in core-platform or documents module per implementation. Inventory continues to use FileObject + bucket `inventory-photos` without document fields.

---

## 1) Data Model (Prisma-Ready + Indexes)

### 1.1 Approach: Reuse FileObject (Recommended — Option A)

**Recommendation: Option A — extend FileObject with document-specific fields.**

**Rationale:**
- Inventory already uses FileObject with `entityType` / `entityId` and bucket `inventory-photos`; documents use the same “file metadata + entity link” pattern with bucket `deal-documents`.
- Single source of truth for file metadata; no extra join; list-by-entity already supported in core-platform db (`listFileObjectsByEntity` with bucket filter).
- Document-only fields (`docType`, `title`, `tags`) are nullable so existing inventory rows and generic uploads are unchanged.
- Keeps one storage abstraction and one audit surface (FileObject); documents module owns the **documents** API and document-specific validation/organization.

**Option B (alternative):** A separate `Document` table with `fileObjectId` would keep FileObject generic and allow document-specific lifecycle (e.g. versioning, supersededBy) without touching FileObject. Trade-off: two tables, joins, and duplicate tenant/entity scoping in two places. Defer unless versioning/supersession requires a first-class Document entity with its own IDs in v1.

---

### 1.2 Additions to FileObject (Option A)

Add the following columns to **FileObject** (documents use bucket `deal-documents`; inventory continues to use `inventory-photos` with these fields null):

| Column       | Type        | Required | Notes |
|-------------|-------------|----------|--------|
| `docType`   | Enum (see below) | No (nullable) | Document category; null for non-document files (e.g. inventory photos). |
| `title`     | String?     | No       | Display label; max length 255. No PII (no SSN/DL in title). |
| `tags`      | String[]    | No       | Optional tags for filtering; Prisma `String[]` or `Json`; empty array if null. |

**Document category enum — `DocumentType` (or `DocType`):**

- `BUYERS_ORDER`
- `CONTRACT`
- `TITLE`
- `ODOMETER`
- `STIP_INCOME`
- `STIP_RESIDENCE`
- `STIP_INSURANCE`
- `PAYOFF`
- `OTHER`

**Indexes to add:**

- `@@index([dealershipId, entityType, entityId, createdAt])` — list documents by entity (if not already covered by existing composite).
- `@@index([dealershipId, docType])` — filter list by document category.

Existing indexes on FileObject: `(dealershipId)`, `(dealershipId, createdAt)`, `(dealershipId, bucket, entityType, entityId)`. Ensure list-by-entity for documents uses `dealershipId + bucket + entityType + entityId`; add `(dealershipId, docType)` for docType filter.

**Audit:** FileObject is used for document metadata; critical actions are create (upload), update (metadata), delete (soft), and sensitive read (signed URL). Audit as in §3 and §5.

---

### 1.3 Optional: Separate Document Table (Option B — for reference only)

If Option B is chosen later:

- **Document:** `id`, `dealershipId`, `fileObjectId` (FK → FileObject), `entityType` (enum), `entityId` (UUID), `docType` (enum), `title`, `tags` (String[]), `createdAt`, `updatedAt`, `deletedAt`, `deletedBy`.
- Indexes: `(dealershipId, entityType, entityId, createdAt)`, `(dealershipId, docType)`.
- FileObject remains generic; Document references it. List returns join Document + FileObject.

This spec assumes **Option A** for v1.

---

## 2) Storage Strategy

- **Buckets:**
  - **deal-documents** — PDFs and stips for deals/customers/vehicles. Used by documents module.
  - **inventory-photos** — existing; do **not** mix with deal documents.

- **Path convention (deal-documents):**  
  `{dealershipId}/{entityType}/{entityId}/{uuid}-{sanitized-filename}`  
  - `entityType`: e.g. `DEAL` | `CUSTOMER` | `VEHICLE` (string value).
  - `entityId`: UUID of the deal, customer, or vehicle.
  - Filename: sanitize to avoid path traversal and special chars; prefix with UUID for uniqueness.

- **Allowed MIME types:**
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`

- **Max size:**
  - PDF: 25 MB.
  - Images (jpeg, png, webp): 10 MB.

- **Validation:** At upload: allowlist mime, enforce max size by type, sanitize filename. No PII in path or metadata (no SSN/DL in title or tags).

---

## 3) API Contracts (No Code)

Base URL for documents: `/api/documents`. All routes require authentication. `dealershipId` is always from auth context (active dealership); never from client body or query for scoping.

**Standard error shape:** `{ error: { code, message, details? } }`. Codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`.

**Pagination:** List endpoint uses `limit` (default 25, max 100) and `offset` (0-based). Response: `{ data: DocumentItem[], meta: { total, limit, offset } }`.

**Cross-tenant:** Any request with a `documentId` that does not belong to the active dealership must return `NOT_FOUND` (no 403 leak).

---

### 3.1 Route Summary

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/documents | List documents by entity (paginated, optional docType filter) | documents.read | No |
| POST | /api/documents/upload | Upload file; create metadata (FileObject) with entity + docType | documents.write | Yes (document.uploaded / file.uploaded) |
| GET | /api/documents/signed-url | Issue short-TTL signed URL for download | documents.read | Yes (document.accessed / file.accessed, sensitive read) |
| DELETE | /api/documents/[documentId] | Soft delete document metadata | documents.write | Yes (document.deleted / file.deleted) |
| PATCH | /api/documents/[documentId] | Update title, docType, tags (no file replacement) | documents.write | Yes (document.updated) |

---

### 3.2 GET /api/documents — List

- **Query (Zod shape):**
  - `entityType` — `z.enum(["DEAL","CUSTOMER","VEHICLE"])`, required.
  - `entityId` — `z.string().uuid()`, required.
  - `docType` — optional, `z.nativeEnum(DocumentType)` or string enum.
  - `limit` — number, default 25, max 100.
  - `offset` — number, min 0.
- **Response:** `{ data: DocumentItem[], meta: { total, limit, offset } }`.
- **DocumentItem shape:** `id`, `bucket`, `path`, `filename`, `mimeType`, `sizeBytes`, `entityType`, `entityId`, `docType`, `title`, `tags`, `uploadedBy` (id), `createdAt`. Omit `path` in list if sensitive; include only for signed URL flow. (Prefer minimal: id, filename, mimeType, sizeBytes, docType, title, tags, uploadedBy, createdAt.)
- **Permission:** `documents.read`.
- **Tenant:** Only files where `dealershipId` = active dealership, `bucket` = `deal-documents`, `entityType`/`entityId` match query, `deletedAt` null.
- **Audit:** No (listing is not a sensitive read; signed URL is).

---

### 3.3 POST /api/documents/upload — Upload

- **Body:** multipart/form-data:
  - `file` — required (file).
  - `entityType` — required, `DEAL` | `CUSTOMER` | `VEHICLE`.
  - `entityId` — required, UUID.
  - `docType` — required, one of DocumentType enum.
  - `title` — optional string, max 255; sanitized, no PII.
- **Validation:** Mime allowlist (pdf, jpeg, png, webp); max size (PDF 25MB, images 10MB); sanitize filename; validate entityId exists in DB for given entityType and dealership (optional but recommended).
- **Behavior:** Upload blob to bucket `deal-documents`, path `{dealershipId}/{entityType}/{entityId}/{uuid}-{safeFilename}`; create FileObject with `dealershipId`, `bucket`, `path`, `filename`, `mimeType`, `sizeBytes`, `entityType`, `entityId`, `docType`, `title`, `tags` (optional/empty), `uploadedBy` from auth.
- **Response:** 201, `DocumentItem` (same shape as list item).
- **Permission:** `documents.write`.
- **Tenant:** `dealershipId` from auth only.
- **Audit:** Yes — action `document.uploaded` (or `file.uploaded`), entity `FileObject`, entityId = file id, metadata (bucket, entityType, entityId, docType; no PII).

---

### 3.4 GET /api/documents/signed-url — Signed URL

- **Query (Zod shape):**
  - `documentId` — `z.string().uuid()`, required.
- **Response:** `{ url: string, expiresAt: string }` (ISO date).
- **Behavior:** Resolve document (FileObject) by id; verify `dealershipId` = active dealership and `deletedAt` null; create signed URL (short TTL, e.g. 60–300 seconds); write audit row.
- **Permission:** `documents.read`.
- **Tenant:** Document must belong to active dealership; otherwise NOT_FOUND.
- **Audit:** Yes — sensitive read; action `document.accessed` (or `file.accessed`), entity `FileObject`, entityId = file id, metadata (e.g. bucket; no PII).

---

### 3.5 DELETE /api/documents/[documentId] — Soft Delete

- **Params (Zod):** `documentId` — `z.string().uuid()`.
- **Response:** 204 No Content.
- **Behavior:** Load FileObject by id; verify tenant and `deletedAt` null; set `deletedAt` = now, `deletedBy` = current user. Blob retention: v1 retain blob after soft delete (optional background job to purge later); do not remove from storage on soft delete unless product decision is to purge immediately.
- **Permission:** `documents.write`.
- **Tenant:** Document must belong to active dealership; else NOT_FOUND.
- **Audit:** Yes — action `document.deleted` (or `file.deleted`), entity `FileObject`, entityId = file id.

---

### 3.6 PATCH /api/documents/[documentId] — Update Metadata (Optional)

- **Params (Zod):** `documentId` — `z.string().uuid()`.
- **Body (Zod):** `{ title?: string (max 255), docType?: DocumentType, tags?: string[] }` — all optional; no file replacement.
- **Response:** Updated DocumentItem.
- **Permission:** `documents.write`.
- **Tenant:** Document must belong to active dealership; else NOT_FOUND.
- **Audit:** Yes — action `document.updated`, entity `FileObject`, entityId, metadata (updated fields only; no PII).

---

### 3.7 Zod Schema Names (Summary)

- **listQuerySchema:** `entityType`, `entityId`, `docType?`, `limit`, `offset`.
- **documentIdParamSchema:** `documentId` (UUID).
- **uploadBodySchema:** multipart `file`, `entityType`, `entityId`, `docType`, `title?`.
- **signedUrlQuerySchema:** `documentId` (UUID).
- **patchBodySchema:** `title?`, `docType?`, `tags?`.

---

## 4) RBAC Matrix + Tenant Scoping

### 4.1 Permissions

| Resource/Action     | documents.read | documents.write |
|--------------------|----------------|-----------------|
| List by entity     | Yes            | Yes             |
| Get signed URL     | Yes            | Yes             |
| Upload             | No             | Yes             |
| Update metadata    | No             | Yes             |
| Delete             | No             | Yes             |

- **Least privilege:** No admin bypass; both read and write are explicit. Default roles (Owner, Admin, Sales, Finance) get both `documents.read` and `documents.write` as in core-platform-spec §2.2.

### 4.2 Tenant Scoping Rules

- Every list/get/update/delete is scoped by `dealershipId` from auth (active dealership). Never use client-supplied `dealershipId`.
- Cross-tenant: request with `documentId` belonging to another dealership → return **NOT_FOUND** (no 403 to avoid leaking existence).
- Entity validation (optional): when uploading, ensure `entityId` exists for the given `entityType` and belongs to the same dealership (e.g. Deal, Customer, or Vehicle).

### 4.3 Sensitive Read

- Issuing a signed URL is a **sensitive read** and must create an audit row (e.g. `document.accessed` or `file.accessed`).

---

## 5) Events

Use project event pattern (e.g. `/lib/events.ts`: `emit(name, payload)`). Documents module **emits** from service layer:

| Event              | When                     | Payload (brief) |
|--------------------|--------------------------|------------------|
| document.uploaded  | After file stored + FileObject created | `dealershipId`, `documentId` (file id), `entityType`, `entityId`, `actorId` |
| document.deleted   | After soft delete        | `dealershipId`, `documentId`, `entityType`, `entityId`, `actorId` |
| document.accessed  | When signed URL issued   | `dealershipId`, `documentId`, `entityType`, `entityId`, `actorId` (optional; audit covers this) |

**Consumed:** None in v1. Other modules may subscribe later (e.g. deal status when stipulations uploaded).

---

## 6) UI Screen Map (For Later Steps)

- **Deal detail page — “Documents” tab:**
  - List documents by entity (deal id) with filters: docType, optional search by title.
  - Columns/summary: docType, title, filename, size, uploadedBy, createdAt.
  - Actions: Upload (modal: file picker, entityType=DEAL, entityId=dealId, docType, title); Download (call signed-url, open URL); Delete (confirmation).
  - States: loading, empty, error; pagination (limit/offset).
- **Optional (later):** Customer detail — “Documents” panel (entityType=CUSTOMER, entityId=customerId). Vehicle detail — “Documents” panel (entityType=VEHICLE, entityId=vehicleId). Same patterns: list, upload, download, delete.

---

## 7) Versioning (v1 Optional)

- v1 versioning can be “upload new document row” with same logical type (e.g. same docType for same entity); mark previous as superseded by adding optional `supersededBy` (FileObject id) on FileObject or a separate Document table in a later iteration.
- For Option A (FileObject only), v1 can omit supersededBy; “versioning” = multiple rows with same entityType/entityId/docType, ordered by createdAt; UI shows “latest” or all. Full supersession tracking deferred.

---

## 8) Backend Checklist

- [ ] Prisma: Add to FileObject (Option A): `docType` (enum, nullable), `title` (string?, max 255), `tags` (String[] or Json, optional). Add enum DocumentType. Add index `(dealershipId, docType)`; ensure `(dealershipId, entityType, entityId, createdAt)` or equivalent for list.
- [ ] Migrations created and apply cleanly.
- [ ] DB layer under `modules/documents/db`: list by entity (paginated, filter docType), get by id (tenant-scoped), create (FileObject with doc fields), update (title, docType, tags), soft delete. Use existing core-platform file storage helpers or Supabase client for upload/signed URL.
- [ ] Service layer under `modules/documents/service`: upload (validate mime/size, path convention, create FileObject, audit), list (paginated), getSignedUrl (tenant check, audit), delete (soft, audit), updateMetadata (audit). Emit events: document.uploaded, document.deleted, document.accessed.
- [ ] Routes under `app/api/documents/**`: GET list, POST upload, GET signed-url, DELETE [documentId], PATCH [documentId]. Thin handlers: Zod parse → service → respond. All scoped by active dealership from auth.
- [ ] Zod: list query, documentId param, upload body (multipart), signed-url query, PATCH body. Standard error shape; pagination (limit max 100).
- [ ] RBAC: documents.read on list + signed-url; documents.write on upload, delete, PATCH.
- [ ] Audit: document.uploaded on upload; document.accessed on signed URL; document.deleted on delete; document.updated on PATCH. No PII in metadata.
- [ ] Storage: bucket `deal-documents` only for document routes; path `{dealershipId}/{entityType}/{entityId}/{uuid}-{sanitizedFilename}`; mime allowlist (pdf, jpeg, png, webp); max size PDF 25MB, images 10MB; rate limit upload endpoint.
- [ ] Tenant isolation tests: cross-tenant documentId returns NOT_FOUND for list/signed-url/delete/PATCH.
- [ ] RBAC tests: insufficient permission returns FORBIDDEN for list, upload, signed-url, delete, PATCH.
- [ ] Upload validation tests: reject disallowed mime, oversize file, invalid entityId/entityType.
- [ ] Audit tests: upload creates audit row; signed-url creates audit row; delete creates audit row.
- [ ] Module doc: `docs/modules/documents.md` with purpose, scope, routes, permissions, data model summary, manual test steps.

---

## 9) Frontend Checklist

- [ ] Deal detail “Documents” tab: list (GET /api/documents?entityType=DEAL&entityId=…), pagination, filter by docType; loading, empty, error states.
- [ ] Upload: modal with file input, entityType (fixed DEAL), entityId (deal id), docType select, title optional; validate file type/size on client; POST /api/documents/upload; refresh list on success.
- [ ] Download: GET /api/documents/signed-url?documentId=… then open URL in new tab or trigger download; handle expiry message.
- [ ] Delete: confirm dialog; DELETE /api/documents/[documentId]; refresh list.
- [ ] Optional PATCH: edit title/docType/tags in modal or inline; PATCH /api/documents/[documentId].
- [ ] Permissions: show upload/delete/PATCH only when user has documents.write; list and download when documents.read.
- [ ] Accessibility: labels, keyboard nav, focus states; consistent with shadcn/ui and Notion-like design.
- [ ] Manual smoke: upload PDF and image, list, download via signed URL, delete; verify 403 for missing permission; verify cross-tenant documentId returns not-found (if testable with two tenants).
