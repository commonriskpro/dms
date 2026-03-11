# User UI Integrity Sweep V1 — Spec

## Goal

Verify that all user-facing buttons, links, primary actions, and key interaction controls in the Dealer app work as intended. Identify and fix broken controls, dead CTAs, missing handlers, bad routing, disabled-state bugs, and permission-gating mismatches.

This is a QA + hardening program, not a redesign sprint.

---

## 1. Test Surface Inventory

### 1.1 Global Shell

| Surface | Component(s) | Key Controls |
|---|---|---|
| Sidebar navigation | `AppSidebar`, `SidebarItem`, `SidebarItemExpandable` | 14 nav items, permission-gated per `navigation.config.ts`, expandable sub-items (Inventory → List/Aging, etc.) |
| Topbar | `TopCommandBar` | GlobalSearch, Quick Create dropdown (Add Vehicle / Add Lead / New Deal — each permission-gated), Theme Toggle, Notifications bell, Sign Out, Active Dealership badge, Lifecycle Status badge |
| Command Palette | `CommandPalette` | Cmd/Ctrl+K toggle, Navigate group (8 routes), Create group (3 routes: Add Prospect, Add Vehicle, Start Deal) |
| Modal Shell | `ModalShell` | Close button, escape key, backdrop click, error/retry states |
| Confirm Dialog | `ConfirmDialogProvider` | Confirm / Cancel pattern used across destructive actions |
| Error Boundary | `error.tsx` root | Retry action |
| Banners | `SuspendedBanner`, `UnverifiedEmailBanner`, `SupportSessionBanner` | Conditional display, action links |

### 1.2 Inventory

| Surface | Component(s) | Key Controls |
|---|---|---|
| List page | `InventoryPageContentV2`, `InventoryListContent` | Quick-filter chips (7), view mode toggle (table/cards), advanced filters dialog, import history dialog |
| Table view | `VehicleInventoryTable` | Search input, status select, + dropdown (Add Vehicle, Advanced Filters), row click → detail, per-row View/Edit buttons, pagination |
| Card view | `VehicleCardGrid` | Card click → detail, Start Deal button per card |
| Add vehicle | `AddVehiclePage`, `VinDecodeBar`, `AddVehicleFooter` | VIN decode, Scan VIN (no-op), form inputs, Cancel / Save Draft / Save & Add Another / Create Vehicle buttons |
| Edit vehicle | `EditVehicleUi` | 8 tabs (Vehicle Info, Media, Market Data, Cost Ledger, Activities, Files, Logs, Marketing), Save / Save & Close / Create Deal / Print buttons (mock — **no handlers wired**), Manage media dialog, media manager |
| Vehicle detail | `VehicleDetailPage`, `VehiclePageHeader`, `VehicleDetailTabs` | Back link, Print button, Edit Vehicle button, tab switching (Overview/Details/Cost/Media/Pricing/Recon/History) |
| Vehicle detail modal | `VehicleDetailModalClient` | ModalShell wrapping `VehicleDetailContent`, error retry |
| Overview card | `VehicleOverviewCard` | Photo carousel (prev/next/dots) |
| Quick actions | `VehicleDetailQuickActionsCard` | Edit, Upload Photos, Create Deal links |
| Recon card | `VehicleReconCard` | Start recon, status select, due date, add/edit/delete line items (full CRUD) |
| Floorplan card | `VehicleFloorplanCard` | Add floorplan form, record curtailment, store payoff quote |
| Specs/VIN card | `VehicleSpecsVinCard` | Decode VIN button |
| Valuations | `VehicleValuationsCard`, `VehicleValuationCard` | Get value form, Recalculate button |
| Pricing automation | `VehiclePricingAutomationCard` | Preview adjustment, Apply adjustment |
| Marketing/distribution | `VehicleMarketingDistributionCard` | Publish, Unpublish per channel |
| Photos manager | `VehiclePhotosManager` | Upload (file input + drag-drop), drag-reorder, set primary, delete photo |
| Cost tab | `CostsTabContent`, `CostLedgerCard`, `CostTotalsCard` | Add/edit/delete cost entries, search/category/vendor filters, export button (**no handler**), View breakdown (**no handler**), pagination (**disabled/static**) |
| Acquisition summary | `AcquisitionSummaryCard` | Edit button (opens cost entry modal) |
| Documents rail | `DocumentsRailCard` | Upload document, tab filters, view document (signed URL), remove document, Add Note (**no handler**) |
| Costs full page | `VehicleCostsFullPage`, `VehicleCostsPageHeader` | Back link, Print (**no handler on full-page variant**), Edit links, tab navigation |
| Aging page | `AgingPage` | Status/sort/order selects, row click → detail, pagination |
| Pricing rules | `PricingRulesManager`, `PricingRuleForm` | Create/edit pricing rules (dialog form with inputs, submit) |
| Appraisals | `AppraisalsPageClient`, `AppraisalForm` | Create appraisal button, filter controls |
| Auctions | `AuctionSearchBar`, `AuctionResults` | Search (provider, VIN, make/model/year), Create appraisal per listing |
| Auction purchases | `AuctionPurchasesPageClient` | Create purchase, per-row status change, vehicle link, pagination |
| Acquisition leads | `AcquisitionPageClient`, `AcquisitionLeadForm` | Create lead, search, source filter, apply filters |
| Inventory KPIs | `InventoryKpis`, `InventoryQuickActionsCard`, `InventoryAlertsCard` | Alert links, Add Vehicle / Add Lead / Start Deal CTAs |

