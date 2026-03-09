/** Response shape from GET /api/onboarding */
export type OnboardingState = {
  id: string;
  dealershipId: string;
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  inventoryPathChosen?: "add_first" | "import" | "later";
  isComplete: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export const STEP_LABELS: Record<number, string> = {
  1: "Dealership info",
  2: "Team setup",
  3: "Inventory setup",
  4: "CRM basics",
  5: "Operations basics",
  6: "Launch",
};

export const TOTAL_STEPS = 6;
