# Phase 0 — Dealer UI Inventory & Constraints (no code changes)

**Target:** apps/dealer. **Date:** inventory only.

---

## 1. Raw HTML UI elements in use

| Element | Where | Notes |
|--------|--------|------|
| `<button>` | WidgetRowLink, RecommendedActionsCard, login page, dialog.tsx, button.tsx, tabs.tsx, toast, suspended-banner, journey-bar, CustomersListPage, AuditPage, StageColumn, DetailPage, ActivityTimeline, ErrorBoundary | Many are intentional (Button component uses <button>; Dialog/Toast use internal buttons). WidgetRowLink and some pages use raw <button> instead of Button. |
| `<input>` | AutomationRulesPage (raw checkbox), login (likely via Input) | AutomationRulesPage uses raw `<input type="checkbox">` — should use a primitive if we add Checkbox. |
| `<select>` | — | Not found; Select component used where needed. |
| `<dialog>` | dialog.tsx (Radix or custom) | Via components/ui/dialog. |
| `<table>`, `<thead>`, `<tbody>` | components/ui/table.tsx | Wrapped in UI component; OK. |

---

## 2. Custom components that duplicate / mirror shadcn

- **components/ui/** contains: Button, Card (CardHeader, CardTitle, CardContent, CardFooter), Dialog, Input, Label, Popover, Select, Skeleton, Table (TableHeader, TableBody, TableRow, TableCell). These are the **canonical** primitives (shadcn-style, not from npm).
- **Dashboard-v3:** WidgetCard composes Card; MetricCard composes Card; QuickActionsCard composes Card; CustomerTasksCard, DealPipelineCard, etc. use WidgetCard. No duplicate “card” abstraction outside ui/.
- **Other:** Pagination, empty-state, error-state, write-guard, closed-screen, suspended-banner — these use Button/Card/Input where applicable; some use raw buttons or custom classes.

---

## 3. Tailwind arbitrary / non-token colors

**Dashboard-v3 (scope for token lock):**

| File | Non-token usage |
|------|------------------|
| CustomerTasksCard.tsx | SEVERITY_BADGE: bg-blue-100, text-blue-800, bg-emerald-100, text-emerald-800, bg-amber-100, text-amber-800, bg-red-100, text-red-800, bg-slate-100, text-slate-800 |
| DealPipelineCard.tsx | Same severity badge palette |
| InventoryAlertsCard.tsx | Same |
| MetricCard.tsx | ACCENT_BAR: bg-blue-500, bg-emerald-500, bg-violet-500, bg-amber-500, bg-slate-400; delta chip: bg-emerald-100, text-emerald-800, bg-red-100, text-red-800 |
| QuickActionsCard.tsx | ACTION_STYLE: bg-blue-600, hover:bg-blue-700, bg-emerald-600/700, bg-violet-600/700 |
| RecommendedActionsCard.tsx | text-amber-600 |

**Elsewhere in apps/dealer:**  
deals ListPage, DealFinanceTab, DealLendersTab, OpportunityDetailPage, JobsPage, platform (users, invites, dealerships), topbar (LifecycleBadge), suspended-banner, login, get-started, accept-invite, closed-screen, toast — use bg-*-100/50, text-*-800/600/900, border-*-200, etc.

---

## 4. Existing shadcn-style components under apps/dealer/components/ui

| Component | Present | Notes |
|-----------|--------|------|
| Button | ✅ | button.tsx |
| Card | ✅ | card.tsx |
| Input | ✅ | input.tsx |
| Label | ✅ | label.tsx |
| Select | ✅ | select.tsx |
| Table | ✅ | table.tsx |
| Tabs | ✅ | tabs.tsx |
| Dialog | ✅ | dialog.tsx |
| Popover | ✅ | popover.tsx |
| Skeleton | ✅ | skeleton.tsx |
| **Badge** | ❌ | Missing; status chips use raw spans with ad-hoc classes |
| **DropdownMenu** | ❌ | Missing; “More” / overflow menus would need it |
| **Separator** | ❌ | Missing |
| **Tooltip** | ❌ | Missing |
| **Sheet** | ❌ | Missing |

---

## 5. Dashboard-specific non-token usage summary

- **Metric cards:** Accent bar and delta chips use hardcoded blue/emerald/violet/amber/red/slate.
- **Widget rows:** Severity badges use blue/emerald/amber/red/slate.
- **Quick Actions:** Button colors use blue/emerald/violet.
- **Rest of layout:** Uses var(--panel), var(--border), var(--muted), var(--text) — token-ready; some border/40 or /60.

---

## 6. Constraints (no code changes in Phase 0)

- Server-first and RBAC: unchanged.
- Single theme: one palette, one radius scale, one shadow scale.
- All new UI must use components/ui primitives and semantic tokens (no new ad-hoc bg-*-500, etc.).
- Forbidden UI libraries: no MUI, antd, Chakra, Mantine, Bootstrap, etc. (enforced by ESLint in Phase 1).

---

*Proceeding to Phase 1 (tokens, theme lock, ban ad-hoc colors).*
