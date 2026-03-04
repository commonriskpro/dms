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
  appointments: "/customers",
  newProspects: "/crm/opportunities",
  inbox: "/customers",
  followUps: "/customers",
  creditApps: "/lenders",
};

function getHref(row: WidgetRow): string | undefined {
  return row.href ?? ROW_HREF[row.key];
}

function RowBadge({ row }: { row: WidgetRow }) {
  const cls = row.severity ? SEVERITY_BADGE[row.severity] : sevBadgeClasses.info;
  return (
    <span className={`h-7 min-w-[36px] px-2 rounded-[8px] flex items-center justify-center text-sm font-semibold text-white ${cls}`}>
      {row.count}
    </span>
  );
}

function RowLeft({ row }: { row: WidgetRow }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <RowBadge row={row} />
      <span className="text-sm font-medium text-[var(--text)] truncate">{row.label}</span>
    </div>
  );
}

function RowRight({ row }: { row: WidgetRow }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
      <span>{row.count}</span>
      <span>•</span>
      <span>{row.count} Total</span>
    </div>
  );
}

export function CustomerTasksCard({ rows }: { rows: WidgetRow[] }) {
  return (
    <WidgetCard title="Customer Tasks">
      <ul className="space-y-0.5">
        {rows.map((row) => {
          const href = getHref(row);
          return (
            <li key={row.key}>
              {href ? (
                <WidgetRowLink variant="compact" href={href} left={<RowLeft row={row} />} right={<RowRight row={row} />} />
              ) : (
                <div className="flex items-center justify-between gap-3 py-2 px-0">
                  <RowLeft row={row} />
                  <span className="text-[var(--text-soft)] shrink-0"><RowRight row={row} /></span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
