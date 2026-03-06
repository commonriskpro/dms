# Documents Module

## Purpose and scope

- Deal jackets and document storage: upload, list, secure download (signed URL), and metadata (title, docType, tags) for documents tied to Deal (primary), Customer, or Vehicle.
- Uses **Option A**: extended FileObject with `docType`, `title`, `tags` (no separate Document table). Bucket **deal-documents** only; inventory continues using **inventory-photos**.
- Storage path: `{dealershipId}/{entityType}/{entityId}/{uuid}-{sanitizedFilename}`.
- Mime allowlist: `application/pdf` (max 25MB); `image/jpeg`, `image/png`, `image/webp` (max 10MB).
- Cross-tenant `documentId` → **NOT_FOUND** (never 403). Issuing a signed URL writes audit **document.accessed**.

## Routes

| Method | Path | Purpose | Permission | Audit |
|--------|------|---------|------------|--------|
| GET | /api/documents | List documents by entity (paginated, optional docType filter) | documents.read | No |
| POST | /api/documents/upload | Upload file; create metadata with entity + docType | documents.write | document.uploaded |
| GET | /api/documents/signed-url | Issue short-TTL signed URL for download | documents.read | document.accessed |
| DELETE | /api/documents/[documentId] | Soft delete document metadata | documents.write | document.deleted |
| PATCH | /api/documents/[documentId] | Update title, docType, tags | documents.write | document.updated |

## Permissions

- **documents.read** — List by entity, get signed URL.
- **documents.write** — Upload, delete, PATCH metadata.
- No admin bypass; both are explicit. `dealershipId` always from auth; never from client.

## Data model summary

- **FileObject** (extended): `docType` (DocumentType enum, nullable), `title` (VARCHAR 255, nullable), `tags` (String[], default []). Documents use bucket `deal-documents`; inventory uses `inventory-photos` with these fields null.
- **DocumentType enum:** BUYERS_ORDER, CONTRACT, TITLE, ODOMETER, STIP_INCOME, STIP_RESIDENCE, STIP_INSURANCE, PAYOFF, OTHER.
- Indexes: `(dealershipId, bucket, entityType, entityId)` for list; `(dealershipId, docType)` for filter.
- Soft delete: `deletedAt`, `deletedBy`; blob retained in v1 (no removal from storage on delete).

## Storage rules

- **Bucket:** `deal-documents` only for document routes.
- **Path:** `{dealershipId}/{entityType}/{entityId}/{uuid}-{sanitizedFilename}`.
- **Entity types:** DEAL | CUSTOMER | VEHICLE.
- **Validation:** Mime allowlist; max size by type; filename sanitized (no path traversal, no PII in title/tags).

## Security guarantees

- **Tenant isolation:** Every operation scoped by `dealershipId` from auth. Cross-tenant `documentId` returns **NOT_FOUND** (no 403 leak). List with another tenant’s `entityId` returns empty.
- **RBAC:** documents.read on list + signed-url; documents.write on upload, delete, PATCH. No admin bypass.
- **Signed-url audit:** Every successful signed-url call writes audit action `document.accessed`. Failed (NOT_FOUND/FORBIDDEN) does not write access audit.
- **Upload validation:** Mime allowlist (PDF, JPEG, PNG, WebP); max size (PDF 25MB, images 10MB); filename sanitized (no path traversal, no control chars); path always `dealershipId/entityType/entityId/`; bucket always `deal-documents`. Missing or invalid `docType`/`entityType`/`entityId` → VALIDATION_ERROR.
- **Soft delete:** Soft-deleted documents do not appear in list. Signed-url for deleted document returns NOT_FOUND. Delete already-deleted returns NOT_FOUND (idempotent).
- **Rate limiting:** Upload endpoint rate limited.

## Manual API checklist

1. **List:** `GET /api/documents?entityType=DEAL&entityId=<deal-uuid>&limit=25&offset=0` — expect `{ data: DocumentItem[], meta: { total, limit, offset } }`. Optional `docType=CONTRACT` to filter.
2. **Upload:** `POST /api/documents/upload` (multipart: `file`, `entityType`, `entityId`, `docType`, optional `title`). Allowed: PDF ≤25MB, JPEG/PNG/WebP ≤10MB. Expect 201 and DocumentItem. Disallowed mime or oversize → 400 VALIDATION_ERROR. Invalid entityId → 404 NOT_FOUND.
3. **Signed URL:** `GET /api/documents/signed-url?documentId=<id>` — expect `{ url, expiresAt }`. Verify audit row `document.accessed` for FileObject entityId. Cross-tenant documentId → 404 NOT_FOUND.
4. **Delete:** `DELETE /api/documents/<documentId>` — expect 204. Verify audit `document.deleted`. Cross-tenant → 404.
5. **PATCH:** `PATCH /api/documents/<documentId>` body `{ "title": "New title", "docType": "CONTRACT", "tags": ["tag1"] }` — expect 200 and updated DocumentItem. Verify audit `document.updated`.
6. **Tenant isolation:** As Dealer A, obtain a document id that belongs to Dealer B (e.g. from another session or test data). GET list with B’s entityId as A → empty list. GET signed-url, DELETE, PATCH with B’s documentId as A → 404 NOT_FOUND.
7. **RBAC:** User without documents.read → 403 on GET list and GET signed-url. User without documents.write → 403 on POST upload, DELETE, PATCH.
