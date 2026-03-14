import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  /** When set, action is rendered as a Link (preferred for navigation). Ignored if onAction is also set. */
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}) {
  const showAction = actionLabel && (actionHref || onAction);
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-8 text-center ${className}`}
    >
      <h3 className="text-lg font-medium text-[var(--text)]">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[var(--text-soft)] max-w-sm">{description}</p>
      )}
      {showAction && actionHref && !onAction && (
        <Link href={actionHref} className="mt-4">
          <Button>{actionLabel}</Button>
        </Link>
      )}
      {showAction && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
