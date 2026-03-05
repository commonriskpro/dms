"use client";

import Link from "next/link";
import { DMSCard, DMSCardContent } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CARD_ACCENT = "var(--accent-inventory)";

export type InventorySummaryCardsProps = {
  total: number;
  inRecon: number;
  salePending: number;
  inventoryValueLabel?: string;
  canWrite?: boolean;
  className?: string;
};

function SummaryCard({
  title,
  value,
  href,
  accentColor,
  className,
}: {
  title: string;
  value: number | string;
  href: string;
  accentColor?: string;
  className?: string;
}) {
  const pct = typeof value === "number" ? Math.min(100, Math.max(0, (value / 200) * 100)) || 0 : 0;
  return (
    <Link
      href={href}
      className={cn("block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]", className)}
    >
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
        <DMSCardContent className="pb-4 pt-1">
          <div className="text-sm font-semibold text-[var(--text)] text-left">{title}</div>
          <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          <div className="mt-2 h-[6px] w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: accentColor ?? CARD_ACCENT }}
              aria-hidden
            />
          </div>
        </DMSCardContent>
      </DMSCard>
    </Link>
  );
}

export function InventorySummaryCards({
  total,
  inRecon,
  salePending,
  inventoryValueLabel = "—",
  canWrite = false,
  className,
}: InventorySummaryCardsProps) {
  return (
    <div
      className={cn("grid gap-[var(--space-grid)] md:grid-cols-2 lg:grid-cols-4 items-stretch", className)}
      role="region"
      aria-label="Inventory summary"
    >
      <SummaryCard title="Total" value={total} href="/inventory" accentColor={CARD_ACCENT} />
      <SummaryCard title="In Recon" value={inRecon} href="/inventory?status=REPAIR" accentColor={CARD_ACCENT} />
      <SummaryCard title="Sale Pending" value={salePending} href="/inventory?status=HOLD" accentColor={CARD_ACCENT} />
      <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)] flex flex-col">
        <DMSCardContent className="pb-4 pt-1 flex flex-col flex-1">
          <div className="text-sm font-semibold text-[var(--text)] text-left">Inventory Value</div>
          <div className="mt-2 text-[28px] font-bold leading-[1] text-[var(--text)]">{inventoryValueLabel}</div>
          <div className="mt-auto pt-3">
            {canWrite && (
              <Link href="/inventory/new">
                <Button className="w-full focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                  + Add Vehicle
                </Button>
              </Link>
            )}
          </div>
        </DMSCardContent>
      </DMSCard>
    </div>
  );
}
