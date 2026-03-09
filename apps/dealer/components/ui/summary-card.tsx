"use client";

import Link from "next/link";
import { widgetTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export type SummaryCardProps = {
  title: string;
  value: number | string;
  href: string;
  accentColor?: string;
  className?: string;
};

const cardLabelClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]";

/**
 * Shared stat summary card with progress-bar accent strip.
 * Dashboard-parity: Widget shell, label/value hierarchy.
 */
export function SummaryCard({ title, value, href, accentColor, className }: SummaryCardProps) {
  const pct = typeof value === "number" ? Math.min(100, Math.max(0, (value / 200) * 100)) || 0 : 0;
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className
      )}
    >
      <section className={cn(widgetTokens.widget, "h-full")}>
        <div className="space-y-2.5">
          <p className={cardLabelClass}>{title}</p>
          <div className="tabular-nums font-bold text-[40px] leading-none text-[var(--text)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          <div className="h-[6px] w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: accentColor }}
              aria-hidden
            />
          </div>
        </div>
      </section>
    </Link>
  );
}
