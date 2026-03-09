"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "STRUCTURED", label: "Structured" },
  { value: "APPROVED", label: "Approved" },
  { value: "CONTRACTED", label: "Contracted" },
];

const LENDER_OPTIONS: SelectOption[] = [
  { value: "", label: "All Lenders" },
];

const ASSIGNED_OPTIONS: SelectOption[] = [
  { value: "", label: "Assigned" },
];

export type DealBoardFilterBarProps = {
  totalDeals: number;
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  canWrite: boolean;
};

export function DealBoardFilterBar({
  totalDeals,
  search,
  onSearchChange,
  status,
  onStatusChange,
  canWrite,
}: DealBoardFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-card)]">
      {/* Total badge */}
      <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-[var(--surface-2)] px-2 text-xs font-semibold tabular-nums text-[var(--text)]">
        {totalDeals}
      </span>

      {/* Search */}
      <div className="relative w-48 min-w-[140px]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-text)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select
          value=""
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          aria-label="Assigned"
        >
          <option value="">Assigned</option>
        </select>

        <select
          value=""
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          aria-label="Lenders"
        >
          <option value="">All Lenders</option>
        </select>

        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          aria-label="Status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {/* New Deal */}
      {canWrite && (
        <Link href="/deals/new" className="shrink-0">
          <Button size="sm">
            <Plus size={14} className="mr-1.5" aria-hidden />
            New Deal
          </Button>
        </Link>
      )}
    </div>
  );
}
