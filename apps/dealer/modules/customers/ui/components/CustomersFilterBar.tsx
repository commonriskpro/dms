"use client";

import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CustomersFilterBarProps = {
  sourceOptions: SelectOption[];
  statusOptions: SelectOption[];
  sourceValue: string;
  statusValue: string;
  onSourceChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onAdvancedFilters?: () => void;
  className?: string;
};

export function CustomersFilterBar({
  sourceOptions,
  statusOptions,
  sourceValue,
  statusValue,
  onSourceChange,
  onStatusChange,
  onAdvancedFilters,
  className,
}: CustomersFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)] transition-shadow duration-150",
        className
      )}
      role="region"
      aria-label="Filters"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-2)]/80 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          onClick={onAdvancedFilters}
        >
          Advanced Filters
        </Button>
        <Select
          label="Source"
          options={sourceOptions}
          value={sourceValue}
          onChange={onSourceChange}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={statusValue}
          onChange={onStatusChange}
        />
      </div>
    </div>
  );
}
