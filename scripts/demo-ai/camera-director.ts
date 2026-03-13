/**
 * AI demo pipeline — camera director.
 * Uses UI metadata to generate camera movements: smooth zoom, pan to element, focus highlight, blur background.
 * Saves camera plan to /demo-output/camera-plan.json.
 */

import path from "path";
import fs from "fs";
import { SCENE_REGISTRY } from "./scene-registry";
import type { UIMap } from "./ui-detector";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const UI_MAP_PATH = path.join(OUT_DIR, "ui-map.json");
const CAMERA_PLAN_PATH = path.join(OUT_DIR, "camera-plan.json");

export type CameraMove = {
  sceneId: string;
  startZoom: number;
  endZoom: number;
  /** CSS selector or scene id for focus element. */
  focusElement: string;
  /** Pan target: center of focus element (normalized 0–1 or pixels). */
  panX?: number;
  panY?: number;
  duration: number;
  /** Optional: apply focus highlight / blur background (for renderer hint). */
  focusHighlight?: boolean;
  blurBackground?: boolean;
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
export function runCameraDirector(): void {
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
      const panX = centerX / vw;
      const panY = centerY / vh;
      moves.push({
        sceneId: scene.id,
        startZoom: 1.0,
        endZoom: 1.2,
        focusElement: focusSelector,
        panX,
        panY,
        duration,
        focusHighlight: true,
        blurBackground: false,
      });
    } else {
      moves.push({
        sceneId: scene.id,
        startZoom: 1.0,
        endZoom: 1.1,
        focusElement: focusSelector,
        duration,
        focusHighlight: false,
        blurBackground: false,
      });
    }
  }

  const plan: CameraPlan = {
    viewport: uiMap.viewport,
    moves,
  };
  fs.writeFileSync(CAMERA_PLAN_PATH, JSON.stringify(plan, null, 2), "utf-8");
  console.log("[camera-director] Wrote", CAMERA_PLAN_PATH);
}

function main() {
  try {
    runCameraDirector();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