### 1.3 Customers / CRM

| Surface | Component(s) | Key Controls |
|---|---|---|
| Customer list | `CustomersPageClient`, `CustomersListPage`, `CustomersTableCard` | KPI cards (5), status chips (5), view toggle, New Customer link, table row click, per-row View/Edit, sort columns, pagination |
| Card view | `CustomerCardGrid` | View / Edit per card |
| Filter/search bar | `CustomersFilterSearchBar` | Search input (debounced), saved filters dropdown, saved searches dropdown, Manage dialog, Save current view dialog, source/status filters, Add Customer CTA |
| Saved search dialogs | `SaveSearchDialog`, `SaveFilterDialog`, `ManageSearchesDialog` | Create/update/delete saved searches and filters |
| Customer detail | `DetailPage` | Back link, Edit / Delete buttons, edit form dialog, delete confirm, stage change dialog |
| Customer detail modal | `CustomerDetailModalClient` | ModalShell wrapping detail content |
| Create customer | `CreateCustomerPage`, `CustomerForm` | Form inputs (name, status, phones, emails, addresses, tags), submit |
| Lead action strip | `LeadActionStrip` | Call (tel:), Send SMS, Send email, Schedule Appointment, Add Task, Disposition |
| Communication dialogs | `SmsDialog`, `EmailDialog` | Send SMS / email forms |
| Appointment dialog | `ScheduleAppointmentDialog` | Date/time, notes, schedule |
| Disposition dialog | `DispositionDialog` | Status select, follow-up task, save |
| Notes | `NotesTab`, `NotesCard`, `AddNoteDialog` | Add/edit/delete notes, pagination |
| Tasks | `TasksTab`, `TasksCard`, `AddTaskDialog`, `TasksPanel` | Add/complete/delete tasks, filter (All/Pending/Completed), pagination |
| Callbacks | `CallbacksCard` | Schedule/done/snooze/cancel callbacks, schedule dialog, snooze dialog |
| Timeline | `TimelineCard`, `ActivityTimeline` | Add note, log call (dialog), load more, filter pills (9) |
| Activity tab | `ActivityTab` | Expand/collapse metadata, pagination |
| Next actions | `NextActionsCard`, `NextActionZone` | Open conversation, Call, Text, Email, Schedule, Add task, Disposition links/buttons |
| Active opp/deal | `ActiveOpportunityDealCard` | Deal / Opportunity links |
| Summary cards | `CustomersSummaryCards`, `CustomersSummaryCardsRow` | Link cards to filtered lists |
| Dashboard widget | `DashboardCustomersWidget` | Metric card links, stage buttons |
| CRM Board | `CrmBoardPage`, `StageColumn` | Pipeline select, New Opportunity button, create dialog, card click → detail, Move stage select |
| Opportunities table | `OpportunitiesTablePage` | Search, pipeline/stage/status selects, Apply, row click, Won/Lost quick actions, Move stage, pagination |
| Opportunity detail | `OpportunityDetailPage` | Back button, Overview/Activity/Sequences tabs, save overview, start/pause/resume/stop sequences, skip steps |
| Sequences | `SequencesPage` | Create/edit/delete templates, add/delete steps (dialogs), pagination |
| Automation rules | `AutomationRulesPage` | Create/edit/delete rules (dialogs), pagination |
| Jobs | `JobsPage` | Run worker button, search, status filter, row inspect toggle, pagination |
| Journey bar | `JourneyBarWidget` | Stage segment click → stage change |
| Inbox | `InboxPageClient` | Conversation list, view customer link, send SMS/email dialogs |

