# Step 3 — Dashboard V3 UI Implementation Report

## Summary

Frontend-only implementation to match the Dealer Dashboard mock and `docs/DASHBOARD_V3_UI_BLUEPRINT.md`. No backend, service, or DB changes.

---

## Files Changed

### Phase A — Tokens
- **apps/dealer/app/globals.css** — Added blueprint CSS variables: `--page-bg`, `--surface`, `--surface-2`, `--shadow-card`, `--shadow-sidebar`, `--sidebar-top`, `--sidebar-bottom`, `--sidebar-text`, `--sidebar-text-strong`, `--sidebar-pill`, `--sidebar-pill-active`, `--accent-inventory`, `--accent-leads`, `--accent-bhph`, `--sev-info`, `--sev-success`, `--sev-warning`, `--sev-danger`, `--ring`, `--radius-pill`.
- **apps/dealer/lib/ui/tokens.ts** — `dashboardCard` and `dashboardPageBg` now use blueprint vars (`--surface`, `--surface-2`, `--page-bg`, `--shadow-card`). Added `sevBadgeClasses` and updated `metricAccentBarClasses` to use `--accent-inventory`, `--accent-leads`, `--accent-bhph`. `widgetRowSurface` uses `--surface-2`, 44px min-h, rounded-[12px].

### Phase B — AppShell, Sidebar, Topbar
- **apps/dealer/components/app-shell/index.tsx** — Layout: `min-h-screen bg-[var(--page-bg)] grid grid-cols-[272px_1fr] gap-6 p-6`; sidebar column; main column with Topbar + content; `SuspendedBanner` spans full width.
- **apps/dealer/components/app-shell/sidebar.tsx** — Rewritten: 272px, rounded-[24px], gradient `from-[var(--sidebar-top)] to-[var(--sidebar-bottom)]`, shadow; brand row (icon + "DMS AUTO" + hamburger); nav items with pill hover/active (`--sidebar-pill`, `--sidebar-pill-active`); dividers `bg-white/10`; footer dealership switch row. All palette classes removed; tokens only.
- **apps/dealer/components/app-shell/topbar.tsx** — Rewritten: h-16, px-6; centered search wrapper 560px; right cluster: refresh, notifications, apps (ghost icon buttons) + avatar + Sign out. `LifecycleBadge` uses `--sev-success`, `--sev-warning`, `--sev-danger` (no emerald/amber/red). No palette classes.

### Phase C — Dashboard grid and cards
- **apps/dealer/components/dashboard-v3/DashboardV3Client.tsx** — Grid layout: Row 2 = Customer Tasks (5) + Inventory Alerts (4) + Recommended Actions (3). Row 4 = Finance Notices (9) + Quick Actions (3). Removed CrmPromoCard from row 2. Header: "Last updated …" + Refresh (uses `window.location.reload()`). All token-based.
- **apps/dealer/components/dashboard-v3/MetricCard.tsx** — Blueprint layout: label + big number (text-4xl); icon tile top-right (h-9 w-9 rounded-xl, `--surface-2`); helper line "+N listed"; progress bar with `--accent-inventory` / `--accent-leads` / `--accent-deals` / `--accent-bhph`. Min-h 108px, padding 16px.
- **apps/dealer/components/dashboard-v3/WidgetCard.tsx** — Header row: title + "…" menu button (ghost). Card padding per blueprint.
- **apps/dealer/components/dashboard-v3/CustomerTasksCard.tsx** — WidgetRow: 44px, `--surface-2`, badge h-7 w-7 rounded-[10px] using `sevBadgeClasses.info`. Right: count • N Total.
- **apps/dealer/components/dashboard-v3/InventoryAlertsCard.tsx** — Same row structure; badges use `sevBadgeClasses` by severity.
- **apps/dealer/components/dashboard-v3/DealPipelineCard.tsx** — Same row structure; badges use `--accent-deals` or `sevBadgeClasses` by severity.
- **apps/dealer/components/dashboard-v3/RecommendedActionsCard.tsx** — Stack of mini-panels: rounded-[14px], `--surface-2`, border; icon + title + "Review" Button (secondary, rounded-[12px]). Title "Recommended Actions".
- **apps/dealer/components/dashboard-v3/QuickActionsCard.tsx** — Two buttons (2-up) + one full-width; h-11, rounded-[12px]. Add Vehicle = `--accent-deals`, Add Lead = `--accent-leads`, Start Deal = `--accent-inventory`.

