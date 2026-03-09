"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export type InventorySetupStepProps = {
  onBack: () => void;
  onNext: (path: "add_first" | "import" | "later") => void;
  onSkip: () => void;
  isLoading: boolean;
  currentPath?: "add_first" | "import" | "later" | null;
};

export function InventorySetupStep({
  onBack,
  onNext,
  onSkip,
  isLoading,
}: InventorySetupStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-soft)]">
        Choose how you want to add vehicles: add your first vehicle now, import in bulk, or set up inventory later.
      </p>
      <div className="flex flex-col gap-2 pt-2">
        <Link href="/inventory/new">
          <Button variant="primary" className="w-full justify-center" disabled={isLoading}>
            Add first vehicle now
          </Button>
        </Link>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={isLoading}
          onClick={() => onNext("add_first")}
        >
          I'll add my first vehicle — continue
        </Button>
        <Link href="/inventory/bulk/import">
          <Button variant="secondary" className="w-full justify-center" disabled={isLoading}>
            Import inventory
          </Button>
        </Link>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={isLoading}
          onClick={() => onNext("import")}
        >
          I'll import inventory — continue
        </Button>
        <Button variant="ghost" className="w-full justify-center" onClick={onSkip} disabled={isLoading}>
          Set up inventory later
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
