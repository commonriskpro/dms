# Secondary Page Visual Parity Spec

## Scope

Step 1 (Architect) output for the Dealer OS Secondary Page Visual Parity sprint.

The **locked dashboard** is the visual baseline. This sprint brings the most important secondary pages to the same visual quality and interaction consistency—same card language, table language, header language, density, spacing rhythm, and dark/light premium feel.

No route renames, backend rewrites, API contract changes, RBAC/tenant changes, or modal breakage. Adapter-first only; existing ui-system and token system only.

---

## Parity rules (design lock)

- **Match:** Dashboard density, hierarchy, card language, and table rhythm. Secondary pages should feel like the same product.
- **Do not force dashboard composition onto list/detail pages.** The dashboard has a specific KPI row + workbench + pipeline + lower grid. List and detail pages are primarily list/detail oriented. Do not add a 5‑KPI hero row, workbench-style hero block, or dashboard layout composition to inventory list, deals list, customers list, or detail pages. Apply the same **density, hierarchy, card language, and table rhythm** only—not the same layout structure.
- **One shared compact table density.** Adopt a single canonical compact table density (row/header/cell spacing, text size) for **all** touched list and queue pages. Define it once in the shared layer (e.g. `lib/ui/recipes/table` or `lib/ui/tokens` tableTokens) and have every list/queue table use it. Do not invent a different density per page.
- **No per-page row/header/cell tuning.** Do not tune table row, header, or cell spacing page by page unless it is strictly necessary (e.g. one-off exception for a constrained layout). All list and queue tables use the shared compact standard. Avoid overriding padding or line-height in VehicleInventoryTable, DealsTableCard, CustomersTableCard, or queue pages individually; use the shared recipe/tokens instead.

---

## 1) Target pages in scope

Grouped by domain.

### Inventory

| Page / surface | Route / location | Priority |
|----------------|------------------|----------|
| Inventory list | `app/(app)/inventory/page.tsx` → `InventoryPageContentV2` | High |
| Inventory detail | `app/(app)/inventory/vehicle/[id]/page.tsx` → `VehicleDetailPage` | High |
| Inventory edit / media | `inventory/[id]/edit`, media surfaces | Low-risk only if aligned |

### Deals

| Page / surface | Route / location | Priority |
|----------------|------------------|----------|
| Deals list | `app/(app)/deals/page.tsx` → `DealsPage` | High |
| Deal detail / workspace | `app/(app)/deals/[id]/page.tsx` → `DealDeskWorkspace` | High |

### Customers / CRM

| Page / surface | Route / location | Priority |
|----------------|------------------|----------|
| Customers list | `app/(app)/customers/page.tsx` → `CustomersListPage` | High |
| Customer detail | `app/(app)/customers/profile/[id]/page.tsx` → `CustomerDetailPage` | High |
| CRM opportunities list | `app/(app)/crm/opportunities/page.tsx` → `OpportunitiesTablePage` | Medium, low-risk only |
| Inbox | `app/(app)/crm/inbox` → `InboxPageClient` | Medium, straightforward only |

### Queues

| Page / surface | Route / location | Priority |
|----------------|------------------|----------|
| Delivery queue | `app/(app)/deals/delivery/page.tsx` → `DeliveryQueuePage` | High |
| Funding queue | `app/(app)/deals/funding/page.tsx` → `FundingQueuePage` | High |
| Title queue | `app/(app)/deals/title/page.tsx` → `TitleQueuePage` | High |
| CRM jobs | `app/(app)/crm/jobs/page.tsx` | Only if needed for parity |

---

## 2) Visual parity goals

Apply consistently across page families. The dashboard defines the standard.

### Page header density

- **Baseline:** Dashboard uses `PageHeader` with `typography.pageTitle`, compact actions, `space-y-3` page stack.
- **Goal:** All secondary pages use the same header height, title size, and action alignment. No larger or looser page titles.

### Card density

- **Baseline:** Dashboard uses `Widget` (widgetTokens: rounded card, p-5, border, shadow), compact internal spacing (`space-y-2.5`–`space-y-3`), delta/value hierarchy.
- **Goal:** List summary cards (inventory KPIs, deals summary, customers summary) and detail section cards use equivalent padding, border radius, and internal rhythm. Replace or wrap DMSCard/SummaryCard/Card with Widget or token-equivalent card treatment where it yields parity without feature rewrites.

### Table row density (one shared standard)

- **Baseline:** Dashboard workbench uses `px-3 py-2`, `text-[13px]`, `min-h-[36px]`-style rows, `border-b border-[var(--border)]`, token StatusBadge.
- **Goal:** Define **one** shared compact table density (e.g. in `lib/ui/recipes/table` or table tokens): header height, cell padding, body text size, row border. All touched list and queue tables (inventory, deals, customers, delivery, funding, title, CRM jobs) use this same standard. No page-specific row/header/cell spacing unless absolutely required. Apply via shared recipe or ui-system table classes only.

