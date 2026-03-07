# Finance & Accounting Core — Sprint Spec

**Sprint name:** Finance & Accounting Core  
**Workflow:** SPEC → BACKEND → FRONTEND → SECURITY & QA (no code in SPEC step).

---

## 1. REPO INSPECTION SUMMARY

### Relevant existing modules / routes / models

| Area | Finding |
|------|--------|
| **lender-integration** | `FinanceApplication`, `FinanceApplicant`, `FinanceSubmission`, `FinanceStipulation`, `Lender`. Deal-linked; applicants in separate table; no SSN. Services: application, submission, stipulation, lender; serializers; events on deal.status_changed. |
| **finance-shell** | `DealFinance`, `DealFinanceProduct`. CONTRACTED lock; calculations (amount financed, payment, totals). Used for deal profit / backend gross. |
| **documents** | Deal documents via `FileObject` (bucket `deal-documents`, entityType/entityId, docType, title, tags). `documents` service: upload, list by entity, signed URL, soft delete. Audit on upload/delete. |
| **core-platform file** | `uploadFile`, `getSignedUrl`, create FileObject; allowed buckets/mime/size; path `dealershipId/bucket/...`; audit `file.uploaded`; `file.accessed` on signed URL. |
| **deals** | `Deal`, `DealFee`, `DealTrade`, `DealHistory`; deal status DRAFT→STRUCTURED→APPROVED→CONTRACTED→CANCELED; salePriceCents, frontGrossCents, taxCents, etc. |
| **reports** | Sales summary, finance penetration, inventory aging, mix, pipeline, sales-by-user; CSV export (sales, inventory); Zod-validated date range; `reports.read` / `reports.export`. |
| **Auth/RBAC** | `getAuthContext`, `guardPermission`, `requireDealershipContext`. Permissions: `deals.read/write`, `finance.read/write`, `lenders.read/write`, `finance.submissions.read/write`, `documents.read/write`, `reports.read`, `reports.export`. |
| **Audit** | `auditLog(dealershipId, actorUserId, action, entity, entityId, metadata)`. PII keys (ssn, dob, email, phone, etc.) sanitized to `[REDACTED]`. |
| **Money** | `lib/money.ts`: formatCents, parseDollarsToCents, centsToDollarInput, percentToBps, bpsToPercent. API: string cents; DB: BigInt cents. |
| **Encryption** | `lib/cookie.ts`: AES-256-GCM (encryptCookieValue/decryptCookieValue, support session). No existing SSN encryption; add minimal field encryption using same pattern (dedicated key env). |
| **Pagination** | `lib/api/pagination.ts`: parsePagination, limit default 25 max 100. |

### Exact files likely to change

- **Prisma:** `apps/dealer/prisma/schema.prisma` (new models + Deal relation); new migration.
- **New modules:** `modules/credit-app/` (credit application + lender submission + stipulations as specified), `modules/accounting/` (ledger, accounts, transactions, entries), `modules/expenses/`, `modules/compliance/` (forms + alerts), `modules/tax/` (TaxProfile). Alternatively fold into existing: credit/lender/stip in `lender-integration` with new models; documents vault in `documents`; accounting/expenses/tax/compliance new or under `reports` where appropriate.
- **Reuse:** `documents` — extend for Deal Document Vault (DealDocument with category, fileObjectId; reuse FileObject + upload/signed URL). `reports` — extend export + new report services (profit, inventory ROI, salesperson, marketing ROI).
- **API routes:** New under `api/credit-applications/`, `api/lender-applications/`, `api/compliance/`, `api/accounting/`, `api/expenses/`, `api/tax/`, `api/reports/` (new endpoints). Documents: extend or add `api/deals/[id]/documents/` for vault.
- **UI:** Deal detail (tabs for credit, lender submissions, documents, compliance); Reports page (new report sections or sub-routes); new pages for accounting, expenses, tax config if needed; compliance alerts in dashboard/deal context.

### Reuse decisions

