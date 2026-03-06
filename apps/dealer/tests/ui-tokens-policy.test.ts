/**
 * Style policy: dealer app (app/** and components/**) must use semantic tokens only.
 * Forbidden: raw Tailwind palette classes (bg-*-500, text-*-600, etc.) unless file is in allowlist.
 * Excluded from scan: components/ui/**, components/dashboard-v3/**.
 */
import * as fs from "fs";
import * as path from "path";

const DEALER_ROOT = path.join(__dirname, "..");
const ALLOWLIST_PATH = path.join(DEALER_ROOT, "ui-tokens.allowlist.txt");

const FORBIDDEN_PATTERNS = [
  /\bbg-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\btext-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bborder-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bhover:bg-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bhover:text-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bhover:border-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bfocus:ring-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
  /\bring-(blue|emerald|green|red|amber|violet|slate|gray)-[0-9]+/,
];

function loadAllowlist(): Set<string> {
  if (!fs.existsSync(ALLOWLIST_PATH)) return new Set();
  const content = fs.readFileSync(ALLOWLIST_PATH, "utf-8");
  const lines = content
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
  return new Set(lines.map((p) => p.replace(/\\/g, "/")));
}

function getTsxFilesUnder(dir: string, base: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      if (dir === path.join(base, "app") && e.name === "api") continue;
      if (dir === path.join(base, "components") && e.name === "ui") continue;
      if (dir === path.join(base, "components") && e.name === "dashboard-v3") continue;
      files.push(...getTsxFilesUnder(full, base));
    } else if (e.isFile() && e.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Dealer UI tokens policy (app + components)", () => {
  const appDir = path.join(DEALER_ROOT, "app");
  const componentsDir = path.join(DEALER_ROOT, "components");
  const appFiles = getTsxFilesUnder(appDir, DEALER_ROOT);
  const componentFiles = getTsxFilesUnder(componentsDir, DEALER_ROOT);
  const allFiles = [...appFiles, ...componentFiles];

  it("scanned files must not use forbidden Tailwind color classes unless allowlisted", () => {
    const allowlist = loadAllowlist();
    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of allFiles) {
      const relPath = path.relative(DEALER_ROOT, file).replace(/\\/g, "/");
      if (allowlist.has(relPath)) continue;

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          const m = line.match(pattern);
          if (m)
            violations.push({ file: relPath, line: i + 1, match: m[0] });
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