### 1.4 Deals

| Surface | Component(s) | Key Controls |
|---|---|---|
| Deals list | `DealsPage`, `DealsListPage`, `DealsTableCard` | New Deal link, status filter, advanced filters, row click → detail, per-row View/Edit, pagination |
| Summary cards | `DealsSummaryCards` | Links to filtered deal lists |
| Create deal | `CreateDealPage` | Customer/Vehicle selects, sale price/tax/doc-fee/down-payment inputs, Create deal / Cancel |
| Deal detail | `DealDetailPage` | 12 tabs, overview structure edit + save, fees CRUD, trade CRUD, status change buttons (STRUCTURED/APPROVED/CONTRACTED/CANCELED), delete deal, cancel deal confirm |
| Deal detail modal | `DealDetailModalClient` | ModalShell wrapping detail, error retry |
| Deal desk | `DealDeskWorkspace`, `DealHeader` | Save deal, notes textarea, selling price, stage change, tabs (Activity/Audit/Documents) |
| Desk sub-cards | `CustomerCard`, `VehicleCard`, `FeesCard`, `TradeCard`, `ProductsCard`, `FinanceTermsCard` | View profile/vehicle links, fee/trade/product CRUD inline, finance term inputs |
| Deal progress | `DealProgressStrip`, `DealNextActionLine` | Delivery & Funding link, Title queue link, dynamic action link |
| Title/DMV tab | `DealTitleDmvTab` | Start title, status transitions (sent/received/completed/hold), create DMV checklist, checklist toggles, view title queue link |
| Delivery/Funding tab | `DealDeliveryFundingTab` | Mark ready / delivered / funded, create funding form, queue links |
| Finance tab | `DealFinanceTab` | Mode select, term/APR/down inputs, Save, status change, add/edit/delete products |
| Documents tab | `DealDocumentsTab` | Upload, type filter, view/download, edit metadata, delete |
| Lenders tab | `DealLendersTab` | Create application, save application, create submission, submission detail panel (status/decision/funding/stipulations CRUD) |
| Credit tab | `DealCreditTab` | Read-only display |
| Compliance tab | `DealComplianceTab` | Generate form, per-form status select |
| Document vault | `DealDocumentVaultTab` | Upload/download/delete documents |
| Delivery queue | `DeliveryQueuePage` | Search, status filter, row View, pagination |
| Funding queue | `FundingQueuePage` | Search, status filter, row View, pagination |
| Title queue | `TitleQueuePage` | Search, status filter, row View, pagination |

### 1.5 Reports / Admin / Supporting Pages

| Surface | Component(s) | Key Controls |
|---|---|---|
| Dealer profit report | `DealerProfitReportPage` | Date range picker, Export CSV |
| Salesperson report | `SalespersonPerformanceReportPage` | Date range picker, Export CSV, pagination |
| Inventory ROI report | `InventoryRoiReportPage` | Date range picker, Export CSV |
| Accounting: Accounts | `AccountsPageClient` | Add account dialog |
| Accounting: Transactions | `TransactionsPageClient` | Date range + Download CSV export |
| Accounting: Expenses | `ExpensesPageClient` | Add expense dialog |
| Admin: Dealership | `DealershipPage` | Save name, add/edit locations (dialog) |
| Admin: Roles | `RolesPage` | Create/edit/delete roles, permissions checklist |
| Admin: Users | `UsersPage` | Invite, status/role filters, edit role, disable member |
| Admin: Audit | `AuditPage` | Filter (action/entity/dates), Apply, expand metadata, pagination |
| Files | `FilesPage` | Upload, get signed URL, open link |
| Vendors list | `VendorsListPage` | Create/edit/remove vendor (dialogs), search, type filter, include-removed toggle |
| Vendor detail | `VendorDetailPage` | Back, Edit vendor, cost entry vehicle links |
| Lenders directory | `LendersDirectoryPage` | Create/edit/deactivate lender (dialogs), active-only filter, pagination |
| Settings | `SettingsContent`, `SessionsBlock` | Section nav, profile/dealership/notifications/security inputs (mostly disabled/coming-soon), revoke sessions |
| Settings modal | `SettingsModal` | ModalShell wrapping settings content |
| Dashboard | `DashboardExecutiveClient`, `QuickActionsCard`, `DashboardCustomizePanel` | Metric card links, quick actions, widget visibility toggles, reorder, save/cancel/reset layout |

