/**
 * Cinematic Demo Studio — scene composer.
 * Combines: raw recording, camera plan, spotlight overlays, cursor animation.
 * Renders individual scene clips with cinematic transitions (fade, slide, cross-dissolve).
 * Output: /demo-output/styled-scenes/
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { SCENE_REGISTRY } from "./scene-registry";
import type { CameraPlan } from "./motion-engine";
import type { SpotlightPlan } from "./spotlight-engine";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const STYLED_SCENES_DIR = path.join(OUT_DIR, "styled-scenes");
const RAW_VIDEO = path.join(OUT_DIR, "raw-demo.webm");
const CAMERA_PLAN_PATH = path.join(OUT_DIR, "camera-plan.json");
const SPOTLIGHT_PLAN_PATH = path.join(OUT_DIR, "spotlight-plan.json");
const CONCAT_LIST_PATH = path.join(STYLED_SCENES_DIR, "concat-list.txt");

const TRANSITION_DURATION = 0.5;

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

/** Build one scene clip: extract segment, apply zoom/pan, fade in/out. */
function renderSceneClip(
  ffmpeg: string,
  startSec: number,
  durationSec: number,
  sceneId: string,
  move: CameraPlan["moves"][0],
  index: number
): string {
  const outPath = path.join(STYLED_SCENES_DIR, `scene-${String(index + 1).padStart(2, "0")}-${sceneId}.mp4`);
  if (fs.existsSync(outPath)) return outPath;

  const zoom = move.endZoom;
  const panX = move.panX;
  const panY = move.panY;
  const w = 1920;
  const h = 1080;
  const scaledW = Math.round(w * zoom);
  const scaledH = Math.round(h * zoom);
  const xOffset = Math.max(0, Math.min(scaledW - w, (scaledW - w) / 2 - panX));
  const yOffset = Math.max(0, Math.min(scaledH - h, (scaledH - h) / 2 - panY));
  const scaleFilter = `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${w}:${h}:${xOffset}:${yOffset}`;
  const fadeIn = `fade=t=in:st=0:d=${TRANSITION_DURATION}`;
  const fadeOut = `fade=t=out:st=${durationSec - TRANSITION_DURATION}:d=${TRANSITION_DURATION}`;
  const filters = `${scaleFilter},${fadeIn},${fadeOut}`;

  const cmd = [
    ffmpeg,
    "-y",
    "-ss",
    String(startSec),
    "-i",
    RAW_VIDEO,
    "-t",
    String(durationSec),
    "-vf",
    filters,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-an",
    outPath,
  ];
  execSync(cmd.map((c) => (c.includes(" ") ? `"${c}"` : c)).join(" "), { stdio: "pipe" });
  return outPath;
}

export function runSceneComposer(): void {
  if (!fs.existsSync(RAW_VIDEO)) {
    throw new Error(`Raw video not found: ${RAW_VIDEO}. Run run-walkthrough first.`);
  }
  if (!fs.existsSync(CAMERA_PLAN_PATH)) {
    throw new Error(`Camera plan not found: ${CAMERA_PLAN_PATH}. Run motion-engine first.`);
  }

  if (!fs.existsSync(STYLED_SCENES_DIR)) fs.mkdirSync(STYLED_SCENES_DIR, { recursive: true });

  const cameraPlan: CameraPlan = JSON.parse(fs.readFileSync(CAMERA_PLAN_PATH, "utf-8"));
  const spotlightPlan = fs.existsSync(SPOTLIGHT_PLAN_PATH)
    ? (JSON.parse(fs.readFileSync(SPOTLIGHT_PLAN_PATH, "utf-8")) as SpotlightPlan)
    : null;

  const ffmpeg = findFfmpeg();
  let startSec = 0;
  const clipPaths: string[] = [];

  for (let i = 0; i < SCENE_REGISTRY.length; i++) {
    const scene = SCENE_REGISTRY[i];
    const move = cameraPlan.moves.find((m) => m.sceneId === scene.id) ?? {
      sceneId: scene.id,
      startZoom: 1,
      endZoom: 1.1,
      panX: 0,
      panY: 0,
      duration: scene.duration,
      easing: "linear",
    };
    console.log(`[scene-composer] Rendering scene ${i + 1}/${SCENE_REGISTRY.length}: ${scene.id}`);
    const outPath = renderSceneClip(ffmpeg, startSec, scene.duration, scene.id, move, i);
    clipPaths.push(outPath);
    startSec += scene.duration;
  }

  const concatList = clipPaths.map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(CONCAT_LIST_PATH, concatList, "utf-8");
  console.log("[scene-composer] Wrote", STYLED_SCENES_DIR);
  console.log("[scene-composer] Concat list:", CONCAT_LIST_PATH);
}

function main(): void {
  try {
    runSceneComposer();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
