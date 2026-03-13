/**
 * Cinematic Demo Studio — camera motion engine.
 * Generates camera movement plans: smooth zoom, pan to element, ease-in/ease-out, parallax.
 * Saves /demo-output/camera-plan.json.
 */

import path from "path";
import fs from "fs";
import { SCENE_REGISTRY } from "./scene-registry";
import type { UIMap } from "./ui-detector";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const UI_MAP_PATH = path.join(OUT_DIR, "ui-map.json");
const CAMERA_PLAN_PATH = path.join(OUT_DIR, "camera-plan.json");

export type EasingType = "linear" | "cubic" | "ease-in" | "ease-out" | "ease-in-out";

export type CameraMove = {
  sceneId: string;
  startZoom: number;
  endZoom: number;
  /** Pan in pixels (or normalized 0–1 if preferred by renderer). */
  panX: number;
  panY: number;
  duration: number;
  easing: EasingType;
  /** Parallax factor for background (0 = none, 0.5 = half movement). */
  parallax?: number;
};

export type CameraPlan = {
  viewport: { width: number; height: number };
  moves: CameraMove[];
};

function loadUIMap(): UIMap {
  if (!fs.existsSync(UI_MAP_PATH)) {
    throw new Error(`UI map not found: ${UI_MAP_PATH}. Run ui-detector first.`);
  }
  return JSON.parse(fs.readFileSync(UI_MAP_PATH, "utf-8")) as UIMap;
}

/** Generate camera plan from UI map and scene registry. */
export function runMotionEngine(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const uiMap = loadUIMap();
  const moves: CameraMove[] = [];
  const vw = uiMap.viewport.width;
  const vh = uiMap.viewport.height;

  for (const scene of SCENE_REGISTRY) {
    const el = uiMap.elements.find((e) => e.sceneId === scene.id);
    const duration = scene.duration;
    const focusSelector = scene.selector.split(",")[0]?.trim() ?? `#${scene.id}`;

    if (el && el.width > 0 && el.height > 0) {
      const centerX = el.x + el.width / 2;
      const centerY = el.y + el.height / 2;
      // Pan to center element in viewport (pixel offset from center 960,540)
      const panX = centerX - vw / 2;
      const panY = centerY - vh / 2;
      moves.push({
        sceneId: scene.id,
        startZoom: 1.0,
        endZoom: 1.4,
        panX,
        panY,
        duration,
        easing: "cubic",
        parallax: 0.2,
      });
    } else {
      moves.push({
        sceneId: scene.id,
        startZoom: 1.0,
        endZoom: 1.1,
        panX: 0,
        panY: 0,
        duration,
        easing: "ease-out",
        parallax: 0,
      });
    }
  }

  const plan: CameraPlan = {
    viewport: uiMap.viewport,
    moves,
  };
  fs.writeFileSync(CAMERA_PLAN_PATH, JSON.stringify(plan, null, 2), "utf-8");
  console.log("[motion-engine] Wrote", CAMERA_PLAN_PATH);
}

function main(): void {
  try {
    runMotionEngine();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
