/**
 * Cinematic Demo Studio — animated cursor overlay engine.
 * Generates cursor track: x, y, timestamp; effects: pulse highlight, click ripple, smooth movement.
 * Output: /demo-output/cursor-data.json for use by scene-composer.
 */

import path from "path";
import fs from "fs";
import { SCENE_REGISTRY } from "./scene-registry";
import type { UIMap } from "./ui-detector";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const UI_MAP_PATH = path.join(OUT_DIR, "ui-map.json");
const CURSOR_DATA_PATH = path.join(OUT_DIR, "cursor-data.json");

export type CursorEventType = "move" | "click" | "pulse";

export type CursorKeyframe = {
  x: number;
  y: number;
  /** Timestamp in seconds from start of demo. */
  timestamp: number;
  type: CursorEventType;
  /** For click: ripple scale at this time. */
  ripple?: number;
};

export type CursorData = {
  viewport: { width: number; height: number };
  /** Keyframes in order. */
  keyframes: CursorKeyframe[];
};

function loadUIMap(): UIMap {
  if (!fs.existsSync(UI_MAP_PATH)) {
    throw new Error(`UI map not found: ${UI_MAP_PATH}. Run ui-detector first.`);
  }
  return JSON.parse(fs.readFileSync(UI_MAP_PATH, "utf-8")) as UIMap;
}

/** Generate synthetic cursor keyframes from scene durations and UI positions. */
export function runCursorEngine(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const uiMap = loadUIMap();
  const keyframes: CursorKeyframe[] = [];
  let timeSec = 0;

  for (const scene of SCENE_REGISTRY) {
    const el = uiMap.elements.find((e) => e.sceneId === scene.id);
    const cx = el ? el.x + el.width / 2 : 960;
    const cy = el ? el.y + el.height / 2 : 540;

    keyframes.push({ x: cx, y: cy, timestamp: timeSec, type: "move" });
    keyframes.push({ x: cx, y: cy, timestamp: timeSec + 0.2, type: "click", ripple: 1 });
    keyframes.push({ x: cx, y: cy, timestamp: timeSec + scene.duration * 0.5, type: "pulse" });
    keyframes.push({ x: cx, y: cy, timestamp: timeSec + scene.duration - 0.1, type: "move" });

    timeSec += scene.duration;
  }

  const data: CursorData = {
    viewport: uiMap.viewport,
    keyframes,
  };
  fs.writeFileSync(CURSOR_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log("[cursor-engine] Wrote", CURSOR_DATA_PATH);
}

function main(): void {
  try {
    runCursorEngine();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