---

## 2. Priority Matrix

### P0 — Critical Actions (must work)

These are the actions that, if broken, block core user workflows.

| Domain | Action | Component |
|---|---|---|
| **Global** | Sidebar nav → all main routes | `AppSidebar` |
| **Global** | Quick Create → Add Vehicle / Add Lead / New Deal | `TopCommandBar` |
| **Global** | Command palette open + navigate/create | `CommandPalette` |
| **Global** | Sign Out | `TopCommandBar` |
| **Inventory** | Add Vehicle (create + submit) | `AddVehiclePage` |
| **Inventory** | Vehicle detail open (table row click + modal) | `VehicleInventoryTable`, `VehicleDetailModalClient` |
| **Inventory** | Edit Vehicle open | `VehiclePageHeader`, `VehicleDetailQuickActionsCard` |
| **Inventory** | Save/submit vehicle form | `VehicleForm` |
| **Inventory** | Tab switching on vehicle detail | `VehicleDetailTabs`, `VehiclePageHeader` |
| **Inventory** | Photo upload | `VehiclePhotosManager` |
| **Inventory** | Cost entry CRUD (add/edit/delete) | `CostsTabContent`, `CostLedgerCard` |
| **Inventory** | Start Deal from vehicle | `VehicleCardGrid`, `VehicleDetailQuickActionsCard` |
| **Customers** | New Customer (create + submit) | `CreateCustomerPage`, `CustomerForm` |
| **Customers** | Customer detail open (row click + modal) | `CustomersTableCard`, `CustomerDetailModalClient` |
| **Customers** | Edit customer | `DetailPage` edit dialog |
| **Customers** | Delete customer | `DetailPage` delete confirm |
| **CRM** | New Opportunity (create + submit) | `CrmBoardPage` create dialog |
| **CRM** | Opportunity detail open | `OpportunitiesTablePage` row click |
| **Deals** | New Deal (create + submit) | `CreateDealPage` |
| **Deals** | Deal detail open (row click + modal) | `DealsListPage`, `DealDetailModalClient` |
| **Deals** | Save deal structure | `DealDetailPage` overview save |
| **Deals** | Deal status change (STRUCTURED → APPROVED → CONTRACTED) | `DealDetailPage`, `DealHeader` |
| **Deals** | Deal desk save | `DealDeskWorkspace` |
| **Deals** | Delete deal | `DealDetailPage` delete confirm |
| **Admin** | Save dealership name | `DealershipPage` |
| **Admin** | Create/edit roles | `RolesPage` |
| **Admin** | Invite user | `UsersPage` |

### P1 — High-Value Daily Actions

