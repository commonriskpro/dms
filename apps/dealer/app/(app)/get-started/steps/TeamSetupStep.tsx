"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export type TeamSetupStepProps = {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLoading: boolean;
};

export function TeamSetupStep({
  onBack,
  onNext,
  onSkip,
  isLoading,
}: TeamSetupStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-soft)]">
        Invite team members so others can use the dealership. You can invite people from Team settings anytime.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href="/admin/users">
          <Button variant="primary" disabled={isLoading}>
            Invite team members
          </Button>
        </Link>
        <Button variant="secondary" onClick={onNext} disabled={isLoading}>
          I've sent invites — continue
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
          Invite later
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
