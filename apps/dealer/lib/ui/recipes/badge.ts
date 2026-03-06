/**
 * Canonical badge recipe for status chips and labels.
 * Use with token typography and semantic colors only.
 */

import { typography } from "../tokens";

/** Base badge: pill shape, token text size and weight */
export const badgeBase = [
  "inline-flex items-center rounded-[var(--radius-input)] px-2 py-0.5",
  typography.badge,
].join(" ");

/** Neutral badge (no severity) */
export const badgeNeutral = "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]";

/** Semantic variants - use CSS vars only */
export const badgeSuccess = "bg-[var(--success-muted)] text-[var(--success-muted-fg)]";
export const badgeWarning = "bg-[var(--warning-muted)] text-[var(--warning-muted-fg)]";
export const badgeDanger = "bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]";
export const badgeInfo = "bg-[var(--info-muted)] text-[var(--info-muted-fg)]";

/** Muted/neutral (no severity). */
export const badgeMuted = "bg-[var(--muted)] text-[var(--text-soft)]";
