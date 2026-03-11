# Dashboard Personalization — Frontend Report (Step 3)

## Summary

Frontend implements layout-driven dashboard rendering, a "Customize dashboard" entry point, and a customization panel (sheet) with show/hide toggles, reorder (up/down), and save/cancel/reset. Server-first load preserved; customization is client-side with API calls for save/reset.

## Deliverables

### A. Dashboard shell preserved
- Existing PageShell, metric cards, 3-column grid, and widget cards unchanged in structure and tokens.
- Added PageHeader with title "Dashboard" and optional "Customize dashboard" button when layout is provided.

### B. Server-first dashboard load
- Dashboard page (`app/(app)/dashboard/page.tsx`) loads saved layout and merges server-side; passes serializable `layout` to client with `initialData`.
- No fetch-on-mount for dashboard data or layout.

### C. Customization entry point
- "Customize dashboard" button in dashboard header (next to title), using SlidersHorizontal icon and outline button with tokens.
- Shown only when server provides a non-empty layout (user has at least one allowed widget).

### D. Personalization UI
- **Component:** `DashboardCustomizePanel` (Sheet, right side).
- **Show/hide:** List of widgets by zone (Metric row, Widgets); each row has title, optional description, Switch for visible (disabled for fixed widgets; "Always visible" label when fixed).
- **Reorder:** Up/down buttons per widget; order normalized within zone.
- **Save:** POST `/api/dashboard/layout` with draft payload; success → toast, close panel, `router.refresh()`.
- **Cancel:** Close sheet without saving.
- **Reset:** Confirm dialog → POST `/api/dashboard/layout/reset` → toast, close, `router.refresh()`.
- Buttons disabled while saving; no duplicate submit.

### E. Dashboard rendering
- `DashboardExecutiveClient` accepts optional `layout: DashboardLayoutItem[]`.
- When `layout.length > 0`: visible items sorted by zone then order; topRow rendered as one row of metric cards; main widgets distributed to 3 columns by index % 3. Widget id → component mapping in `renderMainWidget` / metric props map.
- When no layout: fallback to previous hardcoded order and permission-based visibility (no regression).
- Unknown widget ids do not crash (renderMainWidget returns null).

### F. UX and tokens
- Sheet, buttons, switches, and list rows use `var(--surface)`, `var(--border)`, `var(--text)`, `var(--muted-text)`, `var(--ring)` only.
- No Tailwind palette classes added.
- Confirm dialog and toast from existing providers.

### G. Performance
- No dashboard-wide client refetch on mount.
- Layout and initialData from server; customization panel state is local draft until save.

### H. Tests
- Existing dashboard client tests (page.test.tsx, dashboard-v3-render.test.tsx) still pass (layout optional).
- Snapshots updated for new PageHeader and token-based layout.

## Files added/changed

| Path | Change |
|------|--------|
| apps/dealer/components/dashboard-v3/types.ts | Added `DashboardLayoutItem` |
| apps/dealer/components/dashboard-v3/DashboardExecutiveClient.tsx | Layout-driven render; PageHeader; Customize button; panel |
| apps/dealer/components/dashboard-v3/DashboardCustomizePanel.tsx | New: Sheet with list, toggles, reorder, save/cancel/reset |
| apps/dealer/app/(app)/dashboard/page.tsx | Load saved layout, merge, pass `layout` to client |
| apps/dealer/modules/dashboard/service/merge-dashboard-layout.ts | Added `toSerializableLayout` |
| apps/dealer/lib/ui/icons.ts | Added ChevronUp, ChevronDown |
| apps/dealer/components/dashboard-v3/__tests__/__snapshots__/*.snap | Updated for header and icons |

## Next (Step 4)

Security and QA hardening; tenant isolation and RBAC checks; smoke and perf reports.
