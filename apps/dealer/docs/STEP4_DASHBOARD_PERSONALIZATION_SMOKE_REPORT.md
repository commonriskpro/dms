# Step 4 — Dashboard Personalization Smoke Report

## Regression checklist

| Item | Status | Notes |
|------|--------|--------|
| Dashboard still renders server-first | Pass | Page is async server component; `getDashboardV3Data` and layout merge run on server; `initialData` and `layout` passed to client. |
| No fetch-on-mount regression | Pass | DashboardExecutiveClient uses `initialData` and `layout` from props; no useEffect that fetches dashboard or layout on mount. |
| Command palette, modals, toasts, error boundaries | Pass | No changes to those systems; ConfirmDialog and Toast used in customization panel. |
| Current dashboard widgets unchanged | Pass | Same widget components; layout-driven path uses same MetricCard and main widgets; fallback when no layout preserves previous behavior. |
| No style drift from design system | Pass | Token-only classes (var(--surface), var(--border), etc.); no Tailwind palette classes added. |
| No hardcoded palette classes | Pass | DEALER_UI_BLUEPRINT and .cursorrules enforced; new code uses tokens only. |
| Mobile layout | Pass | Sheet is responsive; grid remains responsive; no layout breakage introduced. |
| Tests from repo root | Pass | `merge-dashboard-layout`, `dashboard-layout-schemas`, `dashboard-layout-persistence`, dashboard client and page tests pass; snapshots updated. |

## Smoke scenarios

1. **First load (no saved layout):** User has permissions → dashboard shows default widget set and order; "Customize dashboard" visible; no errors.
2. **Customize → change visibility/order → Save:** Draft updates; POST returns 200; router.refresh(); dashboard reflects new layout.
3. **Customize → Cancel:** Sheet closes; no API call; next open shows server layout again.
4. **Reset to default:** Confirm → POST reset → refresh; layout returns to registry default.
5. **No permission for dashboard:** User lacks customers.read and crm.read → access message (unchanged behavior).
