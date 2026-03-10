/**
 * Canonical table recipe for list tables.
 * Matches the inventory workbench card style: uppercase headers, text-sm cells,
 * border-b row dividers, hover tint at /50.
 */

/** Wrapper for scrollable table area (e.g. inside a card) */
export const tableScrollWrapper =
  "overflow-x-auto overflow-y-auto flex-1";

/** Sticky header row - use on TableRow that wraps TableHead cells */
export const tableHeaderRow =
  "sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)]";

/** Body row hover - use on TableRow for data rows */
export const tableRowHover =
  "cursor-pointer hover:bg-[var(--surface-2)]/50 transition-colors border-b border-[var(--border)] last:border-b-0";

/** Compact table density (dashboard workbench rhythm). Use for all list/queue tables. */
export const tableHeadCellCompact =
  "h-8 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-text)]";

/** Compact table body cell: px-3 py-2, text-sm. */
export const tableCellCompact =
  "px-3 py-2 align-middle text-sm";

/** Compact table row min-height (36px). Use with tableRowHover on list/queue rows. */
export const tableRowCompact =
  "min-h-9";

/** Pagination footer strip - inside card below table */
export const tablePaginationFooter =
  "border-t border-[var(--border)] px-4 py-2.5 bg-[var(--surface)]";
