# Lender-Integration Module — Full SPEC (Step 1/4)

**Module:** lender-integration  
**Scope:** Lender “submission + tracking” workflow attached to Deal and DealFinance. No real lender APIs in v1: stub only. Supports lender directory (tenant-scoped); finance application per deal (applicant/co-applicant summary, NO SSN/DOB in v1); submission package (deal + finance snapshot + docs); tracking submission attempts (manual); decisions (approved/conditional/declined); stipulations (requested/received/waived) with document linking; funding status; reserve tracking (internal); full auditability, tenant isolation, RBAC.

**Non-goals (v1):** No credit bureau, SSN/DOB/income storage, OFAC, e-contracting, lender-specific API adapters (stub only), bank/card data.

**Money & privacy:** Money BIGINT cents; rates BPS; no SSN/DOB/DL/full bank in DB; audit metadata IDs + changedFields only (no phone/email arrays, no full address dumps).

References: AGENT_SPEC.md, DONE.md, MODULES.md, DMS Non-Negotiables, Coding Standards, core-platform-spec.md, deals-spec.md, finance-shell-spec.md, documents-spec.md.

---

## 1) Prisma Schema + Indexes + Constraints

### 1.1 Table Summary

| Table | Tenant-scoped? | Soft delete? | Audit (CUD / critical) |
|-------|----------------|--------------|-------------------------|
| Lender | Yes | Soft disable (isActive) | Yes |
| FinanceApplication | Yes | No | Yes |
| FinanceApplicant | Yes | No | No (child; audit via application) |
| FinanceSubmission | Yes | No | Yes |
| FinanceStipulation | Yes | No | Yes |

**Money rule:** All monetary columns **BIGINT** (cents). APR/rates **Int** basis points (BPS). No Float/Decimal for money.

**Document linking (stips):** Stipulation links to FileObject via `documentId`. Only FileObjects with `entityType = DEAL` and `entityId = submission.dealId` (same deal, same tenant) are valid; cross-tenant or wrong deal returns **NOT_FOUND**.

---

### 1.2 Lender

- **Purpose:** Tenant-scoped lender directory. Name, type, optional contact, external system (stub), active flag. No secrets.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `name` — String, required
  - `lenderType` — Enum: `BANK` | `CREDIT_UNION` | `CAPTIVE` | `OTHER`
  - `contactEmail` — String?, optional
  - `contactPhone` — String?, optional
  - `externalSystem` — Enum: `NONE` | `ROUTEONE` | `DEALERTRACK` | `CUDL` | `OTHER`
  - `isActive` — Boolean, default true
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, FinanceSubmission[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, isActive])` — list active lenders
  - `@@unique([dealershipId, name])` — unique name per dealership
- **Audit:** Critical. Audit: lender.created, lender.updated, lender.deactivated (when isActive → false).

```prisma
enum LenderType {
  BANK
  CREDIT_UNION
  CAPTIVE
  OTHER
}

enum LenderExternalSystem {
  NONE
  ROUTEONE
  DEALERTRACK
  CUDL
  OTHER
}

model Lender {
  id             String               @id @default(uuid()) @db.Uuid
  dealershipId   String               @map("dealership_id") @db.Uuid
  name           String
  lenderType     LenderType           @map("lender_type")
  contactEmail   String?              @map("contact_email")
  contactPhone   String?              @map("contact_phone")
  externalSystem LenderExternalSystem @map("external_system")
  isActive       Boolean              @default(true) @map("is_active")
  createdAt      DateTime             @default(now()) @map("created_at")
  updatedAt      DateTime             @updatedAt @map("updated_at")

  dealership     Dealership           @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  submissions    FinanceSubmission[]

  @@index([dealershipId])
  @@index([dealershipId, isActive])
  @@unique([dealershipId, name])
}
```

---

### 1.3 FinanceApplication

- **Purpose:** One or more applications per deal; one may be “active/selected” for submission context. Ties applicant(s) to deal.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `dealId` — String, UUID, FK → Deal, required
  - `status` — Enum: `DRAFT` | `COMPLETED` (application form complete for submission)
  - `createdBy` — String?, UUID, FK → Profile (optional)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, Deal, Profile (createdBy), FinanceApplicant[], FinanceSubmission[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, dealId])` — list applications by deal
  - `@@index([dealershipId, createdAt])`
- **Audit:** Critical. Audit: finance_application.created, finance_application.updated.

