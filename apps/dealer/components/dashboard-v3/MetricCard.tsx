"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { widgetTokens } from "@/lib/ui/tokens";

// ─── Color palette ────────────────────────────────────────────────────────────
type MetricCardColor = "green" | "blue" | "violet" | "amber" | "cyan" | "default";

const COLORS: Record<MetricCardColor, {
  sparkline: string;   // SVG stroke/fill color
  border: string;      // Tailwind border class (token-based)
  glow: string;        // rgba string for @keyframes --kpi-glow-color
  gradient: string;    // bottom tint gradient for the card
}> = {
  green:   { sparkline: "#4ade80", border: "border-[var(--success)]", glow: "rgba(74,222,128,0.55)",  gradient: "rgba(74,222,128,0.06)" },
  blue:    { sparkline: "#60a5fa", border: "border-[var(--accent)]",    glow: "rgba(96,165,250,0.55)",  gradient: "rgba(96,165,250,0.06)" },
  violet:  { sparkline: "#a78bfa", border: "border-[var(--accent-leads)]",  glow: "rgba(167,139,250,0.55)", gradient: "rgba(167,139,250,0.06)" },
  amber:   { sparkline: "#fbbf24", border: "border-[var(--warning)]",   glow: "rgba(251,191,36,0.60)",  gradient: "rgba(251,191,36,0.07)" },
  cyan:    { sparkline: "#22d3ee", border: "border-[var(--accent)]",    glow: "rgba(34,211,238,0.55)",  gradient: "rgba(34,211,238,0.06)" },
  default: { sparkline: "var(--accent)", border: "border-[var(--border)]", glow: "rgba(99,102,241,0.4)", gradient: "rgba(99,102,241,0.04)" },
};

// ─── Sparkline (flat baseline when data.length < 2) ───────────────────────────
function AreaSparkline({ data, color }: { data: number[]; color: string }) {
  const W = 88;
  const H = 36;
  if (data.length < 2) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden fill="none" className="shrink-0">
        <line x1={0} y1={H - 4} x2={W} y2={H - 4} stroke={color} strokeWidth={1.5} strokeOpacity={0.4} strokeLinecap="round" />
      </svg>
    );
  }
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * (H - 4),
  ]);
  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x!.toFixed(1)},${y!.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden fill="none" className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.40" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDelta(d: number): string {
  return `${d >= 0 ? "+" : ""}${d}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
type MetricCardProps = {
  title: string;
  value: number;
  valueDisplay?: string;
  delta7d?: number | null;
  delta30d?: number | null;
  deltaLabel?: React.ReactNode;
  /** When provided, shown instead of delta "+N today". Use for e.g. "X unresolved". */
  sub?: React.ReactNode;
  /** Optional suffix for value display (e.g. "%"). */
  valueSuffix?: string;
  trend?: number[];
  href: string;
  color?: MetricCardColor;
  /** Pass a monotonically-increasing token (e.g. refreshToken) to re-trigger the glow. */
  refreshKey?: number;
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────
const NEUTRAL_BAR = "var(--muted-text)";

export function MetricCard({
  title,
  value,
  valueDisplay,
  delta7d,
  delta30d,
  deltaLabel,
  sub: subProp,
  valueSuffix,
  trend,
  href,
  color = "default",
  refreshKey,
  className = "",
}: MetricCardProps) {
  const delta    = delta7d != null ? delta7d : delta30d ?? null;
  const hasTrend = trend && trend.length >= 2;
  const theme    = COLORS[color];

  // ── Glow animation: colored border/left bar only during brief glow ──────────
  const [glowKey, setGlowKey]       = React.useState(0);
  const [glowing, setGlowing]       = React.useState(false);
  const skipFirstRender             = React.useRef(true);

  // Trigger glow only when there's an update (delta > 0) or on data refresh
  React.useEffect(() => {
    if (skipFirstRender.current) {
      skipFirstRender.current = false;
      if (delta != null && delta > 0) triggerGlow();
      return;
    }
    triggerGlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function triggerGlow() {
    setGlowing(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setGlowKey((k) => k + 1);
        setGlowing(true);
      })
    );
    setTimeout(() => setGlowing(false), 1400);
  }

  const showColored = glowing;

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "h-full"
      )}
    >
      <section
        key={glowKey}
        className={cn(
          // Base KPI card style (grain + bg)
          "kpi-noise relative overflow-hidden h-full",
          "rounded-[var(--radius-card)] border bg-[var(--surface)] shadow-[var(--shadow-card)]",
          // Colored border only during brief glow
          showColored ? theme.border : "border-[var(--border)]",
          "transition-shadow hover:shadow-lg",
          "p-4",
          className
        )}
        style={{
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E"),
            linear-gradient(to bottom, transparent 40%, ${theme.gradient} 100%)
          `,
          backgroundSize: "180px 180px, 100% 100%",
          backgroundRepeat: "repeat, no-repeat",
          // Glow CSS variable + animation
          ["--kpi-glow-color" as string]: theme.glow,
          animation: glowing ? "kpi-glow 1.4s ease-out forwards" : undefined,
        }}
      >
        {/* Left accent bar: colored only during glow */}
        <span
          className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full opacity-70"
          style={{ background: showColored ? theme.sparkline : NEUTRAL_BAR }}
          aria-hidden
        />

        {/* Label */}
        <p className="mb-2 pl-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
          {title}
        </p>

        {/* Body: value left, sparkline right */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 pl-1">
            <div className="tabular-nums text-[40px] font-bold leading-none text-[var(--text)]">
              {valueDisplay ?? `${value.toLocaleString()}${valueSuffix ?? ""}`}
            </div>
            {subProp != null ? (
              <p className="mt-1.5 text-xs font-medium text-[var(--muted-text)]">{subProp}</p>
            ) : deltaLabel != null ? (
              <p className="mt-1.5 text-xs font-medium text-[var(--muted-text)]">{deltaLabel}</p>
            ) : delta != null ? (
              <p className="mt-1.5 text-xs font-medium text-[var(--muted-text)]">
                <span
                  className={delta >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}
                >
                  {formatDelta(delta)}
                </span>
                {" today"}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 translate-y-[4px]">
            <AreaSparkline data={hasTrend ? trend! : [1, 1]} color={theme.sparkline} />
          </div>
        </div>
      </section>
    </Link>
  );
}
