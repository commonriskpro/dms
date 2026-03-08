import { MetricCard as UIMetricCard } from "@/components/ui-system/widgets/MetricCard";

export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  href: string;
  className?: string;
};

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
      href={href}
      className={className}
    />
  );
}
