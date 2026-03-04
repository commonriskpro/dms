import { WidgetCard } from "./WidgetCard";
import type { DashboardV3InventoryAlerts } from "./types";

export function InventoryAlertsCard({ inventoryAlerts }: { inventoryAlerts: DashboardV3InventoryAlerts }) {
  const items = [
    { label: "Cars in recon", count: inventoryAlerts.carsInRecon },
    { label: "Pending tasks", count: inventoryAlerts.pendingTasks },
    { label: "Not posted online", count: inventoryAlerts.notPostedOnline },
    { label: "Missing docs", count: inventoryAlerts.missingDocs },
    { label: "Low stock", count: inventoryAlerts.lowStock },
  ];
  return (
    <WidgetCard title="Inventory Alerts">
      <ul className="space-y-2">
        {items.map(({ label, count }) => (
          <li
            key={label}
            className="flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm"
          >
            <span className="text-[var(--text)]">{label}</span>
            <span className="font-semibold text-[var(--text)]">{count}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
