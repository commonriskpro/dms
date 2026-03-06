# Phase 2 UI Migration

Dev note for token-based UI consistency across the dealer app. No Jest tests were added in this pass.

## Recipes added

- **`components/ui/dms-card.tsx`**  
  `DMSCard`, `DMSCardHeader`, `DMSCardTitle`, `DMSCardContent` — thin wrappers over shadcn Card with Dashboard V3 token defaults: `--radius-card`, `--surface`, `--border`, `--shadow-card`; header `px-4 pt-4 pb-3`; title `text-base font-semibold text-[var(--text)]`; content `px-4 pb-4 pt-0`. Overrides via `className` and `cn()`.

- **`components/ui/dms-page.tsx`**  
  `DMSPage` (page container: `px-6 py-6 bg-[var(--page-bg)] min-h-full`), `DMSSection` (vertical stack: `space-y-4`). Overrides via `cn()`.

- **`components/ui/dms-row.tsx`**  
  `DMSRow` (plain row: left badge + label, right meta; `min-h-[44px]`, optional hover); `DMSBadge` (small count pill). Token-only styles.

## Files migrated in this pass

- **App shell:** `components/app-shell/index.tsx` — sidebar column `sticky top-0 h-screen overflow-hidden`; main column `overflow-hidden`; only main content scrolls.
- **Dashboard V3:**  
  - `WidgetCard.tsx` — uses `DMSCard` / `DMSCardHeader` / `DMSCardTitle` / `DMSCardContent`.  
  - `MetricCard.tsx` — uses `DMSCard` / `DMSCardContent`.  
  - `WidgetRowLink.tsx` — uses `DMSRow` with variant-based `className`.  
  - `RecommendedActionsCard.tsx` — unchanged; uses `WidgetCard` (now DMS-backed).
- **Inventory:** `modules/inventory/ui/ListPage.tsx` — outer layout uses `DMSPage` and `DMSSection`; Filters and table blocks use `DMSCard` / `DMSCardHeader` / `DMSCardTitle` / `DMSCardContent`.

## Token compliance reminder

- **Do not use Tailwind palette classes in UI** (e.g. no `bg-slate-*`, `text-blue-*`, `border-gray-*`).
- Use CSS token variables only: `bg-[var(--surface)]`, `border-[var(--border)]`, `text-[var(--text)]`, `text-[var(--text-soft)]`, `ring-[var(--ring)]`, `bg-[var(--page-bg)]`, etc.
- New cards/surfaces should use the DMS recipes so radius, border, shadow, and padding stay consistent with Dashboard V3.
