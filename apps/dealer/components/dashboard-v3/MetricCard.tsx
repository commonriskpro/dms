import Link from "next/link";
import { cn } from "@/lib/utils";
import { widgetTokens } from "@/lib/ui/tokens";

export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  trend?: number[];
  href: string;
  className?: string;
};

/** SVG area sparkline — renders a filled area + line from a number array. */
function AreaSparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  const W = 88;
  const H = 36;
  if (data.length < 2) {
    return <svg width={W} height={H} aria-hidden />;
  }
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * (H - 4),
  ]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDelta(d: number): string {
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d}`;
}

export function MetricCard({ title, value, delta7d, delta30d, trend, href, className = "" }: MetricCardProps) {
  const delta = delta7d != null ? delta7d : delta30d ?? null;
  const hasTrend = trend && trend.length >= 2;

  const content = (
    <section className={cn(widgetTokens.widgetCompactKpi, "relative overflow-hidden h-full", className)}>
      {/* Label */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]">
        {title}
      </p>

      {/* Body: value left, delta + sparkline right */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="tabular-nums text-[40px] font-bold leading-none text-[var(--text)]">
            {value.toLocaleString()}
          </div>
          {delta != null ? (
            <p className="mt-1.5 text-xs font-medium text-[var(--muted-text)]">
              <span className={delta >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                {formatDelta(delta)}
              </span>
              {" today"}
            </p>
          ) : null}
        </div>

        {hasTrend ? (
          <div className="shrink-0 pb-0.5">
            <AreaSparkline data={trend!} color="var(--accent)" />
          </div>
        ) : null}
      </div>
    </section>
  );

  return (
    <Link href={href} className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      {content}
    </Link>
  );
}
