# Dashboard Personalization — Spec (Step 1)

## 1. Problem / Goal

### Why dashboard personalization is needed
Dealer users have different roles and workflows. A BDC manager may care most about leads and tasks; a used-car manager may focus on inventory and deal pipeline. A one-size-fits-all dashboard order and visibility reduces efficiency. Per-user personalization lets each user show only the widgets they use and order them to match their workflow.

### Why it must remain server-first
- **Security and correctness:** Layout and widget availability must be determined server-side using RBAC and tenant context. Client-only personalization would risk leaking or rendering data the user is not allowed to see.
- **Performance and SEO:** The dashboard is the main landing view; first paint must come from the server with the correct layout and data. No fetch-on-mount for the initial dashboard structure.
- **Consistency:** A single source of truth (server merge of registry + permissions + saved preferences) ensures deterministic, safe rendering across reloads and devices.

### Why per-user layout is preferable to shared mutable layouts for V1
- **Simplicity:** No conflict resolution, no “who wins” when two users edit a shared layout. Each user has one layout per dealership.
- **Lower risk:** Shared layouts would require roles (e.g. “dashboard admin”) and more complex write rules. Per-user is a clear, auditable model.
- **Extensibility:** Per-user V1 leaves room for future “manager presets” or “copy from template” without blocking rollout.

---

## 2. Scope

### In scope
- **Widget registry:** Central, typed list of supported dashboard widgets with id, zones, permissions, default order, visibility.
- **Widget visibility toggle:** User can show/hide widgets (except fixed ones).
- **Widget reorder:** User can reorder widgets within zones (and optionally move between allowed zones if we support multiple zones per widget).
- **Per-user persisted layout:** One saved layout per user per dealership (DB row or equivalent).
- **Reset to default:** Single action to discard saved layout and use registry defaults.
- **RBAC filtering:** Widgets not allowed by permission are never returned or rendered; saved layout cannot force forbidden widgets.
- **Server-side merge:** Default layout from registry → filter by RBAC → merge saved preferences (only for allowed widgets) → deterministic effective layout.

### Out of scope for V1
- Arbitrary resizing of widgets.
- User-created custom widgets.
- Shared team layouts.
- Cross-device offline sync beyond normal persistence (single source of truth is server).
- Drag between unconstrained freeform areas; we use zones only.

---

## 3. Existing dashboard inventory

Current dealer dashboard is **Dashboard V3** (`apps/dealer/app/(app)/dashboard`, `components/dashboard-v3`, `modules/dashboard/service/getDashboardV3Data`).

### Structure (current)
- **Top row:** 4 metric cards (Inventory, Leads, Deals, BHPH) — permission-gated.
- **Main area:** 3-column grid (columns 1–3), each column a vertical stack of widget cards.

### Widget inventory

| Widget ID | Title | Fixed | Movable | Hideable | Required | Permission(s) | Zone (current) | Default order | Default visible |
|-----------|-------|-------|---------|----------|----------|---------------|-----------------|---------------|------------------|
| `metrics-inventory` | Inventory | No | No (top row) | No | No | inventory.read | topRow | 1 | true |
| `metrics-leads` | Leads | No | No | No | No | crm.read | topRow | 2 | true |
| `metrics-deals` | Deals | No | No | No | No | deals.read | topRow | 3 | true |
| `metrics-bhph` | BHPH | No | No | No | No | lenders.read | topRow | 4 | true |
| `customer-tasks` | Customer Tasks | No | Yes | Yes | No | customers.read \|\| crm.read | main | 1 | true |
| `floorplan-lending` | Floorplan Lending | No | Yes | Yes | No | lenders.read | main | 2 | true |
| `finance-notices` | Finance Notices | No | Yes | Yes | No | lenders.read | main | 3 | true |
| `inventory-alerts` | Inventory Alerts | No | Yes | Yes | No | inventory.read | main | 4 | true |
| `deal-pipeline` | Deal Pipeline | No | Yes | Yes | No | deals.read | main | 5 | true |
| `recommended-actions` | Recommended Actions | No | Yes | Yes | No | crm.read | main | 6 | true |
| `upcoming-appointments` | Upcoming Appointments | No | Yes | Yes | No | crm.read | main | 7 | true |
| `quick-actions` | Quick Actions | No | Yes | Yes | No | (inventory/customers/deals read+write) | main | 8 | true |

