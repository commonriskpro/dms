import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";
import { StatusBadge } from "@/components/ui-system/tables";

function toVariant(
  severity?: "info" | "success" | "warning" | "danger"
): "info" | "success" | "warning" | "danger" | "neutral" {
  if (!severity) return "neutral";
  return severity;
}

export function InventorySummaryClusterCard({ rows }: { rows: WidgetRow[] }) {
  const items = rows.slice(0, 4);

  return (
    <WidgetCard title="Inventory">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href ?? "/inventory"}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-colors hover:bg-[var(--surface)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-[var(--text)]">{item.label}</p>
              <StatusBadge variant={toVariant(item.severity)}>
                {item.severity ?? "neutral"}
              </StatusBadge>
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--text)]">
              {item.count.toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}
