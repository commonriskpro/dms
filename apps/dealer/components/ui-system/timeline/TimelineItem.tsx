import * as React from "react";
import { cn } from "@/lib/utils";

export function TimelineItem({
  title,
  timestamp,
  detail,
  className,
}: {
  title: React.ReactNode;
  timestamp?: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("relative pl-6", className)}>
      <span
        className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]"
        aria-hidden="true"
      />
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        {timestamp ? <p className="text-xs text-[var(--muted-text)]">{timestamp}</p> : null}
        {detail ? <div className="mt-1 text-xs text-[var(--text-soft)]">{detail}</div> : null}
      </div>
    </li>
  );
}
