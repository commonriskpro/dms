"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export type LaunchStepProps = {
  onBack: () => void;
  onFinish: () => void;
  onFinishLater: () => void;
  isLoading: boolean;
};

export function LaunchStep({
  onBack,
  onFinish,
  onFinishLater,
  isLoading,
}: LaunchStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-base font-medium text-[var(--text)]">
        You're all set. Here are some next steps you can take:
      </p>
      <ul className="space-y-2 text-sm text-[var(--text-soft)]">
        <li>
          <Link href="/inventory/new" className="text-[var(--accent)] hover:underline">
            Add a vehicle
          </Link>
        </li>
        <li>
          <Link href="/customers" className="text-[var(--accent)] hover:underline">
            Add a customer
          </Link>
        </li>
        <li>
          <Link href="/deals" className="text-[var(--accent)] hover:underline">
            Start a deal
          </Link>
        </li>
        <li>
          <Link href="/admin/users" className="text-[var(--accent)] hover:underline">
            Invite team members
          </Link>
        </li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={onFinish} disabled={isLoading}>
          Go to dashboard
        </Button>
        <Button variant="ghost" size="sm" onClick={onFinishLater} disabled={isLoading}>
          I'll finish later
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
