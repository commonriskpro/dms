"use client";

import { WidgetCard } from "./WidgetCard";
import { WidgetRowLink } from "./WidgetRowLink";
import type { WidgetRow } from "./types";

const SEVERITY_BORDER: Record<string, string> = {
  info: "border-l-blue-500",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  danger: "border-l-red-500",
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

export function InventoryAlertsCard({ rows }: { rows: WidgetRow[] }) {
  return (
    <WidgetCard title="Inventory Alerts">
      <ul className="space-y-2">
        {rows.map((row) => {
          const href = getHref(row);
          const borderClass = row.severity ? SEVERITY_BORDER[row.severity] : "border-l-slate-400";
          return (
            <li key={row.key} className={`border-l-4 ${borderClass}`}>
              {href ? (
                <WidgetRowLink
                  href={href}
                  left={<span className="text-[var(--text)]">{row.label}</span>}
                  right={<span className="font-semibold text-[var(--text)]">{row.count}</span>}
                />
              ) : (
                <div className="flex items-center justify-between rounded-md border border-[var(--border)]/60 bg-[var(--muted)]/30 px-3 py-2 text-sm">
                  <span className="text-[var(--text)]">{row.label}</span>
                  <span className="font-semibold text-[var(--text)]">{row.count}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
