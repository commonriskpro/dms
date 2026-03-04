# SPRINT 6 — Lender Integration UI (Deal-tab) — SPEC

Spec-only document for the Deal-tab lender UI. Defines scope, RBAC, business rules, stipulation document linking, test requirements, and formatting so implementation can be verified or completed. No code.

**Context:** Backend exists: GET/POST `/api/deals/[dealId]/applications`, GET/PATCH application, GET/POST submissions, GET/PATCH submission, PATCH funding, GET/POST/PATCH/DELETE stipulations. Permissions: `finance.submissions.read`, `finance.submissions.write`; `lenders.read` for lender list. Submission status transitions validated in service (DRAFT → READY_TO_SUBMIT → SUBMITTED → DECISIONED; FUNDED only via funding endpoint when deal CONTRACTED). Tenant isolation: all routes use `ctx.dealershipId`; deal/application/submission must belong to tenant. `DealLendersTab.tsx` already exists and implements much of this.

**Goal:** Define Deal-tab UI scope and test requirements for verification or completion.

---

## 1) SCOPE — Deal tab "Lenders" (or "Finance / Lenders")

### 1.1 Applications list

- List applications for the deal via **GET** `/api/deals/[dealId]/applications` (paginated).
- Show application summary: e.g. primary applicant name, created date.
- Allow user to select an application to view its submissions.

### 1.2 Create application

- When **no** application exists **and** user has `finance.submissions.write` **and** deal is **not** CANCELED: show "Create Finance Application".
- On action: **POST** `/api/deals/[dealId]/applications`; then show application form/detail.

### 1.3 Submissions

- When an application is selected: list submissions via **GET** submissions for that application (paginated).
- Columns (e.g.): lender name, status, decision status, funding status.
- Allow user to select a submission for detail view.

### 1.4 Status transitions

- Submission has **status**: DRAFT, READY_TO_SUBMIT, SUBMITTED, DECISIONED, FUNDED, CANCELED.
- UI shows current status and may allow transition via **PATCH** submission (e.g. `status` field). Backend validates allowed transitions.
- Define which transitions are **user-triggered from UI**, e.g.:
  - "Mark ready to submit" (DRAFT → READY_TO_SUBMIT)
  - "Mark submitted" (READY_TO_SUBMIT → SUBMITTED)
  - "Mark decisioned" (SUBMITTED → DECISIONED)
  - Any other transitions the backend allows and the UI should expose (e.g. CANCELED). Do not offer invalid transitions (e.g. SUBMITTED → DRAFT); show server error in toast if user somehow triggers one.

### 1.5 Decision update

- Submission has decision fields: `decisionStatus`, `approvedTermMonths`, `approvedAprBps`, `approvedPaymentCents`, `maxAdvanceCents`, `decisionNotes`.
- UI: panel to **view** and **edit** (PATCH submission) when user has `finance.submissions.write`.
- Display: use `formatCents` for money, `bpsToPercent` for APR.

### 1.6 Funding

- **PATCH** `/api/deals/[dealId]/applications/[applicationId]/submissions/[submissionId]/funding` with `fundingStatus` (PENDING, FUNDED, CANCELED).
- Deal must be **CONTRACTED** to set FUNDED; backend returns error otherwise.
- UI: funding panel with status, funded amount, reserve. Save disabled or toast when user tries to set FUNDED and deal is not CONTRACTED.

### 1.7 Stipulations

- List stipulations for the selected submission (GET stipulations).
- Add stip: type, status, description/notes (backend field may be `notes`).
- Document link: stip can have `documentId` linking to a deal document. UI shows link to document (signed URL or document detail) when `documentId` is set.
- **PATCH** stipulation to set `documentId` (link document).

### 1.8 Out of scope

- SSN/DOB fields.
- Full lender directory management (separate page).
- Workflow engine.

---

## 2) RBAC