### Title / value hierarchy

- **Baseline:** Dashboard cards use small uppercase labels (`text-[11px] font-semibold uppercase`), large value (40px/44px), compact delta/metadata.
- **Goal:** Summary cards and key metrics on list/detail pages follow the same hierarchy (label small/uppercase, value dominant, metadata secondary).

### Section spacing

- **Baseline:** Dashboard uses `space-y-3` between major blocks, `gap-3` grid, compact gaps inside cards.
- **Goal:** List pages use `sectionStack` or equivalent `gap-4`/`gap-3` consistently; detail pages use similar vertical rhythm between sections (no excessive padding).

### Right-rail behavior

- **Baseline:** Dashboard lower row uses defined column spans; detail pages use `mainGrid` (1fr + 280px) with context rail.
- **Goal:** Detail page rails (deal workspace, vehicle/customer context) use same token background, border, and padding as dashboard context areas. No divergent rail styling.

### Chip / badge feel

- **Baseline:** Dashboard uses `StatusBadge` with token severity classes, compact size (`h-6 px-2.5 text-[11px]` in workbench).
- **Goal:** All list and detail pages use the same StatusBadge (or token-equivalent) size and variant set. No ad-hoc chip styling.

### Action button feel

- **Baseline:** Dashboard quick actions use consistent height (h-9), rounded-[10px], token accent, uppercase/semibold where appropriate.
- **Goal:** Primary actions on list/detail pages match button height, radius, and token usage. No one-off button styles.

### Empty / loading / error state polish

- **Baseline:** Dashboard uses token text (`text-[var(--muted-text)]`), compact copy, no raw colors.
- **Goal:** EmptyState, ErrorState, and loading skeletons on secondary pages use the same token set and similar density. No page-specific empty-state styling.

### Dark / light consistency

- **Baseline:** All dashboard surfaces use CSS variables only; no raw hex in feature components.
- **Goal:** Every touched secondary page uses only tokens/variables. Same theme switch behavior; no page-specific dark/light branches.

---

## 3) Page-family-specific gaps

### Inventory

- **List:** Uses `InventoryKpis` with **DMSCard** (not Widget); **InventoryFilterBar** and **VehicleInventoryTable** use ui-system TableLayout/TableToolbar/StatusBadge but table cells use recipe `p-4`. Do **not** add a dashboard-style 5‑KPI hero row or workbench block; keep list workflow. Gaps: align summary cards to dashboard **card language** and **density** (not composition); switch table to **shared compact table density**; toolbar/filter bar to match dashboard rhythm.
- **Detail:** **VehicleDetailPage** already uses VehicleHeader, VehicleDetailContent, ActivityTimeline, SignalContextBlock, SignalHeaderBadgeGroup. Gaps: section cards and content blocks—match **density and hierarchy**; right-rail and card stack use same token rhythm as dashboard. No layout recomposition.

### Deals

- **List:** Uses **DealsSummaryCards** with **SummaryCard**; **DealsTableCard** uses TableLayout + recipes. Do **not** add dashboard KPI hero or workbench layout. Gaps: summary cards—match dashboard **card language and density** (not full KPI composition); table uses **shared compact table density**; toolbar/filter bar matches dashboard rhythm.
- **Detail / workspace:** **DealDeskWorkspace** uses DealHeader, CustomerCard, VehicleCard, etc. Gaps: section cards—match **density and title hierarchy**; tab and panel spacing aligned to dashboard; no layout change.

### Customers / CRM

- **List:** **CustomersListPage** uses Card for table wrapper and **CustomersTableCard** with TableLayout + recipes. Do **not** add dashboard hero composition. Gaps: card language and **shared compact table density**; filter bar matches dashboard rhythm.
- **Detail:** **CustomerDetailPage** uses CustomerHeader, CustomerDetailContent, ActivityTimeline, signals. Gaps: **density and hierarchy** only; card/tab spacing and timeline polish to match dashboard; no layout change.
- **CRM opportunities / Inbox:** Use **shared compact table density** and dashboard card/empty-state language if touched; no composition change.

### Queues

- **Delivery / funding / title (and CRM jobs):** Already use QueueLayout, QueueKpiStrip, QueueTable, ui-system tables + recipes. Gaps: queue tables must use the **same shared compact table density** as list pages (no queue-specific row/cell tuning); KPI strip and chip/toolbar to match dashboard **rhythm and polish**; no structure or behavior change.

---

## 4) File plan

### Inventory

