/**
 * Cinematic demo generator — convert script into SRT subtitles.
 * Splits by paragraph (scene narration) and estimates timings from scene durations.
 * Output: /demo-output/captions.srt
 */

import path from "path";
import fs from "fs";
import { DEMO_SCENES } from "./demo-scenes";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCRIPT_PATH = path.join(OUT_DIR, "script.txt");
const CAPTIONS_PATH = path.join(OUT_DIR, "captions.srt");

/** Format seconds as SRT timestamp HH:MM:SS,mmm */
function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function runGenerateCaptions(): void {
  // Use DEMO_SCENES to get per-scene narration and duration so timings match the video
  let startSec = 0;
  const blocks: string[] = [];
  let index = 1;
  for (const scene of DEMO_SCENES) {
    const endSec = startSec + scene.duration;
    const text = scene.narration.trim();
    if (!text) {
      startSec = endSec;
      continue;
    }
    blocks.push(
      `${index}\n${toSrtTime(startSec)} --> ${toSrtTime(endSec)}\n${text.replace(/\n/g, " ")}\n`
    );
    index += 1;
    startSec = endSec;
  }
  const srt = blocks.join("\n");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(CAPTIONS_PATH, srt, "utf-8");
  console.log("[generate-captions] Wrote", CAPTIONS_PATH);
}

function main() {
  try {
    runGenerateCaptions();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
