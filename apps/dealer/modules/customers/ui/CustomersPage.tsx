"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { ui } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomersSummaryCards } from "./components/CustomersSummaryCards";
import { CustomersFilterBar } from "./components/CustomersFilterBar";
import { CustomersTableCard } from "./components/CustomersTableCard";
import type { CustomerListItem, CustomersListResponse } from "@/lib/types/customers";
import { CUSTOMER_STATUS_OPTIONS } from "@/lib/types/customers";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
type SortBy = "created_at" | "updated_at" | "status";
type SortOrder = "asc" | "desc";

type MemberOption = { id: string; fullName: string | null; email: string };

export function CustomersPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("customers.read");
  const canWrite = hasPermission("customers.write");

  const [data, setData] = React.useState<CustomerListItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: DEFAULT_LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [searchInput, setSearchInput] = React.useState("");
  const [searchParam, setSearchParam] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [leadSource, setLeadSource] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [members, setMembers] = React.useState<MemberOption[]>([]);
  const [membersLoaded, setMembersLoaded] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);

  const appliedFilters = React.useRef({
    search: "",
    status: "",
    leadSource: "",
    assignedTo: "",
  });
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }, 400);
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
    if (appliedFilters.current.leadSource) params.set("leadSource", appliedFilters.current.leadSource);
    if (appliedFilters.current.assignedTo) params.set("assignedTo", appliedFilters.current.assignedTo);
    if (appliedFilters.current.search) params.set("search", appliedFilters.current.search);

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
  }, [canRead, meta.offset, searchParam, sortBy, sortOrder, fetchCustomers]);

  const handleApplyFilters = () => {
    appliedFilters.current = {
      search: searchInput.trim(),
      status,
      leadSource,
      assignedTo,
    };
    setMeta((m) => ({ ...m, offset: 0 }));
    setFilterOpen(false);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    appliedFilters.current = { ...appliedFilters.current, status: value };
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const handleSourceChange = (value: string) => {
    setLeadSource(value);
    appliedFilters.current = { ...appliedFilters.current, leadSource: value };
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setStatus("");
    setLeadSource("");
    setAssignedTo("");
    appliedFilters.current = { search: "", status: "", leadSource: "", assignedTo: "" };
    setMeta((m) => ({ ...m, offset: 0 }));
  };

  const statusOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...CUSTOMER_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const sourceOptions: SelectOption[] = [
    { value: "", label: "All sources" },
    { value: "Website", label: "Website" },
    { value: "Referral", label: "Referral" },
    { value: "Walk-in", label: "Walk-in" },
    { value: "Phone", label: "Phone" },
  ];
  const assignedOptions: SelectOption[] = [
    { value: "", label: "Any" },
    ...members.map((u) => ({
      value: u.id,
      label: u.fullName ?? u.email ?? u.id,
    })),
  ];

  const totalCustomers = meta.total;
  const activeLeads = data.filter((c) => c.status === "LEAD").length;
  const creditApps = 0;

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to customers.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className={sectionStack}>
      <PageHeader
        title={
          <h1 className="text-[24px] font-semibold leading-tight text-[var(--text)]">
            Customers
          </h1>
        }
        actions={
          canWrite ? (
            <Link href="/customers/new">
              <Button className={ui.ring}>New Customer</Button>
            </Link>
          ) : null
        }
      />

      <CustomersSummaryCards
        totalCustomers={totalCustomers}
        activeLeads={activeLeads}
        creditApps={creditApps}
      />

      <CustomersFilterBar
        searchParams={{
          status: status || undefined,
          leadSource: leadSource || undefined,
          search: searchParam || undefined,
        }}
        onFilterChange={(updates) => {
          if (updates.status !== undefined) {
            setStatus(updates.status ?? "");
            appliedFilters.current = { ...appliedFilters.current, status: updates.status ?? "" };
          }
          if (updates.leadSource !== undefined) {
            setLeadSource(updates.leadSource ?? "");
            appliedFilters.current = { ...appliedFilters.current, leadSource: updates.leadSource ?? "" };
          }
          if (updates.search !== undefined) {
            setSearchInput(updates.search ?? "");
            appliedFilters.current = { ...appliedFilters.current, search: updates.search ?? "" };
          }
          setMeta((m) => ({ ...m, offset: 0 }));
        }}
        compactPagination={{
          currentPage: Math.floor(meta.offset / meta.limit) + 1,
          totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)),
          onPageChange: (page) => setMeta((m) => ({ ...m, offset: (page - 1) * meta.limit })),
        }}
        totalEntries={meta.total}
        limit={meta.limit}
        offset={meta.offset}
      />

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              label="Search"
              placeholder="Name, phone, email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Select label="Status" options={statusOptions} value={status} onChange={setStatus} />
            <Input
              label="Lead source"
              placeholder="e.g. Website"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
            />
            {membersLoaded && members.length > 0 && (
              <Select
                label="Assigned to"
                options={assignedOptions}
                value={assignedTo}
                onChange={setAssignedTo}
              />
            )}
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters}>Apply</Button>
              <Button variant="secondary" onClick={handleResetFilters}>
                Reset filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CustomersTableCard
        data={data}
        meta={meta}
        loading={loading}
        error={error}
        onRetry={() => { setError(null); fetchCustomers(); }}
        onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
        canRead={canRead}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
