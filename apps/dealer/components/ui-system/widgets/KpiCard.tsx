"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KPI card: colored left bar, uppercase label, large value, optional subtitle/trend.
 * Glowline (colored border) appears only when hasUpdate is true; otherwise neutral border.
 * Use hasUpdate for "today" delta > 0 or when data just refreshed. Default for all KPIs.
 */
export type KpiCardColor = "green" | "blue" | "violet" | "amber" | "cyan" | "default";

const COLORS: Record<
  KpiCardColor,
  { border: string; bar: string; sub: string; sparkline: string }
> = {
  green: {
    border: "border-[var(--success)]/40",
    bar: "var(--success)",
    sub: "text-[var(--success)]",
    sparkline: "var(--success)",
  },
  blue: {
    border: "border-[var(--accent)]/40",
    bar: "var(--accent)",
    sub: "text-[var(--accent)]",
    sparkline: "var(--accent)",
  },
  violet: {
    border: "border-[var(--accent-leads)]/40",
    bar: "var(--accent-leads)",
    sub: "text-[var(--accent-leads)]",
    sparkline: "var(--accent-leads)",
  },
  amber: {
    border: "border-[var(--warning)]/40",
    bar: "var(--warning)",
    sub: "text-[var(--warning)]",
    sparkline: "var(--warning)",
  },
  cyan: {
    border: "border-[var(--accent)]/40",
    bar: "var(--accent)",
    sub: "text-[var(--accent)]",
    sparkline: "var(--accent)",
  },
  default: {
    border: "border-[var(--border)]",
    bar: "var(--muted-text)",
    sub: "text-[var(--muted-text)]",
    sparkline: "var(--accent)",
  },
};

// ─── Trend bar (sparkline) ───────────────────────────────────────────────────
function TrendBar({ data, color, animate }: { data: number[]; color: string; animate?: boolean }) {
  const W = 88;
  const H = 36;
  if (data.length < 2)
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden fill="none" className="shrink-0">
        <line x1={0} y1={H - 4} x2={W} y2={H - 4} stroke={color} strokeWidth={1.5} strokeOpacity={0.4} strokeLinecap="round" />
      </svg>
    );
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * (H - 4),
  ]);
  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x!.toFixed(1)},${y!.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const gradId = `kpi-spark-${color.replace(/[^a-z0-9]/gi, "")}-${pts.length}`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      fill="none"
      className={cn("shrink-0", animate && "animate-in fade-in duration-300")}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type KpiCardProps = {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  /** Accent color for left bar and optional subtitle */
  color?: KpiCardColor;
  /** When true, value uses warning color */
  accentValue?: boolean;
  /** When true, show colored border (glowline); when false/undefined, neutral border only. Use for e.g. "today" delta > 0. */
  hasUpdate?: boolean;
  /** Click to apply filter; card becomes interactive and shows active state */
  onClick?: () => void;
  active?: boolean;
  /** Trend data for the bottom-right sparkline (required). Pass at least 2 points; re-renders when data or refreshKey changes. Use e.g. [v1, v2, ...] or [0, 0] for a flat line. */
  trend: number[];
  /** Increment to trigger trend bar update / brief pulse (e.g. after data refresh) */
  refreshKey?: number;
  className?: string;
};

export function KpiCard({
  label,
  value,
  sub,
  color = "default",
  accentValue,
  hasUpdate = false,
  onClick,
  active,
  trend,
  refreshKey,
  className,
}: KpiCardProps) {
  const theme = COLORS[color];
  const isButton = typeof onClick === "function";
  const showGlowline = hasUpdate;
  const trendData = trend.length >= 2 ? trend : [1, 1];

  const [trendKey, setTrendKey] = React.useState(0);
  const prevRefreshKey = React.useRef(refreshKey);
  React.useEffect(() => {
    if (refreshKey != null && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setTrendKey((k) => k + 1);
    }
  }, [refreshKey]);

  const content = (
    <>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div
            className={cn(
              "tabular-nums text-[32px] font-bold leading-none",
              accentValue ? "text-[var(--warning)]" : "text-[var(--text)]"
            )}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {sub != null && (
            <p className={cn("mt-1.5 text-xs font-medium", theme.sub)}>{sub}</p>
          )}
        </div>
        <div className="pb-0.5" key={trendKey}>
          <TrendBar data={trendData} color={theme.sparkline} animate={trendKey > 0} />
        </div>
      </div>
    </>
  );

  const sectionClass = cn(
    "kpi-noise relative overflow-hidden h-full rounded-[var(--radius-card)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]",
    "border-[var(--border)]",
    isButton &&
      "cursor-pointer transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    active && "border-[var(--accent)]/60 bg-[var(--accent)]/5",
    className
  );

  if (isButton) {
    return (
      <section
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={sectionClass}
      >
        {content}
      </section>
    );
  }

  return <section className={sectionClass}>{content}</section>;
}
