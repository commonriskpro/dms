/**
 * Cinematic Demo Studio — final video render.
 * Combines: scene clips (or styled-demo.mp4), voiceover, captions.
 * Output: product-demo.mp4 (~3 min), product-trailer.mp4 (45 s). Trailer auto-selects best scenes (first 45s).
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const STYLED_SCENES_DIR = path.join(OUT_DIR, "styled-scenes");
const CONCAT_LIST_PATH = path.join(STYLED_SCENES_DIR, "concat-list.txt");
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

/** Build styled-demo.mp4 from concat list (scene clips) or from raw-demo.webm with fade. */
function ensureStyledVideo(ffmpeg: string): string {
  if (fs.existsSync(STYLED_VIDEO)) return STYLED_VIDEO;
  if (fs.existsSync(CONCAT_LIST_PATH)) {
    const listPath = CONCAT_LIST_PATH.replace(/\\/g, "/");
    const cmd = [
      ffmpeg,
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-an",
      STYLED_VIDEO,
    ].join(" ");
    console.log("[render-video] Concatenating scene clips...");
    execSync(cmd, { stdio: "inherit" });
    console.log("[render-video] Wrote", STYLED_VIDEO);
    return STYLED_VIDEO;
  }
  if (fs.existsSync(RAW_VIDEO)) {
    console.log("[render-video] No scene clips; using raw-demo.webm with fade...");
    execSync(
      [
        ffmpeg,
        "-y",
        "-i",
        RAW_VIDEO,
        "-vf",
        "fade=t=in:st=0:d=0.5",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-an",
        STYLED_VIDEO,
      ].join(" "),
      { stdio: "inherit" }
    );
    return STYLED_VIDEO;
  }
  throw new Error(
    `No styled video, concat list, or raw-demo.webm. Run run-walkthrough and scene-composer first.`
  );
}

export function runRenderVideo(): void {
  const ffmpeg = findFfmpeg();
  const videoInput = ensureStyledVideo(ffmpeg);

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
  console.log("[render-video] Rendering product-trailer.mp4 (first 45s)...");
  execSync(trailerCmd, { stdio: "inherit" });
  console.log("[render-video] Wrote", PRODUCT_TRAILER);
}

function main(): void {
  try {
    runRenderVideo();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