```prisma
enum FinanceApplicationStatus {
  DRAFT
  COMPLETED
}

model FinanceApplication {
  id           String                  @id @default(uuid()) @db.Uuid
  dealershipId String                  @map("dealership_id") @db.Uuid
  dealId       String                  @map("deal_id") @db.Uuid
  status       FinanceApplicationStatus @default(DRAFT)
  createdBy    String?                 @map("created_by") @db.Uuid
  createdAt    DateTime                @default(now()) @map("created_at")
  updatedAt    DateTime                @updatedAt @map("updated_at")

  dealership   Dealership              @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  deal         Deal                    @relation(fields: [dealId], references: [id], onDelete: Cascade)
  createdByProfile Profile?            @relation("FinanceApplicationCreatedBy", fields: [createdBy], references: [id])
  applicants   FinanceApplicant[]
  submissions  FinanceSubmission[]

  @@index([dealershipId])
  @@index([dealershipId, dealId])
  @@index([dealershipId, createdAt])
}
```

---

### 1.4 FinanceApplicant

- **Purpose:** Applicant or co-applicant on a finance application. Summary only: fullName, email?, phone?, address fields; employment optional. NO income amount or range buckets; NO SSN/DOB/DL in v1.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `applicationId` — String, UUID, FK → FinanceApplication, required
  - `role` — Enum: `PRIMARY` | `CO` (co-applicant)
  - `fullName` — String, required
  - `email` — String?, optional
  - `phone` — String?, optional
  - `addressLine1` — String?, optional
  - `addressLine2` — String?, optional
  - `city` — String?, optional
  - `region` — String?, optional
  - `postalCode` — String?, optional
  - `country` — String?, optional
  - `employerName` — String?, optional (employment optional; no income)
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, FinanceApplication.
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, applicationId])`
- **Constraint:** At most one PRIMARY per applicationId; at most one CO per applicationId (enforce in service or unique partial index).
- **Audit:** Child; audit via finance_application.updated (applicant add/change).

```prisma
enum FinanceApplicantRole {
  PRIMARY
  CO
}

model FinanceApplicant {
  id            String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  applicationId String  @map("application_id") @db.Uuid
  role          FinanceApplicantRole
  fullName      String  @map("full_name")
  email         String?
  phone         String?
  addressLine1  String? @map("address_line1")
  addressLine2  String? @map("address_line2")
  city          String?
  region        String?
  postalCode    String? @map("postal_code")
  country       String?
  employerName  String? @map("employer_name")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  dealership    Dealership        @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  application   FinanceApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([dealershipId])
  @@index([dealershipId, applicationId])
}
```

---

### 1.5 FinanceSubmission

- **Purpose:** One submission per application to one lender. Snapshot of deal finance at submit time (stable). Tracks status workflow, decision, stipulations, funding, reserve.
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `applicationId` — String, UUID, FK → FinanceApplication, required
  - `dealId` — String, UUID, FK → Deal, required (denormalized for queries and snapshot context)
  - `lenderId` — String, UUID, FK → Lender, required
  - **Status workflow:** `status` — Enum: `DRAFT` | `READY_TO_SUBMIT` | `SUBMITTED` | `DECISIONED` | `FUNDED` | `CANCELED`
  - `submittedAt` — DateTime?, when status moved to SUBMITTED
  - `decisionedAt` — DateTime?, when decision recorded
  - `fundedAt` — DateTime?, when funding status set to FUNDED
  - **Snapshot (BigInt cents / Int BPS):** `amountFinancedCents`, `termMonths`, `aprBps`, `paymentCents`, `productsTotalCents`, `backendGrossCents` — copied from DealFinance at submission; immutable once set.
  - `reserveEstimateCents` — BigInt?, internal reserve estimate
  - **Decision:** `decisionStatus` — Enum: `APPROVED` | `CONDITIONAL` | `DECLINED` | `PENDING`
  - `approvedTermMonths` — Int?, `approvedAprBps` — Int?, `approvedPaymentCents` — BigInt?, `maxAdvanceCents` — BigInt?
  - `decisionNotes` — String?, short; no PII
  - **Funding:** `fundingStatus` — Enum: `PENDING` | `FUNDED` | `CANCELED`
  - `fundedAmountCents` — BigInt?, `reserveFinalCents` — BigInt?
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, FinanceApplication, Deal, Lender, FinanceStipulation[].
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, dealId])` — list submissions by deal
  - `@@index([dealershipId, lenderId])` — list by lender
  - `@@index([dealershipId, status])`
  - `@@index([dealershipId, createdAt])`
