"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import { DealBoardCard } from "./DealBoardCard";
import type { BoardColumn } from "@/modules/deals/service/board";
import { Maximize2, Plus } from "lucide-react";

export type DealBoardColumnProps = {
  column: BoardColumn;
  className?: string;
};

export function DealBoardColumn({ column, className }: DealBoardColumnProps) {
  return (
    <section
      className={cn(
        "flex min-w-[300px] flex-col rounded-xl border border-[var(--border)] bg-[var(--panel)]",
        className
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">{column.label}</h3>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--text)]">
            {column.count}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--muted-text)]">
          {column.id === "funding" && (
            <button className="rounded p-0.5 hover:bg-[var(--surface-2)] hover:text-[var(--text)]" aria-label="Add">
              <Plus className="h-4 w-4" />
            </button>
          )}
          <span className="text-xs font-semibold tabular-nums text-[var(--text)]">
            {column.count}
          </span>
          <button className="rounded p-0.5 hover:bg-[var(--surface-2)] hover:text-[var(--text)]" aria-label="Expand column">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Column total */}
      <div className="px-3.5 py-2 border-b border-[var(--border)]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[var(--muted-text)]">
            <span className="text-xs font-medium">Total</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-[var(--text)]">
            {formatCents(column.totalCents)}
          </span>
        </div>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2.5" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {column.deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-[var(--text-soft)]">No deals in this queue.</p>
          </div>
        ) : (
          column.deals.map((deal) => (
            <DealBoardCard key={deal.id} card={deal} columnId={column.id} />
          ))
        )}
      </div>

      {/* Column footer */}
      <div className="border-t border-[var(--border)] px-3.5 py-2">
        <p className="text-[10px] text-[var(--text-soft)]">
          {column.label}: {column.deals.length > 0 ? `${column.count} deal${column.count !== 1 ? "s" : ""}` : "empty"}
        </p>
      </div>
    </section>
  );
}
