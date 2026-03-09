# Secondary Page Visual Parity — Performance Notes (Step 3)

**Scope:** Audit only the pages and components touched in Step 2. No redesign; no compact table density change unless a real bug; no backend/routes/RBAC changes. Performance notes and tiny safe hardening only.

---

## 1. Pages audited

| Area | List | Detail / workspace | Notes |
|------|------|--------------------|--------|
| Inventory | `InventoryPageContentV2` | `VehicleDetailPage` / `VehicleDetailContent` | List: server-first (route fetches `getInventoryPageOverview`, passes `initialData`). |
| Deals | `DealsPage` | `DealDeskWorkspace` | List: client fetch. Workspace: client state. |
| Customers | `CustomersPageClient` | `DetailPage` / `CustomerDetailContent` | List: server-first (route fetches list, summary, saved filters/searches). |
| Opportunities | `OpportunitiesTablePage` | — | Client fetch. |
| Inbox | `InboxPageClient` | — | Client fetch. |
| Queues | `DeliveryQueuePage`, `FundingQueuePage`, `TitleQueuePage` | — | Client fetch. |
| CRM jobs | `JobsPage` | — | Client fetch; uses `QueueLayout` + preview panel. |

---

## 2. Server-first loading

- **Preserved.** Step 2 did not change data loading or route structure.
  - **Inventory list:** Route remains async; calls `getInventoryPageOverview` and passes `initialData` into `InventoryPageContentV2`. Client component still receives server data on first paint.
  - **Customers list:** Route remains async; fetches list, summary, saved filters, saved searches and passes into `CustomersPageClient`. No new client-only fetch introduced for initial load.
- **Deals list:** Remains client-fetched (no server data in route). No change.
- No new `useEffect`-driven fetches were added for the shell (PageShell, PageHeader, filter bar). All polish is presentational (class names / wrappers).

**Conclusion:** Server-first loading where already present is unchanged. No action required.

---

## 3. Client churn from visual wrappers

- **PageShell:** Pure presentational wrapper. Uses `layoutTokens.pageShell` and `layoutTokens.pageStack` (or grid when `rail` is used). No internal state, no context, no refs. Renders a div tree with `cn()` and spread props. No extra client churn.
- **PageHeader:** Pure presentational. Renders a `<header>` and children. No state. Receives `title`, `description`, `actions` as props; when parent re-renders, props may be new object identity (e.g. `title={<h1 className={...}>Deals</h1>}`), but the component itself does not cause downstream state updates or effect runs. No new subscriptions or listeners.
- **Filter bar wrappers:** Step 2 applied `layoutTokens.filterBar` (or equivalent) to existing filter rows. Same structure as before; only class names changed. No new state or context.
- **Widget / card sections:** Replaced DMSCard/SummaryCard with `<section className={widgetTokens.widget}>` (and similar). Still static class names from tokens. No state added inside these sections.

**Conclusion:** Visual wrappers do not introduce meaningful client churn. No action required.

---

## 4. Compact table recipe — lightweight

- **Location:** `lib/ui/recipes/table.ts`.
- **Contents:** Exports are string constants (e.g. `tableScrollWrapper`, `tableHeaderRow`, `tableHeadCellCompact`, `tableCellCompact`, `tableRowCompact`, `tableRowHover`). No React, no hooks, no state, no context. No runtime cost beyond applying class names.
- **Usage:** List and queue tables apply these strings to `TableRow`, `TableHead`, `TableCell` via `className`. No wrapper components, no extra DOM nodes from the recipe itself.
- **Bundle:** Recipe file is small; tree-shaking keeps only the exports used by each page.

**Conclusion:** Compact table recipe remains lightweight. No action required.

---

## 5. Rerender pressure from PageHeader / PageShell / filter bar

- **PageHeader / PageShell:** No internal state. Parent re-renders (e.g. from list `useState` or fetch completion) cause these components to re-render, but they do not trigger additional state updates or effects. No cascading rerender risk from the polish itself.
- **Filter bars:** Filter state (e.g. status, search) continues to live in the same parent components as before. We did not lift state or add new context. No new rerender pressure.
- **Title prop identity:** Some pages pass `title={<h1 className={typography.pageTitle}>…</h1>}`. A new element is created on each parent render. This does not by itself cause layout thrash or measurable perf impact; it is a normal React pattern. Optional future hardening: pass a stable `title` (e.g. memoized or string where layout accepts it) if profiling ever shows header as hot. Not required for Step 3.

**Conclusion:** No unnecessary rerender pressure identified from Step 2 polish. No code change required.

---

## 6. Theme switching

- **Styling:** All Step 2 changes use CSS variables (e.g. `var(--text)`, `var(--border)`, `var(--surface)`, `var(--shadow-card)`). No raw hex or theme-specific branches in the touched components.
- **Theme application:** Theme is applied at the app root (e.g. class on `html` or body). PageShell, PageHeader, filter bar, table recipe, and widget/card sections do not read theme from context or props; they only consume variables. Switching theme updates the variables and repaints; no remount or extra logic in our wrappers.

**Conclusion:** Theme switching remains stable. No action required.

---

## 7. Layout thrash on dense pages

- **Spacing:** We use consistent spacing (`space-y-3`, `gap-4`, `gap-3`) and fixed token-based padding. No content-dependent layout that would shift after paint (e.g. no “measure then set” patterns added).
- **Tables:** Compact recipe uses fixed `min-h-9`, `px-3 py-2`, `text-[13px]`. No conditional heights or widths that depend on content or client state. Sticky header uses `sticky top-0`; no dynamic positioning added.
- **Cards / widgets:** Fixed padding (`p-5` from `widgetTokens.widget`) and borders. No layout that reflows based on async content in a way that would cause visible thrash.

**Conclusion:** No layout thrash risk introduced. No action required.

---

## 8. Optional tiny safe hardening (no obligation)

- **Stable title (future):** If a page ever wants to avoid recreating the title element on every render, it can memoize: `const title = useMemo(() => <h1 className={typography.pageTitle}>Deals</h1>, []);` and pass `title` to `PageHeader`. Not needed for current perf; only if profiling targets header subtree.
- **Table keys:** List and queue tables already use stable row keys (`key={row.id}`, `key={d.id}`, etc.). No change needed.
- **No new shared primitives:** Step 2 did not introduce new context providers or global state. No hardening needed there.

---

## 9. Summary

| Requirement | Status |
|-------------|--------|
| Preserve server-first loading where present | Preserved (inventory list, customers list). |
| Avoid client churn from visual wrappers | No new churn; wrappers are presentational. |
| Compact table recipe remains lightweight | Yes; string-only recipe. |
| No unnecessary rerender pressure from polish | None identified. |
| Theme switching stable | Yes; token-only styling. |
| No layout thrash on dense pages | No thrash risk from Step 2. |

**Step 3 outcome:** Performance audit complete. No code changes required for performance; no compact table density or backend/routes/RBAC changes. Optional memoized title is documented only for future use if ever needed.