- **Audit:** Critical. Audit: submission.created; submission.status_changed; submission.decision_updated; submission.funding_updated. Sensitive read: submission detail (optional per policy).

```prisma
enum FinanceSubmissionStatus {
  DRAFT
  READY_TO_SUBMIT
  SUBMITTED
  DECISIONED
  FUNDED
  CANCELED
}

enum FinanceDecisionStatus {
  APPROVED
  CONDITIONAL
  DECLINED
  PENDING
}

enum FinanceFundingStatus {
  PENDING
  FUNDED
  CANCELED
}

model FinanceSubmission {
  id                   String                  @id @default(uuid()) @db.Uuid
  dealershipId         String                  @map("dealership_id") @db.Uuid
  applicationId        String                  @map("application_id") @db.Uuid
  dealId               String                  @map("deal_id") @db.Uuid
  lenderId             String                  @map("lender_id") @db.Uuid
  status               FinanceSubmissionStatus @default(DRAFT)
  submittedAt          DateTime?               @map("submitted_at")
  decisionedAt         DateTime?               @map("decisioned_at")
  fundedAt             DateTime?               @map("funded_at")
  amountFinancedCents  BigInt                  @map("amount_financed_cents")
  termMonths           Int                     @map("term_months")
  aprBps               Int                     @map("apr_bps")
  paymentCents         BigInt                  @map("payment_cents")
  productsTotalCents   BigInt                  @map("products_total_cents")
  backendGrossCents    BigInt                  @map("backend_gross_cents")
  reserveEstimateCents BigInt?                 @map("reserve_estimate_cents")
  decisionStatus       FinanceDecisionStatus?  @map("decision_status")
  approvedTermMonths   Int?                    @map("approved_term_months")
  approvedAprBps       Int?                    @map("approved_apr_bps")
  approvedPaymentCents BigInt?                 @map("approved_payment_cents")
  maxAdvanceCents      BigInt?                @map("max_advance_cents")
  decisionNotes        String?                 @map("decision_notes") @db.Text
  fundingStatus        FinanceFundingStatus    @default(PENDING) @map("funding_status")
  fundedAmountCents    BigInt?                 @map("funded_amount_cents")
  reserveFinalCents    BigInt?                 @map("reserve_final_cents")
  createdAt            DateTime                @default(now()) @map("created_at")
  updatedAt            DateTime                @updatedAt @map("updated_at")

  dealership   Dealership        @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  application  FinanceApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  deal         Deal              @relation(fields: [dealId], references: [id], onDelete: Cascade)
  lender       Lender            @relation(fields: [lenderId], references: [id], onDelete: Restrict)
  stipulations FinanceStipulation[]

  @@index([dealershipId])
  @@index([dealershipId, dealId])
  @@index([dealershipId, lenderId])
  @@index([dealershipId, status])
  @@index([dealershipId, createdAt])
}
```

---

### 1.6 FinanceStipulation

- **Purpose:** Stipulation per submission: type, status (requested/received/waived), optional link to FileObject (deal document).
- **Fields:**
  - `id` — String, UUID, PK
  - `dealershipId` — String, UUID, FK → Dealership, required
  - `submissionId` — String, UUID, FK → FinanceSubmission, required
  - `stipType` — Enum: `PAYSTUB` | `PROOF_RESIDENCE` | `INSURANCE` | `LICENSE` | `BANK_STATEMENT` | `OTHER`
  - `status` — Enum: `REQUESTED` | `RECEIVED` | `WAIVED`
  - `requestedAt` — DateTime?, optional
  - `receivedAt` — DateTime?, optional
  - `documentId` — String?, UUID, FK → FileObject (optional; must be DEAL + same dealId)
  - `notes` — String?, short; no PII
  - `createdAt` — DateTime
  - `updatedAt` — DateTime
- **Relations:** Dealership, FinanceSubmission, FileObject? (documentId).
- **Indexes:**
  - `@@index([dealershipId])`
  - `@@index([dealershipId, submissionId])`
  - `@@index([dealershipId, status])`
  - `@@index([dealershipId, stipType])`
- **Audit:** Critical. Audit: stip.created, stip.updated, stip.deleted, stip.document_linked.

