import { WidgetCard } from "./WidgetCard";
import type { DashboardV3DealPipeline } from "./types";

export function DealPipelineCard({ dealPipeline }: { dealPipeline: DashboardV3DealPipeline }) {
  const items = [
    { label: "Pending deals", count: dealPipeline.pendingDeals },
    { label: "Submitted", count: dealPipeline.submittedDeals },
    { label: "Contracts to review", count: dealPipeline.contractsToReview },
    { label: "Funding issues", count: dealPipeline.fundingIssues },
  ];
  return (
    <WidgetCard title="Deal Pipeline">
      <ul className="space-y-2">
        {items.map(({ label, count }) => (
          <li
            key={label}
            className="flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm"
          >
            <span className="text-[var(--text)]">{label}</span>
            <span className="font-semibold text-[var(--accent)]">{count}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
