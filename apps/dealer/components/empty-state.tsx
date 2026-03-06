import * as React from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-8 text-center ${className}`}
    >
      <h3 className="text-lg font-medium text-[var(--text)]">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[var(--text-soft)] max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