```prisma
enum FinanceStipulationType {
  PAYSTUB
  PROOF_RESIDENCE
  INSURANCE
  LICENSE
  BANK_STATEMENT
  OTHER
}

enum FinanceStipulationStatus {
  REQUESTED
  RECEIVED
  WAIVED
}

model FinanceStipulation {
  id           String                   @id @default(uuid()) @db.Uuid
  dealershipId String                   @map("dealership_id") @db.Uuid
  submissionId String                   @map("submission_id") @db.Uuid
  stipType     FinanceStipulationType   @map("stip_type")
  status       FinanceStipulationStatus  @default(REQUESTED)
  requestedAt  DateTime?                @map("requested_at")
  receivedAt   DateTime?                @map("received_at")
  documentId   String?                  @map("document_id") @db.Uuid
  notes        String?                  @db.Text
  createdAt    DateTime                 @default(now()) @map("created_at")
  updatedAt    DateTime                 @updatedAt @map("updated_at")

  dealership   Dealership        @relation(fields: [dealershipId], references: [id], onDelete: Cascade)
  submission   FinanceSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  document     FileObject?       @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([dealershipId])
  @@index([dealershipId, submissionId])
  @@index([dealershipId, status])
  @@index([dealershipId, stipType])
}
```

---

### 1.7 Relations to Add on Existing Models

- **Deal:** `financeApplications` — FinanceApplication[]; `financeSubmissions` — FinanceSubmission[] (via dealId).
- **Dealership:** `lenders` — Lender[]; `financeApplications` — FinanceApplication[]; `financeSubmissions` — FinanceSubmission[]; `financeStipulations` — FinanceStipulation[].
- **Profile:** `financeApplicationsCreatedBy` — FinanceApplication[] @relation("FinanceApplicationCreatedBy").
- **FileObject:** `financeStipulations` — FinanceStipulation[] (stipulations linking this document).

---

### 1.8 Workflow Rules (Invariants)

- **SubmissionStatus:** DRAFT → READY_TO_SUBMIT → SUBMITTED → DECISIONED → FUNDED; any → CANCELED. Deal.CONTRACTED required before marking submission FUNDED (document in business rules).
- **Deal CANCELED:** Submission updates forced to CANCELED or blocked (submission.status → CANCELED; fundingStatus → CANCELED where applicable; or reject non-CANCELED updates).
- **Snapshot:** Submission snapshot (amountFinancedCents, termMonths, aprBps, paymentCents, productsTotalCents, backendGrossCents) is set at creation/READY_TO_SUBMIT and not updated from DealFinance thereafter.
- **Stip document link:** When linking `documentId`, validate FileObject: same dealershipId, entityType = `DEAL`, entityId = submission.dealId. Otherwise return **NOT_FOUND** (cross-tenant or wrong deal).

---

## 2) REST API Routes + Zod Schemas (Contracts Only)

### 2.1 Conventions

- **Dealership scoping:** `dealershipId` from auth (active dealership) only. Never from client body. All list/get/update/delete scoped by dealership. Cross-tenant resource IDs return **NOT_FOUND**.
- **Money in API:** Request body may accept number or string (parsed to BigInt). **Responses** return money as **string** (cents), e.g. `"12345"`. APR as integer BPS.
- **Error shape:** `{ error: { code, message, details? } }`. Codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, INTERNAL.
- **Pagination:** List endpoints use `limit` (default 25, max 100), `offset` (0-based). Response: `{ data: T[], meta: { total, limit, offset } }`.

---

### 2.2 Route Table

| Method | Path | Purpose | Permission |
|--------|------|---------|------------|
| GET | /api/lenders | List lenders (paginated, filter isActive) | lenders.read |
| POST | /api/lenders | Create lender | lenders.write |
| GET | /api/lenders/[id] | Get lender by id | lenders.read |
| PATCH | /api/lenders/[id] | Update lender | lenders.write |
| DELETE | /api/lenders/[id] | Soft disable lender (isActive = false) | lenders.write |
| GET | /api/deals/[dealId]/applications | List applications for deal (paginated) | finance.submissions.read |
| POST | /api/deals/[dealId]/applications | Create application for deal | finance.submissions.write |
| GET | /api/deals/[dealId]/applications/[applicationId] | Get application (with applicants) | finance.submissions.read |
| PATCH | /api/deals/[dealId]/applications/[applicationId] | Update application | finance.submissions.write |
| GET | /api/deals/[dealId]/applications/[applicationId]/submissions | List submissions (paginated) | finance.submissions.read |
| POST | /api/deals/[dealId]/applications/[applicationId]/submissions | Create submission (snapshot from DealFinance) | finance.submissions.write |
| GET | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId] | Get submission (with stips) | finance.submissions.read |
| PATCH | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId] | Update submission (status, decision) | finance.submissions.write |
| PATCH | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId]/funding | Update funding (fundingStatus, fundedAt, amounts) | finance.submissions.write |
| GET | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId]/stipulations | List stipulations (paginated) | finance.submissions.read |
| POST | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId]/stipulations | Create stipulation | finance.submissions.write |
| PATCH | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId]/stipulations/[stipId] | Update stipulation (incl. documentId) | finance.submissions.write |
| DELETE | /api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId]/stipulations/[stipId] | Delete stipulation | finance.submissions.write |

