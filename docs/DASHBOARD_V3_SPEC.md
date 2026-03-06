# Dashboard V3 — Enterprise Layout Spec

## Spec Addendum Checklist

- [x] **WidgetCard standardization** — Single reusable WidgetCard + WidgetRow schema; list widgets as config/data or thin wrappers (see § Widget Standardization).
- [x] **SwitchDealership handler extracted** — Session-focused component specified at `components/session/DealershipSwitchHandler` (see § Session / SwitchDealership).
- [x] **Metrics delta model** — 7d/30d deltas per metric, computation rules, and UI display (see § C) Data Contract).
- [x] **Floorplan caching policy** — Server-only cache, TTL, key, safe fields (see § Caching Strategy).
- [x] **V3.1 roadmap widgets** — Activity Feed, Notification Center, Smart Alerts, Global Search evolution (see § Dashboard V3.1).
- [x] **Enterprise UX guidelines** — Density, status chips, empty states, last-updated, refresh (see § Enterprise Feel Guidelines).

---

## Overview

New enterprise dashboard layout for the dealer app: dark fixed sidebar, topbar with global search + icons + avatar, metric cards row, and a 12-column grid of widgets. Server-first: the dashboard page is a Server Component that loads data via a server-side service; the client receives `initialData` only and does not fetch on mount.

---

## A) Layout Grid Map (12 columns)

| Row | Content | Col spans |
|-----|---------|-----------|
| 1 | 4 metric cards (Inventory, Leads, Deals, BHPH) | each `col-span-3` |
| 2 | Customer Tasks | `col-span-5` |
|     | Inventory Alerts | `col-span-4` |
|     | CRM Workflows promo (small card) | `col-span-3` |
| 3 | Floorplan & Lending | `col-span-5` |
|     | Deal Pipeline | `col-span-4` |
|     | Upcoming Appointments | `col-span-3` |
| 4 | Finance Notices | `col-span-9` |
|     | Quick Actions | `col-span-3` |

Grid: 12 columns, gap 16px (`gap-4`). Page background: subtle muted. Cards: `rounded-xl`, `border border-border/60`, `shadow-sm`, padding 16px.

### Dashboard Load Priority

When computing or streaming dashboard data, use this order (highest to lowest priority):

1. Metrics  
2. Customer Tasks  
3. Inventory Alerts  
4. Deal Pipeline  
5. Finance Notices  
6. Floorplan  
7. Appointments  
8. Activity Feed (future)

### Alert Severity Rules

Use these semantics for status chips and alert severity across the dashboard:

| Severity | Meaning |
|----------|---------|
| **info** | Informational signal |
| **success** | Resolved / positive event |
| **warning** | Operational attention needed |
| **danger** | Blocking issue or financial risk |

**Examples:**  
- `warning` → vehicle in recon > 3 days  
- `danger` → funding delay > 7 days  

### Dashboard Observability

`getDashboardV3Data` should emit structured logs for observability:

- **Events:**  
  - `dashboard_load_start` — when the load begins  
  - `dashboard_load_complete` — when the load finishes successfully  
  - `dashboard_load_error` — when the load fails  

- **Fields (include where applicable):**  
  - `dealershipId`  
  - `userId`  
  - `loadTimeMs`  
  - `widgetCounts` (e.g. counts of items returned per widget/section; no PII)  

Do not log tokens, cookies, or PII.

### Dashboard Query Limits

Cap list sizes returned for dashboard widgets (server enforces; client displays up to these):

| Widget | Limit |
|--------|-------|
| Customer Tasks | 5 |
| Inventory Alerts | 5 |
| Deal Pipeline | 5 |
| Finance Notices | 5 |
| Activity Feed (future) | 10 |

---

## B) Component List + Props

| Component | Purpose | Props (from server) |
|-----------|---------|----------------------|
| **MetricCard** | Big number + optional delta pill (7d/30d); tooltip “since last 7d” (see Data Contract) | `title`, `value`, `delta7d?: number \| null`, `delta30d?: number \| null`, `href` |
| **WidgetCard** | **Single reusable** wrapper: title + rows (see § Widget Standardization) | `title`, `rows: WidgetRow[]` or `children` |
| **CustomerTasksCard** | Implemented as config + WidgetCard (or thin wrapper) | `customerTasks: { appointments, newProspects, inbox, followUps, creditApps }` |
| **InventoryAlertsCard** | Config + WidgetCard | `inventoryAlerts: { carsInRecon, pendingTasks, notPostedOnline, missingDocs, lowStock }` |
| **CrmPromoCard** | Small promo for CRM Workflows | none (static CTA to /crm/automations or similar) |
| **FloorplanLendingCard** | Lines: name, utilized, limit, status; empty state if no lender (see § Caching Strategy) | `floorplan: Array<{ name, utilizedCents, limitCents, statusLabel }>` |
| **DealPipelineCard** | Config + WidgetCard | `dealPipeline: { pendingDeals, submittedDeals, contractsToReview, fundingIssues }` |
| **UpcomingAppointmentsCard** | List rows: avatar circle + name + meta + time (distinct visual; can stay dedicated) | `appointments: Array<{ id, name, meta, timeLabel }>` |
| **FinanceNoticesCard** | Config + WidgetCard | `financeNotices: Array<{ id, title, subtitle, dateLabel, severity }>` |
| **QuickActionsCard** | 2x2 buttons | none (links only; RBAC hides actions user can’t do) |
| **DashboardV3Client** | Client root; receives `initialData`; no switch logic (see § Session / SwitchDealership) | `initialData: DashboardV3Data`, `permissions: string[]`, `activeDealershipId: string \| null` |

