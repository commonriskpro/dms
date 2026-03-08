import { AlertCard } from "@/components/ui-system/widgets";
import type { DashboardV3FinanceNotice } from "./types";
import { WidgetCard } from "./WidgetCard";

export function FinanceNoticesCard({ financeNotices }: { financeNotices: DashboardV3FinanceNotice[] }) {
  if (financeNotices.length === 0) {
    return (
      <WidgetCard title="Finance Notices">
        <p className="text-sm text-[var(--text-soft)]">Funding and title notifications appear here.</p>
      </WidgetCard>
    );
  }

  return (
    <div className="space-y-3">
      {financeNotices.map((notice) => (
        <AlertCard
          key={notice.id}
          title={notice.title}
          body={notice.subtitle ?? "Finance update"}
          severity={notice.severity}
          metadata={notice.dateLabel ?? undefined}
        />
      ))}
    </div>
  );
}
