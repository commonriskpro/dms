"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterChip = { id: string; label: string; onRemove: () => void };

export type CompactPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export type CustomersFilterBarProps = {
  searchParams: {
    status?: string;
    leadSource?: string;
    search?: string;
  };
  onFilterChange: (updates: { status?: string; leadSource?: string; search?: string }) => void;
  compactPagination: CompactPaginationProps;
  totalEntries: number;
  limit: number;
  offset: number;
  className?: string;
};

function CompactPagination({ currentPage, totalPages, onPageChange }: CompactPaginationProps) {
  const pages: number[] = [];
  const show = 5;
  let start = Math.max(1, currentPage - Math.floor(show / 2));
  let end = Math.min(totalPages, start + show - 1);
  if (end - start + 1 < show) start = Math.max(1, end - show + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
        className="h-8 w-8 p-0 rounded-[var(--radius-button)]"
      >
        ‹
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === currentPage ? "primary" : "secondary"}
          size="sm"
          className={cn(
            "h-8 min-w-8 rounded-[var(--radius-button)]",
            p === currentPage && "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
          )}
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="secondary"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
        className="h-8 w-8 p-0 rounded-[var(--radius-button)]"
      >
        ›
      </Button>
    </div>
  );
}

export function CustomersFilterBar({
  searchParams,
  onFilterChange,
  compactPagination,
  totalEntries,
  limit,
  offset,
  className,
}: CustomersFilterBarProps) {
  const chips: FilterChip[] = React.useMemo(() => {
    const c: FilterChip[] = [];
    if (searchParams.status) {
      c.push({
        id: "status",
        label: searchParams.status,
        onRemove: () => onFilterChange({ status: undefined }),
      });
    }
    if (searchParams.leadSource) {
      c.push({
        id: "leadSource",
        label: searchParams.leadSource,
        onRemove: () => onFilterChange({ leadSource: undefined }),
      });
    }
    if (searchParams.search) {
      c.push({
        id: "search",
        label: `Search: ${searchParams.search}`,
        onRemove: () => onFilterChange({ search: undefined }),
      });
    }
    return c;
  }, [searchParams, onFilterChange]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]",
        className
      )}
      role="region"
      aria-label="Filters"
    >
      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              Advanced Filters ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <span className="px-2 py-1.5 text-sm text-[var(--text-soft)]">Status, source, search</span>
          </DropdownMenuContent>
        </DropdownMenu>
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-sm text-[var(--text)]"
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.onRemove}
              className="ml-1 rounded p-0.5 hover:bg-[var(--muted)] text-[var(--text-soft)]"
              aria-label={`Remove ${chip.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <Button variant="secondary" size="sm">
          + Create Filters
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              Save Search ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <span className="px-2 py-1.5 text-sm text-[var(--text-soft)]">Save current filters</span>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CompactPagination {...compactPagination} />
    </div>
  );
}