1. **Credit Application / Lender Submission / Stipulations:** Add new models `CreditApplication`, `LenderApplication`, `LenderStipulation` as specified. Keep existing `FinanceApplication` / `FinanceSubmission` / `FinanceStipulation` for now (no destructive migration); new flows use new models; optional later migration to unify.
2. **SSN:** Encrypt at rest via new `lib/field-encryption.ts` (AES-256-GCM, env `SSN_ENCRYPTION_KEY` or `FIELD_ENCRYPTION_KEY`). Responses expose only masked SSN (e.g. last 4). Audit/logs never get raw SSN.
3. **Deal Document Vault:** Add `DealDocument` model (dealId, creditApplicationId?, lenderApplicationId?, category, fileObjectId, title, mimeType, sizeBytes, uploadedByUserId). Reuse `FileObject` + documents upload/signed URL flow; bucket `deal-documents`; tenant path already in place.
4. **Compliance forms:** Add `ComplianceFormInstance`; server-side payload from deal/customer/vehicle; no e-sign this sprint; UI preview cards + completion tracking.
5. **Compliance alerts:** New service + optional alert dismissal table or reuse pattern from `InventoryAlertDismissal` (deal/compliance scope).
6. **Accounting:** New module: `AccountingAccount`, `AccountingTransaction`, `AccountingEntry`; service validates debits = credits; seed minimal chart of accounts.
7. **Expenses:** New `DealershipExpense`; link to accounting later (posting hook stub).
8. **Tax:** New `TaxProfile`; associate to deal; sales tax in service layer (rate + doc/warranty taxability flags).
9. **Reports / Exports:** Extend reports service + export CSV (transactions, expenses, deal profit, date range); new report views (profit per deal/salesperson, inventory ROI, salesperson performance, marketing ROI foundation).
10. **RBAC:** Use existing `finance.read`/`finance.write` and `finance.submissions.read`/`finance.submissions.write` for credit/lender flows; `documents.read`/`documents.write` for vault; `reports.read`/`reports.export` for reports; add `accounting.read`/`accounting.write` only if seed/role pattern supports it cleanly.

---

## 2. Architecture

- **Layers:** Route → service → db → Prisma. No route → Prisma; no UI → db. Cross-module via service or events.
- **Tenancy:** All new tables: `dealershipId` (UUID, non-null) + `createdAt`/`updatedAt`. Every query/mutation scoped by `ctx.dealershipId` (session).
- **Events:** Emit domain events (e.g. credit_application.submitted, lender_application.decisioned) with dealershipId; optional listeners for cache invalidation or workflows.

---

## 3. Schema plan

### New / extended models

- **CreditApplication** — As specified (id, dealershipId, dealId?, customerId, status, applicant fields, ssnEncrypted, money cents, housingPaymentCents, monthlyIncomeCents, otherIncomeCents, notes, submittedAt, decisionedAt, createdByUserId, updatedByUserId, createdAt, updatedAt). Indexes: dealershipId, dealId, customerId, status, createdAt.
- **LenderApplication** — As specified (id, dealershipId, creditApplicationId, dealId, lenderName, status, externalApplicationRef, aprBps, maxAmountCents, maxAdvanceBps, termMonths, downPaymentRequiredCents, decisionSummary, rawDecisionJson, submittedAt, decisionedAt, createdByUserId, updatedByUserId, createdAt, updatedAt). Indexes: dealershipId, creditApplicationId, dealId, status, createdAt.
- **LenderStipulation** — As specified (id, dealershipId, lenderApplicationId, type, title, notes, status, requiredAt, receivedAt, reviewedAt, createdByUserId, reviewedByUserId, createdAt, updatedAt). Indexes: dealershipId, lenderApplicationId, status.
- **DealDocument** — id, dealershipId, dealId, creditApplicationId?, lenderApplicationId?, category (enum), title, fileObjectId (FK FileObject), mimeType, sizeBytes, uploadedByUserId, createdAt, updatedAt. Indexes: dealershipId, dealId, category.
- **ComplianceFormInstance** — id, dealershipId, dealId, formType (enum), status, generatedPayloadJson, generatedAt, completedAt, createdByUserId, updatedByUserId, createdAt, updatedAt. Indexes: dealershipId, dealId, formType, status.
- **ComplianceAlert** (optional) — If we add dismiss/snooze: id, dealershipId, alertType, entityType, entityId, dismissedAt, snoozedUntil, userId. Else alerts are computed on read.
- **AccountingAccount** — id, dealershipId, code, name, type (enum), isActive, createdAt, updatedAt. Unique(dealershipId, code).
- **AccountingTransaction** — id, dealershipId, referenceType, referenceId, memo, postedAt, createdByUserId, createdAt, updatedAt. Indexes: dealershipId, postedAt, referenceType.
- **AccountingEntry** — id, dealershipId, transactionId, accountId, direction (DEBIT/CREDIT), amountCents, memo, createdAt. Indexes: dealershipId, transactionId, accountId.
- **DealershipExpense** — id, dealershipId, vehicleId?, dealId?, category, vendor, description, amountCents, incurredOn, status (OPEN/POSTED/VOID), createdByUserId, createdAt, updatedAt. Indexes: dealershipId, status, incurredOn, vehicleId, dealId.
- **TaxProfile** — id, dealershipId, name, state, county, city, taxRateBps, docFeeTaxable, warrantyTaxable, createdAt, updatedAt. Indexes: dealershipId.

