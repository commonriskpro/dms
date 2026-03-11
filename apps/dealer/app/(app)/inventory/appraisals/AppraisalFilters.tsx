"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
const SOURCE_OPTIONS: SelectOption[] = [
  { value: "", label: "All sources" },
  { value: "TRADE_IN", label: "Trade-in" },
  { value: "AUCTION", label: "Auction" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "STREET", label: "Street" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PURCHASED", label: "Purchased" },
  { value: "CONVERTED", label: "Converted" },
];

export type AppraisalFiltersProps = {
  currentQuery: { search: string; sourceType: string; status: string };
  onFilterChange: (params: { search?: string; sourceType?: string; status?: string }) => void;
};

export function AppraisalFilters({ currentQuery, onFilterChange }: AppraisalFiltersProps) {
  const [search, setSearch] = React.useState(currentQuery.search);
  const [sourceType, setSourceType] = React.useState(currentQuery.sourceType);
  const [status, setStatus] = React.useState(currentQuery.status);

  React.useEffect(() => {
    setSearch(currentQuery.search);
    setSourceType(currentQuery.sourceType);
    setStatus(currentQuery.status);
  }, [currentQuery.search, currentQuery.sourceType, currentQuery.status]);

  const handleApply = () => {
    onFilterChange({ search: search.trim() || undefined, sourceType: sourceType || undefined, status: status || undefined });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-[220px] flex-1">
        <Label htmlFor="appraisal-search" className="text-[var(--muted-text)] text-xs">
            Search (VIN)
        </Label>
        <Input
          id="appraisal-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search VIN"
          className="mt-1 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
        />
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="appraisal-source" className="text-[var(--muted-text)] text-xs">
            Source
        </Label>
        <Select
          id="appraisal-source"
          value={sourceType}
          onChange={setSourceType}
          options={SOURCE_OPTIONS}
          className="mt-1"
        />
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="appraisal-status" className="text-[var(--muted-text)] text-xs">
            Status
        </Label>
        <Select
          id="appraisal-status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="mt-1"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={handleApply}
        className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--muted)]"
      >
        Apply
      </Button>
    </div>
  );
}
