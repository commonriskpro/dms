/**
 * Canonical table recipe for list tables.
 * Use with shadcn Table components; ensures sticky header, row hover, token borders and typography.
 */

/** Wrapper for scrollable table area (e.g. inside a card) */
export const tableScrollWrapper =
  "overflow-x-auto overflow-y-auto flex-1";

/** Table root - full width, caption-bottom, token text */
export const tableRoot =
  "w-full caption-bottom text-sm text-[var(--text)]";

/** Sticky header row - use on TableRow that wraps TableHead cells */
export const tableHeaderRow =
  "sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] hover:bg-[var(--surface)]";

/** Body row hover - use on TableRow for data rows */
export const tableRowHover =
  "cursor-pointer hover:bg-[var(--surface-2)]/60 transition-colors border-b border-[var(--border)]";

/** Table head cell - left align, token muted text */
export const tableHeadCell =
  "h-10 px-4 text-left align-middle font-medium text-[var(--text-soft)]";

/** Table body cell - padding */
export const tableCell =
  "p-4 align-middle";

/** Compact table density (dashboard workbench rhythm). Use for all list/queue tables. */
export const tableHeadCellCompact =
  "h-9 px-3 text-left align-middle font-medium text-[var(--text-soft)] text-[13px]";

/** Compact table body cell: px-3 py-2, 13px text. */
export const tableCellCompact =
  "px-3 py-2 align-middle text-[13px]";

/** Compact table row min-height (36px). Use with tableRowHover on list/queue rows. */
export const tableRowCompact =
  "min-h-9";

/** Pagination footer strip - inside card below table */
export const tablePaginationFooter =
  "border-t border-[var(--border)] p-4 bg-[var(--surface)]";
