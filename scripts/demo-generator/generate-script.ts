/**
 * Cinematic demo generator — build script from demo-scenes narration.
 * Output: /demo-output/script.txt
 */

import path from "path";
import fs from "fs";
import { DEMO_SCENES } from "./demo-scenes";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCRIPT_PATH = path.join(OUT_DIR, "script.txt");

export function generateScript(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const lines = DEMO_SCENES.map((s) => s.narration.trim()).filter(Boolean);
  const script = lines.join("\n\n");
  fs.writeFileSync(SCRIPT_PATH, script, "utf-8");
  console.log("[generate-script] Wrote", SCRIPT_PATH);
}

function main() {
  generateScript();
}
main();