### Enums (add to schema)

- CreditApplicationStatus, LenderApplicationStatus, LenderStipulationType, LenderStipulationStatus; DealDocumentCategory; ComplianceFormType, ComplianceFormInstanceStatus; AccountingAccountType; AccountingEntryDirection; DealershipExpenseStatus; etc.

---

## 4. API plan

- **Credit applications:** GET list (dealId or customerId filter), GET by id, POST create, PATCH update, POST submit, (internal) PATCH status/decision. All tenant-scoped; RBAC finance.read/finance.write or finance.submissions.*. Responses never include raw SSN; masked only.
- **Lender applications:** GET list by creditApplicationId or dealId, GET by id, POST create, PATCH update (status, decision fields). Audit on submit/decision.
- **Lender stipulations:** GET list by lenderApplicationId, POST create, PATCH update (status, receivedAt, reviewedAt). Outstanding count endpoint or in lender-application payload.
- **Deal document vault:** GET list (dealId, filters), POST upload (reuse documents flow; create DealDocument + FileObject), GET download (signed URL), DELETE (soft delete + audit). RBAC documents.read/write.
- **Compliance forms:** GET list by dealId, POST generate (payload), PATCH status (e.g. COMPLETED). No e-sign.
- **Compliance alerts:** GET list (dealershipId, optional dealId); query-efficient; optionally PATCH dismiss/snooze if pattern exists.
- **Accounting:** GET accounts list, GET transaction list (paginated, date range), POST transaction (with entries; service validates balance). GET deal profit summary (service-driven).
- **Expenses:** GET list (filters, paginated), POST create, PATCH update (status, etc.). Audit create/update.
- **Tax profiles:** GET list, POST create, PATCH update. Associate tax profile to deal (deal.taxProfileId or request body when calculating).
- **Reports / export:** GET reports/profit, reports/inventory-roi, reports/salesperson-performance, reports/marketing-roi (foundation); POST or GET export CSV (transactions, expenses, deal profit) with date range Zod validation.

All routes: getAuthContext → guardPermission → validate (Zod) → service → jsonResponse. force-dynamic where appropriate. Error shape: { error: { code, message, details } }.

---

## 5. UI plan

- **Deal context:** Tabs or sections: Credit application (form + status), Lender submissions (list + manual status/decision), Stipulations (outstanding count + list), Document vault (list/upload/delete), Compliance forms (list + preview + complete). Fit into existing deal detail layout.
- **Reports:** Add sections or sub-routes for Dealer Profit Report, Inventory ROI Report, Salesperson Performance Report, Marketing ROI (foundation). Reuse DateRangePicker, ExportButtons, table/card patterns from ReportsPage.
- **Accounting:** List accounts; list transactions (with date filter); optional simple “Add transaction” flow. Deal profit summary card/section on deal or reports.
- **Expenses:** List page with filters (category, date, vehicle, deal); create/edit form; empty/loading/error states.
- **Tax:** Settings or config page for tax profiles; associate to deal in deal flow.
- **Compliance alerts:** Dashboard widget or deal-level banner; list view for alerts (missing forms, pending decisions, missing stips, unfunded contracted, etc.).
- **Navigation:** Finance/deal features in Deal Desk and deal detail; Reports under existing Reports; Accounting/Expenses under a new “Accounting” or “Finance” nav item if needed, or under Reports/Admin depending on IA.

---

## 6. RBAC matrix

| Resource | Read | Write / Mutate |
|----------|------|-----------------|
| Credit applications | finance.read or finance.submissions.read | finance.write or finance.submissions.write |
| Lender applications / stipulations | finance.submissions.read | finance.submissions.write |
| Deal document vault | documents.read | documents.write |
| Compliance forms / alerts | finance.read or deals.read | finance.write or deals.write |
| Accounting (accounts, transactions, entries) | accounting.read (if added) or reports.read | accounting.write (if added) |
| Expenses | accounting.read or reports.read | accounting.write or same as expenses |
| Tax profiles | deals.read or settings | deals.write or admin |
| Reports / export | reports.read | reports.export for CSV |