| Domain | Action | Component |
|---|---|---|
| **Inventory** | Search/filter inventory | `VehicleInventoryTable`, `InventoryFilterBar` |
| **Inventory** | View mode toggle (table/cards) | `InventoryListContent` |
| **Inventory** | VIN decode (add + detail) | `VinDecodeBar`, `VehicleSpecsVinCard` |
| **Inventory** | Recon line item CRUD | `VehicleReconCard` |
| **Inventory** | Floorplan add/curtailment/payoff | `VehicleFloorplanCard` |
| **Inventory** | Pricing preview + apply | `VehiclePricingAutomationCard` |
| **Inventory** | Publish/unpublish vehicle | `VehicleMarketingDistributionCard` |
| **Inventory** | Photo reorder + set primary + delete | `VehiclePhotosManager` |
| **Inventory** | Document upload/view/delete | `DocumentsRailCard` |
| **Inventory** | Pricing rules CRUD | `PricingRulesManager` |
| **Inventory** | Appraisal create | `AppraisalsPageClient` |
| **Inventory** | Auction search + create appraisal | `AuctionSearchBar`, `AuctionResults` |
| **Inventory** | Acquisition lead CRUD | `AcquisitionPageClient` |
| **Inventory** | Aging page filters + row click | `AgingPage` |
| **Customers** | Status chip filter | `CustomersPageClient` |
| **Customers** | Search customers (debounced) | `CustomersFilterSearchBar` |
| **Customers** | Saved searches CRUD | `SaveSearchDialog`, `ManageSearchesDialog` |
| **Customers** | Send SMS / Send email | `SmsDialog`, `EmailDialog` |
| **Customers** | Schedule appointment | `ScheduleAppointmentDialog` |
| **Customers** | Add task / complete task | `AddTaskDialog`, `TasksTab` |
| **Customers** | Add note | `AddNoteDialog`, `NotesTab` |
| **Customers** | Disposition | `DispositionDialog` |
| **Customers** | Callbacks (schedule/done/snooze/cancel) | `CallbacksCard` |
| **Customers** | Stage change | `DetailPage` stage dialog |
| **Customers** | Timeline (add note, log call, load more) | `TimelineCard` |
| **CRM** | Move opportunity stage (board + table) | `StageColumn`, `OpportunitiesTablePage` |
| **CRM** | Won/Lost quick actions | `OpportunitiesTablePage` |
| **CRM** | Save opportunity overview | `OpportunityDetailPage` |
| **CRM** | Sequence start/pause/resume/stop | `OpportunityDetailPage` |
| **CRM** | Inbox send SMS/email | `InboxPageClient` |
| **Deals** | Fees CRUD | `DealDetailPage` fees tab |
| **Deals** | Trade add/edit/remove | `DealDetailPage` trade tab, `TradeCard` |
| **Deals** | Finance structure save | `DealFinanceTab` |
| **Deals** | Finance products CRUD | `DealFinanceTab` |
| **Deals** | Title process actions | `DealTitleDmvTab` |
| **Deals** | Delivery/Funding actions | `DealDeliveryFundingTab` |
| **Deals** | Lender application + submission | `DealLendersTab` |
| **Deals** | Deal documents upload/view/delete | `DealDocumentsTab`, `DealDocumentVaultTab` |
| **Deals** | Compliance form generate | `DealComplianceTab` |
| **Reports** | Date range picker | All report pages |
| **Reports** | Export CSV | All report pages |
| **Admin** | Add/edit location | `DealershipPage` |
| **Admin** | Edit user role / disable user | `UsersPage` |
| **Vendors** | Create/edit/remove vendor | `VendorsListPage` |
| **Lenders** | Create/edit/deactivate lender | `LendersDirectoryPage` |

### P2 — Secondary Actions

| Domain | Action | Component |
|---|---|---|
| **Inventory** | Import history dialog | `InventoryPageContentV2` |
| **Inventory** | Print cost ledger | `VehiclePageHeader` |
| **Inventory** | Valuation request + recalculate | `VehicleValuationsCard`, `VehicleValuationCard` |
| **Inventory** | Auction purchase status change | `AuctionPurchasesPageClient` |
| **Customers** | Activity tab expand/collapse metadata | `ActivityTab` |
| **Customers** | Activity timeline filter pills | `ActivityTimeline` |
| **Customers** | Customer card view (vs table) | `CustomerCardGrid` |
| **CRM** | Sequence templates CRUD | `SequencesPage` |
| **CRM** | Automation rules CRUD | `AutomationRulesPage` |
| **CRM** | Jobs page (run worker, inspect) | `JobsPage` |
| **CRM** | Journey bar stage click | `JourneyBarWidget` |
| **Deals** | Deal desk sub-card links (view profile, view vehicle) | `CustomerCard`, `VehicleCard` |
| **Deals** | Deal progress strip links | `DealProgressStrip` |
| **Deals** | Deal next action line | `DealNextActionLine` |
| **Deals** | Lender submission detail panel (stipulations CRUD) | `DealLendersTab` |
| **Accounting** | Add account / Add expense | `AccountsPageClient`, `ExpensesPageClient` |
| **Accounting** | Download CSV export | `TransactionsPageClient` |
| **Admin** | Audit log filters + expand | `AuditPage` |
| **Files** | Upload + signed URL | `FilesPage` |
| **Settings** | Section navigation | `SettingsContent` |
| **Settings** | Revoke sessions | `SessionsBlock` |
| **Dashboard** | Customize panel (visibility/reorder/save/reset) | `DashboardCustomizePanel` |
| **Dashboard** | Metric card links | `DashboardExecutiveClient` |
| **Dashboard** | Quick actions (Add Vehicle / Add Lead / Start Deal) | `QuickActionsCard` |
| **Global** | Theme toggle | `TopCommandBar` |
| **Global** | Notifications bell | `TopCommandBar` |