- `modules/inventory/ui/InventoryPageContentV2.tsx` — page structure, optional header tweaks.
- `modules/inventory/ui/components/InventoryKpis.tsx` — align to Widget/MetricCard language or token card density.
- `modules/inventory/ui/components/InventoryFilterBar.tsx` — toolbar styling to match dashboard workbench.
- `modules/inventory/ui/components/VehicleInventoryTable.tsx` — use shared compact table density (no per-page cell/row overrides).
- `modules/inventory/ui/VehicleDetailPage.tsx` — section spacing, optional card wrapper alignment.
- `modules/inventory/ui/VehicleDetailContent.tsx` — card/section density and hierarchy (no logic rewrite).

### Deals

- `modules/deals/ui/DealsPage.tsx` — page structure, section spacing.
- `modules/deals/ui/components/DealsSummaryCards.tsx` — align to dashboard metric/summary card language (or wrap with Widget-style).
- `modules/deals/ui/components/DealsFilterBar.tsx` — toolbar parity.
- `modules/deals/ui/components/DealsTableCard.tsx` — use shared compact table density (no per-page overrides).
- `modules/deals/ui/desk/DealDeskWorkspace.tsx` — section rhythm, card padding/titles (no structure change).
- `modules/deals/ui/desk/DealHeader.tsx` — only if header density/tokens need alignment.
- Deal desk cards (CustomerCard, VehicleCard, TradeCard, FeesCard, etc.) — internal padding/title hierarchy only where needed for parity.

### Customers / CRM

- `modules/customers/ui/CustomersListPage.tsx` — page wrapper, optional Card→Widget alignment for table card.
- `modules/customers/ui/components/CustomersTableCard.tsx` — use shared compact table density (no per-page overrides); toolbar to shared standard.
- `modules/customers/ui/components/CustomersFilterSearchBar.tsx` — filter bar styling.
- `modules/customers/ui/components/CustomersSummaryCardsRow.tsx` or summary components — card language parity.
- `modules/customers/ui/DetailPage.tsx` — section/tab spacing (no logic change).
- `modules/customers/ui/CustomerDetailContent.tsx` — card density and hierarchy where possible.
- CRM: `modules/crm-pipeline-automation/ui/OpportunitiesTablePage.tsx` — only if low-risk table/toolbar parity.
- Inbox: `app/(app)/crm/inbox/InboxPageClient.tsx` — list row density and states if straightforward.

### Queues

- `modules/deals/ui/DeliveryQueuePage.tsx` — use shared compact table density; KPI strip and chip/toolbar to dashboard rhythm (no per-page table tuning).
- `modules/deals/ui/FundingQueuePage.tsx` — same.
- `modules/deals/ui/TitleQueuePage.tsx` — same.
- `modules/crm-pipeline-automation/ui/JobsPage.tsx` — same, only if needed for parity.

### Shared (required for table parity)

- **`lib/ui/recipes/table.ts`** — define **one** canonical compact table density (e.g. `tableCellCompact`, `tableHeadCellCompact`, `tableRowCompact`) matching dashboard workbench rhythm (`px-3 py-2`, text size, header height). All list and queue pages import and use these; no per-page overrides for row/header/cell spacing.
- **`lib/ui/tokens.ts`** — if table density lives in tokens (e.g. `tableTokens.compactCell`), add there and reference from recipes or ui-system tables so a single change applies everywhere.
- `lib/ui/recipes/layout.ts` — no change unless a shared section gap is standardized.
- `components/ui-system/widgets/Widget.tsx` — no change; reference only.
- `components/ui-system/tables/*` — only small, safe refinements that consume the shared compact density (e.g. Table/TableRow/TableCell using compact recipe); must not break dashboard.

---

## 5) Migration strategy

- **Adapter-first:** Keep all data and behavior in existing module presenters/services. Change only presentation: wrappers, class names, spacing, and which shared primitives are used.
- **Prefer wrapping and refining:** Where a page uses DMSCard, SummaryCard, or raw Card, introduce a thin wrapper or replace with Widget/card tokens so the surface matches the dashboard. Do not rewrite feature logic.
- **Table density:** Apply dashboard workbench–like padding (e.g. `px-3 py-2`) and text size to list table cells via recipes or component props where tables already use ui-system. Prefer a single table recipe variant (e.g. “compact”) over one-off page overrides.
- **Detail pages:** Tighten section spacing and card internals; do not reorganize DealWorkspace or detail layout structure. Preserve tabs, panels, and signal integrations.
- **Queues:** Keep QueueLayout/QueueKpiStrip/QueueTable structure. Refine KPI strip visual weight and table row/chip treatment to match dashboard quality.
- **No new patterns:** Do not introduce a new card type or table type. Align to existing Widget, MetricCard, TableLayout, QueueLayout, and entity/timeline primitives.

---

## 6) Slice plan with acceptance criteria

### SLICE A — Parity audit / spec

- **Deliverable:** This spec (SECONDARY_PAGE_VISUAL_PARITY_SPEC.md).
- **Acceptance:** Target pages listed; visual parity goals and page-family gaps documented; file plan and migration strategy explicit; no app code.