### Phase D — Dashboard page
- **apps/dealer/app/dashboard/page.tsx** — Unchanged; already server-first, passes `initialData` to `DashboardV3Client`. Wrapper uses `dashboardPageBg` (now `bg-[var(--page-bg)]`).

### Phase E — Guardrails
- **apps/dealer/components/dashboard-v3/__tests__/dashboard-style-policy.test.ts** — New. Scans `components/dashboard-v3/**`, `components/layout/**`, `components/app-shell/**`, `app/dashboard/**` for forbidden Tailwind palette classes (e.g. `bg-blue-500`, `text-slate-600`). Fails if any match.
- **apps/dealer/components/dashboard-v3/__tests__/dashboard-snapshots.test.tsx** — Fixed time via `jest.setSystemTime("2026-03-04T20:00:00.000Z")` for stable "Last updated 8 hours ago". Snapshots updated for MetricCard, WidgetCard, DashboardV3Client.
- **apps/dealer/app/dashboard/__tests__/dashboard-v3-render.test.tsx** — Updated: metric helper text "+7 listed"; severity pattern `--sev-warning`/`--sev-danger`; "Recommended Actions" and "Review" button text.

---

## Blueprint Compliance

- **Layout:** Sidebar 272px, radius 24px, gradient and shadow; Topbar 64px, 560px search, right cluster; page padding and grid (12 cols, gap 16) match blueprint.
- **Tokens:** All new/updated tokens from blueprint are in `globals.css` and used via `var(--...)` or `lib/ui/tokens.ts`. No Tailwind palette classes in dashboard shell or dashboard-v3.
- **MetricCard / WidgetCard / WidgetRow / RecommendedActions / QuickActions:** Structure and tokens follow blueprint sections 5–10.

---

## Token List Used

From **globals.css** (existing + blueprint):

- Page/surfaces: `--page-bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-soft`
- Shadows: `--shadow-card`, `--shadow-sidebar`
- Sidebar: `--sidebar-top`, `--sidebar-bottom`, `--sidebar-text`, `--sidebar-text-strong`, `--sidebar-pill`, `--sidebar-pill-active`
- Metric accents: `--accent-inventory`, `--accent-leads`, `--accent-deals`, `--accent-bhph`
- Severity: `--sev-info`, `--sev-success`, `--sev-warning`, `--sev-danger`
- Controls: `--ring`, `--radius-card`, `--radius-pill`, `--radius-input`

(Existing tokens such as `--bg`, `--panel`, `--muted`, `--accent` remain for non-dashboard UI.)

---

## Screenshots

Compare the running app side-by-side with the provided mock:

1. **Sidebar:** 272px, dark gradient, "DMS AUTO" brand row, nav pills, footer with dealership name.
2. **Topbar:** Centered search (560px), right icons + avatar.
3. **Dashboard:** Title "Dashboard"; "Last updated X min ago" + Refresh; 12-col grid; four metric cards (icon tile, number, helper, progress bar); widget cards with "…" menu and 44px rows with colored left badges; Recommended Actions as stacked panels; Quick Actions 2-up + full-width.

Run `npm run dev:dealer` from repo root, open `/dashboard`, and compare.

---

## Commands Run and Results

From repo root:

| Command | Result |
|--------|--------|
| `npm ci` | Not re-run (EPERM on Prisma during build is environment-specific). |
| `npm -w apps/dealer run build` | Failed with EPERM (rename .dll.node) — process/lock issue, not code. |
| `npm -w apps/dealer run test` | **Passed** — 77 test suites, 416 tests, 3 snapshots. |

Policy and snapshot tests:

- `dashboard-style-policy.test.ts` — **Passed** (no forbidden palette in dashboard-v3, layout, app-shell, app/dashboard).
- `dashboard-ui-tokens.test.ts` — **Passed**.
- `dashboard-snapshots.test.tsx` — **Passed** (fixed time, updated snapshots).
- `dashboard-v3-render.test.tsx` — **Passed** (updated expectations for metric helper, severity tokens, Recommended Actions).

---

## Determinism

- No Tailwind palette classes in dashboard shell or dashboard-v3; style policy test enforces this.
- Snapshots use fixed `dashboardGeneratedAt` and `jest.setSystemTime` so "Last updated" text is stable.
- Refresh uses `window.location.reload()` (deterministic, no fetch-on-mount).
