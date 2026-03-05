import Link from "next/link";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import { Car, Megaphone, Handshake, Building } from "@/lib/ui/icons";

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
  if (title === "Inventory") return <Car size={16} className={className} aria-hidden />;
  if (title === "Leads") return <Megaphone size={16} className={className} aria-hidden />;
  if (title === "Deals") return <Handshake size={16} className={className} aria-hidden />;
  if (title === "BHPH") return <Building size={16} className={className} aria-hidden />;
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
  // Progress bar logic (hidden; restore when target/100% is defined):
  // const progressPct = Math.min(100, Math.max(0, (value / 200) * 100)) || 55;
  // const progressColor = ACCENT_COLOR[title] ?? "var(--accent)";
  // <div className="mt-3 h-[6px] w-full rounded-full bg-black/5 overflow-hidden">
  //   <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: progressColor }} aria-hidden />
  // </div>

  return (
    <Link
      href={href}
      className={`block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${className}`.trim()}
    >
      <DMSCard className="shadow-[var(--shadow-card-stack)] transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="pb-4 pt-1">
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
        </DMSCardContent>
      </DMSCard>
    </Link>
  );
}
