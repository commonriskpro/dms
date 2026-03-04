"use client";

import Link from "next/link";
import { WidgetCard } from "./WidgetCard";

export type QuickActionsCardProps = {
  canAddVehicle: boolean;
  canAddLead: boolean;
  canStartDeal: boolean;
};

const ACTION_STYLE: Record<string, string> = {
  "Add Vehicle": "bg-[var(--accent-deals)] text-white hover:opacity-90",
  "Add Lead": "bg-[var(--accent-leads)] text-white hover:opacity-90",
  "Start Deal": "bg-[var(--accent-inventory)] text-white hover:opacity-90",
};

function ActionIcon({ label }: { label: string }) {
  const className = "h-4 w-4 shrink-0";
  if (label === "Add Vehicle") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    );
  }
  if (label === "Add Lead") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    );
  }
  if (label === "Start Deal") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return null;
}

export function QuickActionsCard({ canAddVehicle, canAddLead, canStartDeal }: QuickActionsCardProps) {
  const actions = [
    { label: "Add Vehicle", href: "/inventory/new", show: canAddVehicle },
    { label: "Add Lead", href: "/customers/new", show: canAddLead },
    { label: "Start Deal", href: "/deals/new", show: canStartDeal },
  ].filter((a) => a.show);

  if (actions.length === 0) {
    return (
      <WidgetCard title="Quick Actions">
        <p className="text-sm text-[var(--text-soft)]">No actions available.</p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-3">
          {actions.slice(0, 2).map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-sm font-medium transition-colors ${ACTION_STYLE[label] ?? "bg-[var(--surface-2)] text-[var(--text)] hover:opacity-80"}`}
            >
              <ActionIcon label={label} />
              {label}
            </Link>
          ))}
          {actions.length > 2 && (
            <Link
              href={actions[2].href}
              className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent-inventory)] text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              <ActionIcon label={actions[2].label} />
              {actions[2].label}
            </Link>
          )}
      </div>
    </WidgetCard>
  );
}
