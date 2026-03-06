# Dealer UI Blueprint

Single source of truth for the dealer app UI system. All dealer UI MUST follow this blueprint.

---

## 1. Token-only rules (forbidden palette)

- **Forbidden:** Tailwind palette colors for UI (e.g. `bg-blue-100`, `text-amber-800`, `border-gray-200`, `bg-green-500`). Do not use `slate-`, `gray-`, `blue-`, `green-`, `red-`, `amber-`, `yellow-`, etc. for backgrounds, text, or borders.
- **Required:** Use only CSS variables via tokens. All colors, radii, shadows, and spacing MUST come from:
  - `apps/dealer/lib/ui/tokens.ts`
  - `apps/dealer/lib/ui/recipes/*.ts`
  - `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-soft)`, `var(--muted-text)`, `var(--accent)`, `var(--success-muted)`, `var(--warning-muted)`, `var(--danger-muted)`, `var(--info-muted)`, etc.
- **Exception:** Utility classes that do not set color (e.g. `flex`, `grid`, `w-full`, `overflow-hidden`) are allowed. Class names that reference CSS variables (e.g. `bg-[var(--surface)]`) are allowed.

---

## 2. Typography scale

Use the typography tokens from `lib/ui/tokens.ts`:

| Token              | Use case                    |
|--------------------|-----------------------------|
| `typography.pageTitle` | Page headings (e.g. "Inventory", "Customers") |
| `typography.cardTitle` | Card headers                |
| `typography.table`     | Table body text             |
| `typography.muted`     | Labels, secondary text      |
| `typography.mutedSoft` | Softer secondary text       |
| `typography.badge`     | Badges and status chips     |

Always pair with a text color token (e.g. `text-[var(--text)]`, `text-[var(--text-soft)]`). Do not hardcode font sizes or weights outside tokens.

---

## 3. Spacing scale

Use spacing from tokens and layout recipe:

- **Page:** `ui.page`, `spacing.pageX`, `spacing.pageY`
- **Grid gap:** `ui.grid`, `spacing.grid`, `spacingTokens.gridGap`
- **Card padding:** `spacing.cardPad`, `spacingTokens.cardPad`, `spacingTokens.cardHeaderPad`, `spacingTokens.cardContentPad`
- **Section/card stacks:** Use `sectionStack` or `cardStack` from `lib/ui/recipes/layout.ts` for consistent vertical rhythm.

Do not hardcode arbitrary spacing (e.g. `gap-7`, `p-5`) unless matching a token. Prefer token-based values (e.g. `gap-[var(--space-grid)]`).

---

## 4. Required recipes

All dealer UI MUST use these recipes where applicable.

### 4.1 DMSCard (card recipe)

- **Source:** `apps/dealer/lib/ui/recipes/card.ts` → consumed via `@/components/ui/dms-card` (`DMSCard`, `DMSCardHeader`, `DMSCardTitle`, `DMSCardContent`).
- **Rule:** Every card MUST use `DMSCard` (or the card recipe base). No raw `<Card>` or ad-hoc card class strings for content containers.
- **Non-negotiables:** `bg-[var(--surface)]`, `border border-[var(--border)]`, `rounded-[var(--radius-card)]`, `shadow-[var(--shadow-card)]`, `hover:shadow-[var(--shadow-card-hover)]`.

### 4.2 Table recipe

- **Source:** `apps/dealer/lib/ui/recipes/table.ts`.
- **Exports:** `tableScrollWrapper`, `tableHeaderRow`, `tableRowHover`, `tableHeadCell`, `tableCell`, `tablePaginationFooter`.
- **Rule:** All list tables MUST use these classes for sticky header, row hover, token borders, and pagination footer.

### 4.3 Layout recipe

- **Source:** `apps/dealer/lib/ui/recipes/layout.ts`.
- **Exports:** `summaryGrid`, `summaryGrid3`, `mainGrid`, `sectionStack`, `cardStack`.
- **Rule:** Use for page structure: summary card rows (`summaryGrid` / `summaryGrid3`), main content + right rail (`mainGrid`), vertical sections (`sectionStack`), and vertical card columns (`cardStack`).

### 4.4 Badge recipe

- **Source:** `apps/dealer/lib/ui/recipes/badge.ts`.
- **Exports:** Base (`badgeBase`) and semantic variants: `badgeSuccess`, `badgeWarning`, `badgeDanger`, `badgeInfo`, `badgeMuted`, `badgeNeutral`.
- **Rule:** All status chips and small label pills MUST use `badgeBase` plus one semantic variant (token-only, no palette colors).

---

## 5. Page patterns

### List page

- **Structure:** `PageShell` → `PageHeader` (title + actions) → optional `SummaryCardsRow` (using `summaryGrid` / `summaryGrid3`) → optional `FilterBar` → `MainGrid` (optional right rail with `mainGrid`) or single main content area.
- **Main content:** `DMSCard` wrapping table (table recipe) with pagination footer.

### Detail page

- **Structure:** `PageShell` → `PageHeader` (title + actions) → `mainGrid`: left column (`cardStack` of content cards), right column (280px, optional `cardStack` for Recon, Activity, etc.).
- **Content blocks:** Each block in a `DMSCard`.

### Form page

- **Structure:** `PageShell` → `PageHeader` → `sectionStack` or single column; form inside `DMSCard`(s). Use token spacing and inputs with token borders/radius.

### Dashboard

- **Structure:** `PageShell` → `PageHeader` → grid of widgets; each widget in `DMSCard`. Use `summaryGrid` or custom grid with token gap. No palette colors.

---

## 6. Acceptance checklist

Before merging dealer UI changes, verify:

- [ ] **No Tailwind palette colors** – No `bg-blue-*`, `text-gray-*`, `border-amber-*`, etc. Grep for common palette prefixes and fix.
- [ ] **Cards use DMSCard** – All card-like containers use `DMSCard` (or card recipe).
- [ ] **Tables use table recipe** – List tables use `tableScrollWrapper`, `tableHeaderRow`, `tableRowHover`, `tableHeadCell`, `tableCell`, `tablePaginationFooter`.
- [ ] **Layout uses layout recipe** – Summary rows use `summaryGrid` or `summaryGrid3`; main + rail use `mainGrid`; vertical stacks use `sectionStack` or `cardStack` where applicable.
- [ ] **Badges use badge recipe** – Status chips and label pills use `badgeBase` and semantic variants from `badge.ts`.
- [ ] **Typography from tokens** – Page title, card title, table text, muted text use `typography.*` or equivalent token classes.
- [ ] **Spacing from tokens** – Gaps and padding use `spacing*`, `spacingTokens*`, or layout recipe (no arbitrary `gap-*`/`p-*` unless aligned to token).
- [ ] **Shadows/radius from tokens** – Card shadow and radius use `var(--shadow-card)`, `var(--radius-card)`, etc.

---

*Last updated: Dealer UI Blueprint system.*
