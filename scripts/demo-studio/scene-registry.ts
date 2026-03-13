/**
 * Cinematic Demo Studio — structured scene registry.
 * Defines Intro, Dashboard, Inventory, Add Vehicle, CRM Pipeline, Deal Desk, Delivery Queue, Closing.
 * Scenes are written to /demo-output/scenes.json by the orchestrator or run-walkthrough.
 */

import path from "path";
import fs from "fs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "demo-output");
const SCENES_JSON = path.join(OUT_DIR, "scenes.json");

export type SceneAction =
  | "open_dashboard"
  | "open_inventory"
  | "open_add_vehicle"
  | "open_crm_pipeline"
  | "move_opportunity_stage"
  | "open_deals"
  | "open_deal_modal"
  | "open_delivery_queue"
  | "closing_overview";

export type RegisteredScene = {
  id: string;
  /** Optional title for intro/slate. */
  title?: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** CSS selector for UI detection and camera focus (empty for intro). */
  selector: string;
  /** Narration for script and voiceover. */
  narration: string;
  /** Duration in seconds to hold this scene. */
  duration: number;
  /** Action for run-walkthrough to execute. */
  action: SceneAction;
};

/** Intro scene (no selector). */
const INTRO_SCENE: RegisteredScene = {
  id: "intro",
  title: "Dealer OS",
  subtitle: "Modern dealership operating system",
  selector: "",
  narration: "Welcome to the DMS. This walkthrough shows how your team manages inventory, leads, and deals from one place.",
  duration: 3,
  action: "open_dashboard",
};

/** All scenes: Intro, Dashboard, Inventory, Add Vehicle, CRM, Deal Desk, Delivery, Closing. */
export const SCENE_REGISTRY: RegisteredScene[] = [
  INTRO_SCENE,
  {
    id: "dashboard",
    selector: "main, [data-testid='dashboard'], [role='main']",
    narration: "The dashboard provides a real-time overview of dealership operations.",
    duration: 6,
    action: "open_dashboard",
  },
  {
    id: "inventory",
    selector: "main, [data-testid='inventory-table'], table",
    narration: "Inventory can be managed and published in seconds.",
    duration: 6,
    action: "open_inventory",
  },
  {
    id: "add_vehicle",
    selector: "[role='dialog'], [data-state='open'], form",
    narration: "Add a vehicle in one click. VIN decode and forms open in a modal so you never lose your place.",
    duration: 6,
    action: "open_add_vehicle",
  },
  {
    id: "crm_pipeline",
    selector: "main, [data-testid='opportunity-board'], [role='main']",
    narration: "Leads are tracked through a structured sales pipeline with full visibility.",
    duration: 6,
    action: "open_crm_pipeline",
  },
  {
    id: "crm_move",
    selector: "[data-testid='opportunity-card'], [data-opportunity-id], .opportunity-card",
    narration: "Move opportunities between stages to keep the team aligned.",
    duration: 4,
    action: "move_opportunity_stage",
  },
  {
    id: "deal_desk",
    selector: "main, [data-testid='deals-list'], table",
    narration: "Deal desk is where numbers come together. Structure deals and track funding in one workflow.",
    duration: 6,
    action: "open_deals",
  },
  {
    id: "deal_modal",
    selector: "[role='dialog'], [data-state='open']",
    narration: "Open any deal in a modal to review or edit without leaving the list.",
    duration: 4,
    action: "open_deal_modal",
  },
  {
    id: "delivery_queue",
    selector: "main, [data-testid='delivery-queue'], [role='main']",
    narration: "The delivery queue shows deals ready for delivery and those already delivered.",
    duration: 6,
    action: "open_delivery_queue",
  },
  {
    id: "closing",
    selector: "main, [data-testid='dashboard'], [role='main']",
    narration: "From first lead to delivered vehicle, one system for the full deal lifecycle. Thanks for watching.",
    duration: 5,
    action: "closing_overview",
  },
];

/** Write scene registry to demo-output/scenes.json. */
export function saveScenesJson(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(SCENES_JSON, JSON.stringify(SCENE_REGISTRY, null, 2), "utf-8");
  console.log("[scene-registry] Wrote", SCENES_JSON);
}
