/**
 * Build URL query string from params. Omits undefined, empty string, and whitespace-only values.
 */
export function buildQueryString(
  params: Record<string, string | number | undefined>
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "" && String(v).trim() !== ""
  );
  if (entries.length === 0) return "";
  return new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString();
}
