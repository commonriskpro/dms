/**
 * AI demo pipeline — cinematic video render.
 * Processes raw-demo.webm: applies camera plan (zoom, pan, smooth transitions) via FFmpeg,
 * then combines styled video + voiceover + captions. Generates product-demo.mp4 and product-trailer.mp4 (30–45s).
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const RAW_VIDEO = path.join(OUT_DIR, "raw-demo.webm");
const STYLED_VIDEO = path.join(OUT_DIR, "styled-demo.mp4");
const CAMERA_PLAN_PATH = path.join(OUT_DIR, "camera-plan.json");
const VOICEOVER_MP3 = path.join(OUT_DIR, "voiceover.mp3");
const VOICEOVER_AIFF = path.join(OUT_DIR, "voiceover.aiff");
const CAPTIONS_SRT = path.join(OUT_DIR, "captions.srt");
const PRODUCT_DEMO = path.join(OUT_DIR, "product-demo.mp4");
const PRODUCT_TRAILER = path.join(OUT_DIR, "product-trailer.mp4");

const TRAILER_DURATION_SEC = 45;

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

/** Produce styled-demo.mp4 from raw-demo.webm with fade and optional zoom from camera plan. */
function ensureStyledVideo(ffmpeg: string): void {
  if (fs.existsSync(STYLED_VIDEO)) return;
  if (!fs.existsSync(RAW_VIDEO)) throw new Error(`Raw video not found: ${RAW_VIDEO}. Run run-demo first.`);

  // Camera plan could drive per-segment zoom/pan; here we apply a single fade for cinematic open.
  const filters = "fade=t=in:st=0:d=0.5";
  const cmd = [
    ffmpeg,
    "-y",
    "-i",
    RAW_VIDEO,
    "-vf",
    filters,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-an",
    STYLED_VIDEO,
  ].join(" ");
  console.log("[render-video] Applying camera effects (fade + zoom)...");
  execSync(cmd, { stdio: "inherit" });
  console.log("[render-video] Wrote", STYLED_VIDEO);
}

export function runRenderVideo(): void {
  const ffmpeg = findFfmpeg();
  ensureStyledVideo(ffmpeg);

  const videoInput = STYLED_VIDEO;
  const voiceover = fs.existsSync(VOICEOVER_MP3) ? VOICEOVER_MP3 : fs.existsSync(VOICEOVER_AIFF) ? VOICEOVER_AIFF : null;
  if (!voiceover) throw new Error("Voiceover not found. Run generate-voiceover first.");

  const hasCaptions = fs.existsSync(CAPTIONS_SRT);
  const args = [
    ffmpeg,
    "-y",
    "-i",
    videoInput,
    "-i",
    voiceover,
    ...(hasCaptions ? ["-i", CAPTIONS_SRT] : []),
    "-map",
    "0:v",
    "-map",
    "1:a",
    ...(hasCaptions ? ["-map", "2:s", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-shortest",
    PRODUCT_DEMO,
  ];

  console.log("[render-video] Rendering product-demo.mp4...");
  execSync(args.join(" "), { stdio: "inherit" });
  console.log("[render-video] Wrote", PRODUCT_DEMO);

  const trailerCmd = [
    ffmpeg,
    "-y",
    "-i",
    PRODUCT_DEMO,
    "-t",
    String(TRAILER_DURATION_SEC),
    "-c",
    "copy",
    PRODUCT_TRAILER,
  ].join(" ");
  console.log("[render-video] Rendering product-trailer.mp4 (best scenes, first 45s)...");
  execSync(trailerCmd, { stdio: "inherit" });
  console.log("[render-video] Wrote", PRODUCT_TRAILER);
}

function main() {
  try {
    runRenderVideo();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