**Notes:**
- **Top row:** Treated as a single zone `topRow`; metrics are always in a fixed order by default (Inventory, Leads, Deals, BHPH). For V1 we can keep top row order fixed (no reorder) or allow reorder within topRow; spec chooses **allow reorder within topRow** for consistency.
- **Main:** Single zone `main` for all card widgets. Current implementation uses 3 columns; we treat `main` as one ordered list and render in a 3-column masonry (column assignment can be by index modulo 3) so reorder is a single sequence.
- **Required:** No widget is “required” (all hideable except we may mark Quick Actions as always visible for UX — optional product decision; spec keeps it hideable).
- **Fixed:** None for V1; all main widgets movable/hideable. Top row metrics can be marked non-fixed but in a fixed zone.

**Zone model (recommended):**
- **topRow:** Exactly one row; widgets are metric cards. Order: 1..4 by default.
- **main:** All other widgets in a single ordered list; layout component renders them in a 3-column grid (order preserved, fill columns left-to-right or by index % 3).

---

## 4. Widget registry design

**Location:** `apps/dealer/modules/dashboard/config/widget-registry.ts` (or `modules/dashboard/config/widget-registry.ts` under dealer app root).

**Shape (typed):**

```ts
// Ids: stable string keys (kebab-case)
type WidgetId = string;  // validated via zod enum from registry keys
type ZoneId = "topRow" | "main";

interface WidgetDefinition {
  id: WidgetId;
  title: string;
  description: string;
  allowedZones: ZoneId[];
  defaultZone: ZoneId;
  defaultOrder: number;
  defaultVisible: boolean;
  requiredPermissions: string[];  // user must have at least one
  fixed?: boolean;   // if true, cannot hide or move
  hideable?: boolean;
  featureFlag?: string;  // optional; if set, widget only if flag enabled
}
```

**Exact field names:**
- `id`
- `title`
- `description`
- `allowedZones`
- `defaultZone`
- `defaultOrder`
- `defaultVisible`
- `requiredPermissions`
- `fixed` (optional, default false)
- `hideable` (optional, default true for non-fixed)
- `featureFlag` (optional)

**Registry:** Array or record of `WidgetDefinition`; export `WIDGET_REGISTRY`, `getWidgetById(id)`, `getDefaultLayout()`, `filterByPermissions(registry, permissions)`.

---

## 5. Layout model

### Persistence choice: one row per user+dealership, JSON payload

**Recommended:** One row per (dealershipId, userId) with a JSON column for the full layout (e.g. `layoutJson`).

**Justification vs normalized row-per-widget:**
- **Simplicity:** Single read and single write; no race conditions between multiple rows for the same user.
- **Atomic updates:** Save and reset replace the whole payload; no partial state.
- **Schema evolution:** New fields (e.g. zone options) can be added to the JSON schema without migrations for new columns.
- **Performance:** One row per user is a natural unique constraint and index; no need to lock or update many rows.

Normalized (row per widget) would allow finer-grained updates but increase write complexity and migration surface for little benefit at V1 scale.

### Schema proposal (Prisma)

```prisma
model DashboardLayoutPreference {
  id           String   @id @default(uuid()) @db.Uuid
  dealershipId String   @map("dealership_id") @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  layoutJson   Json     @map("layout_json")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([dealershipId, userId])
  @@index([dealershipId])
  @@index([userId])
}
```

### Saved layout payload (zod-validated)

```ts
// Single widget placement (visibility + zone + order)
{ widgetId: string, visible: boolean, zone: ZoneId, order: number }

// Full payload
{ version: 1, widgets: Array<{ widgetId, visible, zone, order }> }
```

**Rules:**
- **Duplicate widget ids:** Reject on save; or normalize by keeping last occurrence. **Spec:** reject on validation (duplicate widget ids invalid).
- **Unknown widget ids:** Ignore in merge; do not persist. On load, strip unknown ids before applying.
- **Forbidden widget ids:** Never persist; filter by RBAC before save. On load, strip widgets user cannot see.
- **Missing widgets:** In merge, add any registry widget (allowed by RBAC) not present in saved layout with default visibility and order.
- **Removed widgets:** (Widget removed from code in future.) Registry no longer contains id; merge treats as unknown — strip from saved payload, do not render. No crash.
- **Default fallback:** If no saved row or layoutJson null/empty/invalid, use `getDefaultLayout()` filtered by RBAC.
- **Fixed widgets:** If registry marks widget as `fixed`, merge and save must never change its zone/order/visibility; validation rejects attempts to hide or move fixed widgets.
- **Order conflicts:** Normalize order to unique integers 0..n-1 within each zone before persist and after merge.

