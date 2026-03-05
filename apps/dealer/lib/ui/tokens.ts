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
    "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-150",
  soft: "bg-[var(--surface-2)]",
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
} as const;

/** Spacing scale (map to globals.css --space-*, --dash-gap) */
export const spacing = {
  pageX: "px-[var(--space-page-x)]",
  pageY: "py-[var(--space-page-y)]",
  grid: "gap-[var(--space-grid)]",
  section: "gap-4",
  cardPad: "p-4",
  cardHeader: "px-4 pt-4 pb-3",
  cardContent: "px-4 pb-4 pt-0",
} as const;

/** Radius (map to globals.css --radius-*) */
export const radius = {
  card: "rounded-[var(--radius-card)]",
  button: "rounded-[var(--radius-button)]",
  input: "rounded-[var(--radius-input)]",
  pill: "rounded-[var(--radius-pill)]",
} as const;

/** Shadows (map to globals.css --shadow-*) */
export const shadow = {
  card: "shadow-[var(--shadow-card)]",
  cardHover: "hover:shadow-[var(--shadow-card-hover)]",
  cardStack: "shadow-[var(--shadow-card-stack)]",
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
  primary: "bg-[var(--accent)]",
  primaryFg: "text-white",
  primaryHover: "hover:bg-[var(--accent-hover)]",
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
  radiusTokens.card,
  "border border-[var(--border)]",
  "bg-[var(--surface)]",
  "shadow-[var(--shadow-card)]",
  shadowTokens.cardHover,
  "transition-shadow h-full",
].join(" ");

export const dashboardPageBg = "min-h-full bg-[var(--page-bg)]";

export const dashboardGrid = `grid grid-cols-12 ${spacingTokens.gridGap}`;

/** Widget row surface (blueprint: 44px min-h, rounded-[12px], --surface-2) */
export const widgetRowSurface = [
  "rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]",
  "px-3 py-2 min-h-[44px]",
  "text-sm",
].join(" ");

/** Severity badge classes (semantic; use with dashboardTokens) */
export const severityBadgeClasses = {
  info: `${dashboardTokens.infoMuted} ${dashboardTokens.infoMutedFg}`,
  success: `${dashboardTokens.successMuted} ${dashboardTokens.successMutedFg}`,
  warning: `${dashboardTokens.warningMuted} ${dashboardTokens.warningMutedFg}`,
  danger: `${dashboardTokens.dangerMuted} ${dashboardTokens.dangerMutedFg}`,
} as const;

/** Metric card accent bar (blueprint): --accent-inventory, --accent-leads, --accent-deals, --accent-bhph */
export const metricAccentBarClasses = {
  primary: "bg-[var(--accent)]",
  success: "bg-[var(--accent-leads)]",
  deals: "bg-[var(--accent-deals)]",
  warning: "bg-[var(--accent-bhph)]",
  danger: dashboardTokens.danger,
  info: "bg-[var(--accent-inventory)]",
} as const;

/** Blueprint widget row severity badge (--sev-info, --sev-success, --sev-warning, --sev-danger) */
export const sevBadgeClasses = {
  info: "bg-[var(--sev-info)] text-white",
  success: "bg-[var(--sev-success)] text-white",
  warning: "bg-[var(--sev-warning)] text-white",
  danger: "bg-[var(--sev-danger)] text-white",
} as const;
