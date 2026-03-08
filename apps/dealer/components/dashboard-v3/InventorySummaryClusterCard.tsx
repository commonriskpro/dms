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
    <WidgetCard
      title="Inventory"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href ?? "/inventory"}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:bg-[var(--surface)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-[var(--text)]">{item.label}</p>
              <StatusBadge variant={toVariant(item.severity)} className="h-5 px-2 text-[10px] uppercase tracking-wide">
                {item.severity ?? "neutral"}
              </StatusBadge>
            </div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--text)]">
              {item.count.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-text)]">open signals</p>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}
