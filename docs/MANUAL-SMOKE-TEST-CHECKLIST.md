# Manual Smoke Test Checklist — Core Platform

Use this after deploying or after major changes. Requires a running app, Supabase Auth, and a seeded database.

---

## Localhost smoke test

Quick verification after running the [local run order](LOCALHOST.md#run-order) (`npm install`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`). Confirm **GET http://localhost:3000/api/health** returns 200 and `db: "ok"` before starting.

- [ ] **/login** — Sign in with password or magic link; redirect after login (see [Login](#-login) under UI smoke tests).
- [ ] **/get-started bootstrap** — With `ALLOW_BOOTSTRAP_LINK=1`, click "Link me as Owner"; redirect to `/admin/dealership`; session shows `activeDealership` + permissions (see [Logged-in, no dealership](#-logged-in-no-dealership)).
- [ ] **/inventory** — Page loads; list visible with `inventory.read` (see [Inventory UI smoke tests](#inventory-ui-smoke-tests)).
- [ ] **Minimal E2E** — Create one customer, one deal, upload one document on the deal, save finance on the deal (see Customers, Deals, Documents, Finance sections).
- [ ] **/reports** — Page loads with `reports.read` (see [Reports UI smoke tests](#reports-ui-smoke-tests)).
- [ ] **/dashboard** — Sales dashboard: no access without `customers.read` or `crm.read`; with permission, one GET /api/dashboard and widgets per response (see [Sales Dashboard](#sales-dashboard-dashboard)).
- [ ] **/crm** — Page loads with `crm.read` (see [CRM UI smoke tests](#crm-ui-smoke-tests)).

---

## UI smoke tests (browser)

- [ ] **Unauthed redirect**: Open `/admin/dealership` while signed out. Expect redirect to `/login`.
- [ ] **Logged-in, no dealership**: Sign in with a user that has no active dealership. Visit `/admin/dealership` or `/files`. Expect redirect to `/get-started`. On Get Started page, confirm “Link me as Owner (demo)” CTA is shown; click it and expect redirect to `/admin/dealership` after success.
- [ ] **Login**: On `/login`, sign in with email/password; expect redirect to app (home or dealership). Try “Magic link” tab and send link; confirm message “Check your inbox”.
- [ ] **App shell**: When signed in with a dealership, confirm topbar shows user and active dealership name; sidebar shows only nav items you have permission for (e.g. Dealership, Users, Roles, Audit Log, Files).
- [ ] **Dealership page**: List locations, add location (dialog), edit location (dialog). Confirm pagination if >25 locations.
- [ ] **Users page**: List members, invite (modal), edit role (modal), disable member. Confirm self-disable shows warning and blocks action.
- [ ] **Roles page**: List roles, create role (permission picker), edit role, delete non-system role. Confirm system roles cannot be deleted (Delete hidden or disabled). If backend returns conflict when role in use, confirm toast “Role is in use”.
- [ ] **Audit page**: List entries, filter by action/entity/date range, expand/collapse metadata JSON.
- [ ] **Files page**: Upload file (choose bucket), get signed URL by file ID, open link. Confirm upload/signed URL only shown when user has documents.write / documents.read.
- [ ] **Accessibility**: Tab through a list page and a modal; confirm visible focus and no trap outside modals. Confirm form inputs have labels.

### Platform Admin UI smoke tests

- [ ] **Nav gating**: When `platformAdmin.isAdmin` is false, sidebar does **not** show "Platform Admin" or Dealerships/Users/Invites. Visiting `/platform/dealerships`, `/platform/users`, or `/platform/invites` directly shows "You don't have access to platform admin" and **no** requests to `/api/platform/*` (check Network tab).
- [ ] **Nav when admin**: When signed in as platform admin, sidebar shows "Platform Admin" with links: Dealerships (`/platform/dealerships`), Users (`/platform/users`), Invites (`/platform/invites`). Active link is highlighted.
- [ ] **Dealerships** (`/platform/dealerships`): List loads (GET `/api/platform/dealerships`). Search and pagination work. "Create dealership" opens modal: name (required), optional slug, "Create default location" checkbox; submit creates (POST) and list refreshes. Disable/Enable and Impersonate show confirm dialogs; actions succeed. Empty state shows "No dealerships" and Create CTA. Loading shows skeleton; error shows Retry.
- [ ] **Pending users** (`/platform/users`): List loads (GET `/api/platform/pending-users`). Search and pagination work. "Approve" opens modal: select dealership (from GET dealerships), select role (from GET dealerships/[id]/roles); submit (POST approve) removes user from list. "Reject" shows confirm "Are you sure you want to reject this user?…"; submit (POST reject) removes user. Empty state: "No pending users". Loading and error with Retry.
- [ ] **Invites** (`/platform/invites`): Select a dealership from dropdown (GET dealerships). List loads (GET dealerships/[id]/invites). Filter by status; "Create invite" modal: email, role (from GET roles), optional expiry; submit creates invite. For PENDING invite: "Resend" and "Revoke" with confirm dialogs; Revoke sets status cancelled. Empty state when no invites; loading and error states.
- [ ] **Pending approval screen**: Sign in as a user who has **no** membership and has a PendingApproval row (e.g. new self-serve signup). Expect redirect to **/pending** (not `/get-started`). Page shows "Your account is pending approval. A platform administrator will link you to a dealership shortly." No tenant data; sign-out available.
- [ ] **Accept invite** (`/accept-invite?token=…`): With **invalid or missing token**: resolve returns 404 or 410; show error. With **valid token**: GET resolve shows dealership name, role name, expiry (no PII). **Signed out**: "Sign in to accept" / "Sign up" link to login; after login, redirect back to `/accept-invite?token=…`; "Accept" button visible. **Signed in**: Click "Accept" → POST accept → PATCH session/switch with returned dealershipId → redirect to `/dashboard` with that dealership active. **Expired/cancelled token**: 410 with message "This invite has expired or was cancelled."
- [ ] **Create dealership modal**: Validation: submit disabled when name empty. Labels visible for name, slug, create default location. Success toast and list refresh.
- [ ] **Accessibility (platform)**: Tab through Dealerships, Users, Invites; modals have visible labels and clear confirm copy; focus order sane.

### Global Search (topbar)

- [ ] **Visibility**: Search is visible only when user has at least one of `customers.read`, `deals.read`, `inventory.read`. When user has none of these, search is not visible (or disabled) and no GET /api/search request is made.
- [ ] **Debounce**: Type 2+ characters, wait 300ms; exactly one GET /api/search with correct `q` and limit/offset (e.g. `q=...&limit=20&offset=0`).
- [ ] **Results**: Results grouped by type (Customers, Deals, Inventory); click row navigates to correct detail page (/customers/[id], /deals/[id], /inventory/[id]); keyboard (Arrow Down/Up, Enter) moves highlight and Enter navigates.
- [ ] **Tenant isolation**: As User A (Dealer 1), create a customer, deal, or vehicle with a unique name. As User B (Dealer 2), search that term; no results from Dealer 1 must appear.
- [ ] **Permission gating**: With only `customers.read`, only customer results; with only `deals.read`, only deal results; with only `inventory.read`, only inventory results.
- [ ] **Limit**: Request with `limit=51` returns 400 (validation error) or, if accepted, at most 50 results and `meta.limit === 50`.

---

## Reports UI smoke tests

- [ ] **Nav**: With `reports.read`, sidebar shows “Reports” linking to `/reports`. Without it, link is hidden.
- [ ] **No access**: Without `reports.read`, visiting `/reports` shows “You don't have access to reports.” and does NOT call any reports APIs (check network tab).
- [ ] **Dashboard**: With `reports.read`, page shows date range picker (Today, Last 7, Last 30, MTD, QTD, YTD, Custom). Top row: Contracted deals, Sales volume, Front gross, Finance penetration %. Second row: Deals trend (line), Front gross (bar), Cash vs finance mix (pie). Tables: Sales by user (paginated), Inventory aging (buckets, byStatus chips, total value/list price).
- [ ] **Date range**: Changing preset or custom from/to refetches data (debounced). Custom shows from/to inputs.
- [ ] **Export**: With `reports.export`, “Export Sales CSV” and “Export Inventory CSV” buttons visible; click triggers download. Without `reports.export`, buttons are hidden.
- [ ] **Export errors**: If export returns 403, toast “Not allowed to export.”; if 429, “Rate limited — try again soon.” “Exporting…” shown while request in flight.
- [ ] **Loading/error**: Skeletons while loading; per-widget error with “Try again” retry; no full-page break.
- [ ] **Money**: All dollar values use formatCents (e.g. $1,234.56).
- [ ] **Accessibility**: Reports page keyboard navigable; date picker and export buttons have accessible names; focus visible.

---

## Sales Dashboard (/dashboard)

- [ ] **No access when user has neither customers.read nor crm.read**: With a role that has neither `customers.read` nor `crm.read`, open `/dashboard`. Expect message “You don’t have access to the dashboard.” In DevTools Network tab, confirm **no** request to GET `/api/dashboard`.
- [ ] **Single fetch when permitted**: With at least one of `customers.read` or `crm.read`, open `/dashboard`. Exactly one GET `/api/dashboard` request; widgets shown only for sections present in the response (My Tasks, New Prospects, Pipeline Funnel, Stale Leads, Appointments placeholder).
- [ ] **Widgets match response**: With only `customers.read`, backend does not return `pipelineFunnel` or `appointments`; UI must not show Pipeline Funnel or Appointments. With only `crm.read`, backend does not return `newProspects`; UI must not show New Prospects.
- [ ] **Tenant isolation**: As User A (Dealer 1), create a task or prospect (e.g. customer in LEAD status). As User B (Dealer 2), open `/dashboard`. Dealer 2 must not see Dealer 1’s data in any widget (My Tasks, New Prospects, Pipeline Funnel, Stale Leads).
- [ ] **Money**: If any widget displays money (e.g. funnel value later), it must use `formatCents`; current funnel may be counts only—note for future.
- [ ] **Empty and error states**: With permission, empty sections show “No tasks”, “No prospects”, etc. On API error, error message and “Retry” button; retry refetches.

---

## Customers UI smoke tests

- [ ] **Nav**: With `customers.read`, sidebar shows “Customers” linking to `/customers`. Without it, link is hidden.
- [ ] **List** (`/customers`): Table shows Name, Status, Lead source, Assigned to, Primary phone, Primary email, Created. Apply filters (Status, Lead source, Assigned to if admin.memberships.read). Search box debounces and filters. Pagination (limit/offset). Row click goes to `/customers/[id]`. Empty state shows message and “New Customer” only if `customers.write`. Loading and error states with retry.
- [ ] **Create** (`/customers/new`): Without `customers.write`, show “Not allowed” and no form. With permission: form has Name (required), Status (default LEAD), Lead source, Assigned to, Tags, Address, Phones (add/remove, primary), Emails (add/remove, primary). Submit creates customer and redirects to detail; toast “Customer created”. Validation and server error toasts.
- [ ] **Detail** (`/customers/[id]`): Overview tab shows core fields, address, tags, phones, emails. Edit (modal) and Delete (confirm) only if `customers.write`; otherwise “Not allowed to edit or delete”. Refresh button refetches. Delete confirms and redirects to `/customers` with toast.
- [ ] **Notes tab**: List newest-first with author and timestamp. With `customers.write`: add note (form), edit (inline), delete. Without: message “You need customers.write…”. Loading, empty, error states; pagination if >25.
- [ ] **Tasks tab**: List with due and status (pending/completed). Filter All / Pending / Completed. With `customers.write`: add task, Complete, Delete. Without: message about permission. Loading, empty, error; pagination.
- [ ] **Activity tab**: Timeline with activityType, timestamp, actor; expand/collapse metadata JSON. Loading, empty, error; pagination.
- [ ] **Permissions**: As role without `customers.read`, visiting `/customers` shows “You don’t have access to customers.” As role with read but without write: list and detail viewable; New Customer hidden; Edit/Delete and note/task add/edit/delete show “Not allowed” or permission message.
- [ ] **Tenant**: As User A (Dealer 1), create a customer; as User B (Dealer 2), confirm that customer does not appear in list and detail is 404.

### Customer Lead Action Strip (Lead tab)

- [ ] **Read-only (customers.read only)**: On Customer detail Lead tab, with only `customers.read`: only **Call** (if customer has phone) and **Email** (if customer has email) are visible. **Send SMS**, **Schedule Appointment**, **Add Task**, and **Disposition** are not visible.
- [ ] **With customers.write**: With `customers.write`, all six actions are visible where applicable: **Call** (tel: link), **Send SMS**, **Email** (mailto: link), **Schedule Appointment**, **Add Task**, **Disposition**.
- [ ] **Call**: Click Call opens `tel:` link with primary phone (digits only).
- [ ] **Email**: Click Email opens `mailto:` with primary email.
- [ ] **SMS**: Click Send SMS opens modal; submit logs activity (POST /api/customers/[id]/sms); modal closes and activity/timeline can be refreshed. Message body is not stored in activity metadata (stub).
- [ ] **Schedule Appointment**: Click Schedule Appointment opens modal; set date/time and optional notes; submit logs activity (POST /api/customers/[id]/appointments); modal closes. Notes stored only as truncated non-PII in metadata (scheduledAt, notesTruncated).
- [ ] **Add Task**: Click Add Task opens modal; submit creates task (POST /api/customers/[id]/tasks) and refreshes; task appears in Tasks panel/list.
- [ ] **Disposition**: Click Disposition opens modal; change status and optionally add follow-up task title/due; submit updates customer status (POST /api/customers/[id]/disposition) and optionally creates follow-up task; modal closes and data refreshes.
- [ ] **XSS**: Create or view a customer whose name (or a task whose title) contains `<script>alert(1)</script>` or `<img onerror=alert(1)>`. Confirm the content is displayed as **plain text only** (visible in DOM as literal characters), not executed (no script run, no img load).
- [ ] **Tenant isolation (action strip)**: As User A (Dealer 1), create a customer and note the customer ID. As User B (Dealer 2), call POST `/api/customers/[id]/disposition`, POST `/api/customers/[id]/sms`, or POST `/api/customers/[id]/appointments` with that customer ID. Expect **404** (customer not found for tenant).

---

## Inventory UI smoke tests

- [ ] **Nav**: With `inventory.read`, sidebar shows “Inventory” linking to `/inventory`. Without it, link is hidden. Visiting `/inventory` without `inventory.read` shows “You don’t have access to inventory.”
- [ ] **List** (`/inventory`): Table shows Stock #, Year/Make/Model, VIN, Mileage, Status, Sale price (formatCents), Projected gross (formatCents), Location, Days in stock, Actions. Filters: Status (All + AVAILABLE, HOLD, SOLD, WHOLESALE, REPAIR, ARCHIVED), Search (VIN/make/model), Min price ($), Max price ($), Location, Sort by (Date added, Sale price, Mileage, Stock #, Last updated), Order. Apply / Reset filters. Pagination. Row click goes to `/inventory/[id]`. “Add vehicle” only if `inventory.write`. Empty, loading, and error states with retry.
- [ ] **Detail** (`/inventory/[id]`): Overview tab shows Stock #, VIN, Year/Make/Model, Mileage, Color, Status (dropdown if `inventory.write`), Sale price, Auction cost, Transport cost, Reconditioning cost, Misc costs (all formatCents), Projected gross (read-only, formatCents), Location, Days in stock. Edit and Delete only if `inventory.write`. Photos tab: list and upload when permitted. API errors shown as toasts.
- [ ] **Create form** (`/inventory/new`): With `inventory.write`, form has VIN (decode), Stock number, Year, Make, Model, Trim, Mileage, Color, Status, Location, Sale price ($), Auction cost ($), Transport cost ($), Reconditioning cost ($), Misc costs ($). Dollar inputs; submit converts via parseDollarsToCents. Validation and API error toasts. On success: redirect to detail and toast.
- [ ] **Edit form** (`/inventory/[id]/edit`): Same dollar fields as create; values pre-filled from vehicle (centsToDollarInput). Save sends canonical cents fields; toast on success/error.
- [ ] **Permissions**: `inventory.read` only: list and detail viewable; Add vehicle hidden; Edit/Delete and status dropdown (if write required) disabled or read-only. Without `inventory.read`: “You don’t have access to inventory.”
- [ ] **Money**: All dollar values use formatCents for display; dollar inputs use parseDollarsToCents for submit. Projected gross is read-only on detail.

---

## Deals UI smoke tests

- [ ] **Nav**: With `deals.read`, sidebar shows “Deals” linking to `/deals`. Without it, link is hidden. Visiting `/deals` without `deals.read` shows “You don't have access to deals.”
- [ ] **List** (`/deals`): Table shows Created, Customer, Vehicle, Status badge, Sale Price, Front Gross. Status filter (DRAFT/STRUCTURED/APPROVED/CONTRACTED/CANCELED), Apply, pagination. Row click goes to `/deals/[id]`. “New Deal” only if `deals.write`. Empty and error states with retry.
- [ ] **Create** (`/deals/new`): Without `deals.write`, show “Not allowed” and no form. With permission: Customer (required) and Vehicle (required) selectors, Sale price ($), Tax rate (%), Doc fee ($), Down payment ($). Submit creates deal and redirects to `/deals/[id]` with toast. Invalid currency shows warning. **Conflict**: Create a second active deal for the same vehicle; expect toast “This vehicle already has an active deal.”
- [ ] **Detail** (`/deals/[id]`): Desking-style layout. Left: tabs (Overview, Fees, Trade, Status & History). Right: Totals card (total fees, tax, total due, front gross; note “Gross excludes tax”). Overview: sale price, tax rate, doc fee, down payment; Save structure only if `deals.write` and status ≠ CONTRACTED. Fees: list fees; add fee (label, amount $, taxable); edit/delete fee; disabled if CONTRACTED or no `deals.write`. Trade: add/edit trade (vehicle description, allowance, payoff); display net trade (allowance − payoff); disabled if CONTRACTED or no `deals.write`. Status & History: current status badge; change status (allowed transitions only) if `deals.write`; history list (from → to, timestamp).
- [ ] **Totals update**: After adding a fee or editing structure, totals card updates (refetch). After changing status, deal refetches.
- [ ] **Edit after CONTRACTED**: When deal status is CONTRACTED, structure inputs and Save, Fees add/edit/delete, and Trade add/edit are disabled. Banner: “Deal is contracted and locked.” If backend returns CONFLICT on a locked change, UI shows banner or toast.
- [ ] **Delete**: Delete deal button only if `deals.write` and status ≠ CONTRACTED. Confirm dialog → DELETE → redirect to `/deals` with toast.
- [ ] **Accessibility**: Tab through list and detail; focus visible. Modal (delete confirm) has focus trap and Escape to close. Form inputs have labels.

---

## Finance UI smoke tests (Deal Finance tab)

- [ ] **Tab visibility**: With `finance.read`, Deal detail shows a "Finance" tab. Without `finance.read`, do not show the Finance tab (or show tab and content "You don't have access to finance." without calling finance APIs).
- [ ] **No finance.read**: When user lacks `finance.read`, Finance tab (if visible) shows "You don't have access to finance." and does not call GET /api/deals/[id]/finance or GET products.
- [ ] **Create finance (FINANCE mode)**: With `finance.read` and `finance.write`, open Finance tab on a deal with no finance. See "No finance data" and form (Mode, Cash down, Term, APR, First payment date). Set Mode = Finance, term 36, APR 12%, cash down; click "Create finance structure". Expect toast and finance loads; payment summary shows amount financed, monthly payment, total of payments, finance charge, products total, backend gross (formatCents).
- [ ] **Payment fields**: After creating finance (FINANCE mode), change term or APR or cash down, click Save. Totals update; payment summary card shows correct amount financed, monthly payment, total of payments, finance charge.
- [ ] **CASH save → $0**: Set Mode = Cash; click Save. Payment summary shows $0.00 monthly payment and amount financed $0 (or zeros as backend returns). No term/APR sent or displayed for payment.
- [ ] **Add product**: With `finance.write`, click "Add product". Modal: Type (GAP/VSC/…), Name, Price ($), Cost ($) optional, Included in amount financed. Submit → toast "Product added"; products table and payment summary (products total, backend gross) update after refetch.
- [ ] **Edit product**: Edit a product (change name or price); Save → toast; totals recalculate.
- [ ] **Delete product**: Delete product → confirm dialog → toast "Product removed"; totals recalculate.
- [ ] **Status DRAFT → STRUCTURED**: With `finance.write` and deal not CONTRACTED, use Status section "Change to" buttons; select STRUCTURED. Toast; status badge updates.
- [ ] **Invalid status transition**: If backend rejects an invalid transition (e.g. STRUCTURED → CONTRACTED), expect toast with error message.
- [ ] **CONTRACTED lock + CONFLICT**: When deal status is CONTRACTED, Finance tab shows banner "Deal is contracted and finance is locked." Save, Add product, Edit, Delete, and Status change are disabled or hidden. If a write is attempted (e.g. from stale tab), backend returns CONFLICT; UI shows toast and/or banner.
- [ ] **Permission read-only**: With `finance.read` only (no `finance.write`): Finance tab shows data and products; "Save", "Add product", "Edit", "Delete", and Status "Change to" are hidden or show "Not allowed."
- [ ] **Permission no access**: Without `finance.read`: Message "You don't have access to finance." and no finance API calls.
- [ ] **Loading / error / empty**: Tab open → loading skeleton; 404 no finance → empty state with create form if write; API error → error state with retry.
- [ ] **Accessibility**: Finance tab keyboard-focusable; form inputs and table have labels; modals (Add/Edit product, Delete confirm) have focus trap and Escape to close.

### 7.7 Finance Shell Enhancement — Sprint 7

- [ ] **Payment summary side-by-side**: When deal is not CONTRACTED and finance exists (FINANCE mode), Payment summary shows two columns: **Saved** (persisted amounts) and **Current (live)** (recalculated from current form + products). Changing term/APR/cash down or product inclusion updates **Current** immediately without saving. When CONTRACTED, only **Saved** column shown.
- [ ] **Product toggles**: In Products table, when user has `finance.write` and deal not CONTRACTED, each product has a checkbox **Included in amount financed**. Toggling sends PATCH and refetches; Saved and Current totals update. When CONTRACTED, column is read-only (Yes/No text).
- [ ] **APR impact**: When Mode = Finance, an **APR impact** card shows monthly payment at 0% APR, at current APR, and at +3% APR (same amount financed and term). Values match backend formula (BigInt, HALF_UP). When CONTRACTED, section is read-only.
- [ ] **Backend gross visibility**: Backend gross appears in both Saved and Current columns. Current backend gross = sum of (price − cost) for products with cost.
- [ ] **GET finance baseAmountCents**: GET /api/deals/[id]/finance response includes `baseAmountCents` (string, deal total due) for client-side live calculation.
- [ ] **Calculation vector tests**: Run `modules/finance-shell/service/calculations.test.ts`. Canonical vectors: P=$10k 12% 60mo → payment 22244¢; P=$10k 0% 60mo → 16667¢; product inclusion and HALF_UP edges pass.

---

## Documents UI smoke tests (Deal jacket)

- [ ] **Documents tab**: On Deal detail, open the “Documents” tab. With `documents.read`: list loads (GET /api/documents?entityType=DEAL&entityId=…). Without `documents.read`: message “You don’t have access to documents.”
- [ ] **List**: Table shows Doc Type, Title (or —), Filename, Size (KB/MB), Uploaded (date), Actions. Filter by Doc Type dropdown (All types + enum options). Pagination when >25 docs; limit/offset in URL or state.
- [ ] **Upload**: With `documents.write`, “Upload Document” visible. Modal: file picker (accept PDF, JPEG, PNG, WebP), Doc Type (required), Title optional. Client hints: PDF ≤25 MB, images ≤10 MB. Submit → POST /api/documents/upload (multipart); toast success; list refetches.
- [ ] **Download**: “View/Download” → GET signed-url?documentId=… → open URL in new tab. Requires `documents.read`.
- [ ] **Edit**: With `documents.write`, “Edit” opens modal (title, docType, tags comma-separated). PATCH /api/documents/[documentId]; toast; list refetches. Without write: “Not allowed to edit or delete” (or Edit/Delete disabled).
- [ ] **Delete**: With `documents.write`, “Delete” → confirm dialog → DELETE → toast and list refetch. Without write: no Delete or disabled with message.
- [ ] **Permissions**: `documents.read` only: list and View/Download work; Upload hidden; Edit/Delete disabled or message “Not allowed”. No `documents.read`: tab shows “You don’t have access to documents.”
- [ ] **States**: Empty state (message + Upload CTA if write). Loading (skeleton). Error (message + retry). API error shape { error: { code, message } } shown in toast.
- [ ] **Accessibility**: Documents tab keyboard-focusable; table and buttons have accessible names; modal focus trap and Escape to close.
- [ ] **UI safety (Security & QA)**: UI does not display raw storage path (only filename). Signed URL is used only to open in new tab; not logged or exposed in UI. Without `documents.read`, tab shows “You don’t have access to documents.” without calling list API.

---

## Lender Integration UI smoke tests

- [ ] **Nav**: With `lenders.read`, sidebar shows "Lenders" linking to `/lenders`. Without it, link is hidden. Visiting `/lenders` without `lenders.read` shows "You don't have access to lenders." and does NOT call GET /api/lenders.
- [ ] **Lenders directory** (`/lenders`): With `lenders.read`, table shows Name, Type, External system, Active, Actions. Filter "Active only" toggles list. With `lenders.write`: "Create lender" visible; Create modal (name, type, external system, contact email/phone, isActive); Edit modal; Deactivate with confirm (soft disable, not hard delete). Without `lenders.write`: no Create/Edit/Deactivate. Pagination when >25 lenders. Loading skeleton and error state with retry. Empty state with CTA when no lenders.
- [ ] **Deal Lenders tab**: With `finance.submissions.read`, Deal detail shows "Lenders" tab. Without it, tab content shows "You don't have access to lender submissions." and does NOT fetch applications/submissions/stipulations.
- [ ] **Banners**: When deal status is CONTRACTED, tab shows banner "Deal is contracted. Finance structure is locked; submissions can still be tracked." When CANCELED, "Deal is canceled. Submissions are canceled and cannot be updated."
- [ ] **Application**: No application and `finance.submissions.write` and deal not CANCELED → "Create Finance Application" (POST applications). With application: primary applicant (fullName required, email/phone/address); co-applicant toggle; Save application (PATCH). No SSN/DOB fields. Without write: form read-only or hidden.
- [ ] **Lender select**: With `lenders.read`, lenders load (GET /api/lenders?activeOnly=true). Lender dropdown + optional Reserve estimate ($) + "Create submission" when `finance.submissions.write` and application exists and deal not CANCELED. Without `lenders.read`: message "You don't have access to lender directory." and no lender fetch. Create submission: VALIDATION_ERROR → toast "Complete Finance tab first (structure required)."; CONFLICT → server message in toast.
- [ ] **Submissions table**: Columns Lender, Status, Decision, Submitted, Funding, Reserve est., Actions. Row "View" opens detail panel. Pagination. Loading and error with retry. Empty state when no submissions.
- [ ] **Submission detail panel**: (1) Snapshot read-only: amount financed, term, APR %, payment, products total, backend gross (formatCents). (2) Status: with write and not CANCELED, "Next status" dropdown (only valid transitions: DRAFT→READY_TO_SUBMIT/CANCELED, etc.; FUNDED only via Funding panel) → Update status (PATCH). Invalid transition → toast with server error. (3) Decision: decision status, approved term/APR/payment, max advance, notes → Save decision (PATCH). (4) Stipulations: list; Add stipulation (type, status REQUESTED); update status (dropdown); Delete with confirm; Link document: with `documents.read`, modal lists GET /api/documents?entityType=DEAL&entityId=dealId, select doc → PATCH stip documentId. When stip has documentId and `documents.read`: "View document" link opens signed URL in new tab. Without `documents.read`: "Linked" only or "No access to documents" in stip link flow. (5) Funding: with write and not CANCELED, funding status, funded amount ($), reserve final ($) → Save funding (PATCH). CONFLICT when FUNDED without deal CONTRACTED → toast "Deal must be CONTRACTED to mark funded."
- [ ] **Money**: All dollar amounts use formatCents for display; dollar inputs use parseDollarsToCents for submit. No raw storage paths or signed URLs logged.
- [ ] **Accessibility**: Lenders directory and Deal Lenders tab keyboard navigable; table and form inputs have labels; modals (Create/Edit lender, Deactivate, Add stip, Link document, Delete stip) have focus trap and Escape to close; visible focus indicators.

### 6.6 Lender Integration UI — Sprint 6 (backend tests)

- [ ] **Status transition validation**: Run `modules/lender-integration/tests/integration.test.ts` (with TEST_DATABASE_URL). Invalid transition (e.g. SUBMITTED → DRAFT) returns VALIDATION_ERROR; valid transition (e.g. DRAFT → READY_TO_SUBMIT) succeeds. FUNDED only via funding endpoint when deal CONTRACTED.
- [ ] **Cross-tenant access blocked**: Same suite: Dealer A cannot GET/PATCH applications, list/PATCH submissions, PATCH funding, list/add/PATCH/DELETE stipulations for Dealer B deal/application/submission; expect NOT_FOUND or empty list.

---

## CRM UI smoke tests

- [ ] **No crm.read**: Without `crm.read`, visiting any CRM route (`/crm`, `/crm/opportunities`, `/crm/opportunities/[id]`, `/crm/automations`, `/crm/sequences`, `/crm/jobs`) shows "You don't have access to CRM." and does NOT call any `/api/crm/*` endpoints (check network tab).
- [ ] **Nav**: With `crm.read`, sidebar shows CRM Board, Opportunities, Automations, Sequences, Jobs. Without it, those links are hidden.
- [ ] **Pipeline board** (`/crm`): With `crm.read`, board loads (GET pipelines, default pipeline, GET stages, GET opportunities?pipelineId=…&status=OPEN). Stages as columns with count and total value (formatCents). Opportunity cards show customer name, vehicle, age, value, assigned. With `crm.write`: "Move" dropdown on each card to change stage (PATCH opportunity); "New Opportunity" button opens modal (customer, stage, est. value $, assigned to). On success: toast and board refresh. Without `crm.write`: no Move controls, no New Opportunity. Pipeline selector when multiple pipelines. Empty/loading/error states.
- [ ] **Opportunities table** (`/crm/opportunities`): Filters: pipeline, stage, status (OPEN/WON/LOST), search by customer name (client-side on current page). Pagination. Row click → `/crm/opportunities/[id]`. With `crm.write`: quick status (Won/Lost), Move stage dropdown. Without: view only.
- [ ] **Opportunity detail** (`/crm/opportunities/[id]`): Loads opportunity, activity, sequences. Header: title, status badge, stage, assigned, created. Tabs: Overview, Activity, Sequences. Overview: with `crm.write`, edit stage, status, value ($), assigned, notes → Save (PATCH). Activity: timeline (type, timestamp, actor, metadata expand). Sequences: list instances; with `crm.write`, "Start sequence" (select template, POST /opportunities/[id]/sequences); per instance Pause/Resume/Stop (PATCH instance), Skip step (POST skip). Without `crm.write`: read-only message. CONFLICT/error toasts and refresh.
- [ ] **Automations** (`/crm/automations`): List rules (GET automation-rules). Columns: Name, Trigger, Schedule, Active, Actions. With `crm.write`: Create rule (name, trigger event, schedule, isActive, actions); Edit; Delete with confirm. Without: view only.
- [ ] **Sequences** (`/crm/sequences`): List templates (GET sequence-templates). With `crm.write`: Create/Edit template (name, description); Steps button opens steps for template; Add step (type: create_task/send_email/send_sms, title, delay days); Delete step. Without: view only.
- [ ] **Jobs** (`/crm/jobs`): List jobs (GET jobs) with filters status, pagination. Row click → details drawer (attempts, error message, payload summary, runAt, createdAt). With `crm.write`: "Run worker now" (POST /api/crm/jobs/run). 403 → toast "Not allowed"; 429 → "Rate limited". Without: run button hidden.
- [ ] **Accessibility**: CRM pages keyboard navigable; modals focus trap and Escape to close; form inputs and buttons have labels.

### CRM UI security checks

- [ ] **No fetch without crm.read**: With a role that lacks `crm.read`, open any CRM page (e.g. `/crm`, `/crm/jobs`). Confirm message "You don't have access to CRM." In DevTools Network tab, confirm **no** requests to `/api/crm/*`.
- [ ] **No mutation controls without crm.write**: With `crm.read` only, open Pipeline board, Opportunities, Opportunity detail, Automations, Sequences, Jobs. Confirm Move/New Opportunity, status/stage edits, Create/Edit/Delete rules, template/step actions, and "Run worker now" are **hidden or disabled**; no mutation API calls when clicking around.
- [ ] **Job run error toasts**: With `crm.write`, on Jobs page click "Run worker now". If backend returns 403, confirm toast "Not allowed to run worker"; if 429, confirm "Rate limited — try again soon."
- [ ] **Activity metadata plain text**: On Opportunity detail Activity tab, confirm activity metadata (and job payload/error in Jobs drawer) is rendered as **plain text** (e.g. in `<pre>`), not as HTML; no script or image execution from embedded strings.

### Road-to-Sale V2 (Journey bar)

- [ ] **Customer detail — journey bar**: With `crm.read`, open Customer detail (Lead tab). Journey bar shows; stages and current stage (or default pipeline) visible. With `crm.write`, use stage change popover to move customer to another stage; confirm success toast and bar updates. Without `crm.read`, no journey bar fetch (legacy bar or no bar); confirm in Network tab that GET `/api/crm/journey-bar` is not called.
- [ ] **Opportunity detail — journey bar**: With `crm.read`, open Opportunity detail. Journey bar shows; current stage highlighted. With `crm.write`, change stage via popover; confirm toast and bar update. Without `crm.read`, journey bar not shown and no GET `/api/crm/journey-bar` request.
- [ ] **Tenant isolation**: As User A (Dealer 1), open a customer or opportunity and note the ID. As User B (Dealer 2), call GET `/api/crm/journey-bar?customerId=<id>` or `?opportunityId=<id>` (same ID). Expect 404 or “not found” (no data leak). Same for PATCH `/api/crm/customers/[id]/stage` and PATCH `/api/crm/opportunities/[opportunityId]/stage` with that ID as User B: expect 404.
- [ ] **403 without permission**: Without `crm.read`, GET `/api/crm/journey-bar?customerId=<valid-id>` returns 403. Without `crm.write`, PATCH `/api/crm/customers/[id]/stage` or PATCH `/api/crm/opportunities/[opportunityId]/stage` with body `{ "newStageId": "<valid-stage-id>" }` returns 403.

---

## Prerequisites

- `npm run db:migrate` and `npm run db:seed` completed.
- Supabase project with Auth enabled; at least one user (sign up or create in Supabase Dashboard).
- Env: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COOKIE_ENCRYPTION_KEY`.

---

## 1. Auth and session

- [ ] **Sign in** (e.g. via your login page or Supabase Auth).
- [ ] **GET /api/auth/session** (with session cookie): expect `200` and body `{ user: { id, email, ... }, activeDealership: null, permissions: [], platformAdmin: { isAdmin: true|false } }` (no dealership yet).
- [ ] **POST /api/auth/logout**: expect `204`. Then GET /api/auth/session: expect `401` or empty session.

---

## 2. Bootstrap link owner

- [ ] Sign in again. **POST /api/admin/bootstrap-link-owner** (no body, with session cookie): expect `200` and `{ message: "Linked as Owner", membershipId, dealershipId }`.
- [ ] **GET /api/auth/session** again: expect `activeDealership: { id, name }` and `permissions` array with many keys (Owner has all).
- [ ] If your app sets the active-dealership cookie automatically after bootstrap, confirm session now shows activeDealership. Otherwise call **PATCH /api/auth/session/switch** with body `{ "dealershipId": "<demo-dealership-id>" }` (get id from seed output or GET /api/admin/dealership after step 3).

---

## 3. Admin — Dealership

- [ ] **GET /api/admin/dealership** (with session + active dealership): expect `200`, `dealership` and `locations`.
- [ ] **PATCH /api/admin/dealership** with body `{ "name": "Updated Demo" }`: expect `200` and updated name.
- [ ] **GET /api/admin/dealership/locations**: expect `{ data, meta }` with pagination.
- [ ] **POST /api/admin/dealership/locations** with body `{ "name": "Second Lot", "city": "Boston" }`: expect `201` and created location.
- [ ] **PATCH /api/admin/dealership/locations/<location-id>** with body `{ "city": "Cambridge" }`: expect `200` and updated location.

---

## 4. Admin — Memberships

- [ ] **GET /api/admin/memberships**: expect list including the Owner.
- [ ] **POST /api/admin/memberships** with body `{ "email": "<another-user-email>", "roleId": "<Sales-role-id>" }` (user must already exist in Supabase/Profile): expect `200`/`201` and membership.
- [ ] **GET /api/admin/memberships/<membership-id>**: expect single membership with user and role.
- [ ] **PATCH /api/admin/memberships/<membership-id>** with body `{ "roleId": "<Finance-role-id>" }`: expect `200`.
- [ ] **DELETE /api/admin/memberships/<membership-id>** (use a membership you can afford to disable): expect `204`.

---

## 5. Admin — Roles and permissions

- [ ] **GET /api/admin/roles**: expect list (Owner, Admin, Sales, Finance).
- [ ] **POST /api/admin/roles** with body `{ "name": "Custom", "permissionIds": ["<permission-id-1>", "<permission-id-2>"] }`: expect `201`.
- [ ] **GET /api/admin/roles/<role-id>**: expect role with permissions.
- [ ] **PATCH /api/admin/roles/<custom-role-id>** with body `{ "name": "Custom Updated" }`: expect `200`.
- [ ] **GET /api/admin/permissions**: expect full catalog (optionally ?module=admin).

---

## 6. Audit

- [ ] **GET /api/audit**: expect `{ data, meta }` with audit rows (e.g. dealership.updated, membership.role_changed).
- [ ] **GET /api/audit?entity=Membership&action=membership.role_changed**: expect filtered list.

---

## 6.5 Platform Admin

- [ ] **Non-admin cannot access platform routes**: As a user who is **not** a platform admin, call **GET /api/platform/dealerships** (or any `/api/platform/*` route) with a valid session. Expect **403 Forbidden** and error body `{ error: { code: "FORBIDDEN", ... } }`.
- [ ] **Platform admin can manage dealerships**: As a platform admin, **GET /api/platform/dealerships** returns 200 with list; **POST** to create dealership; **POST .../disable** and **POST .../enable** to disable/enable a dealership.
- [ ] **Platform admin can manage members**: As platform admin, **GET /api/platform/dealerships/[id]/members**, **POST** to add member (email + roleId), **PATCH .../members/[membershipId]** to update role or disable/enable membership.
- [ ] **Impersonate sets cookie and session**: As platform admin, **POST /api/platform/impersonate** with body `{ "dealershipId": "<uuid>" }`. Expect 204; active-dealership cookie is set. **GET /api/auth/session** shows `activeDealership` as the impersonated dealership and `platformAdmin: { isAdmin: true }`. After impersonation, tenant routes (e.g. GET /api/customers, GET /api/deals) use that dealership as context.
- [ ] **Tenant routes still require membership for non–platform-admin**: As a normal user (no platform admin), tenant routes resolve active dealership only from cookie + membership; switching cookie to another dealership without membership returns 403. Platform admin with impersonation can use the app as the impersonated dealership without being a member.
- [ ] **Seed**: Platform admins are seeded from **SUPERADMIN_EMAILS** (or **PLATFORM_ADMIN_EMAILS** if unset), comma-separated; ensure env is set and `npm run db:seed` has run so platform admin users exist for smoke tests.

---

## 7. Files

- [ ] **POST /api/files/upload** (multipart/form-data): field `file` = a small PDF or image; optional `bucket` = `deal-documents` or `inventory-photos`. Expect `200` and `{ id, bucket, path, filename, mimeType, sizeBytes, createdAt }`.
- [ ] **GET /api/files/signed-url?fileId=<file-id>**: expect `200` and `{ url, expiresAt }`. Open URL in browser; file should download or display.
- [ ] **GET /api/audit** and filter for `file.uploaded` and `file.accessed`: expect corresponding rows.

---

## 8. Tenant isolation (optional)

- [ ] Create a second dealership and membership for another user. As User A (Dealer 1), call **GET /api/admin/memberships** — ensure no members from Dealer 2 appear. As User A, try **GET /api/admin/memberships/<membership-id-of-dealer-2>** with a Dealer 2 membership id: expect `404` or `403` (tenant scoping).

---

## 9. RBAC (optional)

- [ ] As a user with **Sales** role only, call **PATCH /api/admin/dealership** or **POST /api/admin/roles**: expect `403 Forbidden`.
- [ ] As Sales, **GET /api/admin/dealership** (admin.dealership.read): expect `403` unless Sales has that permission in your seed; if Sales has no admin.*, confirm.

---

## 10. Security & QA (optional)

- [ ] **Session switch forbidden**: As User A (member of Dealer 1 only), call **PATCH /api/auth/session/switch** with body `{ "dealershipId": "<dealer-2-id>" }`. Expect `403` and no active-dealership cookie set.
- [ ] **Rate limiting**: Rapidly call **PATCH /api/auth/session/switch** or **POST /api/files/upload** many times; expect `429` after the limit.
- [ ] **File upload validation**: POST a file with disallowed MIME (e.g. `.exe`) or over 25MB; expect `400` with message about type or size.

---

## 11. Curl examples (no browser)

```bash
# Session (after signing in; use cookie from browser or Supabase session)
curl -s -b "sb-...-auth-token=..." http://localhost:3000/api/auth/session

# Bootstrap (replace with your session cookie)
curl -X POST -b "sb-...-auth-token=..." http://localhost:3000/api/admin/bootstrap-link-owner

# Switch dealership (get dealershipId from seed or GET /api/admin/dealership)
curl -X PATCH -H "Content-Type: application/json" -b "..." -d '{"dealershipId":"<uuid>"}' http://localhost:3000/api/auth/session/switch

# Upload file
curl -X POST -b "..." -F "file=@/path/to/file.pdf" -F "bucket=deal-documents" http://localhost:3000/api/files/upload
```

---

Complete all steps and check off each item. If any step fails, note the route, expected vs actual response, and fix before considering the smoke test passed.
