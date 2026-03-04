/**
 * Single source of truth for customer/CRM stage values (maps to Prisma CustomerStatus).
 * Use for filters, Road-to-Sale, stage badges, and stage change UI.
 */
export const CRM_STAGES = ["LEAD", "ACTIVE", "SOLD", "INACTIVE"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  LEAD: "Lead",
  ACTIVE: "Active",
  SOLD: "Sold",
  INACTIVE: "Lost",
};

/** Order for road-to-sale progress (left to right / top to bottom). */
export const CRM_STAGE_ORDER: CrmStage[] = ["LEAD", "ACTIVE", "SOLD", "INACTIVE"];

/** Terminal stages: no further progression. */
export const CRM_TERMINAL_STAGES: CrmStage[] = ["SOLD", "INACTIVE"];

export function getStageIndex(stage: string): number {
  const i = CRM_STAGE_ORDER.indexOf(stage as CrmStage);
  return i >= 0 ? i : 0;
}

export function getStageLabel(stage: string): string {
  return CRM_STAGE_LABELS[stage as CrmStage] ?? stage;
}

/** Stage color variant for badges and road-to-sale: neutral, active (blue), success (green), danger (red). */
export type StageColorVariant = "neutral" | "active" | "success" | "danger";

export function getStageColorVariant(stage: string, currentStage: string): StageColorVariant {
  if (stage === "SOLD") return "success";
  if (stage === "INACTIVE") return "danger";
  const currentIdx = getStageIndex(currentStage);
  const idx = getStageIndex(stage);
  if (idx < currentIdx) return "neutral";
  if (idx === currentIdx) return "active";
  return "neutral";
}
