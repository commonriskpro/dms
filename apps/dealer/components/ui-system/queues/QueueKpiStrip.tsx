import * as React from "react";
import { cn } from "@/lib/utils";

export type QueueKpiItem = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

export function QueueKpiStrip({
  items,
  className,
}: {
  items: QueueKpiItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={cn("grid grid-cols-1 gap-3 md:grid-cols-3", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
            {item.label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--text)]">{item.value}</p>
          {item.hint ? <p className="mt-1 text-xs text-[var(--muted-text)]">{item.hint}</p> : null}
        </div>
      ))}
    </section>
  );
}
