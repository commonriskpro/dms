/**
 * AI demo pipeline — structured scene registry.
 * Each scene has id, selector (for UI detection / camera focus), narration, duration, and route/action for run-demo.
 */

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
  /** CSS selector for UI detection and camera focus. */
  selector: string;
  /** Narration for script and voiceover. */
  narration: string;
  /** Duration in seconds to hold this scene. */
  duration: number;
  /** Action for run-demo to execute (route or interaction). */
  action: SceneAction;
};

/** Scenes: Dashboard, Inventory, Add Vehicle, CRM Pipeline, Deal Desk, Delivery Queue, Final Overview. */
export const SCENE_REGISTRY: RegisteredScene[] = [
  {
    id: "dashboard",
    selector: "main, [data-testid='dashboard'], [role='main']",
    narration: "The dashboard provides a real-time overview of dealership operations.",
    duration: 5,
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
    id: "final_overview",
    selector: "main, [data-testid='dashboard'], [role='main']",
    narration: "From first lead to delivered vehicle, one system for the full deal lifecycle. Thanks for watching.",
    duration: 5,
    action: "closing_overview",
  },
];
