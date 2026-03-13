"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { SaveSearchDialog } from "./SaveSearchDialog";
import { Search, X, ChevronDown } from "@/lib/ui/icons";
import type { SavedFilterCatalogItem, SavedSearchCatalogItem } from "@/lib/types/saved-filters-searches";

const SEARCH_PLACEHOLDER = "Search by name, email, or phone";
const DEBOUNCE_MS = 400;

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "LEAD", label: "Lead" },
  { value: "ACTIVE", label: "Active" },
  { value: "SOLD", label: "Sold" },
  { value: "INACTIVE", label: "Inactive" },
];

const DRAFT_OPTIONS = [
  { value: "all", label: "All Records" },
  { value: "final", label: "Final Only" },
  { value: "draft", label: "Drafts Only" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All Sources" },
  { value: "Website", label: "Website" },
  { value: "Walk-In", label: "Walk-In" },
  { value: "Referral", label: "Referral" },
  { value: "BDC", label: "BDC" },
  { value: "Autotrader", label: "Autotrader" },
];

export type CustomersFilterSearchBarSearchParams = {
  status?: string;
  draft?: "all" | "draft" | "final";
  leadSource?: string;
  assignedTo?: string;
  q?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
  savedSearchId?: string;
};

export type CustomersFilterSearchBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (updates: Partial<CustomersFilterSearchBarSearchParams & { savedSearchId?: string }>) => void;
  searchParams: CustomersFilterSearchBarSearchParams;
  savedFilters: SavedFilterCatalogItem[];
  savedSearches: SavedSearchCatalogItem[];
  onApplySavedFilter: (definition: SavedFilterCatalogItem["definitionJson"]) => void;
  onApplySavedSearch: (state: SavedSearchCatalogItem["stateJson"], searchId: string) => void;
  onSavedFilterOrSearchChange: () => void;
  canWrite?: boolean;
  className?: string;
};

