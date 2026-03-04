import { WidgetCard } from "./WidgetCard";
import type { DashboardV3FloorplanLine } from "./types";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function FloorplanLendingCard({ floorplan }: { floorplan: DashboardV3FloorplanLine[] }) {
  if (floorplan.length === 0) {
    return (
      <WidgetCard title="Floorplan & Lending">
        <p className="text-sm text-[var(--text-soft)]">No floor plan data</p>
      </WidgetCard>
    );
  }
  return (
    <WidgetCard title="Floorplan & Lending">
      <ul className="space-y-2">
        {floorplan.map((line) => (
          <li
            key={line.name}
            className="flex items-center justify-between rounded-md border border-[var(--border)]/40 bg-[var(--muted)]/30 px-2.5 py-1.5 text-sm min-h-[2.25rem]"
          >
            <span className="text-[var(--text)] font-medium">{line.name}</span>
            <span className="text-[var(--text-soft)] text-sm tabular-nums">
              {formatCents(line.utilizedCents)} / {formatCents(line.limitCents)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
