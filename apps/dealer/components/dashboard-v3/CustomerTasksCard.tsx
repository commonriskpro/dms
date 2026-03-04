"use client";

import { severityBadgeClasses, neutralBadge, widgetRowSurface } from "@/lib/ui/tokens";
import { WidgetCard } from "./WidgetCard";
import { WidgetRowLink } from "./WidgetRowLink";
import type { WidgetRow } from "./types";

const SEVERITY_BADGE: Record<string, string> = {
  info: severityBadgeClasses.info,
  success: severityBadgeClasses.success,
  warning: severityBadgeClasses.warning,
  danger: severityBadgeClasses.danger,
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
  const cls = row.severity ? SEVERITY_BADGE[row.severity] : neutralBadge;
  return (
    <span className={`inline-flex items-center justify-center min-w-[1.75rem] rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {row.count}
    </span>
  );
}

function RowLeft({ row }: { row: WidgetRow }) {
  return (
    <>
      <RowBadge row={row} />
      <span className="text-[var(--text)] truncate">{row.label}</span>
    </>
  );
}

function RowRight({ row }: { row: WidgetRow }) {
  return <>{row.count} Total</>;
}

export function CustomerTasksCard({ rows }: { rows: WidgetRow[] }) {
  return (
    <WidgetCard title="Customer Tasks">
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const href = getHref(row);
          return (
            <li key={row.key}>
              {href ? (
                <WidgetRowLink href={href} left={<RowLeft row={row} />} right={<RowRight row={row} />} />
              ) : (
                <div className={`flex items-center justify-between gap-2 ${widgetRowSurface}`}>
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
