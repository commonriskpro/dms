import { formatCents } from "@/lib/money";
import { widgetRowSurface } from "@/lib/ui/tokens";
import { WidgetCard } from "./WidgetCard";
import type { DashboardV3FloorplanLine } from "./types";

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
            className={`flex items-center justify-between ${widgetRowSurface}`}
          >
            <span className="text-[var(--text)] font-medium">{line.name}</span>
            <span className="text-[var(--text-soft)] text-sm tabular-nums">
              {formatCents(String(line.utilizedCents))} / {formatCents(String(line.limitCents))}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