Use guardPermission on every route; no bypass.

---

## 7. Audit events

- credit_application.created, credit_application.updated, credit_application.submitted, credit_application.decisioned, credit_application.status_changed.
- lender_application.created, lender_application.updated, lender_application.submitted, lender_application.decisioned.
- lender_stipulation.created, lender_stipulation.updated, lender_stipulation.received, lender_stipulation.waived.
- deal_document.uploaded, deal_document.deleted (file.accessed on signed URL already).
- compliance_form.generated, compliance_form.completed.
- accounting_transaction.created; dealership_expense.created, dealership_expense.updated.
- No SSN/DOB/income in metadata.

---

## 8. Risk notes

- **SSN:** Must never appear in logs or API responses; encrypt at rest; mask in UI (e.g. ***-**-1234). Key rotation strategy doc later.
- **Ledger balance:** Service must reject transaction if debits ≠ credits; tests must enforce.
- **Cross-tenant:** All lookups by id must verify dealershipId; 404 on wrong tenant.
- **Deal CONTRACTED:** Existing finance-shell lock; no conflicting edits to financial fields from new features.

---

## 9. Acceptance criteria (summary)

- Credit application CRUD + submit + decision; SSN encrypted and masked.
- Lender application CRUD + manual status/decision; multiple per credit app.
- Stipulation CRUD + outstanding count; compliance flags for old incomplete stips.
- Deal document vault: list, upload, delete, signed download; tenant-safe; audit.
- Compliance form instances: generate payload, track status; no e-sign.
- Compliance alerts: at least missing forms, no decision after threshold, missing stips, unfunded contracted; dealership-scoped.
- General ledger: accounts, transactions, entries; balance validation; seed chart.
- Deal profit: service-derived (front/back gross, fees, reserve, etc.); read API.
- Expenses: CRUD; filterable list; audit.
- Tax profiles: CRUD; associate to deal; sales tax in service.
- CSV export: transactions, expenses, deal profit; date range; permissions.
- Reports: profit per deal, profit per salesperson, inventory ROI, salesperson performance, marketing ROI foundation.
- All list queries paginated/filtered; indexes on common filters.
- Tests: tenant isolation, RBAC, validation, audit emission, SSN masking, ledger balance, report correctness.

---

*End of STEP 1 — SPEC. No code; implementation in STEP 2 (Backend) next.*

---

## STEP 2 — BACKEND (Verification Summary)

**Done:**
- Prisma: Added CreditApplication, LenderApplication, LenderStipulation, DealDocument, ComplianceFormInstance, AccountingAccount, AccountingTransaction, AccountingEntry, DealershipExpense, TaxProfile; enums; migration `20260307120000_finance_accounting_core`.
- `lib/field-encryption.ts`: encryptField, decryptField, maskSsn (SSN never in logs/API).
- `modules/finance-core`: db (credit-application, lender-application, lender-stipulation), service (credit-application with audit + submit, lender-application, lender-stipulation), schemas (Zod), serialize (masked SSN, cents as string).
- API: GET/POST `/api/credit-applications`, GET/PATCH `/api/credit-applications/[id]`, POST `/api/credit-applications/[id]/submit`; GET/POST `/api/lender-applications`, GET/PATCH `/api/lender-applications/[id]`, GET/POST `/api/lender-applications/[id]/stipulations`; PATCH/GET `/api/lender-stipulations/[id]`. RBAC: finance.submissions.read/write.

**Deferred (same sprint, follow-up):**
- Deal document vault (DealDocument + documents service extension), compliance forms/alerts, accounting service + balanced-entry validation, expenses, tax profiles, report/export extensions. Schema and migration are in place; services/APIs to be added in same pattern.

---

## STEP 3 — FRONTEND (Verification Summary)

- **DealCreditTab** (`modules/finance-core/ui/DealCreditTab.tsx`): Lists credit applications for deal (GET credit-applications?dealId=), fetches lender applications per credit app, shows status badges and stipulation count. Empty/loading/error states; permission-gated (finance.submissions.read).
- **Deal detail:** "Credit" tab added to DetailPage when user has finance.submissions.read; renders DealCreditTab.

