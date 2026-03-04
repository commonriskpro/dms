"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
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
import type {
  CustomerListItem,
  CustomersListResponse,
  CustomerStatus,
} from "@/lib/types/customers";
import { CUSTOMER_STATUS_OPTIONS } from "@/lib/types/customers";

const DEBOUNCE_MS = 400;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type MemberOption = { id: string; fullName: string | null; email: string };

export function CustomersListPage() {
  const router = useRouter();
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
  const [members, setMembers] = React.useState<MemberOption[]>([]);
  const [membersLoaded, setMembersLoaded] = React.useState(false);

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
    });
    if (appliedFilters.current.status) params.set("status", appliedFilters.current.status);
    if (appliedFilters.current.leadSource)
      params.set("leadSource", appliedFilters.current.leadSource);
    if (appliedFilters.current.assignedTo)
      params.set("assignedTo", appliedFilters.current.assignedTo);
    if (appliedFilters.current.search)
      params.set("search", appliedFilters.current.search);

    const res = await apiFetch<CustomersListResponse>(`/api/customers?${params.toString()}`);
    setData(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset]);

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
  }, [canRead, meta.offset, searchParam, fetchCustomers]);

  const handleApplyFilters = () => {
    appliedFilters.current = {
      search: searchInput.trim(),
      status,
      leadSource,
      assignedTo,
    };
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
  const assignedOptions: SelectOption[] = [
    { value: "", label: "Any" },
    ...members.map((u) => ({
      value: u.id,
      label: u.fullName ?? u.email ?? u.id,
    })),
  ];

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
          <Link href="/customers/new">
            <Button>New Customer</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <Input
              label="Search"
              placeholder="Name, phone, email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search customers"
            />
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
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
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApplyFilters}>Apply</Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

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
                actionLabel={canWrite ? "New Customer" : undefined}
                onAction={canWrite ? () => router.push("/customers/new") : undefined}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Name</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">Lead source</TableHead>
                      <TableHead scope="col">Assigned to</TableHead>
                      <TableHead scope="col">Primary phone</TableHead>
                      <TableHead scope="col">Primary email</TableHead>
                      <TableHead scope="col">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/customers/${c.id}`)}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.status}</TableCell>
                        <TableCell>{c.leadSource ?? "—"}</TableCell>
                        <TableCell>
                          {c.assignedToProfile?.fullName ?? c.assignedToProfile?.email ?? "—"}
                        </TableCell>
                        <TableCell>{c.primaryPhone ?? "—"}</TableCell>
                        <TableCell>{c.primaryEmail ?? "—"}</TableCell>
                        <TableCell>
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
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
