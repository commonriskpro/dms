/**
 * Format cents for display; parse user input to cents (integer).
 * Never use floats for money.
 */

export function formatCentsToDollars(cents: string | number | undefined | null): string {
  if (cents === undefined || cents === null || cents === "") return "";
  const n = Number(String(cents).trim());
  if (Number.isNaN(n)) return "";
  return (n / 100).toFixed(2);
}

/** Parse dollar input (e.g. "1234.56") to cents number. Returns 0 for invalid/empty. */
export function parseDollarsToCents(value: string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const s = String(value).trim().replace(/,/g, "");
  if (s === "") return 0;
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Clamp tax rate (bps 0-10000 = 0-100%). */
export function clampTaxRateBps(bps: number): number {
  return Math.max(0, Math.min(10000, Math.round(bps)));
}