**Document linking:** When PATCH stipulation with `documentId`, backend validates FileObject: dealershipId = auth, entityType = DEAL, entityId = submission.dealId. Else **NOT_FOUND**.

---

### 2.3 Zod Schema Names and Shapes

**Lenders**

- `listLendersQuerySchema`: `limit` (number, default 25, max 100), `offset` (number, min 0), `isActive?` (boolean, optional filter).
- `lenderIdParamSchema`: `id` (z.string().uuid()).
- `createLenderBodySchema`: `name` (string, required), `lenderType` (enum), `contactEmail?`, `contactPhone?`, `externalSystem` (enum), `isActive?` (boolean, default true).
- `updateLenderBodySchema`: `name?`, `lenderType?`, `contactEmail?`, `contactPhone?`, `externalSystem?`, `isActive?` (all optional).

**Applications**

- `dealIdParamSchema`: `dealId` (z.string().uuid()).
- `applicationIdParamSchema`: `applicationId` (z.string().uuid()).
- `listApplicationsQuerySchema`: `limit`, `offset`.
- `createApplicationBodySchema`: optional initial payload (e.g. empty or `status?: DRAFT`).
- `updateApplicationBodySchema`: `status?` (DRAFT | COMPLETED). Applicant CRUD may be same PATCH with nested applicants or separate endpoints; spec assumes PATCH application can update status and applicants in one body (e.g. `applicants?: array of { role, fullName, email?, phone?, address fields?, employerName? }`).

**Applicants (if separate or nested)**

- `createApplicantBodySchema`: `role` (PRIMARY | CO), `fullName` (string), `email?`, `phone?`, `addressLine1?`, `addressLine2?`, `city?`, `region?`, `postalCode?`, `country?`, `employerName?`. No income, SSN, DOB.
- `updateApplicantBodySchema`: same fields optional.

**Submissions**

- `submissionIdParamSchema`: `submissionId` (z.string().uuid()).
- `listSubmissionsQuerySchema`: `limit`, `offset`, `status?` (optional filter).
- `createSubmissionBodySchema`: `lenderId` (UUID), `reserveEstimateCents?` (number or string). Snapshot taken from DealFinance for that deal (same tenant); if no DealFinance or deal not found, NOT_FOUND or VALIDATION_ERROR.
- `updateSubmissionBodySchema`: `status?`, `decisionStatus?`, `approvedTermMonths?`, `approvedAprBps?`, `approvedPaymentCents?`, `maxAdvanceCents?`, `decisionNotes?`, `reserveEstimateCents?`. Valid status transitions enforced.
- `updateSubmissionFundingBodySchema`: `fundingStatus` (PENDING | FUNDED | CANCELED), `fundedAt?` (ISO datetime), `fundedAmountCents?`, `reserveFinalCents?`. When FUNDED: Deal must be CONTRACTED (else CONFLICT).

**Stipulations**

- `stipIdParamSchema`: `stipId` (z.string().uuid()).
- `listStipulationsQuerySchema`: `limit`, `offset`, `status?`, `stipType?` (optional).
- `createStipulationBodySchema`: `stipType` (enum), `status?` (default REQUESTED), `requestedAt?`, `notes?`.
- `updateStipulationBodySchema`: `stipType?`, `status?`, `requestedAt?`, `receivedAt?`, `documentId?` (UUID; validated DEAL + dealId), `notes?`.

---

### 2.4 Response Shapes

- **Single resource:** `{ data: Lender | FinanceApplication | FinanceSubmission | FinanceStipulation }`. Money/apr fields as string.
- **List:** `{ data: T[], meta: { total, limit, offset } }`.
- **Error:** `{ error: { code, message, details? } }`.

