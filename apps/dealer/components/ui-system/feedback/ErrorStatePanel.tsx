import * as React from "react";
import { Button } from "@/components/ui/button";

type ErrorStatePanelProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorStatePanel({
  title = "Something went wrong",
  description,
  onRetry,
}: ErrorStatePanelProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/30 bg-[var(--danger-surface)] p-6">
      <h3 className="text-base font-semibold text-[var(--danger-text)]">{title}</h3>
      {description ? <p className="mt-1 text-sm text-[var(--danger-text)]/90">{description}</p> : null}
      {onRetry ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
