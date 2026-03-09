"use client";

import { Button } from "@/components/ui/button";

export type CrmBasicsStepProps = {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLoading: boolean;
};

export function CrmBasicsStep({
  onBack,
  onNext,
  onSkip,
  isLoading,
}: CrmBasicsStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-soft)]">
        Your CRM is set up with default pipelines and stages. You can customize lead sources and pipelines later in CRM settings.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button onClick={onNext} disabled={isLoading}>
          Continue
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
          Set up CRM later
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
