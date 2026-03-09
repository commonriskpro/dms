/**
 * Canonical layout recipe for dealer app pages.
 * Use for summary rows, main + rail grid, and vertical stacks.
 * Token-only (gap from --space-grid where applicable).
 */

/** Summary cards row: 4 columns on lg (inventory, deals). */
export const summaryGrid =
  "grid gap-[var(--space-grid)] grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch";

/** Summary cards row: 3 columns on lg (customers). */
export const summaryGrid3 =
  "grid gap-[var(--space-grid)] grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch";

/** Main content + right rail: 1fr and 280px on lg. */
export const mainGrid =
  "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]";

/** Vertical stack of page sections (e.g. header, summary, filters, content). */
export const sectionStack =
  "flex flex-col gap-4";

/** Vertical stack of cards (e.g. left column on detail page). */
export const cardStack =
  "flex flex-col gap-4 min-w-0";

/** Costs tab: top summary row — two cards, tight gap. */
export const costsTabSummaryGrid =
  "grid grid-cols-1 gap-3 md:grid-cols-2 items-stretch";

/** Costs tab: main workspace row — ledger + documents rail (320px on lg). */
export const costsTabWorkspaceGrid =
  "grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_320px]";
