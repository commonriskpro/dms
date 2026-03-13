/**
 * Cinematic demo generator — scene definitions.
 * Each scene has id, duration (seconds), action (for run-demo), and narration (for script/voiceover).
 */

export type DemoSceneAction =
  | "open_dashboard"
  | "open_inventory"
  | "open_add_vehicle"
  | "open_crm_pipeline"
  | "move_opportunity_stage"
  | "open_deals"
  | "open_deal_modal"
  | "open_delivery_queue"
  | "closing_overview";

export type DemoScene = {
  id: string;
  /** Duration in seconds to hold this scene (slow, cinematic). */
  duration: number;
  action: DemoSceneAction;
  /** Narration text for script and voiceover. */
  narration: string;
};

/** Scene list: dashboard → inventory → CRM → deal desk → delivery → closing. */
export const DEMO_SCENES: DemoScene[] = [
  {
    id: "intro",
    duration: 5,
    action: "open_dashboard",
    narration: "Welcome to the DMS. One platform for your entire dealership.",
  },
  {
    id: "dashboard",
    duration: 6,
    action: "open_dashboard",
    narration: "The dashboard gives you a real-time overview of operations, from inventory health to pipeline activity.",
  },
  {
    id: "inventory",
    duration: 6,
    action: "open_inventory",
    narration: "Inventory can be added in seconds using VIN decoding. Track aging, recon, and missing photos in one place.",
  },
  {
    id: "add_vehicle",
    duration: 6,
    action: "open_add_vehicle",
    narration: "Add a vehicle from the list or quick actions. The form opens in a modal so you never lose your place.",
  },
  {
    id: "crm",
    duration: 6,
    action: "open_crm_pipeline",
    narration: "Leads are tracked through a structured sales pipeline. Move opportunities from lead to won with full visibility.",
  },
  {
    id: "crm_move",
    duration: 4,
    action: "move_opportunity_stage",
    narration: "Stages keep the team aligned and make it easy to see what needs attention.",
  },
  {
    id: "deals",
    duration: 6,
    action: "open_deals",
    narration: "Deal desk is where numbers come together. Structure deals, attach finance, and track funding in one workflow.",
  },
  {
    id: "deal_modal",
    duration: 4,
    action: "open_deal_modal",
    narration: "Open any deal in a modal to review or edit without leaving the list.",
  },
  {
    id: "delivery",
    duration: 6,
    action: "open_delivery_queue",
    narration: "The delivery queue shows deals ready for delivery and those already delivered. Title, DMV, and funding in one view.",
  },
  {
    id: "closing",
    duration: 6,
    action: "closing_overview",
    narration: "From first lead to delivered vehicle, the DMS keeps everything in one system. Thanks for watching.",
  },
];
