"use client";

import { Button } from "@/components/ui/button";

export type OperationsBasicsStepProps = {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLoading: boolean;
};

export function OperationsBasicsStep({
  onBack,
  onNext,
  onSkip,
  isLoading,
}: OperationsBasicsStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-soft)]">
        You can manage titles, funding, and delivery from the deal desk. Configure workflows as needed when you run deals.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button onClick={onNext} disabled={isLoading}>
          Continue
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
          Review setup later
        </Button>
      </div>
      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
      </div>
    </div>
  );
}
