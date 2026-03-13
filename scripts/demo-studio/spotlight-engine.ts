/**
 * Cinematic Demo Studio — UI spotlight engine.
 * Defines overlay: highlight selected element, blur background, soft glow around element.
 * Style: rgba black background blur, glow around element border, smooth fade.
 * Output: /demo-output/spotlight-plan.json for use by scene-composer.
 */

import path from "path";
import fs from "fs";
import { SCENE_REGISTRY } from "./scene-registry";
import type { UIMap } from "./ui-detector";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const UI_MAP_PATH = path.join(OUT_DIR, "ui-map.json");
const SPOTLIGHT_PLAN_PATH = path.join(OUT_DIR, "spotlight-plan.json");

export type SpotlightSpec = {
  sceneId: string;
  /** Apply spotlight (highlight + blur + glow). Intro/closing may skip. */
  enabled: boolean;
  /** Bounding box for highlight cutout (from ui-map). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Border glow radius (px). */
  glowRadius: number;
  /** Border glow color (rgba). */
  glowColor: string;
  /** Background overlay color (rgba). */
  overlayColor: string;
  /** Blur strength for background (px). */
  blurPx: number;
  /** Fade-in duration (s). */
  fadeInDuration: number;
};

export type SpotlightPlan = {
  viewport: { width: number; height: number };
  spots: SpotlightSpec[];
};

function loadUIMap(): UIMap {
  if (!fs.existsSync(UI_MAP_PATH)) {
    throw new Error(`UI map not found: ${UI_MAP_PATH}. Run ui-detector first.`);
  }
  return JSON.parse(fs.readFileSync(UI_MAP_PATH, "utf-8")) as UIMap;
}

/** Generate spotlight plan from UI map and scene registry. */
export function runSpotlightEngine(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const uiMap = loadUIMap();
  const spots: SpotlightSpec[] = [];

  for (const scene of SCENE_REGISTRY) {
    const el = uiMap.elements.find((e) => e.sceneId === scene.id);
    const isIntroOrClosing = scene.id === "intro" || scene.id === "closing";
    const enabled = !isIntroOrClosing && !!el && el.width > 0 && el.height > 0;

    spots.push({
      sceneId: scene.id,
      enabled,
      x: el?.x ?? 0,
      y: el?.y ?? 0,
      width: el?.width ?? 1920,
      height: el?.height ?? 1080,
      glowRadius: 12,
      glowColor: "rgba(59, 130, 246, 0.6)",
      overlayColor: "rgba(0, 0, 0, 0.5)",
      blurPx: 8,
      fadeInDuration: 0.3,
    });
  }

  const plan: SpotlightPlan = {
    viewport: uiMap.viewport,
    spots,
  };
  fs.writeFileSync(SPOTLIGHT_PLAN_PATH, JSON.stringify(plan, null, 2), "utf-8");
  console.log("[spotlight-engine] Wrote", SPOTLIGHT_PLAN_PATH);
}

function main(): void {
  try {
    runSpotlightEngine();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