---

## Widget Standardization

- **Single reusable component:** All list-style widgets use one **WidgetCard** component. It accepts a title and either `children` or a list of rows conforming to the generic **WidgetRow** schema.
- **WidgetRow schema (generic):**
  ```ts
  { key: string; label: string; count: number; severity?: "info" | "success" | "warning" | "danger"; href?: string }
  ```
- **List widgets (Customer Tasks, Inventory Alerts, Deal Pipeline, Finance Notices)** are implemented as either:
  - **Thin wrappers** that map their domain data into `WidgetRow[]` and render `<WidgetCard title="..." rows={rows} />`, or
  - **Pure data config** passed into WidgetCard (e.g. a config array + data object producing rows).
- **Rule:** Avoid near-duplicate components (e.g. separate Card components that only differ by title and row layout). Use WidgetCard + row config unless visuals materially differ (e.g. Upcoming Appointments with avatar + time is a different visual pattern and may remain a dedicated component).

---

## Session / SwitchDealership

- **Shared component location:** `components/session/DealershipSwitchHandler.tsx` (or equivalent under a session-focused path). This component is **not** dashboard-specific; it is used by any page that may land with a `switchDealership` query param (e.g. post-invite redirect).
- **Responsibilities:**
  - Read `switchDealership` from the URL (e.g. `useSearchParams().get("switchDealership")`).
  - When present and session is authenticated: call `PATCH /api/auth/session/switch` with the given `dealershipId`.
  - On success: refetch session and perform a **full-page navigation** (e.g. `router.replace(currentPathnameWithoutQuery)` or equivalent) so the URL no longer contains the param and the page re-renders with the new active dealership.
  - Ensure navigation is safe (no double-submit, no loop); use a ref or one-time guard so the switch runs at most once per param value.
- **Dashboard (and other pages):** Do not implement switch logic in the dashboard. The dashboard only consumes **active dealership** state provided by the server (or session context after the handler has run). The DealershipSwitchHandler wraps the app shell or layout so it runs on all relevant routes.

---

## Caching Strategy (Floorplan / Lending)

- **Scope:** Server-only caching for floorplan/lending data (or the computed floorplan panel payload). No client-side cache for this data.
- **Storage:** In-memory cache on the server (e.g. a module-level Map or a lightweight cache abstraction). Not shared across processes unless explicitly designed (e.g. Redis) in a later phase.
- **TTL:** Default 60 seconds; configurable (e.g. env `DASHBOARD_FLOORPLAN_CACHE_TTL_SECONDS`). After TTL, the next request recomputes and repopulates the cache.
- **Cache key:** `dealershipId` (required). Optionally include lender provider or source id if multiple floorplan sources exist.
- **Safe fields only:** Cache stores only non-sensitive aggregates (e.g. name, utilizedCents, limitCents, statusLabel). No account numbers, no raw lender credentials, no PII.
- **Fallback:** If no lender integrations or floorplan data exist, the dashboard shows an **empty-state card** (e.g. “No floor plan data” or “Connect a lender”) instead of an error.

---

## C) Data Contract (Server → Client)

Safe for serialization; no secrets, no raw tokens. All list items use opaque ids and display-only labels.

### Metrics with deltas (data contract)

- **Counts:** `inventoryCount`, `leadsCount`, `dealsCount`, `bhphCount` (numbers).
- **Deltas (optional):** For each metric, support `*Delta7d` and `*Delta30d` (signed integer or `null`):
  - `inventoryDelta7d`, `inventoryDelta30d`
  - `leadsDelta7d`, `leadsDelta30d`
  - `dealsDelta7d`, `dealsDelta30d`
  - `bhphDelta7d`, `bhphDelta30d`
