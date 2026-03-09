# Finance Core — Slice 2: Document Vault + Compliance Workflow

**Sprint:** Finance Core — Slice 2  
**Flow:** SPEC → BACKEND → FRONTEND → SECURITY & QA

---

## 1. REPO INSPECTION SUMMARY

### Existing models (already in Prisma)

- **DealDocument:** id, dealershipId, dealId, creditApplicationId?, lenderApplicationId?, category (DealDocumentCategory: CONTRACT, ID, INSURANCE, STIPULATION, CREDIT, COMPLIANCE, OTHER), title, fileObjectId (FK FileObject), mimeType, sizeBytes, uploadedByUserId, createdAt, updatedAt. Indexes: dealershipId, dealId, category.
- **ComplianceFormInstance:** id, dealershipId, dealId, formType (PRIVACY_NOTICE, ODOMETER_DISCLOSURE, BUYERS_GUIDE, ARBITRATION, OTHER), status (NOT_STARTED, GENERATED, REVIEWED, COMPLETED), generatedPayloadJson, generatedAt, completedAt, createdByUserId, updatedByUserId, createdAt, updatedAt. Indexes: dealershipId, dealId, formType, status.

### Existing patterns to reuse

- **File storage:** `modules/documents/service/documents.ts` — upload to Supabase bucket `deal-documents`, path `dealershipId/entityType/entityId/uuid-filename`; `documentDb.createDocumentMetadata` creates FileObject (bucket, path, filename, mimeType, sizeBytes, uploadedBy, entityType, entityId, docType, title). `getSignedUrl`, `softDeleteDocument`. MIME allowlist PDF/JPEG/PNG/WebP; max 25MB PDF, 10MB image.
- **core-platform/db/file.ts:** `createFileObject`, `getFileObjectById`, `softDeleteFileObject`. FileObject has no docType/title in core file module; documents module uses extended create in documentDb.
- **Deal detail UI:** `DetailPage.tsx` — tabs Overview, Fees, Trade, Status, **Documents**, Finance, Lenders, Credit, Totals. Existing **DealDocumentsTab** uses `/api/documents` with entityType=DEAL, entityId=dealId (FileObject list). We will add vault APIs and either switch Documents tab to vault or add a separate vault tab; spec says "Documents" tab shows list/upload/download/delete → implement vault and have Documents tab consume it.
- **Alerts:** Inventory uses `InventoryAlertDismissal` + service `getDashboardV3InventoryAlerts`; compliance alerts will be **computed on read** (no new table this slice): service returns list of { type, dealId, message } for missing forms, missing stips, no decision after threshold, etc.
- **Auth/RBAC:** `getAuthContext`, `guardPermission`. Use **finance.submissions.read** / **finance.submissions.write** for vault and compliance (per user requirement).
- **Audit:** `auditLog(dealershipId, actorUserId, action, entity, entityId, metadata)`; no PII in metadata.

### Files to add/change

- **New:** `modules/finance-core/db/deal-document.ts`, `modules/finance-core/db/compliance-form.ts`, `modules/finance-core/service/documents.ts` (vault), `modules/finance-core/service/compliance.ts` (forms + alerts), `modules/finance-core/schemas-deal-documents.ts`, `modules/finance-core/schemas-compliance.ts`.
- **New routes:** `app/api/deal-documents/route.ts` (GET, POST), `app/api/deal-documents/[id]/route.ts` (GET, DELETE), `app/api/deal-documents/[id]/download/route.ts` (GET signed URL); `app/api/compliance-forms/route.ts` (GET), `app/api/compliance-forms/generate/route.ts` (POST), `app/api/compliance-forms/[id]/route.ts` (GET, PATCH); `app/api/compliance-alerts/route.ts` (GET).
- **UI:** New `DealDocumentVaultTab` (or refactor DealDocumentsTab to use vault API); new `DealComplianceTab`. Wire into DetailPage (Documents tab → vault; add Compliance tab).

### Reuse decisions

1. **Upload flow:** Upload to Supabase `deal-documents` bucket (same as documents module); create FileObject via core-platform or documents db (entityType "DEAL", entityId dealId for consistency); create DealDocument row linking fileObjectId, dealId, category, title, etc.
2. **Download:** Reuse signed-URL pattern from documents service (create signed URL from FileObject.path/bucket); audit file.accessed.
3. **Delete:** Soft-delete FileObject (documents.softDeleteDocument) and delete DealDocument row (or cascade); audit both.
4. **Compliance payload:** Build JSON from deal (customer, vehicle) via existing deal/customer/vehicle services or deal-desk data shape.
5. **Compliance alerts:** Service-only: query deals, credit applications, lender applications, stipulations, compliance form instances; return array of alerts. No dismiss table this slice.

---

## 2. STEP 1 — SPEC (no code)

### Architecture

- **Deal Document Vault:** List DealDocuments by dealId (and optional category); upload = write blob + FileObject + DealDocument; download = signed URL; delete = soft-delete FileObject + delete DealDocument. All scoped by dealershipId.
- **Compliance Forms:** List ComplianceFormInstances by dealId; generate = build payload from deal/customer/vehicle, upsert instance (NOT_STARTED → GENERATED); PATCH = update status (e.g. REVIEWED, COMPLETED). No e-sign; payload is server-generated JSON for future PDF/display.
- **Compliance Alerts:** Read-only service: for dealership (and optional dealId), compute: missing required compliance forms, lender app submitted no decision after N days, approved lender app with missing stips, contracted deal missing required docs. Return list; no persist.

### API plan