### SLICE B — Inventory page parity

- **Scope:** Inventory list (summary cards, filter bar, table) and inventory detail (section/card density). No dashboard-style KPI/hero composition added.
- **Acceptance:** List uses **shared compact table density** and dashboard card language/density; detail section spacing and card hierarchy align to dashboard; no per-page table spacing overrides; no inventory logic or route changes; token-only.

### SLICE C — Deals page parity

- **Scope:** Deals list (summary cards, filter bar, table) and deal detail/workspace (section rhythm, card treatment). No dashboard KPI/hero composition on list.
- **Acceptance:** List uses **shared compact table density** and dashboard card language/density; workspace sections and cards match dashboard quality; no per-page table tuning; DealWorkspace structure unchanged; token-only.

### SLICE D — Customers / CRM parity

- **Scope:** Customers list (table card, filter bar, summary), customer detail (section/timeline polish), optionally CRM opportunities/inbox. No dashboard hero composition on list.
- **Acceptance:** List uses **shared compact table density** and dashboard card language; detail card/timeline density matches dashboard; no per-page table tuning; CRM/inbox only if straightforward; no behavior or route changes.

### SLICE E — Queue parity

- **Scope:** Delivery, funding, title (and CRM jobs if needed). Queue tables use the **same shared compact table density** as list pages.
- **Acceptance:** Queue tables use shared compact density (no queue-specific row/header/cell tuning); KPI strip and chip/toolbar match dashboard rhythm; no queue behavior or API changes; token-only.

### SLICE F — Shared component polish where required

- **Scope:** Define **one shared compact table density** (recipes or tokens) and have all list/queue tables consume it. Optional small Widget/card spacing refinements only if needed for parity.
- **Acceptance:** Single canonical compact table density; list and queue pages use it with no per-page spacing overrides; dashboard baseline unchanged; no new visual language.

### SLICE G — Dark / light parity validation

- **Scope:** All touched pages.
- **Acceptance:** Dark mode and light mode both correct; no raw colors; no page-specific theme branches; token logic matches dashboard.

### SLICE H — Tests / docs / hardening

- **Scope:** Focused tests, snapshots, docs, regression checks.
- **Acceptance:** SECONDARY_PAGE_VISUAL_PARITY_REPORT.md created; UI_SYSTEM_USAGE.md updated if needed; no route or permission regressions; unrelated failures documented separately.

---

## 7) Regression risks and mitigations

| Risk | Mitigation |
|------|------------|
| Over-polishing into redesign | Strict parity scope: density, spacing, card/table language only. No new layouts or reordering of content. |
| Visual drift from dashboard language | All changes must use existing tokens and ui-system primitives. Compare side-by-side with dashboard. |
| Table regressions (break layout, overflow, or accessibility) | One shared compact density only; no per-page row/header/cell overrides; test list/queue pages with many columns and long content. |
| Detail-page overcrowding | Reduce spacing and padding only; do not add new sections or cram more content. |
| Queue behavior regressions | Do not change queue logic, filters, or API usage; only visual refinement of existing shell and table. |
| Modal breakage | Do not change modal routes or intercepting behavior; do not alter dialog content that is shared with modals. |
| Permission-sensitive UI exposure | Do not change visibility or gating logic; only styling. Re-verify permission-gated blocks after polish. |
| CustomersListPage or CRM using different data shape | Adapter-first: keep data flow; only swap or wrap presentational components. |
| Inbox or opportunities table structure | Only align list row density and empty/loading states; do not change data or navigation. |

---

## 8) Authoritative references

- `apps/dealer/docs/UI_SYSTEM_ARCHITECTURE_V1.md`
- `apps/dealer/docs/UI_VISUAL_SYSTEM_V1.md`
- `apps/dealer/docs/UI_COMPONENT_LIBRARY_SPEC.md`
- `apps/dealer/docs/UI_SYSTEM_USAGE.md`
- `apps/dealer/docs/UI_FOUNDATION_IMPLEMENTATION_SPEC.md`
- `apps/dealer/docs/DASHBOARD_VFINAL_IMPLEMENTATION_SPEC.md`
- `apps/dealer/docs/DASHBOARD_VFINAL_FINAL_REPORT.md`
- `apps/dealer/docs/DASHBOARD_VFINAL_POLISH_FINAL_REPORT.md`
- Locked Dealer OS dashboard (implementation and polish) as the visual standard

---

## 9) Definition of done (sprint)

- This spec approved and implemented per slices B–H.
- Inventory, deals, customers/CRM, and queue target pages visually aligned to dashboard baseline.
- No route/backend/API/RBAC/tenant/modal regressions.
- Dark/light parity preserved; token-only styling on all touched surfaces.
- Perf, security, and final reports produced; tests updated or unrelated failures documented.
