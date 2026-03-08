"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { widgetTokens } from "@/lib/ui/tokens";

// ─── Color palette ────────────────────────────────────────────────────────────
export type MetricCardColor = "green" | "blue" | "violet" | "amber" | "cyan" | "default";

const COLORS: Record<MetricCardColor, {
  sparkline: string;   // SVG stroke/fill color
  border: string;      // Tailwind border class (resting, low-opacity)
  glow: string;        // rgba string for @keyframes --kpi-glow-color
  gradient: string;    // bottom tint gradient for the card
}> = {
  green:   { sparkline: "#4ade80", border: "border-emerald-500/30", glow: "rgba(74,222,128,0.55)",  gradient: "rgba(74,222,128,0.06)" },
  blue:    { sparkline: "#60a5fa", border: "border-blue-500/30",    glow: "rgba(96,165,250,0.55)",  gradient: "rgba(96,165,250,0.06)" },
  violet:  { sparkline: "#a78bfa", border: "border-violet-500/30",  glow: "rgba(167,139,250,0.55)", gradient: "rgba(167,139,250,0.06)" },
  amber:   { sparkline: "#fbbf24", border: "border-amber-500/40",   glow: "rgba(251,191,36,0.60)",  gradient: "rgba(251,191,36,0.07)" },
  cyan:    { sparkline: "#22d3ee", border: "border-cyan-500/30",    glow: "rgba(34,211,238,0.55)",  gradient: "rgba(34,211,238,0.06)" },
  default: { sparkline: "var(--accent)", border: "border-[var(--border)]", glow: "rgba(99,102,241,0.4)", gradient: "rgba(99,102,241,0.04)" },
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
function AreaSparkline({ data, color }: { data: number[]; color: string }) {
  const W = 88;
  const H = 36;
  if (data.length < 2) return <svg width={W} height={H} aria-hidden />;
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
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden fill="none">
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
export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  trend?: number[];
  href: string;
  color?: MetricCardColor;
  /** Pass a monotonically-increasing token (e.g. refreshToken) to re-trigger the glow. */
  refreshKey?: number;
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function MetricCard({
  title,
  value,
  delta7d,
  delta30d,
  trend,
  href,
  color = "default",
  refreshKey,
  className = "",
}: MetricCardProps) {
  const delta    = delta7d != null ? delta7d : delta30d ?? null;
  const hasTrend = trend && trend.length >= 2;
  const theme    = COLORS[color];

  // ── Glow animation on update ──────────────────────────────────────────────
  const [glowKey, setGlowKey]       = React.useState(0);
  const [glowing, setGlowing]       = React.useState(false);
  const skipFirstRender             = React.useRef(true);

  // Trigger glow on mount (once data is available) and on every refreshKey change
  React.useEffect(() => {
    if (skipFirstRender.current) {
      skipFirstRender.current = false;
      if (delta != null) triggerGlow();
      return;
    }
    triggerGlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function triggerGlow() {
    setGlowing(false);
    // Double-RAF to reset the animation before re-applying
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setGlowKey((k) => k + 1);
        setGlowing(true);
      })
    );
    // Remove class after animation completes (1.4 s)
    setTimeout(() => setGlowing(false), 1400);
  }

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
          // Colored resting border
          theme.border,
          // Hover lift
          "transition-shadow hover:shadow-lg",
          // Padding
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
        {/* Colored left accent bar */}
        <span
          className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full opacity-70"
          style={{ background: theme.sparkline }}
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
              {value.toLocaleString()}
            </div>
            {delta != null ? (
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

          {hasTrend ? (
            <div className="shrink-0 pb-0.5">
              <AreaSparkline data={trend!} color={theme.sparkline} />
            </div>
          ) : null}
        </div>
      </section>
    </Link>
  );
}
