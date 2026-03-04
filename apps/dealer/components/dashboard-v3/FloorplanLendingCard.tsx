import { WidgetCard } from "./WidgetCard";
import type { DashboardV3FloorplanLine } from "./types";

export function FloorplanLendingCard({ floorplan }: { floorplan: DashboardV3FloorplanLine[] }) {
  if (floorplan.length === 0) {
    return (
      <WidgetCard title="Floorplan & Lending">
        <p className="text-sm text-[var(--text-soft)]">No floor plan data.</p>
      </WidgetCard>
    );
  }
  return (
    <WidgetCard title="Floorplan & Lending">
      <ul className="space-y-2">
        {floorplan.map((line) => (
          <li
            key={line.name}
            className="flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm"
          >
            <span className="text-[var(--text)]">{line.name}</span>
            <span className="text-[var(--text-soft)] text-xs">{line.statusLabel}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
