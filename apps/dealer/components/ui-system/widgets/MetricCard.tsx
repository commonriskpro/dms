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
};

function MetricBody({ value, delta, sparkline }: Pick<MetricCardProps, "value" | "delta" | "sparkline">) {
  return (
    <div className="space-y-2">
      <div className="text-[40px] font-bold leading-none tabular-nums text-[var(--text)]">{value}</div>
      {delta ? <div className="text-sm text-[var(--muted-text)]">{delta}</div> : null}
      {sparkline ? <div>{sparkline}</div> : null}
    </div>
  );
}

export function MetricCard({ label, value, delta, sparkline, href, className }: MetricCardProps) {
  const content = (
    <Widget title={label} className={cn("h-full", className)}>
      <MetricBody value={value} delta={delta} sparkline={sparkline} />
    </Widget>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      {content}
    </Link>
  );
}
