"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomersSummaryCardsRow } from "./components/CustomersSummaryCardsRow";
import { CustomersFilterSearchBar } from "./components/CustomersFilterSearchBar";
import { CustomersTableCard } from "./components/CustomersTableCard";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { ui } from "@/lib/ui/tokens";
import type { CustomerListItem } from "@/lib/types/customers";
import type { CustomerSummaryMetrics } from "@/modules/customers/service/customer";

export type CustomersPageInitialData = {
  list: { data: CustomerListItem[]; meta: { total: number; limit: number; offset: number } };
  summary: CustomerSummaryMetrics;
};

export type CustomersSearchParams = {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  leadSource?: string;
  assignedTo?: string;
  search?: string;
};

export type CustomersPageClientProps = {
  initialData: CustomersPageInitialData | null;
  canRead: boolean;
  canWrite: boolean;
  searchParams: CustomersSearchParams;
};

function buildCustomersQuery(params: CustomersSearchParams): string {
  const p = new URLSearchParams();
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.offset != null) p.set("offset", String(params.offset));
  if (params.sortBy) p.set("sortBy", params.sortBy);
  if (params.sortOrder) p.set("sortOrder", params.sortOrder);
  if (params.status) p.set("status", params.status);
  if (params.leadSource) p.set("leadSource", params.leadSource);
  if (params.assignedTo) p.set("assignedTo", params.assignedTo);
  if (params.search) p.set("search", params.search);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function CustomersPageClient({
  initialData,
  canRead,
  canWrite,
  searchParams,
}: CustomersPageClientProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  const handlePageChange = (offset: number) => {
    const next = { ...searchParams, offset };
    router.push(`/customers${buildCustomersQuery(next)}`);
    router.refresh();
  };

  const handleFilterChange = (updates: Partial<CustomersSearchParams>) => {
    const next = { ...searchParams, ...updates, offset: 0 };
    router.push(`/customers${buildCustomersQuery(next)}`);
    router.refresh();
  };

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to customers.</p>
        </div>
      </PageShell>
    );
  }

  const list = initialData?.list ?? { data: [], meta: { total: 0, limit: 10, offset: 0 } };
  const summary = initialData?.summary ?? {
    totalCustomers: 0,
    totalLeads: 0,
    activeCustomers: 0,
    activeCount: 0,
    inactiveCustomers: 0,
  };

  const { meta } = list;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const currentPage = Math.floor(meta.offset / meta.limit) + 1;

  return (
    <PageShell className={sectionStack}>
      <PageHeader
        title={
          <h1 className="text-2xl font-semibold leading-tight text-[var(--text)]">
            Customer List
          </h1>
        }
        actions={
          <div className="flex items-center gap-3">
            {canWrite && (
              <Link href="/customers/new">
                <Button className={ui.ring} size="md">
                  <span className="mr-2">+</span>
                  Add Customer
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="md">
                  <span className="mr-2">☰</span>
                  Bulk Actions
                  <span className="ml-2">▾</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <span className="px-2 py-1.5 text-sm text-[var(--text-soft)]">Export / Assign</span>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="md" onClick={handleRefresh}>
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-9 w-9 p-0 shrink-0" aria-label="Table view options">
                  <span className="text-[var(--text)]">▦</span>
                  <span className="ml-0.5 text-[var(--text-soft)] text-xs">▾</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <span className="px-2 py-1.5 text-sm text-[var(--text-soft)]">View options</span>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <CustomersSummaryCardsRow
        totalCustomers={summary.totalCustomers}
        totalLeads={summary.totalLeads}
        activeCustomers={summary.activeCustomers}
        activeCount={summary.activeCount}
        inactiveCustomers={summary.inactiveCustomers}
      />

      <CustomersFilterSearchBar
        searchValue={searchParams.search ?? ""}
        onSearchSubmit={(value) => handleFilterChange({ search: value || undefined })}
        onFilterChange={handleFilterChange}
        searchParams={searchParams}
      />

      <CustomersTableCard
        data={list.data}
        meta={meta}
        loading={false}
        error={null}
        onRetry={handleRefresh}
        onPageChange={handlePageChange}
        canRead={canRead}
        canWrite={canWrite}
        entriesLabel={`Showing ${meta.offset + 1} to ${Math.min(meta.offset + meta.limit, meta.total)} of ${meta.total.toLocaleString()} entries`}
        compactPagination={{
          currentPage,
          totalPages,
          onPageChange: (page) => handlePageChange((page - 1) * meta.limit),
        }}
      />
    </PageShell>
  );
}
