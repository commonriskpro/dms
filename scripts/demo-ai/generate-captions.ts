/**
 * AI demo pipeline — convert script into SRT subtitles and chapter markers.
 * Outputs: /demo-output/captions.srt, /demo-output/chapters.json
 */

import path from "path";
import fs from "fs";
import { SCENE_REGISTRY } from "./scene-registry";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const CAPTIONS_PATH = path.join(OUT_DIR, "captions.srt");
const CHAPTERS_PATH = path.join(OUT_DIR, "chapters.json");

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export type ChapterMarker = {
  title: string;
  startSeconds: number;
  endSeconds: number;
};

export function runGenerateCaptions(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let startSec = 0;
  const srtBlocks: string[] = [];
  const chapters: ChapterMarker[] = [];
  let index = 1;

  for (const scene of SCENE_REGISTRY) {
    const endSec = startSec + scene.duration;
    const text = scene.narration.trim();
    if (text) {
      srtBlocks.push(
        `${index}\n${toSrtTime(startSec)} --> ${toSrtTime(endSec)}\n${text.replace(/\n/g, " ")}\n`
      );
      index += 1;
    }
    const title = scene.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    chapters.push({ title, startSeconds: startSec, endSeconds: endSec });
    startSec = endSec;
  }

  fs.writeFileSync(CAPTIONS_PATH, srtBlocks.join("\n"), "utf-8");
  fs.writeFileSync(CHAPTERS_PATH, JSON.stringify(chapters, null, 2), "utf-8");
  console.log("[generate-captions] Wrote", CAPTIONS_PATH);
  console.log("[generate-captions] Wrote", CHAPTERS_PATH);
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
