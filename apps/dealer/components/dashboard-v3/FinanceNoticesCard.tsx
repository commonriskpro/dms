import { WidgetCard } from "./WidgetCard";
import type { DashboardV3FinanceNotice } from "./types";

export function FinanceNoticesCard({ financeNotices }: { financeNotices: DashboardV3FinanceNotice[] }) {
  if (financeNotices.length === 0) {
    return (
      <WidgetCard title="Finance Notices">
        <p className="text-sm text-[var(--text-soft)]">No notices.</p>
      </WidgetCard>
    );
  }
  const severityClass: Record<string, string> = {
    info: "border-l-blue-500",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
  };
  return (
    <WidgetCard title="Finance Notices">
      <ul className="space-y-2">
        {financeNotices.map((notice) => (
          <li
            key={notice.id}
            className={`rounded-md border border-[var(--border)]/60 border-l-4 bg-[var(--muted)]/30 px-3 py-2 text-sm ${severityClass[notice.severity] ?? "border-l-slate-400"}`}
          >
            <p className="font-medium text-[var(--text)]">{notice.title}</p>
            {notice.subtitle != null && (
              <p className="text-xs text-[var(--text-soft)]">{notice.subtitle}</p>
            )}
            {notice.dateLabel != null && (
              <p className="text-xs text-[var(--text-soft)] mt-1">{notice.dateLabel}</p>
            )}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
