"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { formatCents } from "@/lib/money";
import {
  QueueKpiStrip,
  QueueLayout,
  QueueTable,
} from "@/components/ui-system/queues";
import { SignalBlockerInline, SignalQueueSummary, type SignalSurfaceItem } from "@/components/ui-system/signals";
import {
  ColumnHeader,
  RowActions,
  StatusBadge,
  TableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-system/tables";
import { Pagination } from "@/components/pagination";
import {
  tableScrollWrapper,
  tableHeaderRow,
  tableRowHover,
  tableRowCompact,
  tableHeadCellCompact,
  tableCellCompact,
  tablePaginationFooter,
} from "@/lib/ui/recipes/table";
import { typography } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import {
  fetchSignalsByDomains,
  groupSignalsByEntityId,
  toQueueSignals,
} from "@/modules/intelligence/ui/surface-adapters";
import { getDealQueueHref } from "./deal-workspace-href";

type FundingDealItem = {
  id: string;
  customerId: string;
  createdAt: string;
  customer?: { id: string; name: string };
  vehicle?: {
    id: string;
    stockNumber: string;
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
  };
  dealFundings?: Array<{
    id: string;
    fundingStatus: string;
    fundingAmountCents: string;
    fundingDate: string | null;
    lenderName?: string;
  }>;
};

type Response = { data: FundingDealItem[]; meta: { total: number; limit: number; offset: number } };
type QueueState = "loading" | "error" | "empty" | "default";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "FUNDED", label: "Funded" },
  { value: "DECLINED", label: "Declined" },
];

function statusVariant(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  const normalized = status.toUpperCase();
  if (normalized.includes("FUNDED")) return "success";
  if (normalized.includes("APPROVED")) return "info";
  if (normalized.includes("DECLINED")) return "danger";
  if (normalized.includes("PENDING")) return "warning";
  return "neutral";
}

function vehicleDisplay(v: FundingDealItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.stockNumber || "—";
}

function primaryFunding(f: FundingDealItem) {
  const list = f.dealFundings ?? [];
  return list[0];
}

export function FundingQueuePage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const [data, setData] = React.useState<FundingDealItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [allQueueSignals, setAllQueueSignals] = React.useState<SignalSurfaceItem[]>([]);

  const fetchData = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ limit: "25", offset: String(meta.offset) });
    const res = await apiFetch<Response>(`/api/deals/funding?${params.toString()}`);
    setData(res.data);
    setMeta(res.meta);
  }, [canRead, meta.offset]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchData().catch((e) => setError(e instanceof Error ? e.message : "Failed to load")).finally(() => setLoading(false));
  }, [canRead, meta.offset, fetchData]);

  React.useEffect(() => {
    let mounted = true;
    fetchSignalsByDomains(["deals", "operations"], { limit: 50 })
      .then((signals) => {
        if (!mounted) return;
        setAllQueueSignals(signals);
      })
      .catch(() => {
        if (!mounted) return;
        setAllQueueSignals([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const queueSignals = React.useMemo(
    () => toQueueSignals(allQueueSignals, { maxVisible: 4 }),
    [allQueueSignals]
  );
  const signalsByDealId = React.useMemo(
    () => groupSignalsByEntityId(allQueueSignals, data.map((r) => r.id)),
    [allQueueSignals, data]
  );

  if (!canRead) {
    return (
      <QueueLayout
        title={<h1 className={typography.pageTitle}>Funding queue</h1>}
        description="Track deals waiting for lender funding."
        table={
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
          </div>
        }
      />
    );
  }

  const filtered = data.filter((row) => {
    const fund = primaryFunding(row);
    const customer = (row.customer?.name ?? row.customerId).toLowerCase();
    const vehicle = vehicleDisplay(row.vehicle).toLowerCase();
    const lender = (fund?.lenderName ?? "").toLowerCase();
    const fundingStatus = fund?.fundingStatus ?? "";
    const matchesSearch =
      search.trim().length === 0 ||
      customer.includes(search.toLowerCase()) ||
      vehicle.includes(search.toLowerCase()) ||
      lender.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "" || fundingStatus.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const pendingCount = data.filter((row) => (primaryFunding(row)?.fundingStatus ?? "").toUpperCase().includes("PENDING")).length;
  const totalAmountCents = data.reduce((sum, row) => sum + Number(primaryFunding(row)?.fundingAmountCents ?? "0"), 0);
  const state: QueueState = loading ? "loading" : error ? "error" : filtered.length === 0 ? "empty" : "default";

  return (
    <QueueLayout
      title={<h1 className={typography.pageTitle}>Funding queue</h1>}
      description="Shared queue view for funding operations."
      kpis={
        <>
          <QueueKpiStrip
            items={[
              { label: "Awaiting funding", value: meta.total.toLocaleString(), hint: "Deals currently in funding queue" },
              { label: "Pending lender action", value: pendingCount.toLocaleString(), hint: "Still pending lender response" },
              { label: "Funding volume", value: formatCents(String(totalAmountCents)), hint: "Current queue principal total" },
            ]}
          />
          <SignalQueueSummary items={queueSignals} />
        </>
      }
      filters={
        <TableToolbar
          search={(
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, vehicle, or lender"
              aria-label="Search funding queue"
            />
          )}
          filters={(
            <Select
              label="Funding status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          )}
        />
      }
      table={
        <QueueTable
          state={state}
          errorMessage={error ?? undefined}
          onRetry={fetchData}
          emptyTitle="No deals awaiting funding"
          emptyDescription="Deals appear here when funding is pending or approved."
          pagination={(
            <Pagination
              meta={meta}
              onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
            />
          )}
        >
          <div className={tableScrollWrapper}>
            <Table>
              <TableHeader>
                <TableRow className={tableHeaderRow}>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Customer</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Vehicle</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Lender</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Funding status</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Amount</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>SLA start</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Alerts</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const fund = primaryFunding(row);
                  const status = fund?.fundingStatus ?? "NOT_STARTED";
                  return (
                    <TableRow key={row.id} className={cn(tableRowHover, tableRowCompact)}>
                      <TableCell className={tableCellCompact}>{row.customer?.name ?? row.customerId.slice(0, 8)}</TableCell>
                      <TableCell className={tableCellCompact}>{vehicleDisplay(row.vehicle)}</TableCell>
                      <TableCell className={tableCellCompact}>{fund?.lenderName ?? "—"}</TableCell>
                      <TableCell className={tableCellCompact}>
                        <StatusBadge variant={statusVariant(status)}>{status}</StatusBadge>
                      </TableCell>
                      <TableCell className={tableCellCompact}>{fund ? formatCents(fund.fundingAmountCents) : "—"}</TableCell>
                      <TableCell className={tableCellCompact}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className={tableCellCompact}>
                        {(signalsByDealId.get(row.id)?.length ?? 0) > 0 ? (
                          <SignalBlockerInline items={signalsByDealId.get(row.id) ?? []} maxCount={3} />
                        ) : null}
                      </TableCell>
                      <TableCell className={tableCellCompact}>
                        <RowActions>
                          <Link href={getDealQueueHref(row.id, "delivery-funding")}>
                            <Button variant="secondary" size="sm">View</Button>
                          </Link>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className={tablePaginationFooter} />
        </QueueTable>
      }
    />
  );
}
