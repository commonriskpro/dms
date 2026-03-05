# Phase 2 UI System Spec

Single source of truth for dealer app layout, spacing, typography, and canonical components. **Inventory is the reference page.** Every future page should follow this pattern.

---

## 1. Layout Primitives

### PageShell

- **Purpose:** Outer page wrapper; sets background and page padding.
- **Usage:** Wrap entire page content.
- **Tokens:** `min-h-full bg-[var(--page-bg)]`, `px-[var(--space-page-x)] py-[var(--space-page-y)]`.
- **Location:** `components/ui/page-shell.tsx` — `PageShell`.

### PageHeader

- **Purpose:** Top row of the page: title (left), actions (right).
- **Usage:** First child inside PageShell; same layout as Dashboard.
- **Layout:** `flex items-center justify-between`; title in `min-w-0`, actions in `flex items-center gap-3 shrink-0`.
- **Location:** `components/ui/page-shell.tsx` — `PageHeader`.

### ContentGrid

- **Purpose:** Main content area; optional two-column layout (main + right rail).
- **Usage:** After PageHeader, SummaryCardsRow, FilterBar.
- **Pattern:** `grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]` when right rail is present.
- **Tokens:** `gap-[var(--space-grid)]` or `gap-4` (16px) for consistency.

### RightRail

- **Purpose:** Fixed-width sidebar column (e.g. Quick Actions + Alerts).
- **Width:** `280px`.
- **Usage:** Second column in ContentGrid; contains stacked cards (QuickActionsCard, AlertsCard).
- **Location:** `modules/inventory/ui/components/InventoryRightRail.tsx`.

---

## 2. Spacing Scale

All spacing must use the same scale. Prefer CSS vars where defined in `globals.css`.

| Token / usage      | Value   | Tailwind / CSS var              |
|--------------------|--------|----------------------------------|
| Page padding x     | 24px   | `px-[var(--space-page-x)]`      |
| Page padding y     | 24px   | `py-[var(--space-page-y)]`      |
| Section gap        | 16px   | `gap-[var(--space-grid)]` or `gap-4` |
| Grid gap           | 16px   | `gap-[var(--space-grid)]`       |
| Card padding       | 16px   | `p-4` or `px-4 py-4`            |
| Card header        | px 16, pt 16, pb 12 | `px-4 pt-4 pb-3`        |
| Card content       | px 16, pb 16, pt 0  | `px-4 pb-4 pt-0`        |
| Filter bar padding | 16px   | `px-4 py-3`                     |
| Table cell         | 16px   | `p-4`                           |

---

## 3. Typography

Use design tokens / CSS vars only. Sizes map to `globals.css` (--text-*).

| Element      | Size   | Weight   | Token / class                                      |
|-------------|--------|----------|----------------------------------------------------|
| Page title  | 24px   | semibold | `text-[24px] font-semibold leading-tight text-[var(--text)]` |
| Card title  | 16px   | semibold | `text-base font-semibold text-[var(--text)] text-left`      |
| Table text  | 14px   | normal   | `text-sm` (table default); `text-[var(--text)]`              |
| Muted text  | 14px   | normal   | `text-sm text-[var(--muted-text)]` or `text-[var(--text-soft)]` |
| Badge/chip  | 12px   | medium   | `text-xs font-medium`                              |

---

## 4. Canonical Components

### DMSCard / WidgetCard

- **Canonical card recipe:** All cards must include:
  - `bg-[var(--surface)]`
  - `border border-[var(--border)]`
  - `rounded-[var(--radius-card)]`
  - `shadow-[var(--shadow-card)]`
  - `hover:shadow-[var(--shadow-card-hover)]`
  - `transition-shadow duration-150`
- **DMSCard:** `components/ui/dms-card.tsx` — DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent.
- **WidgetCard:** Dashboard widget wrapper using DMSCard; title left-aligned, no decorative dots.
- **Recipe export:** `lib/ui/recipes/card.ts` exports canonical card base classes for reuse.

### Summary metric cards

- Same padding, shadow, radius as dashboard metric cards.
- Title: left-aligned, `text-sm font-semibold text-[var(--text)]`.
- Thin progress bar: `h-[6px]`, token background (e.g. `var(--accent-inventory)`).
- **Location:** `modules/inventory/ui/components/InventorySummaryCards.tsx`.

### Filter bar

- Surface strip: one horizontal row, card-like (border, shadow, token surface).
- Left: pill buttons (rounded, `bg-[var(--surface-2)] border-[var(--border)]`).
- Right: actions (Create Plans, Save Search dropdown).
- **Location:** `modules/inventory/ui/components/InventoryFilterBar.tsx`.

### Inventory table

- Inside a DMSCard; sticky table header; row hover: `hover:bg-[var(--surface-2)]/60`.
- Status badges: semantic tokens (e.g. `--success-muted`, `--warning-muted`); no palette classes.
- Pagination row at bottom inside card; token border-top.
- **Location:** `modules/inventory/ui/components/InventoryTableCard.tsx`.

### Right rail cards

- **QuickActionsCard:** Buttons (Add Vehicle, Add Lead, Start Deal); token styles, focus-visible ring.
- **AlertsCard:** Vertical list (Missing Photos, Units > 90 days, Units Need Recon); token hover/focus.
- **Location:** `modules/inventory/ui/components/InventoryQuickActionsCard.tsx`, `InventoryAlertsCard.tsx`.

### Chips / status badges

- Rounded pill/chip: `rounded-[var(--radius-input)]` or `rounded-full`; padding `px-2 py-0.5`.
- Use semantic tokens only: `bg-[var(--success-muted)] text-[var(--success-muted-fg)]`, etc.
- **Never:** `bg-slate-*`, `text-blue-*`, or other Tailwind palette classes.

### Buttons

- shadcn `Button`; override only with token classes when needed.
- Focus: `focus-visible:ring-2 focus-visible:ring-[var(--ring)]`.
- Use `rounded-[var(--radius-button)]` or default Button radius.

---

## 5. Reference Page Structure (Inventory)

Every future page should copy this layout pattern:

1. **PageShell**
2. **PageHeader** — title left, “Last updated” + Refresh (or equivalent) right
3. **SummaryCardsRow** (optional) — 4 metric/summary cards
4. **FilterBar** (optional) — pills + actions surface strip
5. **MainGrid** — main content card (e.g. table) + **RightRail** (optional, 280px)
6. Footer links (e.g. “View aging report”) if needed

---

## 6. Non-Negotiable UI Rules

- **Components:** Use only shadcn/ui (Card, Button, Table, DropdownMenu, Badge, Input, Dialog).
- **Colors/shadows/borders:** Only design tokens / CSS vars (e.g. `bg-[var(--surface)]`, `shadow-[var(--shadow-card)]`). Never Tailwind palette classes (`bg-slate-*`, `text-blue-*`, `border-gray-*`).
- **Cards:** Must use the canonical card recipe (surface, border, radius, shadow, hover shadow, transition).
- **Spacing:** Use the same spacing scale (page padding, section gap, card padding, grid gap).
- **Focus:** Buttons and interactive elements must have visible focus (e.g. `focus-visible:ring-[var(--ring)]`).
- **Inline styles:** Avoid; allow only for dynamic values (e.g. progress bar width).
