/**
 * Demo pipeline — combine raw-demo.webm and voiceover into product-demo.mp4 using FFmpeg.
 * Output: demo-output/product-demo.mp4
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const RAW_VIDEO = path.join(OUT_DIR, "raw-demo.webm");
const VOICEOVER_MP3 = path.join(OUT_DIR, "voiceover.mp3");
const VOICEOVER_AIFF = path.join(OUT_DIR, "voiceover.aiff");
const OUTPUT_MP4 = path.join(OUT_DIR, "product-demo.mp4");

function findFfmpeg(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStaticPath = require("ffmpeg-static") as string | undefined;
    if (ffmpegStaticPath && fs.existsSync(ffmpegStaticPath)) return ffmpegStaticPath;
  } catch {
    // ffmpeg-static not installed
  }
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return "ffmpeg";
  } catch {
    throw new Error("FFmpeg not found. Install ffmpeg (system) or add devDependency ffmpeg-static.");
  }
}

export function runRenderVideo(): void {
  if (!fs.existsSync(RAW_VIDEO)) {
    throw new Error(`Raw video not found: ${RAW_VIDEO}. Run run-walkthrough first.`);
  }
  const voiceover = fs.existsSync(VOICEOVER_MP3)
    ? VOICEOVER_MP3
    : fs.existsSync(VOICEOVER_AIFF)
      ? VOICEOVER_AIFF
      : null;
  if (!voiceover) {
    throw new Error(
      `Voiceover not found: ${VOICEOVER_MP3} or ${VOICEOVER_AIFF}. Run generate-voiceover first.`
    );
  }

  const ffmpeg = findFfmpeg();
  // -shortest so output ends when the shorter of video/audio ends; -c:v libx264 -c:a aac for MP4
  const cmd = [
    ffmpeg,
    "-y",
    "-i",
    RAW_VIDEO,
    "-i",
    voiceover,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    OUTPUT_MP4,
  ].join(" ");
  console.log("[render-video] Running ffmpeg...");
  execSync(cmd, { stdio: "inherit" });
  console.log("[render-video] Wrote", OUTPUT_MP4);
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
