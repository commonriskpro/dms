/**
 * Money utilities: API uses string cents; UI displays dollars.
 * No floating-point math for persisted values.
 */

/**
 * Format cents (string from API) as dollar display, e.g. "12345" -> "$123.45"
 */
export function formatCents(centsString: string): string {
  const trimmed = String(centsString).trim();
  if (trimmed === "" || /[^0-9-]/.test(trimmed)) return "$0.00";
  let n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  const dollars = Math.floor(n / 100);
  const cents = n % 100;
  const intPart = dollars.toLocaleString("en-US");
  const decPart = String(cents).padStart(2, "0");
  return `${sign}$${intPart}.${decPart}`;
}

/**
 * Parse user dollar input to cents string (no floats).
 * Accepts optional leading $ and commas (e.g. "$1,234.56"), ".99" -> 99.
 * Returns string suitable for API; invalid input returns empty string.
 */
export function parseDollarsToCents(inputString: string): string {
  const s = String(inputString).trim().replace(/,/g, "").replace(/^\$/, "");
  if (s === "" || s === "-") return "";
  // ".99" or ".5" -> cents only
  const centsOnly = s.match(/^-?\.(\d{1,2})$/);
  if (centsOnly) {
    const frac = centsOnly[1].padEnd(2, "0").slice(0, 2);
    const sign = s.startsWith("-") ? "-" : "";
    return sign + parseInt(frac, 10).toString();
  }
  const match = s.match(/^-?(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return "";
  const whole = match[1];
  const frac = (match[2] ?? "00").padEnd(2, "0").slice(0, 2);
  const sign = s.startsWith("-") ? "-" : "";
  const totalCents = (parseInt(whole, 10) * 100 + parseInt(frac, 10)).toString();
  return sign === "-" ? "-" + totalCents : totalCents;
}

/**
 * Whether the dollar input is valid for parsing.
 */
export function isValidDollarInput(inputString: string): boolean {
  const s = String(inputString).trim().replace(/,/g, "");
  if (s === "" || s === "-") return true;
  return /^-?\d+(?:\.\d{1,2})?$/.test(s);
}

/**
 * Percent string to basis points, e.g. "7.25" -> 725
 */
export function percentToBps(percentString: string): number {
  const s = String(percentString).trim().replace(/,/g, "");
  if (s === "") return 0;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Basis points to percent string, e.g. 725 -> "7.25"
 */
export function bpsToPercent(bps: number): string {
  const n = Math.round(bps) / 100;
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/**
 * Cents string to dollar string for input fields, e.g. "123456" -> "1234.56"
 * No floating-point; integer math only.
 */
export function centsToDollarInput(centsString: string): string {
  const trimmed = String(centsString).trim();
  if (trimmed === "" || /[^0-9-]/.test(trimmed)) return "0";
  let n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return "0";
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  const dollars = Math.floor(n / 100);
  const cents = n % 100;
  const decPart = String(cents).padStart(2, "0");
  return `${sign}${dollars}.${decPart}`;
}
