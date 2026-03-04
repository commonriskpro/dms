/**
 * Single source of truth for Dealer UI tokens.
 * All values are Tailwind class names that use CSS variables (var(--...)).
 * Use these in dashboard and shared UI; do not hardcode colors/radii/shadows.
 */

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

/** Composite class names for dashboard cards and widgets */
export const dashboardCard = [
  radiusTokens.card,
  "border border-[var(--border)]/40",
  dashboardTokens.surface,
  shadowTokens.card,
  shadowTokens.cardHover,
  "transition-shadow h-full",
].join(" ");

export const dashboardPageBg = "min-h-full bg-[var(--muted)]/30";

export const dashboardGrid = `grid grid-cols-12 ${spacingTokens.gridGap}`;

/** Widget row surface (list rows inside cards) */
export const widgetRowSurface = [
  "rounded-md border border-[var(--border)]/40 bg-[var(--muted)]/30",
  spacingTokens.widgetRowPad,
  "text-sm",
  spacingTokens.widgetRowMinH,
].join(" ");

/** Severity badge classes (semantic; use with dashboardTokens) */
export const severityBadgeClasses = {
  info: `${dashboardTokens.infoMuted} ${dashboardTokens.infoMutedFg}`,
  success: `${dashboardTokens.successMuted} ${dashboardTokens.successMutedFg}`,
  warning: `${dashboardTokens.warningMuted} ${dashboardTokens.warningMutedFg}`,
  danger: `${dashboardTokens.dangerMuted} ${dashboardTokens.dangerMutedFg}`,
} as const;

/** Metric card accent bar (semantic): Inventory=primary, Leads=success, Deals=deals, BHPH=warning */
export const metricAccentBarClasses = {
  primary: "bg-[var(--accent)]",
  success: dashboardTokens.success,
  deals: "bg-[var(--accent-deals)]",
  warning: dashboardTokens.warning,
  danger: dashboardTokens.danger,
  info: "bg-[var(--accent)]",
} as const;