- **Delta computation (server):**
  - Use `createdAt` / `updatedAt` (or equivalent) time windows: “count now” minus “count at (now - 7d)” for 7d delta; same for 30d.
  - If historical data or point-in-time counts are not available, return `null` for that delta. UI then shows “—” or omits the chip.
  - **Implementation note:** If accurate point-in-time counts are needed later, introduce snapshot tables (or equivalent) in a future version (V3.2+). That is not required for V3.
- **UI display (spec behavior, no implementation here):**
  - Show a delta chip next to the big number: “+N” or “-N” with semantic color (e.g. positive = success/green for leads/deals, context-dependent for inventory).
  - Tooltip or secondary text: “since last 7d” or “since last 30d” so the user knows the period. No raw timestamps required in the chip.

### Last updated and refresh

- **Field:** `dashboardGeneratedAt: string` (ISO 8601). Set when the server generates the dashboard payload.
- **UI:** Show “Last updated X min ago” (or “just now” if &lt; 1 min). Provide a **Refresh** control (button or link).
- **Rule:** **Refresh is an explicit user action only — no timers, no polling, no auto-refresh loops.**
- **Refresh behavior (to be decided in implementation):**
  - **Option A:** Full page reload (re-request the server-rendered page; preserves server-first, no client fetch for initial data).
  - **Option B:** Client-triggered refresh action that requests fresh dashboard data (e.g. dedicated endpoint or RSC revalidation) and updates client state without full reload.
  - Requirement: **Initial render must never use fetch-on-mount**; data comes from server. Refresh is an explicit user action.

### Full shape (reference)

```ts
type DashboardV3Data = {
  dashboardGeneratedAt: string; // ISO
  metrics: {
    inventoryCount: number;
    inventoryDelta7d: number | null;
    inventoryDelta30d: number | null;
    leadsCount: number;
    leadsDelta7d: number | null;
    leadsDelta30d: number | null;
    dealsCount: number;
    dealsDelta7d: number | null;
    dealsDelta30d: number | null;
    bhphCount: number;
    bhphDelta7d: number | null;
    bhphDelta30d: number | null;
  };
  customerTasks: {
    appointments: number;
    newProspects: number;
    inbox: number;
    followUps: number;
    creditApps: number;
  };
  inventoryAlerts: {
    carsInRecon: number;
    pendingTasks: number;
    notPostedOnline: number;
    missingDocs: number;
    lowStock: number;
  };
  floorplan: Array<{
    name: string;
    utilizedCents: number;
    limitCents: number;
    statusLabel: string;
  }>;
  dealPipeline: {
    pendingDeals: number;
    submittedDeals: number;
    contractsToReview: number;
    fundingIssues: number;
  };
  appointments: Array<{
    id: string;
    name: string;
    meta: string;
    timeLabel: string;
  }>;
  financeNotices: Array<{
    id: string;
    title: string;
    subtitle: string;
    dateLabel: string;
    severity: "info" | "success" | "warning" | "danger";
  }>;
};
```

Server returns this shape from `getDashboardV3Data(dealershipId, userId, permissions)`. All queries scoped by `dealership_id`; RBAC applied where applicable.

---

## D) Empty / Loading States

- **Permission denied:** User lacks `customers.read` and `crm.read` (and any other required for dashboard). Show a single card: “You don’t have access to the dashboard.” No metric or widget data.
- **No active dealership:** Redirect or show get-started state per existing auth flow; dashboard page is not rendered with data.
- **No data (empty lists/counts):** Widgets show “0” or “No items” / “No notices” etc. No skeleton on client for initial load; server sends data or explicit zeros/empty arrays.
- **Not configured (e.g. no lender):** Use distinct copy per § Enterprise Feel Guidelines (e.g. “No floor plan data” / “Connect a lender” for floorplan card).
- **Loading (server only):** If server is slow, optional loading UI can be handled at the layout or page shell (e.g. Suspense); client components do not show a loading spinner for “fetch on mount” because there is no client fetch.

---

## E) Visual Tokens

- Card radius: 12px (`rounded-xl`)
- Card padding: 16px (`p-4`)
- Grid gap: 16px (`gap-4`)
- Page background: muted (`bg-[var(--muted)]/30` or equivalent)
- Borders: subtle (`border-[var(--border)]/60`), `shadow-sm`
- Metric cards: big number `text-3xl font-bold`, optional delta pill (e.g. `+3` / `-1`) with muted or accent color
- Widget rows: left colored chip + label, count or value aligned right
- Appointments: avatar circle (initials or placeholder) + name + meta + time label
- Quick actions: 2x2 grid of buttons (Add Vehicle, Add Lead, Start Deal, Start Deal — last may be “Start Deal” once or a second action per product decision)

---

## Enterprise Feel Guidelines