---

## 3. Integrity-Check Method

For each action under audit, verify:

| Check | Description |
|---|---|
| **Visibility** | Control is visible when expected based on route and user state |
| **Permission gating** | Control is hidden or disabled for users without required permission; `WriteGuard` wraps mutation controls |
| **Enabled/disabled** | Control is enabled when actionable, disabled during loading/submitting/locked states, disabled at pagination bounds |
| **Click behavior** | `onClick` / `onSubmit` / `href` fires the correct handler; no dead buttons |
| **Route/navigation** | `router.push()` / `Link href` navigates to the correct path; no stale hrefs, no incorrect redirects |
| **Mutation behavior** | POST/PATCH/DELETE hits the correct API endpoint with correct payload; response is handled |
| **Modal/dialog flow** | Dialog opens on trigger, closes on cancel/escape/backdrop; form inside dialog submits correctly |
| **Success handling** | On mutation success: toast/feedback shown, data refreshed/refetched, UI reflects new state |
| **Error handling** | On mutation error: error message shown, form not cleared, user can retry |
| **Loading state** | Submit button shows loading indicator, is disabled during submission, re-enables on completion |
| **Stale UI** | After mutation, list/detail data is refreshed; no stale cache showing old data |
| **Console errors** | No uncaught errors, unhandled promise rejections, or handler failures in console |

---

## 4. Execution Strategy

### Primary method: Code audit + targeted fixes

1. **Static code audit** — Read each component's source to identify:
   - Buttons/controls with no `onClick` or empty handlers
   - `href` values that don't match valid routes
   - Missing `WriteGuard` or permission checks on mutation controls
   - Missing loading/disabled states on submit buttons
   - Missing error handling on `fetch` / `apiFetch` calls
   - Stale references (wrong API paths, removed routes)

2. **Targeted Jest/RTL tests** — For high-value interaction paths:
   - Button renders and fires correct handler on click
   - Permission-gated button hidden when permission absent
   - Form submit calls correct API endpoint
   - Modal open/close lifecycle
   - Error state renders retry button

3. **Route/API validation** — Cross-reference:
   - Every `router.push()` / `Link href` target matches an existing page route
   - Every `fetch("/api/...")` target matches an existing API route
   - Every permission string used in UI matches the RBAC system

4. **Manual verification checklist** — For flows not practical in Jest:
   - Full navigation flow (sidebar → page → detail → back)
   - Multi-step dialog chains (create → save → refresh)
   - File upload end-to-end
   - Real-time data refresh after mutation

### Out of scope for this sprint
- No Playwright/Cypress E2E framework
- No cross-browser matrix testing
- No visual regression testing
- No performance benchmarking beyond interaction sanity

---

## 5. Failure Categories

