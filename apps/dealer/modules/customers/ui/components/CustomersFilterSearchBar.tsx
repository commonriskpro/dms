"use client";

import * as React from "react";
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
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { SaveSearchDialog } from "./SaveSearchDialog";
import type { SavedFilterCatalogItem, SavedSearchCatalogItem } from "@/lib/types/saved-filters-searches";

const SEARCH_PLACEHOLDER = "Search by name, email, phone…";
const DEBOUNCE_MS = 400;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "LEAD", label: "Lead" },
  { value: "ACTIVE", label: "Active" },
  { value: "SOLD", label: "Sold" },
  { value: "INACTIVE", label: "Inactive" },
];

export type CustomersFilterSearchBarSearchParams = {
  status?: string;
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
  className,
}: CustomersFilterSearchBarProps) {
  const [localSearch, setLocalSearch] = React.useState(searchValue);
  const [localStatus, setLocalStatus] = React.useState(searchParams.status ?? "");
  const [localLeadSource, setLocalLeadSource] = React.useState(searchParams.leadSource ?? "");
  const [saveSearchOpen, setSaveSearchOpen] = React.useState(false);
  const [saveSearchMode, setSaveSearchMode] = React.useState<"new" | "update">("new");
  const [manageSearchesOpen, setManageSearchesOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onSearchChangeRef = React.useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  React.useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  React.useEffect(() => {
    setLocalStatus(searchParams.status ?? "");
    setLocalLeadSource(searchParams.leadSource ?? "");
  }, [searchParams.status, searchParams.leadSource]);

  React.useEffect(() => {
    const trimmed = localSearch.trim();
    const t = setTimeout(() => {
      onSearchChangeRef.current(trimmed);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [localSearch]);

  const hasActiveFilters =
    searchParams.status || searchParams.leadSource || searchParams.assignedTo;

  const currentState: SavedSearchCatalogItem["stateJson"] = {
    q: searchParams.q,
    status: searchParams.status,
    leadSource: searchParams.leadSource,
    assignedTo: searchParams.assignedTo,
    sortBy: searchParams.sortBy ?? "created_at",
    sortOrder: (searchParams.sortOrder as "asc" | "desc") ?? "desc",
    limit: searchParams.limit ?? 10,
    offset: searchParams.offset ?? 0,
  };

  const applyStatus = (value: string) => {
    onFilterChange({ status: value || undefined });
  };

  const applyLeadSource = (value: string) => {
    onFilterChange({ leadSource: value.trim() || undefined });
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
    if (searchParams.assignedTo) {
      c.push({
        id: "assignedTo",
        label: "Assigned",
        onRemove: () => onFilterChange({ assignedTo: undefined }),
      });
    }
    if (searchParams.q) {
      c.push({
        id: "q",
        label: `Search: ${searchParams.q}`,
        onRemove: () => onFilterChange({ q: undefined }),
      });
    }
    return c;
  }, [searchParams, onFilterChange]);

  const currentSavedSearch = searchParams.savedSearchId
    ? savedSearches.find((s) => s.id === searchParams.savedSearchId)
    : null;

  return (
    <>
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
            <DropdownMenuContent align="start" className="min-w-[240px]">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <div className="px-2 py-2 space-y-2">
                <div>
                  <label className="text-xs text-[var(--text-soft)] block mb-1">Status</label>
                  <Select
                    options={[{ value: "", label: "Any" }, ...STATUS_OPTIONS]}
                    value={localStatus}
                    onChange={(v) => applyStatus(v)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-soft)] block mb-1">Lead source</label>
                  <Input
                    value={localLeadSource}
                    onChange={(e) => setLocalLeadSource(e.target.value)}
                    onBlur={() => applyLeadSource(localLeadSource)}
                    placeholder="e.g. Website"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {savedFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
                  {savedFilters.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => onApplySavedFilter(f.definitionJson)}
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="ml-1 text-xs text-[var(--text-soft)]">
                        {f.visibility === "SHARED" ? "Shared" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {hasActiveFilters && (
                <DropdownMenuItem
                  onClick={() =>
                    onFilterChange({
                      status: undefined,
                      leadSource: undefined,
                      assignedTo: undefined,
                      savedSearchId: undefined,
                      offset: 0,
                    })
                  }
                >
                  Clear all filters
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {chips.filter((chip) => chip.id !== "q").map((chip) => (
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

        {/* Center: live search input */}
        <div
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
        </div>

        {/* Right: Search chip (e.g. "Search: jon") */}
        {chips
          .filter((c) => c.id === "q")
          .map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-sm text-[var(--text)] shrink-0"
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

        {/* Save Search (right of search bar) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" type="button">
              Save Search ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem
              onClick={() => {
                setSaveSearchMode("new");
                setSaveSearchOpen(true);
              }}
            >
              Save as new…
            </DropdownMenuItem>
            {currentSavedSearch && (
              <DropdownMenuItem
                onClick={() => {
                  setSaveSearchMode("update");
                  setSaveSearchOpen(true);
                }}
              >
                Update current…
              </DropdownMenuItem>
            )}
            {savedSearches.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Apply saved search</DropdownMenuLabel>
                {savedSearches.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onApplySavedSearch(s.stateJson, s.id)}
                  >
                    <span className="truncate">{s.name}</span>
                    {s.isDefault && (
                      <span className="ml-1 text-xs text-[var(--text-soft)]">Default</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setManageSearchesOpen(true)}>
                  Manage…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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

/** Simple modal listing saved searches with delete; no edit. */
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
