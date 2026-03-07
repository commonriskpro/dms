/**
 * Shared date utilities for the dealer app db layer.
 * Centralises the divergent startOfToday implementations and names the
 * MS_PER_DAY magic constant that appeared 4+ times across inventory/reports.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Number of whole days from `from` to `to` (defaults to now).
 * Always rounds down (floor). Returns 0 for same-day dates.
 */
export function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/**
 * Start of the current day in UTC (midnight 00:00:00.000).
 * Use this instead of `new Date(now.getFullYear(), ...)` which is local-time.
 */
export function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
