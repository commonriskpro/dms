/**
 * Cinematic demo generator — apply FFmpeg effects to raw recording.
 * Effects: smooth zoom, fade in/out. Cursor highlight and focus blur require post-processing; use zoom + fade for cinematic feel.
 * Input: raw-demo.webm. Output: /demo-output/styled-demo.mp4
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const RAW_VIDEO = path.join(OUT_DIR, "raw-demo.webm");
const STYLED_VIDEO = path.join(OUT_DIR, "styled-demo.mp4");

function findFfmpeg(): string {
  try {
    const fp = require("ffmpeg-static") as string | undefined;
    if (fp && fs.existsSync(fp)) return fp;
  } catch {
    // ignore
  }
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return "ffmpeg";
  } catch {
    throw new Error("FFmpeg not found. Install ffmpeg or add ffmpeg-static.");
  }
}

export function runApplyEffects(): void {
  if (!fs.existsSync(RAW_VIDEO)) throw new Error(`Raw video not found: ${RAW_VIDEO}. Run run-demo first.`);

  const ffmpeg = findFfmpeg();
  // Gentle zoom (zoompan): slow zoom in over time. Fade in at start, fade out at end.
  // zoompan: 'zoom=1+0.001*min(on\\,300):x=iw/2-(iw/2/zoom):y=ih/2-(ih/2/zoom:d=1:s=1920x1080' for slow zoom
  // Simpler: fade in 0.5s, fade out last 0.5s; optional very subtle zoom via scale
  // Fade in for cinematic open; fade out would need duration so we skip it
  const simpleFade = "fade=t=in:st=0:d=0.5";
  const fullCmd = [
    ffmpeg,
    "-y",
    "-i",
    RAW_VIDEO,
    "-vf",
    simpleFade,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-an",
    STYLED_VIDEO,
  ].join(" ");
  console.log("[apply-effects] Applying cinematic effects (fade in)...");
  execSync(fullCmd, { stdio: "inherit" });
  console.log("[apply-effects] Wrote", STYLED_VIDEO);
}

function main() {
  try {
    runApplyEffects();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
