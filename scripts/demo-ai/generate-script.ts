/**
 * AI demo pipeline — generate narration script from scene registry.
 * Structure: Intro, Dashboard overview, Inventory workflow, CRM pipeline, Deal desk, Delivery workflow, Closing.
 * Output: /demo-output/script.txt
 */

import path from "path";
import fs from "fs";
import { SCENE_REGISTRY } from "./scene-registry";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCRIPT_PATH = path.join(OUT_DIR, "script.txt");

export function runGenerateScript(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const sections = [
    "Intro",
    "Welcome to the DMS. This walkthrough shows how your team manages inventory, leads, and deals from one place.",
    "",
    ...SCENE_REGISTRY.map((s) => {
      const title = s.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return `${title}\n\n${s.narration}`;
    }),
  ];
  const script = sections.join("\n\n");
  fs.writeFileSync(SCRIPT_PATH, script, "utf-8");
  console.log("[generate-script] Wrote", SCRIPT_PATH);
}

function main() {
  runGenerateScript();
}
main();