export function CustomersFilterSearchBar({
  searchValue,
  onSearchChange,
  onFilterChange,
  searchParams,
  savedFilters,
  savedSearches,
  onApplySavedFilter,
  onApplySavedSearch,
  onSavedFilterOrSearchChange,
  canWrite,
  className,
}: CustomersFilterSearchBarProps) {
  const [localSearch, setLocalSearch] = React.useState(searchValue);
  const [saveSearchOpen, setSaveSearchOpen] = React.useState(false);
  const [saveSearchMode, setSaveSearchMode] = React.useState<"new" | "update">("new");
  const [manageSearchesOpen, setManageSearchesOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onSearchChangeRef = React.useRef(onSearchChange);
  React.useEffect(() => { onSearchChangeRef.current = onSearchChange; }, [onSearchChange]);

  React.useEffect(() => { setLocalSearch(searchValue); }, [searchValue]);

  React.useEffect(() => {
    const trimmed = localSearch.trim();
    const t = setTimeout(() => onSearchChangeRef.current(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [localSearch]);

  const hasActiveFilters = searchParams.status || searchParams.leadSource || searchParams.assignedTo || searchParams.q || (searchParams.draft && searchParams.draft !== "all");

  const currentState: SavedSearchCatalogItem["stateJson"] = {
    q: searchParams.q,
    status: searchParams.status,
    draft: searchParams.draft,
    leadSource: searchParams.leadSource,
    assignedTo: searchParams.assignedTo,
    sortBy: searchParams.sortBy ?? "created_at",
    sortOrder: (searchParams.sortOrder as "asc" | "desc") ?? "desc",
    limit: searchParams.limit ?? 25,
    offset: searchParams.offset ?? 0,
  };

  const currentSavedSearch = searchParams.savedSearchId
    ? savedSearches.find((s) => s.id === searchParams.savedSearchId)
    : null;

  const activeStatusLabel = STATUS_OPTIONS.find((o) => o.value === (searchParams.status ?? ""))?.label ?? "All Statuses";
  const activeDraftLabel = DRAFT_OPTIONS.find((o) => o.value === (searchParams.draft ?? "all"))?.label ?? "All Records";
  const activeSourceLabel = SOURCE_OPTIONS.find((o) => o.value === (searchParams.leadSource ?? ""))?.label ?? "All Sources";

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-card)]",
          className
        )}
        role="region"
        aria-label="Filters and search"
      >
        <span className="text-sm font-semibold text-[var(--text)] shrink-0">Customers</span>

        {/* Search input */}
        <div className="flex min-w-[180px] w-64 items-center gap-2 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <Search size={14} className="shrink-0 text-[var(--text-soft)]" />
          <Input
            ref={inputRef}
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="flex-1 min-w-0 border-0 bg-transparent rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-8 text-sm px-0"
            aria-label="Search customers"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              onFilterChange({
                status: undefined,
                draft: "all",
                leadSource: undefined,
                assignedTo: undefined,
                q: undefined,
                savedSearchId: undefined,
                offset: 0,
              })
            }
            className="flex items-center gap-1 text-sm text-[var(--text-soft)] hover:text-[var(--text)] transition-colors shrink-0"
          >
            Clear filters
            <X size={12} />
          </button>
        )}

        {/* All Customers (saved filters) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] shrink-0"
            >
              All Customers
              <ChevronDown size={12} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            {savedFilters.length > 0 && (
              <>
                <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
                {savedFilters.map((f) => (
                  <DropdownMenuItem key={f.id} onClick={() => onApplySavedFilter(f.definitionJson)}>
                    <span className="truncate">{f.name}</span>
                    {f.visibility === "SHARED" && (
                      <span className="ml-1 text-xs text-[var(--text-soft)]">Shared</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            {savedSearches.length > 0 && (
              <>
                <DropdownMenuLabel>Saved searches</DropdownMenuLabel>
                {savedSearches.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => onApplySavedSearch(s.stateJson, s.id)}>
                    <span className="truncate">{s.name}</span>
                    {s.isDefault && <span className="ml-1 text-xs text-[var(--text-soft)]">Default</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setManageSearchesOpen(true)}>Manage…</DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => {
                setSaveSearchMode("new");
                setSaveSearchOpen(true);
              }}
            >
              Save current view…
            </DropdownMenuItem>
            {currentSavedSearch && (
              <DropdownMenuItem
                onClick={() => {
                  setSaveSearchMode("update");
                  setSaveSearchOpen(true);
                }}
              >
                Update &ldquo;{currentSavedSearch.name}&rdquo;…
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* All Sources */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] shrink-0"
            >
              {activeSourceLabel}
              <ChevronDown size={12} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px]">
            {SOURCE_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => onFilterChange({ leadSource: o.value || undefined })}
                className={cn(searchParams.leadSource === o.value && "font-semibold")}
              >
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] shrink-0"
            >
              {activeDraftLabel}
              <ChevronDown size={12} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px]">
            {DRAFT_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => onFilterChange({ draft: o.value as "all" | "draft" | "final" })}
                className={cn((searchParams.draft ?? "all") === o.value && "font-semibold")}
              >
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* All Statuses */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] shrink-0"
            >
              {activeStatusLabel}
              <ChevronDown size={12} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px]">
            {STATUS_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => onFilterChange({ status: o.value || undefined })}
                className={cn(searchParams.status === o.value && "font-semibold")}
              >
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Table indicator */}
        <span className="flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white shrink-0">
          Table
        </span>

        {/* New Customer */}
        {canWrite && (
          <Link href="/customers/new">
            <Button size="sm">New Customer</Button>
          </Link>
        )}
      </div>

      <SaveSearchDialog
        open={saveSearchOpen}
        onOpenChange={setSaveSearchOpen}
        state={currentState}
        existingSearchId={saveSearchMode === "update" && currentSavedSearch ? currentSavedSearch.id : null}
        initialName={saveSearchMode === "update" && currentSavedSearch ? currentSavedSearch.name : undefined}
        onSuccess={onSavedFilterOrSearchChange}
      />

      {manageSearchesOpen && (
        <ManageSearchesDialog
          open={manageSearchesOpen}
          onOpenChange={setManageSearchesOpen}
          savedSearches={savedSearches}
          currentSearchId={searchParams.savedSearchId}
          onDeleteSuccess={onSavedFilterOrSearchChange}
          onClearCurrent={() => onFilterChange({ savedSearchId: undefined })}
        />
      )}
    </>
  );
}

function ManageSearchesDialog({
  open,
  onOpenChange,
  savedSearches,
  currentSearchId,
  onDeleteSuccess,
  onClearCurrent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedSearches: SavedSearchCatalogItem[];
  currentSearchId?: string;
  onDeleteSuccess: () => void;
  onClearCurrent: () => void;
}) {
  const { addToast } = useToast();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch<unknown>(`/api/customers/saved-searches/${id}`, { method: "DELETE" });
      addToast("success", "Saved search deleted");
      if (id === currentSearchId) onClearCurrent();
      onOpenChange(false);
      onDeleteSuccess();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage saved searches</DialogTitle>
          <p className="text-sm text-[var(--text-soft)]">Delete saved list views you no longer need.</p>
        </DialogHeader>
        <div className="py-2 max-h-64 overflow-y-auto space-y-1">
          {savedSearches.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No saved searches.</p>
          ) : (
            savedSearches.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-3 py-2"
              >
                <span className="truncate text-sm">{s.name}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                >
                  {deletingId === s.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
