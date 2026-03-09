"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { widgetTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

const cardLabelClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-text)]";

export type InventoryQuickActionsCardProps = {
  canWrite?: boolean;
  className?: string;
};

export function InventoryQuickActionsCard({ canWrite = false, className }: InventoryQuickActionsCardProps) {
  return (
    <section className={cn(widgetTokens.widgetCompactKpi, "relative overflow-hidden h-full", className)}>
      <p className={cn(cardLabelClass, "mb-3")}>Quick Actions</p>
      <div className="space-y-2.5">
        {canWrite && (
          <Link href="/inventory/new" className="block">
            <Button
              className="w-full justify-center focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              variant="primary"
            >
              + Add Vehicle
            </Button>
          </Link>
        )}
        <Link href="/crm/opportunities" className="block">
          <Button
            variant="secondary"
            className="w-full justify-center border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            + Add Lead
          </Button>
        </Link>
        <Link href="/deals/new" className="block">
          <Button
            variant="secondary"
            className="w-full justify-center border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Start Deal
          </Button>
        </Link>
      </div>
    </section>
  );
}
