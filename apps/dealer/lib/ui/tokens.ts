/**
 * Single source of truth for Dealer UI tokens.
 * All values are Tailwind class names that use CSS variables (var(--...)).
 * Use these in dashboard and shared UI; do not hardcode colors/radii/shadows.
 *
 * CSS vars are defined in apps/dealer/app/globals.css (:root).
 */

/** Design-system primitives: use with PageShell, AppCard, etc. */
export const ui = {
  page: "px-[var(--space-page-x)] py-[var(--space-page-y)]",
  grid: "gap-[var(--space-grid)]",
  card:
    "surface-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-150",
  soft: "bg-[var(--surface-2)]",
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
} as const;

/** Typography sizes (map to globals.css --text-*); use with text-[var(--text)] etc. */
export const typography = {
  pageTitle: "text-[24px] font-semibold leading-tight text-[var(--text)]",
  cardTitle: "text-base font-semibold text-[var(--text)] text-left",
  table: "text-sm text-[var(--text)]",
  muted: "text-sm text-[var(--muted-text)]",
  mutedSoft: "text-sm text-[var(--text-soft)]",
  badge: "text-xs font-medium",
} as const;

/** Semantic colors (map to globals.css :root) */
export const dashboardTokens = {
  bg: "bg-[var(--bg)]",
  surface: "bg-[var(--panel)]",
  surface2: "bg-[var(--muted)]",
  border: "border-[var(--border)]",
  text: "text-[var(--text)]",
  mutedText: "text-[var(--text-soft)]",
  primary: "bg-[var(--primary)]",
  primaryFg: "text-white",
  primaryHover: "hover:bg-[var(--primary-hover)]",
  primaryDeals: "bg-[var(--accent-deals)]",
  primaryDealsHover: "hover:bg-[var(--accent-deals-hover)]",
  ring: "ring-[var(--accent)]",
  success: "bg-[var(--success)]",
  successFg: "text-white",
  successMuted: "bg-[var(--success-muted)]",
  successMutedFg: "text-[var(--success-muted-fg)]",
  warning: "bg-[var(--warning)]",
  warningFg: "text-white",
  warningMuted: "bg-[var(--warning-muted)]",
  warningMutedFg: "text-[var(--warning-muted-fg)]",
  danger: "bg-[var(--danger)]",
  dangerFg: "text-white",
  dangerMuted: "bg-[var(--danger-muted)]",
  dangerMutedFg: "text-[var(--danger-muted-fg)]",
  infoMuted: "bg-[var(--info-muted)]",
  infoMutedFg: "text-[var(--info-muted-fg)]",
} as const;

/** Neutral/muted fallback when no severity */
export const neutralBadge = "bg-[var(--muted)] text-[var(--text-soft)]";

/** Radius scale (match mock: cards xl, buttons/inputs md) */
export const radiusTokens = {
  card: "rounded-xl",
  button: "rounded-md",
  input: "rounded-md",
} as const;

/** Shadows */
export const shadowTokens = {
  card: "shadow-sm",
  cardHover: "hover:shadow-md",
  popover: "shadow-md",
} as const;

/** Spacing (grid, page, card padding) */
export const spacingTokens = {
  pagePad: "p-6",
  gridGap: "gap-4",
  cardPad: "p-4",
  cardHeaderPad: "p-4 pb-2",
  cardContentPad: "p-4 pt-0",
  widgetRowPad: "px-2.5 py-1.5",
  widgetRowMinH: "min-h-[2.25rem]",
} as const;

/** Composite class names for dashboard cards and widgets (blueprint: --surface, --surface-2) */
export const dashboardCard = [
  "surface-noise",
  radiusTokens.card,
  "border border-[var(--border)]",
  "bg-[var(--surface)]",
  "shadow-[var(--shadow-card)]",
  shadowTokens.cardHover,
  "transition-shadow h-full",
].join(" ");

export const dashboardPageBg = "min-h-full bg-[var(--page-bg)]";

/**
 * Standard dashboard list row.
 * Full-bleed divider style: border-b separators, transparent bg, hover tint.
 * Apply to every signal/task/notice/activity row for visual consistency.
 */
export const widgetRowSurface = [
  "flex items-center justify-between gap-3",
  "border-b border-[var(--border)] last:border-b-0",
  "px-3 py-2 text-sm",
  "transition-colors hover:bg-[var(--surface-2)]/50",
].join(" ");

/** Severity badge classes (semantic; use with dashboardTokens) */
export const severityBadgeClasses = {
  info: `${dashboardTokens.infoMuted} ${dashboardTokens.infoMutedFg}`,
  success: `${dashboardTokens.successMuted} ${dashboardTokens.successMutedFg}`,
  warning: `${dashboardTokens.warningMuted} ${dashboardTokens.warningMutedFg}`,
  danger: `${dashboardTokens.dangerMuted} ${dashboardTokens.dangerMutedFg}`,
} as const;

export const layoutTokens = {
  appShell: "h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text)]",
  pageShell: "min-h-full bg-[var(--page-bg)] px-[var(--space-page-x)] py-[var(--space-page-y)]",
  pageStack: "flex flex-col gap-4",
  filterBar:
    "surface-noise flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]",
  contextRail:
    "surface-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--rail-bg)] p-4 shadow-[var(--shadow-card)]",
} as const;

export const navTokens = {
  sidebarRoot:
    "relative h-full overflow-hidden border-r border-[var(--sidebar-hairline)] bg-[linear-gradient(180deg,var(--sidebar-bg-1)_0%,var(--sidebar-bg-2)_100%)] shadow-[0_20px_40px_rgba(2,6,23,0.45)]",
  sidebarItem:
    "relative flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[15px] font-medium text-[var(--sidebar-text)] transition-colors hover:bg-[var(--sidebar-hover)]",
  sidebarItemActive:
    "bg-[linear-gradient(90deg,rgba(42,105,197,0.96)_0%,rgba(35,86,164,0.96)_100%)] text-[var(--sidebar-text-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
  commandBar:
    "h-14 border-b border-white/10 bg-transparent px-4",
} as const;

export const widgetTokens = {
  widget:
    "surface-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]",
  widgetHeader: "mb-4 flex items-start justify-between gap-3",
  widgetTitle: "text-base font-semibold text-[var(--text)]",
  widgetSubtitle: "text-sm text-[var(--muted-text)]",
  /** Tighter padding for dense widgets */
  widgetCompact:
    "surface-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)]",
  widgetHeaderCompact: "mb-2 flex items-start justify-between gap-2",
  /** KPI/metric cards: grain + accent gradient glow */
  widgetCompactKpi:
    "kpi-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]",
  widgetHeaderCompactKpi: "mb-2.5 flex items-start justify-between gap-2",
} as const;

export const tableTokens = {
  shell:
    `overflow-hidden ${ui.card}`,
  toolbar: "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3",
  footer: "border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3",
  columnHeader: "h-10 px-4 text-left align-middle text-sm font-medium text-[var(--text-soft)]",
  rowHover: "cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/60",
  cell: "p-4 align-middle text-sm text-[var(--text)]",
} as const;