---

## STEP 4 — SECURITY & QA (Verification Summary)

- **Tests added:**
  - `modules/finance-core/tests/serialize.test.ts`: SSN never in list/detail DTO; ssnMasked only (***-**-**** when present).
  - `lib/field-encryption.test.ts`: maskSsn behavior; encrypt/decrypt roundtrip; invalid cipher returns null.
  - `modules/finance-core/tests/audit.test.ts`: credit_application.created audit event (integration, skipped when no DB).
- **Tenant isolation / RBAC:** Enforced in service (requireTenantActiveForRead/Write, getDeal/getCustomer scoped by dealershipId) and in routes (getAuthContext, guardPermission finance.submissions.read/write). Cross-tenant id returns NOT_FOUND via getCreditApplication/getLenderApplication.
- **Audit:** credit_application.created, credit_application.updated, credit_application.submitted; lender_application.created/updated; lender_stipulation.created/updated. Metadata sanitized (no SSN in audit).

---

## 6. FINAL REPORT

**Completed**
- **Spec:** REPO INSPECTION SUMMARY + full STEP 1 SPEC (architecture, schema, API, UI, RBAC, audit, risks, acceptance criteria).
- **Backend:** Prisma schema + migration for CreditApplication, LenderApplication, LenderStipulation, DealDocument, ComplianceFormInstance, AccountingAccount, AccountingTransaction, AccountingEntry, DealershipExpense, TaxProfile. Field encryption (SSN). finance-core module: db, service, Zod schemas, serializers (masked SSN). API routes for credit-applications, lender-applications, lender-stipulations with RBAC.
- **Frontend:** DealCreditTab on deal detail (Credit tab when finance.submissions.read); lists credit apps and lender apps for the deal.
- **Security & QA:** Serialize tests (SSN masking); field-encryption tests (mask + encrypt/decrypt); audit test stub (integration, skip when no DB). Tenant isolation and RBAC enforced in service and routes.

**Deferred (intentional)**
- Deal document vault (DealDocument model exists; documents service/API extension not implemented).
- Compliance forms (ComplianceFormInstance model exists; generation/alerts not implemented).
- Accounting service (create transaction with balanced entries, seed chart of accounts).
- DealershipExpense and TaxProfile services/APIs.
- Report extensions (profit per deal/salesperson, inventory ROI, salesperson performance, marketing ROI) and CSV exports for accounting/expenses.

**Commands run**
- `npx prisma validate` (schema valid; DATABASE_URL required for full validate).
- `npm run test:dealer` (full suite; pre-existing failures in deals/immutability, inventory/dashboard, portal-split, crm integration).
- `npx jest modules/finance-core/tests/serialize.test.ts` — PASS.
- `npx jest lib/field-encryption.test.ts` — PASS.
- Dealer app build failed due to unrelated module: `app/api/inventory/acquisition/[id]/move-stage/route.ts` (Module not found: '../schemas').

**Failing tests (pre-existing, not introduced by this sprint)**
- deals/immutability-and-one-deal.test.ts (CONTRACTED→APPROVED expects DOMAIN_ERROR, received VALIDATION_ERROR).
- inventory/dashboard.test.ts (tenant isolation / aging bucket).
- portal-split/internal-api.test.ts (timeout / auth).
- crm-pipeline-automation/integration.test.ts (DealerJobRun deadLetter column / unique constraint).
- deals/audit.test.ts (actorUserId assertion).

**Remaining follow-ups**
- Implement DealDocument vault (reuse documents upload + create DealDocument row).
- Implement compliance form generation + compliance alerts (query layer).
- Implement accounting service (balance validation, seed chart, POST transaction).
- Implement DealershipExpense and TaxProfile CRUD + APIs.
- Add report services and CSV export for accounting/expenses/profit.
- Fix build: resolve `../schemas` in inventory acquisition move-stage route.
- Run migration on target DB: `npx prisma migrate deploy` (or `migrate dev` locally).

**Risk notes**
- SSN: Stored encrypted; API exposes only ssnMasked. Ensure SSN_ENCRYPTION_KEY (or FIELD_ENCRYPTION_KEY) is set in production and never logged.
- Ledger: When accounting service is implemented, enforce debits = credits in service before commit; add tests.
- Cross-tenant: All new APIs scope by ctx.dealershipId; cross-tenant id returns 404.
