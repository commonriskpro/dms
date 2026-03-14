import * as React from "react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`glass-surface flex flex-col items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 text-center ${className}`}
    >
      <h3 className="text-lg font-medium text-[var(--text)]">{title}</h3>
      {message && (
        <p className="mt-1 text-sm text-[var(--text-soft)] max-w-md">{message}</p>
      )}
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
