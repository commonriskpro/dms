import { widgetRowSurface } from "@/lib/ui/tokens";
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
    info: "border-l-[var(--accent)]",
    success: "border-l-[var(--success)]",
    warning: "border-l-[var(--warning)]",
    danger: "border-l-[var(--danger)]",
  };
  return (
    <WidgetCard title="Finance Notices">
      <ul className="space-y-2">
        {financeNotices.map((notice) => (
          <li
            key={notice.id}
            className={`${widgetRowSurface} border-l-4 flex flex-col justify-center ${severityClass[notice.severity] ?? "border-l-[var(--border)]"}`}
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
