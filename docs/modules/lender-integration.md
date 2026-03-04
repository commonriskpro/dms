# Lender Integration Module

## Purpose and scope
 Lender “submission + tracking” workflow attached to Deal and DealFinance: tenant-scoped lender directory; finance application per deal (applicants/co-applicants, no SSN/DOB in v1); submission package with deal finance snapshot; tracking submission status, decision, stipulations (with document linking), and funding. Full auditability, tenant isolation, RBAC. No real lender APIs in v1 (stub only).

## Security guarantees

- **Tenant isolation:** Every list/get/update/delete is scoped by `dealership_id` from auth. Cross-tenant resource IDs return **NOT_FOUND**. Dealer A cannot access or mutate Dealer B's applications, submissions, stipulations, or lenders.
- **RBAC:** Every route enforces a permission before performing the action. No admin bypass. Missing permission returns **403 FORBIDDEN**.
- **Snapshot immutability:** Submission snapshot (amount, term, APR, payment, products, backend gross) is taken from DealFinance at creation and is immutable; later changes to DealFinance do not alter existing submissions.
- **Deal canceled rule:** When the deal is **CANCELED**, submission updates are restricted to setting status/fundingStatus to **CANCELED** only; other submission updates return **CONFLICT**. When the deal is **CANCELED**, PATCH on the deal itself (e.g. notes) returns **CONFLICT**.
- **Funding rule:** **FUNDED** is allowed only when **Deal.status = CONTRACTED** and only via the funding endpoint (PATCH …/submissions/[id]/funding). Status transition to FUNDED via general submission PATCH is not allowed (**VALIDATION_ERROR**).
- **Stip document linking rule:** When setting a stipulation's `documentId`, the backend validates the FileObject: same `dealershipId`, `entityType = DEAL`, `entityId = submission.dealId`, and not soft-deleted. Cross-tenant, wrong deal, wrong entity type, or soft-deleted document returns **NOT_FOUND**. No `document.accessed` audit is created by linking; only signed-url usage creates access audit.
- **Audit PII policy:** Audit metadata contains only IDs and changedFields (or equivalent safe keys). It does **not** contain applicant email/phone/address text, or raw decisionNotes. Sensitive reads (e.g. signed-url) are audited separately without PII in metadata.

## Routes

| Method | Path | Permission |
|--------|------|------------|
| GET | /api/lenders | lenders.read |
| POST | /api/lenders | lenders.write |
| GET | /api/lenders/[id] | lenders.read |
| PATCH | /api/lenders/[id] | lenders.write |
| DELETE | /api/lenders/[id] | lenders.write (soft-disable) |
| GET | /api/deals/[dealId]/applications | finance.submissions.read |
| POST | /api/deals/[dealId]/applications | finance.submissions.write |
| GET | /api/deals/[dealId]/applications/[applicationId] | finance.submissions.read |
| PATCH | /api/deals/[dealId]/applications/[applicationId] | finance.submissions.write |
| GET | /api/deals/[dealId]/applications/[applicationId]/submissions | finance.submissions.read |
| POST | /api/deals/[dealId]/applications/[applicationId]/submissions | finance.submissions.write |
| GET | /api/deals/.../submissions/[submissionId] | finance.submissions.read |
| PATCH | /api/deals/.../submissions/[submissionId] | finance.submissions.write |
| PATCH | /api/deals/.../submissions/[submissionId]/funding | finance.submissions.write |
| GET | /api/deals/.../submissions/[submissionId]/stipulations | finance.submissions.read |
| POST | /api/deals/.../submissions/[submissionId]/stipulations | finance.submissions.write |
| PATCH | /api/deals/.../stipulations/[stipId] | finance.submissions.write |
| DELETE | /api/deals/.../stipulations/[stipId] | finance.submissions.write |

All list endpoints: `limit` (default 25, max 100), `offset`. Responses: `{ data, meta: { total, limit, offset } }`. Money in API as string cents.

## Permissions

- **lenders.read** — View lender directory and submission list/detail.
- **lenders.write** — Create/update/disable lenders.
- **finance.submissions.read** — View applications, submissions, decisions, stips, funding.
- **finance.submissions.write** — Create/update applications, submissions, decisions, stips, funding.

No admin bypass; least privilege.

## Snapshot rules

- On **create submission**, snapshot is taken from **DealFinance** for that deal: `amountFinancedCents`, `termMonths`, `aprBps`, `monthlyPaymentCents` → `paymentCents`, `productsTotalCents`, `backendGrossCents`.
- If DealFinance is missing or incomplete (e.g. no term/APR), create returns **VALIDATION_ERROR**.
- Snapshot is **immutable** after creation; later changes to DealFinance do not update existing submissions.

## Funding rules

- **FUNDED**: Allowed only when **Deal.status = CONTRACTED**. Otherwise **CONFLICT**.
- When **Deal** is **CANCELED**: submission updates are restricted to setting `status` and `fundingStatus` to **CANCELED** only; other updates return **CONFLICT**. On `deal.status_changed` to CANCELED, submissions for that deal are auto-set to CANCELED.

## Stip document safety

- When setting a stipulation’s `documentId`, the backend validates the **FileObject**: same `dealershipId`, `entityType = DEAL`, `entityId = submission.dealId`, and not soft-deleted.
- Cross-tenant, wrong deal, wrong entity type, or soft-deleted document returns **NOT_FOUND**.
- `stip.document_linked` audit is written only on successful link (non-null documentId). Linking does not create `document.accessed`; only signed-url usage does.

## Manual smoke checklist

1. **Lenders**: As user with lenders.read, GET /api/lenders; with lenders.write, POST a lender, PATCH, DELETE (soft-disable). Confirm other dealership cannot see or update.
2. **Applications**: As user with finance.submissions.write, create deal + DealFinance, then POST /api/deals/[dealId]/applications; GET list, GET one, PATCH status.
3. **Submissions**: POST submission (snapshot from DealFinance); confirm snapshot matches current DealFinance. Change DealFinance; confirm existing submission unchanged. Transition status (e.g. DRAFT → READY_TO_SUBMIT → SUBMITTED). Try invalid transition → VALIDATION_ERROR.
4. **Funding**: PATCH funding to FUNDED while deal is not CONTRACTED → CONFLICT. Set deal to CONTRACTED, then PATCH funding to FUNDED → success.
5. **Deal canceled**: Set deal to CANCELED; confirm submissions for that deal become or can only be set to CANCELED; try PATCH submission to non-CANCELED → CONFLICT.
6. **Stipulations**: Create stip, PATCH with documentId. Use a file with entityType=DEAL and entityId=submission.dealId → success. Use file for another deal or another tenant → NOT_FOUND.
7. **RBAC**: As role without lenders.write, POST /api/lenders → 403. Without finance.submissions.write, POST submission → 403.
