"use client";

import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import { PlusCircle, UserPlus, FilePlus } from "@/lib/ui/icons";

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
  if (label === "Add Vehicle") return <PlusCircle size={16} className={className} aria-hidden />;
  if (label === "Add Lead") return <UserPlus size={16} className={className} aria-hidden />;
  if (label === "Start Deal") return <FilePlus size={16} className={className} aria-hidden />;
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