- **Density:** Lists show top 5 (or configurable N) with a total count; avoid oversized whitespace. “Show 5 of 12” pattern is acceptable.
- **Consistency:** Use semantic colors only (info, success, warning, danger) for status chips and deltas; same spacing and gap tokens across all cards.
- **Empty states:** Must explain **why** empty: “No permission” vs “No data” vs “Not configured” (e.g. no lender connected). Different copy for each.
- **Microcopy:** Use operational language: “Needs Review”, “Overdue”, “Stale”, “Pending”, “Due soon”. Avoid vague labels.
- **Status chips:** Same severity mapping everywhere: info (blue), success (green), warning (amber), danger (red). Chips are compact and scannable.
- **Last-updated:** Display “Last updated X min ago” using `dashboardGeneratedAt`; keep format consistent.
- **Refresh pattern:** Refresh is an explicit user action (button/link). Spec allows either full page reload or client-triggered refresh; no automatic polling for initial load.
- **Accessibility:** Focus states visible on all interactive elements; keyboard navigation for search and card links; aria-labels where needed.
- **Performance:** No heavy client libs on the dashboard (e.g. no chart lib for V3). Keep client bundle minimal; cards and lists only.

---

## F) Routes and Navigation (from spec)

- **Inventory** metric → `/inventory`
- **Leads** metric → `/crm/opportunities`
- **Deals** metric → `/deals`
- **BHPH** metric → `/lenders` (or existing finance section)
- **Quick actions:** Add Vehicle → `/inventory/new`, Add Lead → `/customers/new` (or `/crm/opportunities` if that’s the canonical “new lead”), Start Deal → `/deals/new`
- CRM promo card → link to CRM automations/workflows (e.g. `/crm/automations`)

---

## G) Shell (Sidebar + Topbar)

- **Sidebar:** Dark, fixed; same nav items as current dealer app (Dashboard, Inventory, Customers, Deals, CRM, etc.). No code change to nav structure unless explicitly required; styling can be “dark” variant.
- **Topbar:** Global search placeholder: “Search inventory, customers, deals…” (or “Search inventory, customers, deals…”). Icons + avatar per mock; no tokens or sensitive data in UI.

---

## H) Non-Negotiables (Recap)

- Server-first: dashboard page is a Server Component; `dynamic = "force-dynamic"`, `noStore()`.
- No client fetch-on-mount for initial dashboard data.
- RBAC and tenant isolation unchanged; all server data scoped by `dealership_id`; links/actions hidden when user lacks permission.
- Jest only; installs and tests from repo root (`npm ci`, then `npm -w apps/dealer run test`).

---

## Dashboard V3.1 (Future Iteration — Spec Only)

The following are specified for a future release (V3.1). No implementation in V3.

### 1) Activity Feed (Operational timeline)

- **Source:** Dealer audit log (existing) or a new lightweight **ActivityEvent** table (future). Prefer reuse of audit log with safe, display-only fields.
- **Display:** Last 10 events; each row: type, entity label (e.g. “Deal #123”), action, relative time. Safe fields only (no PII, no document contents).
- **RBAC:** Must be gated (e.g. user needs `deals.read` or `customers.read` or `admin.audit.read` to see relevant event types). Tenant-scoped by `dealership_id`.

### 2) Notification Center

- **Source:** Future notifications table, or derived from existing tasks/finance alerts (e.g. “3 stipulations pending”).
- **UI:** Right-rail card with list of notifications + “View all” link. Count badge on icon in topbar if desired.
- **Rules:** Avoid PII leakage in notification text; use “A deal needs attention” not “John Smith’s deal…”. Deep links to entity detail are allowed (opaque ids).

### 3) Smart Alerts

- **Concept:** Deterministic, explainable alert rules that produce a list of items (label, severity, count, recommended action, deep link).
- **Example rules:**
  - Recon aging > N days
  - Missing docs (e.g. stipulations or deal docs)
  - Funding delay (submission stuck in pending)
  - Stipulation pending > N days
- **Alert item shape (logical):** `{ label, severity, count, recommendedAction?, deepLink? }`. Severity: "info" | "success" | "warning" | "danger".
- **Rule:** Alerts must be deterministic (same data → same alerts) and explainable (user can understand why an alert appeared).

### 4) Global Search evolution

- **Phase 1 (current):** Search input in topbar; placeholder and UI only. No backend search requirement for V3.
- **Phase 2 (future):** Server endpoint or service-backed search across VIN, customer name, deal reference, etc.
- **Constraints for Phase 2:**
  - Tenant-scoped (dealership_id on all sources).
  - RBAC-filtered (results only for entities the user can read).
  - Paginated results (limit/offset or cursor).
  - Rate limited to prevent abuse.
