import { MetricCard as UIMetricCard } from "@/components/ui-system/widgets/MetricCard";

export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  href: string;
  className?: string;
};

function MiniTrend() {
  return (
    <div className="flex items-end gap-1.5" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--surface-2)]" />
      <span className="h-3.5 w-2.5 rounded-[3px] bg-[var(--surface-2)]" />
      <span className="h-4 w-2.5 rounded-[3px] bg-[var(--surface-2)]" />
      <span className="h-5 w-2.5 rounded-[3px] bg-[var(--accent)] opacity-80" />
      <span className="h-6 w-2.5 rounded-[3px] bg-[var(--accent)]" />
    </div>
  );
}

function formatDelta(d: number): string {
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d}`;
}

export function MetricCard({ title, value, delta7d, delta30d, href, className = "" }: MetricCardProps) {
  const delta = delta7d != null ? delta7d : delta30d ?? null;
  const deltaLabel = delta != null ? `${formatDelta(delta)} listed` : undefined;

  return (
    <UIMetricCard
      label={title}
      value={value.toLocaleString()}
      delta={deltaLabel}
      sparkline={<MiniTrend />}
      href={href}
      className={`relative overflow-hidden ${className}`}
    />
  );
}
