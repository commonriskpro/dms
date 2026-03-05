import Link from "next/link";
<<<<<<< HEAD
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
=======
import { Card, CardContent } from "@/components/ui/card";
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083

export type MetricCardProps = {
  title: string;
  value: number;
  delta7d?: number | null;
  delta30d?: number | null;
  href: string;
  className?: string;
};

const ACCENT_COLOR: Record<string, string> = {
  Inventory: "var(--accent-inventory)",
  Leads: "var(--accent-leads)",
  Deals: "var(--accent-deals)",
  BHPH: "var(--accent-bhph)",
};

function MetricIcon({ title }: { title: string }) {
  const className = "w-4 h-4 opacity-70 shrink-0";
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

export function MetricCard({ title, value, delta7d, delta30d, href, className = "" }: MetricCardProps) {
  const delta = delta7d != null ? delta7d : delta30d ?? null;
  const deltaLabel = delta != null ? `${formatDelta(delta)} listed` : null;
  const leftHelperText =
    delta7d != null ? `${formatDelta(delta7d)} 7d` : delta30d != null ? `${formatDelta(delta30d)} 30d` : "No recent change";
  const rightHelperText = delta7d != null && delta30d != null ? `${formatDelta(delta30d)} 30d` : null;
  const progressPct = Math.min(100, Math.max(0, (value / 200) * 100)) || 55;
  const progressColor = ACCENT_COLOR[title] ?? "var(--accent)";

  return (
    <Link
      href={href}
      className={`block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${className}`.trim()}
    >
<<<<<<< HEAD
      <DMSCard className="shadow-[var(--shadow-card-stack)] transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="pb-4 pt-1">
=======
      <Card className="rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] transition-shadow duration-150 hover:shadow-[0_6px_18px_rgba(16,24,40,0.10)]">
        <CardContent className="px-4 pb-4 pt-5">
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
          {/* top header */}
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-black/5 border border-black/5 shrink-0">
              <MetricIcon title={title} />
            </div>
          </div>

          {/* value + delta */}
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-[40px] font-bold leading-[1] text-[var(--text)]">{value.toLocaleString()}</div>
            {deltaLabel ? (
              <div className="text-sm text-[var(--muted-text)] whitespace-nowrap">
                {deltaLabel}
              </div>
            ) : null}
<<<<<<< HEAD
          </div>

          {/* helper row */}
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted-text)]">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex" aria-hidden>
                <svg className="h-3.5 w-3.5 text-[var(--muted-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span>{leftHelperText}</span>
            </div>
            {rightHelperText ? (
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex" aria-hidden>
                  <svg className="h-3.5 w-3.5 text-[var(--muted-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l10-10m0 0H9m8 0v8" />
                  </svg>
                </span>
                <span>{rightHelperText}</span>
              </div>
            ) : null}
          </div>

          {/* progress */}
          <div className="mt-3 h-[6px] w-full rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: progressColor }}
              aria-hidden
            />
          </div>
        </DMSCardContent>
      </DMSCard>
=======
          </div>

          {/* helper row */}
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted-text)]">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex" aria-hidden>
                <svg className="h-3.5 w-3.5 text-[var(--muted-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span>{leftHelperText}</span>
            </div>
            {rightHelperText ? (
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex" aria-hidden>
                  <svg className="h-3.5 w-3.5 text-[var(--muted-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l10-10m0 0H9m8 0v8" />
                  </svg>
                </span>
                <span>{rightHelperText}</span>
              </div>
            ) : null}
          </div>

          {/* progress */}
          <div className="mt-3 h-[6px] w-full rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: progressColor }}
              aria-hidden
            />
          </div>
        </CardContent>
      </Card>
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
    </Link>
  );
}
