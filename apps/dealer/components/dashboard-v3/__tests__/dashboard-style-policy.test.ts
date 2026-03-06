/**
 * Style policy: dashboard shell (dashboard-v3, layout, app-shell, app/dashboard) must not use
 * Tailwind palette classes. Only var(--token) or token imports allowed.
 */
import * as fs from "fs";
import * as path from "path";

const DEALER_ROOT = path.join(__dirname, "..", "..", "..");
const SCAN_DIRS = [
  path.join(DEALER_ROOT, "components", "dashboard-v3"),
  path.join(DEALER_ROOT, "components", "layout"),
  path.join(DEALER_ROOT, "components", "app-shell"),
  path.join(DEALER_ROOT, "app", "dashboard"),
];

const FORBIDDEN_PATTERNS = [
  /\bbg-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\btext-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\bborder-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\bhover:bg-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\bhover:text-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\bhover:border-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\bfocus:ring-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
  /\bring-(blue|slate|gray|zinc|neutral|red|amber|yellow|green|emerald|violet|purple|indigo)-\d+/,
];

function getTsxFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== "__tests__" && e.name !== "__snapshots__") {
      files.push(...getTsxFiles(full));
    } else if (e.isFile() && e.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Dashboard style policy (dashboard-v3, layout, app-shell, app/dashboard)", () => {
  const allFiles = SCAN_DIRS.flatMap((d) => getTsxFiles(d));

  it("must not use forbidden Tailwind palette color classes", () => {
    const violations: { file: string; line: number; match: string }[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relPath = path.relative(DEALER_ROOT, file);
      lines.forEach((line, i) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          const m = line.match(pattern);
          if (m) violations.push({ file: relPath, line: i + 1, match: m[0] });
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
