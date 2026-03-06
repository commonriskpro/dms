#!/usr/bin/env node
/**
 * Policy check: fails if repo violates DMS policies.
 * Run from repo root: node scripts/policy-check.mjs [--strict]
 *
 * Checks:
 * - Git conflict markers (<<<<<<<, =======, >>>>>>>)
 * - Forbidden import: { noStore } from "next/cache" (use unstable_noStore as noStore)
 * - [--strict] Tailwind palette classes in apps/dealer (require CSS variables)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEALER_UI = path.join(ROOT, "apps", "dealer");

const CONFLICT_MARKERS = ["<<<<<<<", "=======", ">>>>>>>"];
const BAD_IMPORT = /import\s*\{\s*noStore\s*\}\s*from\s*["']next\/cache["']/;
const TAILWIND_PALETTE =
  /\b(bg|text|border|ring|from|to|via|fill|stroke)-(red|blue|green|yellow|amber|orange|purple|pink|indigo|gray|slate|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900|950)\b/;

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORE_DIRS = new Set([".next", "node_modules", "dist", ".git"]);

let failed = false;
const strict = process.argv.includes("--strict");

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) walk(full, fn);
    } else if (EXTENSIONS.has(path.extname(e.name))) {
      fn(full);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relative = path.relative(ROOT, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    for (const m of CONFLICT_MARKERS) {
      if (trimmed === m || trimmed.startsWith(m + " ")) {
        console.error(`[CONFLICT] ${relative}:${i + 1} contains conflict marker: ${m}`);
        failed = true;
      }
    }
    if (BAD_IMPORT.test(line)) {
      console.error(
        `[NO_STORE] ${relative}:${i + 1} Use: import { unstable_noStore as noStore } from "next/cache"`
      );
      failed = true;
    }
    if (strict && filePath.startsWith(DEALER_UI) && TAILWIND_PALETTE.test(line)) {
      console.error(`[PALETTE] ${relative}:${i + 1} Use CSS variables (e.g. var(--surface)) instead of Tailwind palette`);
      failed = true;
    }
  }
}

walk(ROOT, checkFile);

if (failed) {
  process.exit(1);
}
console.log("Policy check passed.");
