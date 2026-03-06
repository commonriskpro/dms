/**
 * Guardrail: detect Tailwind palette classes that should be replaced with tokens.
 * In development, AppCard/AppButton/AppInput warn when forbidden classes are passed.
 */

const FORBIDDEN_PATTERN = new RegExp(
  [
    "bg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\\d+|\\d+/\\d+)",
    "text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\\d+|\\d+/\\d+)",
    "border-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\\d+|\\d+/\\d+)",
  ].join("|"),
  "g"
);

/**
 * Returns true if the className string contains forbidden Tailwind palette classes.
 */
export function hasForbiddenPaletteClasses(className: string): boolean {
  if (typeof className !== "string") return false;
  return FORBIDDEN_PATTERN.test(className);
}

/**
 * In development, warns to console when forbidden classes are used.
 * Call from app-level components (AppCard, AppButton, AppInput) with the merged className.
 */
export function warnIfForbiddenClasses(componentName: string, className: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (!hasForbiddenPaletteClasses(className)) return;
  const match = className.match(FORBIDDEN_PATTERN);
  console.warn(
    `[${componentName}] Prefer tokens over Tailwind palette. Forbidden classes detected:`,
    match?.[0] ?? className
  );
}
