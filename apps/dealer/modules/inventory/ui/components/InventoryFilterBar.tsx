"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type InventoryFilterBarProps = {
  floorPlannedCount?: number;
  onAdvancedFilters?: () => void;
  onSaveSearch?: () => void;
  className?: string;
};

export function InventoryFilterBar({
  floorPlannedCount = 0,
  onAdvancedFilters,
  onSaveSearch,
  className,
}: InventoryFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]",
        className
      )}
      role="region"
      aria-label="Filters and actions"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-2)]/80 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          onClick={onAdvancedFilters}
        >
          Advanced Filters
        </Button>
        <span className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text)]">
          {floorPlannedCount} floor planned
        </span>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              Save Search
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSaveSearch}>Save current search</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
