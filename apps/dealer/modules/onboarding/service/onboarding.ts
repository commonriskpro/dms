import * as onboardingDb from "../db/onboarding";
import type { InventoryPathChosen } from "../db/onboarding";

const MIN_STEP = 1;
const MAX_STEP = 6;

export type OnboardingStateDto = {
  id: string;
  dealershipId: string;
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  inventoryPathChosen: InventoryPathChosen | null;
  isComplete: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: {
  id: string;
  dealershipId: string;
  currentStep: number;
  completedSteps: unknown;
  skippedSteps: unknown;
  inventoryPathChosen: string | null;
  isComplete: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OnboardingStateDto {
  return {
    id: row.id,
    dealershipId: row.dealershipId,
    currentStep: row.currentStep,
    completedSteps: onboardingDb.parseCompletedSteps(row.completedSteps),
    skippedSteps: onboardingDb.parseSkippedSteps(row.skippedSteps),
    inventoryPathChosen: row.inventoryPathChosen as InventoryPathChosen | null,
    isComplete: row.isComplete,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get or lazily create onboarding state for the dealership.
 * Used by GET onboarding API and by onboarding-status when user has active dealership.
 */
export async function getOrCreateState(dealershipId: string): Promise<OnboardingStateDto> {
  const row = await onboardingDb.ensureOnboardingState(dealershipId);
  return rowToDto(row);
}

/**
 * Advance to a step (1–6). Does not mark step completed; use completeStep for that.
 */
export async function advanceStep(dealershipId: string, step: number): Promise<OnboardingStateDto> {
  const clamped = Math.max(MIN_STEP, Math.min(MAX_STEP, step));
  await onboardingDb.ensureOnboardingState(dealershipId);
  const updated = await onboardingDb.updateOnboardingState(dealershipId, {
    currentStep: clamped,
  });
  return rowToDto(updated);
}

/**
 * Mark a step (1–5) as completed and advance currentStep to next. Step 6 completion uses markOnboardingComplete.
 */
export async function completeStep(dealershipId: string, step: number): Promise<OnboardingStateDto> {
  const clamped = Math.max(MIN_STEP, Math.min(MAX_STEP, step));
  await onboardingDb.ensureOnboardingState(dealershipId);
  const row = await onboardingDb.getOnboardingState(dealershipId);
  if (!row) throw new Error("onboarding state missing after ensure");
  const completed = onboardingDb.parseCompletedSteps(row.completedSteps);
  if (!completed.includes(clamped)) completed.push(clamped);
  const nextStep = Math.min(MAX_STEP, clamped + 1);
  const updated = await onboardingDb.updateOnboardingState(dealershipId, {
    completedSteps: completed,
    currentStep: nextStep,
  });
  return rowToDto(updated);
}

/**
 * Mark a step as skipped (steps 2, 4, 5; step 3 uses inventory path choice).
 */
export async function skipStep(dealershipId: string, step: number): Promise<OnboardingStateDto> {
  const clamped = Math.max(MIN_STEP, Math.min(MAX_STEP, step));
  await onboardingDb.ensureOnboardingState(dealershipId);
  const row = await onboardingDb.getOnboardingState(dealershipId);
  if (!row) throw new Error("onboarding state missing after ensure");
  const skipped = onboardingDb.parseSkippedSteps(row.skippedSteps);
  if (!skipped.includes(clamped)) skipped.push(clamped);
  const nextStep = Math.min(MAX_STEP, clamped + 1);
  const updated = await onboardingDb.updateOnboardingState(dealershipId, {
    skippedSteps: skipped,
    currentStep: nextStep,
  });
  return rowToDto(updated);
}

/**
 * Set inventory path for step 3: "add_first" | "import" | "later".
 */
export async function setInventoryPathChosen(
  dealershipId: string,
  path: InventoryPathChosen
): Promise<OnboardingStateDto> {
  await onboardingDb.ensureOnboardingState(dealershipId);
  const updated = await onboardingDb.updateOnboardingState(dealershipId, {
    inventoryPathChosen: path,
    currentStep: 4,
  });
  return rowToDto(updated);
}

/**
 * Mark onboarding complete (step 6). Sets isComplete and completedAt.
 */
export async function markOnboardingComplete(dealershipId: string): Promise<OnboardingStateDto> {
  await onboardingDb.ensureOnboardingState(dealershipId);
  const row = await onboardingDb.getOnboardingState(dealershipId);
  if (!row) throw new Error("onboarding state missing after ensure");
  const completed = onboardingDb.parseCompletedSteps(row.completedSteps);
  if (!completed.includes(MAX_STEP)) completed.push(MAX_STEP);
  const updated = await onboardingDb.updateOnboardingState(dealershipId, {
    completedSteps: completed,
    currentStep: MAX_STEP,
    isComplete: true,
    completedAt: new Date(),
  });
  return rowToDto(updated);
}
