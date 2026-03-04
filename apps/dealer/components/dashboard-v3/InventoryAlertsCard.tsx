"use client";

import { sevBadgeClasses, widgetRowSurface } from "@/lib/ui/tokens";
import { WidgetCard } from "./WidgetCard";
import { WidgetRowLink } from "./WidgetRowLink";
import type { WidgetRow } from "./types";

const SEVERITY_BADGE: Record<string, string> = {
  info: sevBadgeClasses.info,
  success: sevBadgeClasses.success,
  warning: sevBadgeClasses.warning,
  danger: sevBadgeClasses.danger,
};

const ROW_HREF: Record<string, string> = {
  carsInRecon: "/inventory",
  pendingTasks: "/inventory",
  notPostedOnline: "/inventory",
  missingDocs: "/inventory",
  lowStock: "/inventory",
};

function getHref(row: WidgetRow): string | undefined {
  return row.href ?? ROW_HREF[row.key];
}

function RowBadge({ row }: { row: WidgetRow }) {
  const cls = row.severity ? SEVERITY_BADGE[row.severity] : sevBadgeClasses.warning;
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold tabular-nums text-white ${cls}`}>
      {row.count}
    </span>
  );
}

export function InventoryAlertsCard({ rows }: { rows: WidgetRow[] }) {
  return (
    <WidgetCard title="Inventory Alerts">
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const href = getHref(row);
          const left = (
            <>
              <RowBadge row={row} />
              <span className="text-[var(--text)] truncate">{row.label}</span>
            </>
          );
          const right = (
            <div className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
              <span>{row.count}</span>
              <span>•</span>
              <span>{row.count} Total</span>
            </div>
          );
          return (
            <li key={row.key}>
              {href ? (
                <WidgetRowLink href={href} left={left} right={right} />
              ) : (
                <div className={`flex items-center justify-between gap-2 ${widgetRowSurface}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <RowBadge row={row} />
                    <span className="text-sm font-medium text-[var(--text)] truncate">{row.label}</span>
                  </div>
                  {right}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
