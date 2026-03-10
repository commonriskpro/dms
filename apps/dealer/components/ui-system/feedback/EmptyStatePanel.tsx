import * as React from "react";
import { Button } from "@/components/ui/button";

type EmptyStatePanelProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyStatePanel({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStatePanelProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      {description ? <p className="mt-1 text-sm text-[var(--muted-text)]">{description}</p> : null}
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