**Payload size:** Cap at e.g. 50 widget entries and 64KB raw JSON to avoid abuse.

---

## 6. Dashboard zones

**Zones (deterministic):**
- **topRow:** Summary row; 4 metric cards. Render as single row, 4 columns on large screens.
- **main:** All other widgets. Render as 3-column grid; widgets placed in order (e.g. column = index % 3, row = floor(index / 3)).

Which widgets are allowed in which zones:
- **topRow:** Only widgets with `allowedZones` including `topRow`: `metrics-inventory`, `metrics-leads`, `metrics-deals`, `metrics-bhph`.
- **main:** All non-metric widgets; `allowedZones` includes `main`.

Current implementation has no “side” rail; we keep **topRow + main** only. If the UI later adds a side rail, registry can add zone `side` and `allowedZones` per widget.

---

## 7. Server-first data flow

1. **Load context:** On dashboard page load (server), get current user + dealership from session (`getSessionContextOrNull`), require `activeDealershipId` and dashboard access (e.g. customers.read or crm.read).
2. **Load widget registry:** From code (widget-registry.ts); no DB.
3. **Load saved layout:** Query `DashboardLayoutPreference` by `dealershipId` + `userId`; one row or null.
4. **RBAC filter registry:** `filterByPermissions(registry, session.permissions)` → allowed widgets only.
5. **Merge:** Merge service: start from default layout (from registry defaults, filtered by RBAC), then apply saved layout for allowed widgets only (visibility, zone, order). Strip unknown/forbidden/removed widget ids. Normalize order within each zone. Fixed widgets restored to default if present in registry.
6. **Build final render model:** List of widgets with widgetId, zone, order, visible. Sort by zone then order.
7. **Render dashboard (server):** Server component passes effective layout + full dashboard data (existing `getDashboardV3Data`) to client. No client fetch for layout or data on first paint.
8. **Hydrate client:** Client component receives initial data + effective layout; renders widgets by id from registry mapping. Customize mode (reorder, show/hide, save, cancel, reset) is client-side; save/reset call API or server action.

---

## 8. UX flows

- **Enter customization mode:** “Customize dashboard” button in dashboard header (e.g. near refresh / last updated). Opens sheet or modal (sheet recommended for desktop; keeps dashboard visible).
- **Show/hide widgets:** In customize panel, list widgets with toggle/switch. Fixed widgets shown but disabled and labeled “Always visible” or similar.
- **Reorder widgets:** Drag-and-drop list per zone, or up/down buttons. Must feel reliable; keyboard (e.g. focus + arrow keys) and touch considered.
- **Save layout:** Button “Save” → call save API with current draft layout; on success close panel and optionally refresh or update client state so dashboard re-renders with new layout (e.g. router.refresh or server component re-fetch).
- **Cancel edits:** “Cancel” closes panel without saving; draft discarded.
- **Reset to default:** “Reset to default” → confirm dialog → call reset API; then same as save (refresh layout).
- **Empty states:** If user hides all optional widgets, show minimal dashboard (e.g. metrics + “Add widgets by customizing your dashboard”).
- **Permission-restricted:** Widgets user loses permission for disappear from registry result and from saved payload; no special UX beyond “no longer shown.”
- **Removed widget:** (Future) Removed from code/registry; saved layout may still reference it; server strips it; no crash, no placeholder.
- **Mobile:** Customization panel should be responsive (full-screen sheet or stacked layout); reorder may be up/down buttons if drag is poor on touch.

---

## 9. Error / loading / fallback behavior

- **Failed save:** Toast error; keep panel open so user can retry or cancel.
- **Invalid saved payload:** On load, treat as “no saved layout”; use default layout; optionally overwrite stored JSON with null or default in background (or leave as-is and always merge safely).
- **Stale client data:** After save success, use router.refresh() or equivalent so server re-renders with new layout; avoid stale layout on next navigation.
- **Missing widget registry entry:** At render, if effective layout references widget id not in registry, skip that entry (do not render component); no crash.
- **Partially invalid layout:** Merge service normalizes; invalid entries dropped; valid entries kept.
- **Loading:** Use existing skeleton for dashboard; customization panel may show loading state for save/reset (disable buttons, spinner).
- Use existing **toast**, **confirm dialog**, **error boundary** patterns; no new ad-hoc patterns.

