/**
 * Style policy: dashboard-v3 must use only semantic tokens (lib/ui/tokens.ts).
 * Forbidden: raw Tailwind color classes like bg-blue-500, text-amber-800, etc.
 * Allowed: var(--...) or token imports.
 */
import * as fs from "fs";
import * as path from "path";

const DASHBOARD_DIR = path.join(__dirname, "..");
const FORBIDDEN_PATTERNS = [
  /\bbg-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\btext-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bborder-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bhover:bg-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
];

function getTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== "__tests__") {
      files.push(...getTsxFiles(full));
    } else if (e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts"))) {
      files.push(full);
    }
  }
  return files;
}

describe("Dashboard UI tokens policy", () => {
  const files = getTsxFiles(DASHBOARD_DIR).filter(
    (f) => f.endsWith(".tsx") || f.endsWith(".ts")
  );

  it("dashboard-v3 components must not use forbidden Tailwind color classes", () => {
    const violations: { file: string; line: number; match: string }[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          const m = line.match(pattern);
          if (m) violations.push({ file: path.relative(DASHBOARD_DIR, file), line: i + 1, match: m[0] });
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