| Method | Path | Description | RBAC |
|--------|------|-------------|------|
| GET | /api/deal-documents | List by dealId, optional category, pagination | finance.submissions.read |
| POST | /api/deal-documents | Upload (multipart: file, dealId, category, title; optional creditApplicationId, lenderApplicationId) | finance.submissions.write |
| GET | /api/deal-documents/[id] | Get one (metadata) | finance.submissions.read |
| DELETE | /api/deal-documents/[id] | Delete document (soft-delete file + delete DealDocument) | finance.submissions.write |
| GET | /api/deal-documents/[id]/download | Signed URL for download | finance.submissions.read |
| GET | /api/compliance-forms | List by dealId | finance.submissions.read |
| POST | /api/compliance-forms/generate | Body: dealId, formType. Generate payload, create or update instance | finance.submissions.write |
| PATCH | /api/compliance-forms/[id] | Update status (and optional completedAt) | finance.submissions.write |
| GET | /api/compliance-alerts | Query dealId optional; return list of alerts | finance.submissions.read |

### UI plan

- **Documents tab (deal detail):** Show list of DealDocuments for the deal (category, title, size, uploaded, actions: download, delete). Upload button: modal with file picker, category select, title. Use existing tokens and table/card patterns.
- **Compliance tab (deal detail):** List compliance form instances (form type, status, generated at, completed at). "Generate" per form type if NOT_STARTED. PATCH to set REVIEWED/COMPLETED. Show compliance alerts for this deal (e.g. missing forms, missing stips).

### RBAC

- All vault and compliance routes: **finance.submissions.read** (read/list/download) and **finance.submissions.write** (upload, delete, generate, PATCH).

### Audit events

- deal_document.uploaded, deal_document.deleted, document.accessed (signed URL).
- compliance_form.generated, compliance_form.updated.

### Risk notes

- Cross-tenant: every query by dealershipId; cross-tenant id → NOT_FOUND.
- No PII in audit metadata; no raw file content in logs.

---

*End STEP 1. Proceed to STEP 2 Backend.*

---

## 6. FINAL REPORT — Slice 2 Complete

### Completed

1. **STEP 1 Spec** — `FINANCE_CORE_SLICE2_SPEC.md` (this doc): architecture, API plan, UI plan, RBAC, audit, risks.

2. **STEP 2 Backend**
   - **DB:** `modules/finance-core/db/deal-document.ts`, `compliance-form.ts` (create, getById, list, update, delete).
   - **Services:** `service/documents.ts` (vault: list, upload, get, delete, getDownloadUrl); `service/compliance.ts` (list forms, generate, update status, getComplianceAlerts).
   - **Schemas:** `schemas-deal-documents.ts`, `schemas-compliance.ts` (Zod).
   - **API routes:** GET/POST `/api/deal-documents`, GET/DELETE `/api/deal-documents/[id]`, GET `/api/deal-documents/[id]/download`; GET `/api/compliance-forms`, POST `/api/compliance-forms/generate`, GET/PATCH `/api/compliance-forms/[id]`; GET `/api/compliance-alerts`. All use `getAuthContext`, `guardPermission` (finance.submissions.read/write), tenant-scoped queries, NOT_FOUND for cross-tenant.

3. **STEP 3 Frontend**
   - **DealDocumentVaultTab** (`modules/finance-core/ui/DealDocumentVaultTab.tsx`): list by dealId, upload (multipart + category/title), download (signed URL), delete; categories CONTRACT, ID, INSURANCE, STIPULATION, CREDIT, COMPLIANCE, OTHER; permission gates.
   - **DealComplianceTab** (`modules/finance-core/ui/DealComplianceTab.tsx`): compliance alerts card, forms table (PRIVACY_NOTICE, ODOMETER_DISCLOSURE, BUYERS_GUIDE, ARBITRATION), generate modal, status Select (NOT_STARTED → GENERATED → REVIEWED → COMPLETED).
   - **Deal detail:** Documents tab shows **DealDocumentVaultTab** when user has `finance.submissions.read`, else existing **DealDocumentsTab**. New **Compliance** tab (same permission) with **DealComplianceTab**.

4. **STEP 4 Security & QA**
   - **Tests added:** `modules/finance-core/tests/deal-documents-tenant-isolation.test.ts` (list/get/delete cross-tenant → NOT_FOUND; getDealDocumentById wrong dealer → null). `modules/finance-core/tests/compliance-tenant-and-forms.test.ts` (list forms with B dealId → NOT_FOUND; getComplianceFormInstance cross-tenant → NOT_FOUND; getComplianceAlerts with B dealId → empty; generateComplianceForm payload/status; updateComplianceFormInstance status/completedAt; getComplianceAlerts returns array and filters by dealId).
   - Integration tests use `hasDb = SKIP_INTEGRATION_TESTS !== "1" && !!TEST_DATABASE_URL`; when DB is unavailable or connection pool is exhausted they fail with connection errors (environmental), not assertion failures.

### Commands

- Run dealer tests from repo root: `npm run test:dealer`
- Run only Slice 2 integration tests: `cd apps/dealer && npx jest modules/finance-core/tests/deal-documents-tenant-isolation.test.ts modules/finance-core/tests/compliance-tenant-and-forms.test.ts` (requires `TEST_DATABASE_URL`; may need to run in isolation to avoid connection exhaustion).

### Deferred / follow-ups

- RBAC API-level tests (mock auth, expect 403 without permission): not added; guardPermission is used on all routes.
- E-sign / PDF generation for compliance forms: out of scope this slice; payload is JSON only.
- Compliance alert dismissals: out of scope; alerts are computed on read.

### Risks

- Document vault and generic documents tab: users with only `documents.read` see the legacy DealDocumentsTab; users with `finance.submissions.read` see the vault on the same "Documents" tab. No conflict.
- Integration tests can hit "too many database connections" when run in parallel with the full suite; run with a fresh pool or skip with `SKIP_INTEGRATION_TESTS=1` if needed.