| Code | Category | Description |
|---|---|---|
| **FC-1** | Dead control | Button/link renders but has no handler, empty onClick, or is wired to a no-op |
| **FC-2** | Wrong route | `router.push()` or `href` points to a non-existent or incorrect route |
| **FC-3** | Wrong permission gating | Control visible to users who shouldn't see it, or hidden from users who should |
| **FC-4** | Missing handler | Control references a handler function that doesn't exist or isn't connected |
| **FC-5** | Disabled-state bug | Button stuck disabled when it should be enabled, or enabled when it should be disabled |
| **FC-6** | Mutation success broken | API call succeeds but UI doesn't refresh, toast not shown, or stale data persists |
| **FC-7** | Mutation error broken | API call fails but no error message shown, or form state lost on error |
| **FC-8** | Stale UI after action | Data not refetched after create/update/delete; user sees old state |
| **FC-9** | Modal/dialog flow bug | Dialog doesn't open, doesn't close, closes prematurely, or form state leaks between opens |
| **FC-10** | Upload action bug | File input doesn't trigger, upload fails silently, or success not reflected |
| **FC-11** | Tab/section flow bug | Tab doesn't switch, wrong content shown, or tab state not preserved |

---

## 6. Slice Plan

### SLICE A — Integrity Sweep Spec + Action Inventory
**Status:** This document.

**Acceptance criteria:**
- Complete action inventory by page/domain
- Priority matrix (P0/P1/P2) defined
- Integrity-check method defined
- Failure categories defined
- Slice plan with acceptance criteria

---

### SLICE B — Critical Action Audit/Fix (P0)

Audit and fix the highest-risk user actions.

**Scope:** All P0 actions listed in §2.

**Work items:**
1. Sidebar navigation — verify all 14 nav items route correctly
2. Topbar Quick Create — verify all 3 actions navigate to correct route with permission gating
3. Command palette — verify all navigate/create commands
4. Sign out — verify POST to `/api/auth/logout` and redirect
5. Inventory: Add Vehicle — verify full create flow (VIN decode, form inputs, submit, redirect)
6. Inventory: Vehicle detail open — verify table row click, modal open, full-page open
7. Inventory: Edit Vehicle — verify edit button opens correct route; **identify and document mock/dead buttons in `EditVehicleUi`**
8. Inventory: Tab switching — verify all tabs on vehicle detail
9. Inventory: Photo upload — verify file input triggers, upload succeeds, UI refreshes
10. Inventory: Cost entry CRUD — verify add/edit/delete with correct API calls
11. Inventory: Start Deal from vehicle — verify route includes `vehicleId` param
12. Customers: Create + detail + edit + delete — verify full lifecycle
13. CRM: New Opportunity — verify create dialog, submit, data refresh
14. Deals: Create + detail + status change + delete — verify full lifecycle
15. Deals: Deal desk save — verify save triggers correct API
16. Admin: Dealership save, role CRUD, invite user — verify form submissions

**Acceptance criteria:**
- All P0 actions verified functional or documented as intentionally deferred
- Dead controls identified and either fixed or documented
- Missing handlers connected or documented
- Permission gating verified correct

---

### SLICE C — High-Value Action Audit/Fix (P1)

**Scope:** All P1 actions listed in §2.

**Work items:**
1. Inventory: Search/filter controls, VIN decode, recon CRUD, floorplan, pricing, publishing, photo management, document management, pricing rules, appraisals, auctions, acquisition, aging
2. Customers: Filters, search, saved searches, communication dialogs (SMS/email/appointment), tasks, notes, callbacks, stage change, timeline
3. CRM: Stage move, won/lost, save overview, sequences, inbox
4. Deals: Fees CRUD, trade CRUD, finance, products, title, delivery, funding, lenders, documents, compliance
5. Reports: Date picker, export CSV
6. Admin: Locations, user management
7. Vendors/Lenders: CRUD dialogs

**Acceptance criteria:**
- All P1 actions verified functional or documented
- Dialog open/close/confirm flows work correctly
- Inline editing flows complete correctly
- Upload actions work end-to-end where handler is connected

---

### SLICE D — Secondary Action Audit/Fix (P2)

**Scope:** All P2 actions listed in §2.

**Work items:**
1. Import history, print, valuations, auction purchases
2. Activity filters, card view, sequences CRUD, automation rules, jobs
3. Deal desk sub-links, progress strip, stipulations
4. Accounting, audit, files, settings, dashboard customization
5. Theme toggle, notifications bell

**Acceptance criteria:**
- All P2 actions verified or documented
- Intentionally stubbed actions clearly documented
- No silent no-ops — either working or labeled

---

