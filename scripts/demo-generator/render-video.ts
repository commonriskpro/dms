/**
 * Cinematic demo generator — combine styled video, voiceover, and captions into final output.
 * Outputs: product-demo.mp4 (full ~3 min), product-trailer.mp4 (45 seconds).
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const STYLED_VIDEO = path.join(OUT_DIR, "styled-demo.mp4");
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

export function runRenderVideo(): void {
  const videoInput = fs.existsSync(STYLED_VIDEO) ? STYLED_VIDEO : path.join(OUT_DIR, "raw-demo.webm");
  if (!fs.existsSync(videoInput)) throw new Error(`Video not found: ${videoInput}. Run run-demo and apply-effects first.`);

  const voiceover = fs.existsSync(VOICEOVER_MP3) ? VOICEOVER_MP3 : fs.existsSync(VOICEOVER_AIFF) ? VOICEOVER_AIFF : null;
  if (!voiceover) throw new Error(`Voiceover not found. Run generate-voiceover first.`);

  const ffmpeg = findFfmpeg();
  const hasCaptions = fs.existsSync(CAPTIONS_SRT);

  // Full demo: video + voiceover; mux SRT as subtitle stream when present
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

  // Trailer: first 45 seconds
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
  console.log("[render-video] Rendering product-trailer.mp4 (45s)...");
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
