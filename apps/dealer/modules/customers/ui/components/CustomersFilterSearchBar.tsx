"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_PLACEHOLDER = "Search by name, email, phone, VIN…";

export type CustomersFilterSearchBarProps = {
  searchValue: string;
  onSearchSubmit: (value: string) => void;
  onFilterChange: (updates: { status?: string; leadSource?: string; search?: string }) => void;
  searchParams: { status?: string; leadSource?: string; search?: string };
  className?: string;
};

export function CustomersFilterSearchBar({
  searchValue,
  onSearchSubmit,
  onFilterChange,
  searchParams,
  className,
}: CustomersFilterSearchBarProps) {
  const [localSearch, setLocalSearch] = React.useState(searchValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = localSearch.trim();
    onSearchSubmit(trimmed);
  };

  const chips = React.useMemo(() => {
    const c: { id: string; label: string; onRemove: () => void }[] = [];
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
        "flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]",
        className
      )}
      role="region"
      aria-label="Filters and search"
    >
      {/* Left: Advanced Filters */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" type="button">
              Advanced Filters ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <span className="px-2 py-1.5 text-sm text-[var(--text-soft)]">
              Status, source, search
            </span>
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
      </div>

      {/* Center: wide search input + attached blue search button */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 min-w-0 max-w-xl items-center rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ring)]"
      >
        <Input
          ref={inputRef}
          type="search"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          className="flex-1 min-w-0 border-0 bg-transparent rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
          aria-label="Search customers"
        />
        <Button
          type="submit"
          size="sm"
          className="h-9 rounded-none bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shrink-0 px-4 border-0"
          aria-label="Search"
        >
          Search
        </Button>
      </form>

      {/* Right: Create Filters + Save Search */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="secondary" size="sm" type="button">
          + Create Filters
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" type="button">
              Save Search ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <span className="px-2 py-1.5 text-sm text-[var(--text-soft)]">
              Save current filters
            </span>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
