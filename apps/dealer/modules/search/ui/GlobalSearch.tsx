"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { apiFetch } from "@/lib/client/http";
import type { GlobalSearchResultItem, GlobalSearchApiResponse } from "./types";
import { Search } from "@/lib/ui/icons";
import { customerDetailPath, inventoryDetailPath } from "@/lib/routes/detail-paths";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 20;
const BLUR_CLOSE_DELAY_MS = 150;

const SECTION_LABELS: Record<GlobalSearchResultItem["type"], string> = {
  customer: "Customers",
  deal: "Deals",
  inventory: "Inventory",
};

function getDetailHref(item: GlobalSearchResultItem): string {
  switch (item.type) {
    case "customer":
      return customerDetailPath(item.id);
    case "deal":
      return `/deals/${item.id}`;
    case "inventory":
      return inventoryDetailPath(item.id);
  }
}

function getItemLabel(item: GlobalSearchResultItem): string {
  switch (item.type) {
    case "customer":
      return [item.name, item.primaryPhone, item.primaryEmail].filter(Boolean).join(" · ") || item.name;
    case "deal":
      return `${item.stockNumber} — ${item.customerName}`;
    case "inventory":
      return [item.vin || item.stockNumber, item.yearMakeModel].filter(Boolean).join(" · ") || item.stockNumber;
  }
}

type RowEntry = { type: GlobalSearchResultItem["type"]; id: string; item: GlobalSearchResultItem; href: string; sectionLabel: string };

function buildRows(data: GlobalSearchResultItem[]): RowEntry[] {
  const rows: RowEntry[] = [];
  for (const item of data) {
    rows.push({
      type: item.type,
      id: item.id,
      item,
      href: getDetailHref(item),
      sectionLabel: SECTION_LABELS[item.type],
    });
  }
  return rows;
}

export function GlobalSearch(): React.ReactElement | null {
  const router = useRouter();
  const { hasPermission, activeDealership } = useSession();
  const canSearch =
    hasPermission("customers.read") || hasPermission("deals.read") || hasPermission("inventory.read");

  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [data, setData] = React.useState<GlobalSearchResultItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const rows = React.useMemo(() => buildRows(data), [data]);

  const runSearch = React.useCallback(async (q: string) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setStatus("idle");
      setData([]);
      setOpen(false);
      return;
    }
    setStatus("loading");
    setOpen(true);
    setHighlightedIndex(-1);
    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}&offset=0`;
      const res = await apiFetch<GlobalSearchApiResponse>(url);
      const list = Array.isArray(res?.data) ? res.data : [];
      setData(list);
      setStatus("success");
      setHighlightedIndex(list.length > 0 ? 0 : -1);
    } catch {
      setData([]);
      setStatus("error");
      setHighlightedIndex(-1);
    }
  }, []);

  // Debounced search (no-op when no permission or no tenant to avoid hook order change)
  React.useEffect(() => {
    if (!canSearch || !activeDealership) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setStatus("idle");
      setData([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canSearch, activeDealership, trimmed, runSearch]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Scroll highlighted item into view (no-op in jsdom)
  React.useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`) as HTMLElement | null;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  // Don't render search UI when no permission or no active dealership (after all hooks)
  if (!canSearch || !activeDealership) return null;

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => setOpen(false), BLUR_CLOSE_DELAY_MS);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (trimmed.length >= MIN_QUERY_LENGTH && (status === "success" || status === "loading")) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" && trimmed.length >= MIN_QUERY_LENGTH) setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i < rows.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter" && highlightedIndex >= 0 && rows[highlightedIndex]) {
      e.preventDefault();
      const row = rows[highlightedIndex];
      setOpen(false);
      setValue("");
      router.push(row.href);
    }
  };

  const handleSelect = (row: RowEntry) => {
    setOpen(false);
    setValue("");
    router.push(row.href);
  };

  return (
    <div ref={containerRef} className="relative flex w-full">
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]" aria-hidden>
          <Search size={16} className="h-4 w-4" />
        </span>
        <input
          type="search"
          autoComplete="off"
          placeholder="Search inventory, customers, deals..."
          aria-label="Search customers, deals, inventory"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-activedescendant={highlightedIndex >= 0 && rows[highlightedIndex] ? `search-result-${highlightedIndex}` : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-[44px] w-full rounded-[12px] bg-white/60 border border-[rgba(15,23,42,0.08)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] pl-10 pr-10 text-sm text-[var(--text)] placeholder:text-[var(--muted-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-text)]" aria-hidden>
          <Search size={16} className="h-4 w-4" />
        </span>
      </div>
      {open && (
        <div
          id="global-search-results"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[min(400px,70vh)] overflow-auto rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg"
        >
          {status === "loading" && (
            <div className="px-3 py-4 text-center text-sm text-[var(--text-soft)]">
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" aria-hidden />
              Searching…
            </div>
          )}
          {status === "error" && (
            <div className="px-3 py-4 text-center text-sm text-[var(--danger)]">
              Search failed
            </div>
          )}
          {status === "success" && data.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-[var(--text-soft)]">
              No results
            </div>
          )}
          {status === "success" && data.length > 0 && (
            <>
              {rows.map((row, index) => {
                if (!row?.item) return null;
                return (
                <div
                  key={`${row.type}-${row.id}`}
                  data-index={index}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  tabIndex={-1}
                  className={`cursor-pointer px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset ${
                    index === highlightedIndex ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(row);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-[var(--text-soft)]">
                    {row.sectionLabel}
                  </span>
                  <span className="text-[var(--text)]">{getItemLabel(row.item)}</span>
                </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
