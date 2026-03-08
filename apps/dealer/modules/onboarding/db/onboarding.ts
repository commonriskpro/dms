import { prisma } from "@/lib/db";

const DEFAULT_STEP = 1;
const MIN_STEP = 1;
const MAX_STEP = 6;

export type InventoryPathChosen = "add_first" | "import" | "later";

function ensureNumberArray(value: unknown): number[] {
  if (Array.isArray(value) && value.every((x) => typeof x === "number")) {
    return value.filter((n) => n >= MIN_STEP && n <= MAX_STEP);
  }
  return [];
}

export async function getOnboardingState(dealershipId: string) {
  return prisma.dealershipOnboardingState.findUnique({
    where: { dealershipId },
  });
}

/**
 * Get onboarding state for dealership, or null if none exists.
 * Does not create; use ensureOnboardingState for lazy creation.
 */
export async function getOnboardingStateOrNull(dealershipId: string) {
  return prisma.dealershipOnboardingState.findUnique({
    where: { dealershipId },
  });
}

/**
 * Lazy creation: if no row exists, create one with default state (currentStep 1, not complete).
 */
export async function ensureOnboardingState(dealershipId: string) {
  const existing = await prisma.dealershipOnboardingState.findUnique({
    where: { dealershipId },
  });
  if (existing) return existing;
  return prisma.dealershipOnboardingState.create({
    data: {
      dealershipId,
      currentStep: DEFAULT_STEP,
      completedSteps: [],
      skippedSteps: [],
      isComplete: false,
    },
  });
}

export type UpdateOnboardingStepData = {
  currentStep?: number;
  completedSteps?: number[];
  skippedSteps?: number[];
  inventoryPathChosen?: InventoryPathChosen | null;
  isComplete?: boolean;
  completedAt?: Date | null;
};

export async function updateOnboardingState(
  dealershipId: string,
  data: UpdateOnboardingStepData
) {
  const payload: Parameters<typeof prisma.dealershipOnboardingState.update>[0]["data"] = {};
  if (data.currentStep !== undefined) {
    const step = Math.max(MIN_STEP, Math.min(MAX_STEP, data.currentStep));
    payload.currentStep = step;
  }
  if (data.completedSteps !== undefined) {
    payload.completedSteps = ensureNumberArray(data.completedSteps) as unknown as object;
  }
  if (data.skippedSteps !== undefined) {
    payload.skippedSteps = ensureNumberArray(data.skippedSteps) as unknown as object;
  }
  if (data.inventoryPathChosen !== undefined) {
    payload.inventoryPathChosen = data.inventoryPathChosen;
  }
  if (data.isComplete !== undefined) {
    payload.isComplete = data.isComplete;
  }
  if (data.completedAt !== undefined) {
    payload.completedAt = data.completedAt;
  }
  return prisma.dealershipOnboardingState.update({
    where: { dealershipId },
    data: payload,
  });
}

export function parseCompletedSteps(raw: unknown): number[] {
  return ensureNumberArray(raw);
}

export function parseSkippedSteps(raw: unknown): number[] {
  return ensureNumberArray(raw);
}
