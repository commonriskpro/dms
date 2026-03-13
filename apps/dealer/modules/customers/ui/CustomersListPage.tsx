"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import { Select, type SelectOption } from "@/components/ui/select";
import { getStageLabel } from "@/lib/constants/crm-stages";
import type {
  CustomerListItem,
  CustomersListResponse,
} from "@/lib/types/customers";
import type { SavedFilterCatalogItem, SavedSearchCatalogItem } from "@/lib/types/saved-filters-searches";
import { CustomersFilterSearchBar, type CustomersFilterSearchBarSearchParams } from "@/modules/customers/ui/components/CustomersFilterSearchBar";
import { CRM_STAGES } from "@/lib/constants/crm-stages";
import { customerDetailPath, customerDraftPath } from "@/lib/routes/detail-paths";

const DEBOUNCE_MS = 400;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type MemberOption = { id: string; fullName: string | null; email: string };

type SortBy = "created_at" | "updated_at" | "status";
type SortOrder = "asc" | "desc";

export function CustomersListPage() {
  const router = useRouter();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("customers.read");
  const canWrite = hasPermission("customers.write");

  const [data, setData] = React.useState<CustomerListItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: DEFAULT_LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [searchInput, setSearchInput] = React.useState("");
  const [searchParam, setSearchParam] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [draft, setDraft] = React.useState<"all" | "draft" | "final">("all");
  const [leadSource, setLeadSource] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [savedSearchId, setSavedSearchId] = React.useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = React.useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [members, setMembers] = React.useState<MemberOption[]>([]);
  const [savedFilters, setSavedFilters] = React.useState<SavedFilterCatalogItem[]>([]);
  const [savedSearches, setSavedSearches] = React.useState<SavedSearchCatalogItem[]>([]);
  const [membersLoaded, setMembersLoaded] = React.useState(false);

  const appliedFilters = React.useRef<{
    search: string;
    status: string;
    draft: "all" | "draft" | "final";
    leadSource: string;
    assignedTo: string;
    savedSearchId: string | undefined;
  }>({
    search: "",
    status: "",
    draft: "all",
    leadSource: "",
    assignedTo: "",
    savedSearchId: undefined,
  });
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    // Fetch saved filters and searches
    apiFetch<{ data: SavedFilterCatalogItem[] }>("/api/customers/saved-filters")
      .then((res) => setSavedFilters(res.data))
      .catch(() => setSavedFilters([]));
    apiFetch<{ data: SavedSearchCatalogItem[] }>("/api/customers/saved-searches")
      .then((res) => setSavedSearches(res.data))
      .catch(() => setSavedSearches([]));
  }, []);

  React.useEffect(() => {
    if (!hasPermission("admin.memberships.read")) {
      setMembersLoaded(true);
      return;
    }
    apiFetch<{ data: { user: MemberOption }[]; meta: { total: number } }>(
      "/api/admin/memberships?limit=100"
    )
      .then((res) => {
        const seen = new Set<string>();
        const list: MemberOption[] = [];
        for (const m of res.data ?? []) {
          const u = m.user;
          if (u && !seen.has(u.id)) {
            seen.add(u.id);
            list.push(u);
          }
        }
        setMembers(list);
      })
      .catch(() => setMembers([]))
      .finally(() => setMembersLoaded(true));
  }, [hasPermission]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParam(searchInput.trim());
      appliedFilters.current = { ...appliedFilters.current, search: searchInput.trim() };
      setMeta((m) => ({ ...m, offset: 0 }));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const fetchCustomers = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(Math.min(meta.limit, MAX_LIMIT)),
      offset: String(meta.offset),
      sortBy,
      sortOrder,
    });
    if (appliedFilters.current.status) params.set("status", appliedFilters.current.status);
    if (appliedFilters.current.draft !== "all") params.set("draft", appliedFilters.current.draft);
    if (appliedFilters.current.leadSource)
      params.set("leadSource", appliedFilters.current.leadSource);
    if (appliedFilters.current.assignedTo)
      params.set("assignedTo", appliedFilters.current.assignedTo);
    if (appliedFilters.current.search)
      params.set("search", appliedFilters.current.search);
    if (appliedFilters.current.savedSearchId) {
      params.set("savedSearchId", appliedFilters.current.savedSearchId);
    }

    const res = await apiFetch<CustomersListResponse>(`/api/customers?${params.toString()}`);
    setData(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset, sortBy, sortOrder]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchCustomers().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load customers");
    }).finally(() => setLoading(false));
  }, [canRead, meta.offset, searchParam, sortBy, sortOrder, status, draft, leadSource, assignedTo, fetchCustomers, savedSearchId]);



  const handleSort = React.useCallback((id: string) => {
    const nextOrder =
      sortBy === id && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(id as SortBy);
    setSortOrder(nextOrder);
    setMeta((m) => ({ ...m, offset: 0 }));
  }, [sortBy, sortOrder]);

  const columns = React.useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{String(getValue())}</span>
            {row.original.isDraft ? (
              <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                Draft
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <button
            type="button"
            onClick={() => handleSort("status")}
            className="hover:text-[var(--text)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          >
            Stage {sortBy === "status" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
          </button>
        ),
        cell: ({ getValue }) => getStageLabel(String(getValue())),
      },
      {
        accessorKey: "leadSource",
        header: "Lead source",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "assignedToProfile",
        header: "Assigned to",
        cell: ({ getValue }) => {
          const p = getValue() as CustomerListItem["assignedToProfile"];
          return p?.fullName ?? p?.email ?? "—";
        },
      },
      {
        accessorKey: "primaryPhone",
        header: "Primary phone",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "primaryEmail",
        header: "Primary email",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "createdAt",
        header: () => (
          <button
            type="button"
            onClick={() => handleSort("created_at")}
            className="hover:text-[var(--text)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          >
            Created {sortBy === "created_at" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
          </button>
        ),
        cell: ({ getValue }) =>
          getValue() ? new Date(String(getValue())).toLocaleDateString() : "—",
      },
      {
        accessorKey: "updatedAt",
        header: () => (
          <button
            type="button"
            onClick={() => handleSort("updated_at")}
            className="hover:text-[var(--text)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          >
            Updated {sortBy === "updated_at" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
          </button>
        ),
        cell: ({ getValue }) =>
          getValue() ? new Date(String(getValue())).toLocaleDateString() : "—",
      },
    ],
    [sortBy, sortOrder, handleSort]
  );

  // TanStack Table's useReactTable() returns unstable refs; React Compiler cannot memoize this safely
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable API returns non-memoizable functions
  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(meta.total / meta.limit),
  });

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don’t have access to customers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Customers</h1>
        {canWrite && (
          <WriteGuard>
            <Link href="/customers/new">
              <Button>New Customer</Button>
            </Link>
          </WriteGuard>
        )}
      </div>

      <CustomersFilterSearchBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onFilterChange={(updates) => {
          if (updates.savedSearchId !== undefined) setSavedSearchId(updates.savedSearchId);
          if (updates.status !== undefined) setStatus(updates.status);
          if (updates.draft !== undefined) setDraft(updates.draft);
          if (updates.leadSource !== undefined) setLeadSource(updates.leadSource);
          if (updates.assignedTo !== undefined) setAssignedTo(updates.assignedTo);
          setMeta((m) => ({
            ...m,
            offset: 0,
            limit: updates.limit ?? m.limit,
          }));
          if (
            updates.sortBy === "created_at" ||
            updates.sortBy === "updated_at" ||
            updates.sortBy === "status"
          ) {
            setSortBy(updates.sortBy);
          }
          if (updates.sortOrder === "asc" || updates.sortOrder === "desc") {
            setSortOrder(updates.sortOrder);
          }
          appliedFilters.current = {
            ...appliedFilters.current,
            status: updates.status ?? appliedFilters.current.status,
            draft: updates.draft ?? appliedFilters.current.draft,
            leadSource: updates.leadSource ?? appliedFilters.current.leadSource,
            assignedTo: updates.assignedTo ?? appliedFilters.current.assignedTo,
            savedSearchId: updates.savedSearchId ?? appliedFilters.current.savedSearchId,
          };
        }}
        searchParams={{
          q: searchInput,
          status,
          draft,
          leadSource,
          assignedTo,
          sortBy,
          sortOrder,
          limit: meta.limit,
          offset: meta.offset,
          savedSearchId,
        }}
        savedFilters={savedFilters}
        savedSearches={savedSearches}
        onApplySavedFilter={(definition) => {
          setStatus(definition.status ?? "");
          setDraft((definition.draft as "all" | "draft" | "final") ?? "all");
          setLeadSource(definition.leadSource ?? "");
          setAssignedTo(definition.assignedTo ?? "");
          setSavedSearchId(undefined);
          appliedFilters.current = {
            ...appliedFilters.current,
            status: definition.status ?? "",
            draft: (definition.draft as "all" | "draft" | "final") ?? "all",
            leadSource: definition.leadSource ?? "",
            assignedTo: definition.assignedTo ?? "",
            savedSearchId: undefined,
          };
          setMeta((m) => ({ ...m, offset: 0 }));
        }}
        onApplySavedSearch={(state, searchId) => {
          setSearchInput(state.q ?? "");
          setStatus(state.status ?? "");
          setDraft((state.draft as "all" | "draft" | "final") ?? "all");
          setLeadSource(state.leadSource ?? "");
          setAssignedTo(state.assignedTo ?? "");
          setSavedSearchId(searchId);
          setMeta((m) => ({ ...m, offset: state.offset ?? 0, limit: state.limit ?? DEFAULT_LIMIT }));
          setSortBy((state.sortBy as SortBy) ?? "created_at");
          setSortOrder(state.sortOrder ?? "desc");
          appliedFilters.current = {
            search: state.q ?? "",
            status: state.status ?? "",
            draft: (state.draft as "all" | "draft" | "final") ?? "all",
            leadSource: state.leadSource ?? "",
            assignedTo: state.assignedTo ?? "",
            savedSearchId: searchId,
          };
        }}
        onSavedFilterOrSearchChange={() => {
          apiFetch<{ data: SavedFilterCatalogItem[] }>("/api/customers/saved-filters")
            .then((res) => setSavedFilters(res.data))
            .catch(() => setSavedFilters([]));
          apiFetch<{ data: SavedSearchCatalogItem[] }>("/api/customers/saved-searches")
            .then((res) => setSavedSearches(res.data))
            .catch(() => setSavedSearches([]));
        }}
        className="mb-4 px-0"
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState
                message={error}
                onRetry={() => {
                  setError(null);
                  fetchCustomers();
                }}
              />
            </div>
          ) : data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No customers"
                description="Add your first customer to get started."
                actionLabel={canWrite && !writeDisabled ? "New Customer" : undefined}
                onAction={canWrite && !writeDisabled ? () => router.push("/customers/new") : undefined}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            scope="col"
                            style={{
                              display: header.column.getIsVisible()
                                ? undefined
                                : "none",
                            }}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-[var(--accent)]/10 focus-within:bg-[var(--accent)]/10 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--accent)]"
                        onClick={() => router.push(row.original.isDraft ? customerDraftPath(row.original.id) : customerDetailPath(row.original.id))}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(row.original.isDraft ? customerDraftPath(row.original.id) : customerDetailPath(row.original.id));
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-[var(--border)] p-4">
                <Pagination
                  meta={meta}
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
