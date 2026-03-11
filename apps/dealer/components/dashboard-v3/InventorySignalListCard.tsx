/**
 * InventorySignalListCard — compact signal-row alternative to InventorySummaryClusterCard.
 * To revert: swap back to <InventorySummaryClusterCard> in DashboardExecutiveClient.tsx (one line).
 */
import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";

const DOT: Record<string, string> = {
  danger:  "bg-[var(--danger)]",
  warning: "bg-[var(--warning)]",
  success: "bg-[var(--success)]",
  info:    "bg-[var(--accent)]",
};

function severityDot(severity?: string) {
  return DOT[severity ?? ""] ?? "bg-[var(--border)]";
}

function countColor(count: number, severity?: string) {
  if (count === 0) return "text-[var(--muted-text)]";
  if (severity === "danger")  return "text-[var(--danger)]";
  if (severity === "warning") return "text-[var(--warning)]";
  return "text-[var(--text)]";
}

export function InventorySignalListCard({ rows }: { rows: WidgetRow[] }) {
  const allClear = rows.every((r) => r.count === 0);

  return (
    <WidgetCard title="Inventory">
      {allClear ? (
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-2 text-sm">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
        <span className="text-sm text-[var(--muted-text)]">All clear — no open signals</span>
      </div>
      ) : null}

      <div className="mt-0">
        {rows.map((item) => (
          <Link
            key={item.key}
            href={item.href ?? "/inventory"}
            className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/50"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`h-2 w-2 shrink-0 rounded-full ${severityDot(item.severity)}`} />
              <span className="truncate text-sm text-[var(--text)]">{item.label}</span>
            </div>
            <span className={`shrink-0 tabular-nums text-sm font-semibold ${countColor(item.count, item.severity)}`}>
              {item.count.toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}
