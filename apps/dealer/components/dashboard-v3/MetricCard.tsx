import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  href: string;
};

const ACCENT_BAR: Record<string, string> = {
  Inventory: "bg-blue-500",
  Leads: "bg-emerald-500",
  Deals: "bg-violet-500",
  BHPH: "bg-amber-500",
};

function MetricIcon({ title }: { title: string }) {
  const className = "h-5 w-5 text-[var(--text-soft)] shrink-0";
  if (title === "Inventory") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
  }
  if (title === "Leads") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (title === "Deals") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (title === "BHPH") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  }
  return null;
}

function formatDelta(d: number): string {
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d}`;
}

export function MetricCard({ title, value, delta7d, delta30d, href }: MetricCardProps) {
  const delta = delta7d != null ? delta7d : delta30d ?? null;
  const deltaPeriod = delta7d != null ? "this week" : delta30d != null ? "this month" : null;
  const tooltip = delta7d != null ? "Compared to last 7 days" : delta30d != null ? "Compared to last 30 days" : undefined;
  const barClass = ACCENT_BAR[title] ?? "bg-slate-400";
  return (
    <Link href={href} className="block focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl">
      <Card className="rounded-xl border border-[var(--border)]/40 bg-[var(--panel)] shadow-sm hover:shadow-md transition-shadow h-full overflow-hidden">
        <CardContent className="p-3 flex flex-col gap-0">
          <div className="flex items-center gap-2">
            <MetricIcon title={title} />
            <p className="text-sm font-medium text-[var(--text-soft)]">{title}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text)]">{value.toLocaleString()}</span>
            <span
              title={tooltip}
              className={`text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0 ${
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
          <div className={`mt-2 h-1 rounded-full ${barClass}`} aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