| Permission | Effect |
|------------|--------|
| **finance.submissions.read** | View applications list, application detail, submissions list, submission detail (decision, funding, stipulations). **No fetch** to applications/submissions when this permission is missing. |
| **finance.submissions.write** | Create application, PATCH application, create submission, PATCH submission (status/decision), PATCH funding, create/PATCH/DELETE stipulation. When permission is missing: read-only mode or hide mutation controls. |
| **lenders.read** | Required to load lender list for "Create submission" (lender dropdown). **No lender fetch** when missing; show message or disable "Create submission". |

**Tenant:** All API calls use `dealId` from the route (deal belongs to `ctx.dealershipId`). Backend validates application/submission belong to deal and tenant. No client-supplied `dealershipId`.

---

## 3) BUSINESS RULES (UI reflection)

| Rule | UI behavior |
|------|-------------|
| **Deal CONTRACTED required for funding** | When deal `status !== CONTRACTED`, UI must **not** allow setting funding status to FUNDED (disable control or show toast: "Deal must be CONTRACTED to mark funded"). |
| **Deal CANCELED** | No create application; no create submission. Existing data read-only or funding only allow CANCELED. |
| **Status transition validation** | Backend rejects invalid transitions (e.g. SUBMITTED → DRAFT). UI should only offer valid next states or show server error in toast. |

---

## 4) STIPULATION DOCUMENT LINK

- Stipulation has optional **documentId** (FK to document). Document must be same tenant, `entityType` DEAL, `entityId` = dealId.
- **UI (edit):** When editing a stip, show "Link document" (e.g. dropdown or modal listing deal documents). On save, **PATCH** stipulation with `documentId`.
- **Display:** Show document name or "View document" link (signed URL or `/documents` or deal documents tab). If backend returns NOT_FOUND for invalid document (wrong deal/cross-tenant), show appropriate message.

---

## 5) TEST REQUIREMENTS (for Step 4)

### 5.1 Status transition validation (backend)

- **Invalid transition:** Attempt PATCH submission with invalid status transition (e.g. SUBMITTED → DRAFT). Expect **400** and error code such as **VALIDATION_ERROR** (or equivalent).
- **Valid transition:** PATCH submission with valid transition (e.g. DRAFT → READY_TO_SUBMIT). Expect success.

### 5.2 Cross-tenant access blocked (backend)

- User from Dealer A calls GET or PATCH for deal/application/submission that belongs to Dealer B. Expect **404**.
- Same for stipulations and funding endpoints.

### 5.3 Frontend (optional)

- No fetch to applications/submissions when user lacks `finance.submissions.read`.
- Mutation buttons (create application, create submission, PATCH submission, PATCH funding, stipulation create/PATCH/DELETE) hidden or disabled when user lacks `finance.submissions.write`.
- When user lacks `lenders.read`, lender list is not fetched; create submission is disabled or shows message.

---

## 6) MONEY AND FORMAT

- **Display:** All money in UI via **formatCents** (display).
- **Inputs:** Use **parseDollarsToCents** / **centsToDollarInput** for money inputs.
- **APR:** Stored in basis points; display with **bpsToPercent**.

---

## Deliverables checklist (verification)

- [ ] Applications list loads (GET applications); summary shown; selection shows submissions.
- [ ] Create application shown only when no application, has write, deal not CANCELED; POST then show form.
- [ ] Submissions list with lender, status, decision status, funding status; selection shows detail.
- [ ] Status transitions: UI offers only valid next states; invalid PATCH shows toast/error.
- [ ] Decision panel: view/edit with formatCents and bpsToPercent; PATCH when write permission.
- [ ] Funding panel: status, amounts; FUNDED disabled or toasts when deal not CONTRACTED.
- [ ] Stipulations: list, add (type, status, description/notes); link document (deal documents only); display link when documentId set.
- [ ] RBAC: no fetch without read; no mutation controls without write; no lender fetch without lenders.read.
- [ ] Tenant: all calls use dealId from route; no client dealershipId.

---

Next step: backend verifies status validation and tenant isolation with tests; frontend verifies or completes Deal tab UI per spec.
