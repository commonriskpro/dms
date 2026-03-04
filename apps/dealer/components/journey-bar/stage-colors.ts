/**
 * Map stage colorKey from API to CSS variable or class.
 * Uses design tokens only (var(--success), var(--accent), etc.).
 */
const COLOR_KEY_MAP: Record<string, string> = {
  blue: "var(--accent)",
  green: "var(--success)",
  red: "var(--danger)",
  gray: "var(--muted)",
  yellow: "#ca8a04",
  purple: "#7c3aed",
  orange: "#ea580c",
};

export function getStageColor(colorKey: string | null | undefined): string | null {
  if (!colorKey) return null;
  const normalized = colorKey.toLowerCase().trim();
  return COLOR_KEY_MAP[normalized] ?? null;
}