### SLICE E — Docs / Checklist / Reporting

Create `USER_UI_INTEGRITY_SWEEP_V1_REPORT.md`:
- Pages/domains checked
- Actions verified (pass/fail/deferred)
- Bugs found with failure category codes
- Fixes applied with file references
- Intentionally deferred/non-functional actions
- Manual checklist for flows not covered by automated tests

**Acceptance criteria:**
- Report covers every domain in §1
- Every P0 action has a pass/fail/deferred status
- Every bug has a failure category code
- Manual checklist is actionable

---

### SLICE F — Tests / Hardening / Final Report

Add/update focused interaction tests:
- Button click behavior verification
- Route transition verification
- Modal open/close lifecycle
- Mutation success/error handling
- Permission-gated button visibility

Create `USER_UI_INTEGRITY_SWEEP_V1_FINAL_REPORT.md`:
- Changed files list
- Tests run + results
- Coverage breakdown (automated / manually verified / deferred)
- Unrelated failures separated

**Acceptance criteria:**
- High-value P0 actions have test coverage
- Tests pass with `npm run test:dealer`
- Final report clearly states coverage achieved

---

## 7. Deliverables

| # | Deliverable | File |
|---|---|---|
| 1 | This spec | `apps/dealer/docs/USER_UI_INTEGRITY_SWEEP_V1_SPEC.md` |
| 2 | Action inventory | §1 of this spec |
| 3 | P0/P1/P2 action bug fixes | Code changes in affected components |
| 4 | Focused interaction tests | `__tests__/` directories adjacent to affected modules |
| 5 | Manual integrity checklist | §E of report |
| 6 | Security QA report | `apps/dealer/docs/USER_UI_INTEGRITY_SWEEP_V1_SECURITY_QA.md` |
| 7 | Performance notes | `apps/dealer/docs/USER_UI_INTEGRITY_SWEEP_V1_PERF_NOTES.md` |
| 8 | Final report | `apps/dealer/docs/USER_UI_INTEGRITY_SWEEP_V1_FINAL_REPORT.md` |

---

## 8. Known Dead/Stub Controls (Pre-Audit Findings)

During the inventory phase, the following controls were identified as likely dead or stub:

| Component | Control | Issue | Category |
|---|---|---|---|
| `EditVehicleUi` | Save button | No handler wired (mock) | FC-1 |
| `EditVehicleUi` | Save & Close button | No handler wired (mock) | FC-1 |
| `EditVehicleUi` | Create Deal button | No handler wired (mock) | FC-1 |
| `EditVehicleUi` | Print button | No handler wired (mock) | FC-1 |
| `EditVehicleUi` | FloorplanCard "Add floorplan" | No handler wired (mock) | FC-1 |
| `EditVehicleUi` | SpecsVinCard "Auto-fill missing specs" | No handler wired (mock) | FC-1 |
| `EditVehicleUi` | "Edit" badge button (title) | No handler wired | FC-1 |
| `EditVehicleUi` | "…" more tabs button | No handler wired | FC-1 |
| `CostLedgerCard` | Export icon button | No handler wired | FC-1 |
| `CostLedgerCard` | Pagination buttons | Currently disabled/static | FC-5 |
| `CostTotalsCard` | View breakdown button | No handler wired | FC-1 |
| `DocumentsRailCard` | Add Note button | No handler wired | FC-1 |
| `VehicleCostsPageHeader` | Print button (full page) | No handler wired | FC-1 |
| `VinDecodeBar` | Scan VIN button | No-op currently | FC-1 |
| `TopCommandBar` | Notifications bell | No handler wired | FC-1 |
| `CustomersFilterBar` | "+ Create Filters" button | No handler wired | FC-1 |
| `SettingsContent` | Save changes (Profile) | Disabled / coming soon | FC-1 |
| `SettingsContent` | Save dealership settings | Disabled / coming soon | FC-1 |
| `SettingsContent` | Save notification settings | Disabled | FC-1 |

These will be formally verified and documented in SLICE B/C/D with disposition (fix / document as intentional stub / remove).

---

## Design Lock

- No visual redesign
- No new QA framework
- No feature expansion
- Fix intended behavior only
- Keep tests targeted and practical
