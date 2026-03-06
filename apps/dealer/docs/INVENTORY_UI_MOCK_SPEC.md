# Inventory Page UI Mock Spec

UI-only migration to match the "inventory focused layout" mock. No business-logic changes except where required to render the layout.

---

## 1. Layout Grid Definition

- **Page shell:** Same as Dashboard — `PageShell` + `PageHeader` (title left, "Last updated …" + Refresh right).
- **Row 1 — Summary cards:** 4 cards in a grid (`grid gap-[var(--space-grid)] md:grid-cols-2 lg:grid-cols-4`).
  - Card 1: **Total** (total vehicle count).
  - Card 2: **In Recon** (count with status REPAIR or equivalent).
  - Card 3: **Sale Pending** (count with status HOLD or equivalent).
  - Card 4: **Inventory Value** (bigger feel; optional progress or value; primary action "+ Add Vehicle").
- **Row 2 — Filters / actions bar:** Single horizontal strip (surface with border/shadow).
  - Left: Pill buttons — "Advanced Filters", "17 floor planned", "9 previously sold" (or derived counts).
  - Right: "+ Create Plans", "Save Search" (dropdown).
- **Row 3 — Main content:** Two columns.
  - Left (dominant): **Inventory list table** inside a card (sticky table header, row hover, status chips, pagination at bottom).
  - Right: **Right rail** (fixed width ~280–320px):
    - **Quick Actions** card (e.g. Add Vehicle, Add Lead, Start Deal).
    - **Alerts** card with rows: "Missing Photos", "Units > 90 days", "Units Need Recon" (or equivalent).

---

## 2. Component Map

| File | Purpose |
|------|--------|
| `dealer/app/inventory/page.tsx` | Route: render `<InventoryPage />`. |
| `dealer/modules/inventory/ui/InventoryPage.tsx` | **New.** Full page layout: header, summary row, filter bar, main (table + right rail). Composes extracted components. |
| `dealer/modules/inventory/ui/components/InventorySummaryCards.tsx` | **New.** Four summary cards (Total, In Recon, Sale Pending, Inventory Value). Uses DMSCard / dashboard metric style. |
| `dealer/modules/inventory/ui/components/InventoryFilterBar.tsx` | **New.** Pills left, actions right; surface strip. |
| `dealer/modules/inventory/ui/components/InventoryTableCard.tsx` | **New.** Wraps table in a card; sticky header, row hover, status chips, pagination. Hosts logic moved from ListPage (table + pagination). |
| `dealer/modules/inventory/ui/components/InventoryRightRail.tsx` | **New.** Right column: Quick Actions + Alerts. |
| `dealer/modules/inventory/ui/components/InventoryQuickActionsCard.tsx` | **New.** Quick Actions panel (buttons). |
| `dealer/modules/inventory/ui/components/InventoryAlertsCard.tsx` | **New.** Alerts panel with alert rows. |
| `dealer/modules/inventory/ui/ListPage.tsx` | **Refactor.** Becomes a thin wrapper or is replaced by InventoryPage; list/table state and fetch stay in InventoryTableCard or InventoryPage (single source of truth). |

---

## 3. Token Usage Rules

- **Shadows:** `shadow-[var(--shadow-card)]`, `hover:shadow-[var(--shadow-card-hover)]`, `transition-shadow duration-150`. No hardcoded shadow values.
- **Radius:** `rounded-[var(--radius-card)]` for cards; buttons/inputs use `var(--radius-button)` / `var(--radius-input)`.
- **Borders:** `border-[var(--border)]`.
- **Surfaces:** `bg-[var(--surface)]`, `bg-[var(--surface-2)]`, `bg-[var(--page-bg)]`.
- **Text:** `text-[var(--text)]`, `text-[var(--text-soft)]`, `text-[var(--muted-text)]`.
- **Focus:** `focus-visible:ring-2 focus-visible:ring-[var(--ring)]`.
- **Status chips/badges:** Use semantic tokens (e.g. `--success-muted`, `--warning-muted`, `--danger-muted`) or existing badge tokens; no Tailwind palette literals (e.g. no `text-blue-500`).

---

## 4. Must Match Mock Checklist

- [x] Page header: "Inventory" left (same style as Dashboard heading); right: "Last updated …" + Refresh.
- [x] Summary row: 4 cards, same radius/shadow as dashboard; title padding matches Inventory metric cards; thin progress bar where used.
- [x] Card titles left-aligned; no decorative dots under titles.
- [x] All cards use base + hover shadow (tokens).
- [x] Filter bar: surface strip; pills rounded, soft background, token border; actions on the right.
- [x] Main: table card dominant; right rail with Quick Actions + Alerts.
- [x] Table: sticky header inside card; row hover subtle (token); status chips soft filled (tokens).
- [x] Pagination row at bottom of table card.
- [x] Typography consistent with dashboard; tokens only (no palette literals).
- [x] No inline `style={{}}` except progress bar width/color (unavoidable); keyboard focus visible.

---

## 5. Data / Logic Notes

- Summary counts (Total, In Recon, Sale Pending) can be derived from list response `meta.total` and client-side status filters, or from a future summary API. Inventory Value can be placeholder or sum from current page.
- Table data, sorting, pagination, and filters remain as in current ListPage; move into `InventoryTableCard` (or keep state in InventoryPage and pass down) without changing API contracts.