---

## 10. RBAC / security

- **Widget visibility:** Widget may appear only if user has at least one of `requiredPermissions` for that widget. Merge and API must use `session.permissions` (or equivalent) from server.
- **Saved layout:** User cannot save a layout that includes widgets they don’t have permission for; server filters before persist. On load, strip any such entries.
- **API/server action:** All read/write of `DashboardLayoutPreference` must verify: (1) authenticated user, (2) dealershipId and userId from session (not from client body), (3) tenant isolation: only read/write rows where `dealershipId` and `userId` match session.
- **Dealership isolation:** All reads and writes scoped by `dealershipId`; user can only read/update their own row for the active dealership.

---

## 11. Acceptance criteria

- **First-time users:** No row in DB; dashboard shows default layout (from registry filtered by RBAC). Customize → change layout → Save → row created; reload shows saved layout.
- **Returning users:** Saved row exists; dashboard shows merged layout (saved + defaults for new widgets); reorder/hide persists after save.
- **Permission changes:** User loses permission for a widget → widget no longer in allowed set; layout merge excludes it; saved payload can still reference it but it’s stripped on load and not rendered.
- **Reset:** Reset to default clears saved layout (delete row or set layoutJson to default); next load shows registry default filtered by RBAC.
- **Removed widgets:** Remove widget id from registry (simulate); existing saved layout with that id still loads; widget not rendered; no error.
- **Reorder persistence:** Reorder in customize panel → Save → reload → order preserved.
- **No regression:** Dashboard still server-rendered; no fetch-on-mount for initial data; existing widgets and visual language unchanged for users who do not customize.

---

## 12. Rollout / migration notes

- **Existing users:** No saved layout → merge uses default layout only; behavior identical to today.
- **Future extensibility:** Document possible extensions: manager-defined presets, shared layouts, widget density, multiple saved views (tabs). Not in V1.

---

## File list for Steps 2–4

### Step 2 (Backend)
- `apps/dealer/prisma/schema.prisma` — add `DashboardLayoutPreference`
- `apps/dealer/modules/dashboard/config/widget-registry.ts` — new
- `apps/dealer/modules/dashboard/schemas/dashboard-layout.ts` — new (zod)
- `apps/dealer/modules/dashboard/service/merge-dashboard-layout.ts` — new (merge service)
- `apps/dealer/modules/dashboard/service/dashboard-layout-persistence.ts` — new (read/write preference)
- `apps/dealer/app/api/dashboard/layout/route.ts` — GET (effective layout) and/or used from page
- `apps/dealer/app/api/dashboard/layout/save/route.ts` or `apps/dealer/app/api/dashboard/layout/route.ts` (PATCH/POST) — save
- `apps/dealer/app/api/dashboard/layout/reset/route.ts` or same route DELETE — reset
- `apps/dealer/modules/dashboard/tests/` — merge, persistence, validation tests
- `apps/dealer/docs/DASHBOARD_PERSONALIZATION_BACKEND_REPORT.md` — new

### Step 3 (Frontend)
- `apps/dealer/app/(app)/dashboard/page.tsx` — load effective layout (from merge service), pass to client
- `apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx` — accept layout model, render by widget id
- `apps/dealer/components/dashboard-v3/DashboardCustomizePanel.tsx` (or Sheet content) — new: list widgets, toggles, reorder, save/cancel/reset
- `apps/dealer/components/dashboard-v3/` — optional: widget map (id → component) for dynamic render
- Dashboard header: add “Customize dashboard” entry point
- `apps/dealer/components/dashboard-v3/__tests__/` — customization and layout render tests
- `apps/dealer/docs/DASHBOARD_PERSONALIZATION_FRONTEND_REPORT.md` — new

### Step 4 (Security & QA)
- `apps/dealer/docs/STEP4_DASHBOARD_PERSONALIZATION_SECURITY_REPORT.md`
- `apps/dealer/docs/STEP4_DASHBOARD_PERSONALIZATION_SMOKE_REPORT.md`
- `apps/dealer/docs/STEP4_DASHBOARD_PERSONALIZATION_PERF_REPORT.md`

---

*Spec complete. No code until Step 2.*
