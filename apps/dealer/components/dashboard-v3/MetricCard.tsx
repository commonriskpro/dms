import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  href: string;
};

function formatDelta(d: number): string {
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d}`;
}

export function MetricCard({ title, value, delta7d, delta30d, href }: MetricCardProps) {
  const delta = delta7d != null ? delta7d : delta30d ?? null;
  const deltaPeriod = delta7d != null ? "this week" : delta30d != null ? "this month" : null;
  const tooltip = delta7d != null ? "Compared to last 7 days" : delta30d != null ? "Compared to last 30 days" : undefined;
  return (
    <Link href={href} className="block focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl">
      <Card className="rounded-xl border border-[var(--border)]/60 shadow-sm bg-[var(--panel)] hover:bg-[var(--muted)]/30 transition-colors h-full">
        <CardContent className="p-4">
          <p className="text-sm text-[var(--text-soft)]">{title}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text)]">{value.toLocaleString()}</span>
            <span
              title={tooltip}
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                delta == null
                  ? "bg-[var(--muted)] text-[var(--text-soft)]"
                  : delta >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {delta != null ? formatDelta(delta) : "—"}
            </span>
          </div>
          {delta != null && deltaPeriod && (
            <p className="mt-0.5 text-xs text-[var(--text-soft)]">
              {formatDelta(delta)} {deltaPeriod}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