---

## 3) RBAC Matrix + Tenant Scoping

### 3.1 Permissions

- **finance.read** / **finance.write** — Existing (deal finance shell).
- **lenders.read** — View lender directory and submission list/detail (view-only on lenders and submission metadata).
- **lenders.write** — Create/update/disable lenders (directory management).
- **finance.submissions.read** — View applications, submissions, decisions, stips, funding status.
- **finance.submissions.write** — Create/update applications, submissions, decisions, stips, funding.

### 3.2 Route × Permission Matrix

| Resource / action | lenders.read | lenders.write | finance.submissions.read | finance.submissions.write |
|-------------------|--------------|---------------|---------------------------|----------------------------|
| GET /api/lenders, GET /api/lenders/[id] | ✓ | — | — | — |
| POST/PATCH/DELETE /api/lenders, PATCH/DELETE /api/lenders/[id] | — | ✓ | — | — |
| GET applications, submissions, stipulations | — | — | ✓ | — |
| POST/PATCH applications, submissions, stipulations; PATCH submission funding | — | — | — | ✓ |

**Least privilege:** No admin bypass. Each route requires the stated permission(s) only.

### 3.3 Tenant Scoping Rules

- Every list/get/update/delete is scoped by `dealershipId` from auth. Cross-tenant resource ID returns **NOT_FOUND**.
- Stipulation `documentId`: FileObject must belong to same dealership and have entityType = DEAL, entityId = submission.dealId; otherwise **NOT_FOUND**.

### 3.4 Sensitive Reads

- Submission detail (and application with applicant info) is sensitive. Audit optional: submission.detail_viewed / application.detail_viewed (metadata: entity ids only, no PII in audit payload).

---

## 4) Audit Events

- **lender.created** — metadata: lenderId, dealershipId.
- **lender.updated** — metadata: lenderId, changedFields (field names only).
- **lender.deactivated** — metadata: lenderId (when isActive → false).
- **finance_application.created** — metadata: applicationId, dealId, dealershipId.
- **finance_application.updated** — metadata: applicationId, changedFields.
- **submission.created** — metadata: submissionId, applicationId, dealId, lenderId.
- **submission.status_changed** — metadata: submissionId, fromStatus, toStatus.
- **submission.decision_updated** — metadata: submissionId, decisionStatus.
- **submission.funding_updated** — metadata: submissionId, fundingStatus.
- **stip.created** — metadata: stipId, submissionId.
- **stip.updated** — metadata: stipId, changedFields.
- **stip.deleted** — metadata: stipId, submissionId.
- **stip.document_linked** — metadata: stipId, documentId (when documentId set/changed).

Audit metadata: IDs and changedFields only; no phone/email arrays, no full address dumps.

---

## 5) Events Emitted / Consumed

**Emitted (internal domain events):**

- `submission.created` — payload: { submissionId, applicationId, dealId, lenderId, dealershipId }.
- `submission.decisioned` — payload: { submissionId, decisionStatus, dealId, dealershipId }.
- `submission.funded` — payload: { submissionId, dealId, dealershipId, fundedAmountCents }.
- `stip.received` — payload: { stipId, submissionId } (when status → RECEIVED).

**Consumed:**

- `deal.status_changed` — When toStatus = CANCELED, set submission.status / fundingStatus to CANCELED where applicable or block non-CANCELED updates for that deal’s submissions.
- (Optional) `deal.status_changed` — When toStatus = CONTRACTED, allow submission funding to be set to FUNDED; when not CONTRACTED, reject PATCH funding to FUNDED with CONFLICT.

---

## 6) Module Boundary

- **Owns:** Lender, FinanceApplication, FinanceApplicant, FinanceSubmission, FinanceStipulation. Code under `/modules/lender-integration/{db,service,ui,tests}`. Route handlers under `/app/api/lenders/**` and `/app/api/deals/[dealId]/applications/**` call lender-integration service only.
- **Depends on:** core-platform (Dealership, Profile, RBAC, AuditLog, FileObject); deals (Deal); finance-shell (DealFinance — read-only for snapshot). No direct DB access to Deal/DealFinance from lender-integration db layer for cross-entity reads; use deals/finance service or Prisma relation scoped by dealership.
- **Document linking:** Uses FileObject (documents module / core). Validate entityType = DEAL, entityId = submission.dealId, dealershipId = auth.
- **Shared:** Permissions `lenders.read`, `lenders.write`, `finance.submissions.read`, `finance.submissions.write` (seed in core-platform). finance.read/finance.write remain for deal finance shell.

