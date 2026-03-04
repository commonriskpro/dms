"use client";

import { WidgetCard } from "./WidgetCard";
import { WidgetRowLink } from "./WidgetRowLink";
import type { WidgetRow } from "./types";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
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

function RowLeft({ row }: { row: WidgetRow }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${row.severity ? SEVERITY_DOT[row.severity] : "bg-slate-500"}`}
        aria-hidden
      />
      <span className="text-[var(--text)]">{row.label}</span>
    </span>
  );
}

function RowRight({ row }: { row: WidgetRow }) {
  return <span className="font-semibold text-[var(--accent)]">{row.count}</span>;
}

export function CustomerTasksCard({ rows }: { rows: WidgetRow[] }) {
  return (
    <WidgetCard title="Customer Tasks">
      <ul className="space-y-2">
        {rows.map((row) => {
          const href = getHref(row);
          return (
            <li key={row.key}>
              {href ? (
                <WidgetRowLink href={href} left={<RowLeft row={row} />} right={<RowRight row={row} />} />
              ) : (
                <div className="flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm">
                  <RowLeft row={row} />
                  <RowRight row={row} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
