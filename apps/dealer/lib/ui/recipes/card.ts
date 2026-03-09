import { ui } from "@/lib/ui/tokens";

/**
 * Canonical card recipe for the dealer app.
 * All cards must use these base classes for consistency.
 *
 * Non-negotiables:
 * - bg-[var(--surface)]
 * - border border-[var(--border)]
 * - rounded-[var(--radius-card)]
 * - shadow-[var(--shadow-card)]
 * - hover:shadow-[var(--shadow-card-hover)]
 * - transition-shadow duration-150
 */

export const cardBase =
  ui.card;

export const cardHeaderBase =
  "w-full flex flex-row items-center justify-start px-4 pt-4 pb-3";

export const cardTitleBase =
  "text-base font-semibold text-[var(--text)] text-left leading-tight";

export const cardContentBase =
  "px-4 pb-4 pt-0";
