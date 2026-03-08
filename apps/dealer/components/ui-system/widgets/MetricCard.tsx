import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Widget } from "./Widget";

export type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  sparkline?: React.ReactNode;
  href?: string;
  className?: string;
  emphasis?: "default" | "hero";
};

function MetricBody({
  value,
  delta,
  sparkline,
  emphasis = "default",
}: Pick<MetricCardProps, "value" | "delta" | "sparkline" | "emphasis">) {
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "tabular-nums font-bold leading-none text-[var(--text)]",
          emphasis === "hero" ? "text-[44px]" : "text-[40px]"
        )}
      >
        {value}
      </div>
      {delta ? (
        <div className="inline-flex min-h-5 items-center rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs font-medium text-[var(--muted-text)]">
          {delta}
        </div>
      ) : null}
      {sparkline ? <div className="pt-1">{sparkline}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  sparkline,
  href,
  className,
  emphasis = "default",
}: MetricCardProps) {
  const content = (
    <Widget
      title={<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">{label}</span>}
      compact
      className={cn("h-full", className)}
    >
      <MetricBody value={value} delta={delta} sparkline={sparkline} emphasis={emphasis} />
    </Widget>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      {content}
    </Link>
  );
}