---

## 7) UI Screen Map

- **Deal detail “Lenders” tab** (gated: finance.submissions.read for view, finance.submissions.write for create/update):
  - Application card: create/select application; applicant/co-applicant summary (name, email, phone, address; employment optional; no income/SSN/DOB).
  - Lender select + “Create submission” (snapshot from current DealFinance); submissions table (columns: lender, status, submittedAt, decision, funding).
  - Decision panel: decision status, approved terms/APR/payment, max advance, notes (edit with finance.submissions.write).
  - Stipulations checklist: type, status (requested/received/waived), document link (pick from deal documents only); NOT_FOUND if wrong deal/cross-tenant.
  - Funding panel: funding status, funded date, funded amount, reserve final (edit with finance.submissions.write). Deal must be CONTRACTED to set FUNDED; toasts for status/decision/funding updates.
- **Admin /lenders directory** (gated: lenders.read to view, lenders.write to manage):
  - List lenders (paginated, filter active); create/edit/disable lender (name, type, contact, external system). No secrets.

---

## 8) Backend Checklist

- [ ] Prisma: Add Lender, FinanceApplication, FinanceApplicant, FinanceSubmission, FinanceStipulation; enums LenderType, LenderExternalSystem, FinanceApplicationStatus, FinanceApplicantRole, FinanceSubmissionStatus, FinanceDecisionStatus, FinanceFundingStatus, FinanceStipulationType, FinanceStipulationStatus; all money BigInt, rates Int BPS; indexes and FKs; relations on Deal, Dealership, Profile, FileObject.
- [ ] Migration: Create and apply; verify unique (dealershipId, name) on Lender and all indexes.
- [ ] DB layer: `/modules/lender-integration/db` — CRUD for all five models; all queries scoped by dealershipId; snapshot built from DealFinance (read via service or relation).
- [ ] Service layer: Snapshot correctness (copy from DealFinance at submission create); status/funding rules (Deal CONTRACTED for FUNDED; Deal CANCELED → submission CANCELED or block); stip document link validation (FileObject entityType DEAL, entityId = submission.dealId, same tenant) → NOT_FOUND when invalid.
- [ ] API routes: Lenders GET/POST/PATCH/DELETE; Applications GET/POST/PATCH per deal; Submissions GET/POST/PATCH + PATCH funding; Stipulations GET/POST/PATCH/DELETE. Zod for params, query, body; requirePermission per route table; dealershipId from auth; money as string in responses.
- [ ] Pagination: All list endpoints limit (default 25, max 100), offset; meta.total.
- [ ] Tenant isolation: NOT_FOUND for any resource in another dealership; stip documentId cross-tenant or wrong deal → NOT_FOUND.
- [ ] Tests: Tenant isolation (Dealer A cannot read/update Dealer B lenders, applications, submissions, stips); RBAC (insufficient permission → FORBIDDEN); snapshot correctness (submission snapshot matches DealFinance at create); stip doc link NOT_FOUND for wrong deal/cross-tenant; status/funding rules (CONTRACTED required for FUNDED; CANCELED deal behavior); audit entries for lender, application, submission, stip actions.
- [ ] Docs: `/docs/modules/lender-integration.md` (purpose, routes, permissions, data model summary, manual test steps); update SECURITY.md if new permissions or sensitive flows.

---

## 9) Frontend Checklist

- [ ] Deal detail “Lenders” tab: application card (create/select, applicant/co-applicant summary); lender select + create submission from snapshot; submissions table; decision panel; stips checklist + document link (deal documents only); funding panel. Permission gating (finance.submissions.read / finance.submissions.write).
- [ ] Lenders directory (Admin): list (paginated, filter active), create/edit/disable; gated by lenders.read / lenders.write.
- [ ] Create submission from snapshot: call POST submissions with lenderId; display snapshot and status.
- [ ] Stips: list, add, update status, link document (pick from deal documents); handle NOT_FOUND for invalid document.
- [ ] Status/decision/funding toasts or inline feedback on success/error.
- [ ] Manual smoke: create deal → finance shell → application → applicants → submission → decision → stips + doc link → funding (after deal CONTRACTED); lenders directory CRUD; tenant/RBAC negative checks.
