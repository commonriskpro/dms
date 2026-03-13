"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
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

const TITLE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  TITLE_PENDING: "Pending",
  TITLE_SENT: "Sent to DMV",
  TITLE_RECEIVED: "Received",
  TITLE_COMPLETED: "Completed",
  ISSUE_HOLD: "Issue / hold",
};

type TitleQueueItem = {
  id: string;
  customerId: string;
  createdAt: string;
  deliveredAt?: string | null;
  customer?: { id: string; name: string };
  vehicle?: {
    id: string;
    stockNumber: string;
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
  };
  dealTitle?: {
    id: string;
    titleStatus: string;
    titleNumber: string | null;
    lienholderName: string | null;
    sentToDmvAt: string | null;
    receivedFromDmvAt: string | null;
  } | null;
};

type Response = { data: TitleQueueItem[]; meta: { total: number; limit: number; offset: number } };
type QueueState = "loading" | "error" | "empty" | "default";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "TITLE_PENDING", label: "Pending" },
  { value: "TITLE_SENT", label: "Sent to DMV" },
  { value: "TITLE_RECEIVED", label: "Received" },
  { value: "ISSUE_HOLD", label: "Issue / hold" },
];

function statusVariant(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (status === "TITLE_RECEIVED" || status === "TITLE_COMPLETED") return "success";
  if (status === "TITLE_SENT") return "info";
  if (status === "ISSUE_HOLD") return "danger";
  if (status === "TITLE_PENDING") return "warning";
  return "neutral";
}

function vehicleDisplay(v: TitleQueueItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.stockNumber || "—";
}

function daysSinceDelivery(deliveredAt: string | null | undefined): string | number {
  if (!deliveredAt) return "—";
  const days = Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 86400000);
  return days >= 0 ? days : "—";
}

export function TitleQueuePage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const [data, setData] = React.useState<TitleQueueItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [allQueueSignals, setAllQueueSignals] = React.useState<SignalSurfaceItem[]>([]);

  const fetchData = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ limit: "25", offset: String(meta.offset) });
    const res = await apiFetch<Response>(`/api/deals/title?${params.toString()}`);
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
    fetchSignalsByDomains(["operations", "deals"], { limit: 50 })
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

  if (!canRead) {
    return (
      <QueueLayout
        title={<h1 className={typography.pageTitle}>Title queue</h1>}
        description="Track title and DMV processing."
        table={
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
          </div>
        }
      />
    );
  }

  const filtered = data.filter((row) => {
    const status = row.dealTitle?.titleStatus ?? "";
    const matchesStatus = statusFilter === "" || status === statusFilter;
    const query = search.toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      (row.customer?.name ?? row.customerId).toLowerCase().includes(query) ||
      vehicleDisplay(row.vehicle).toLowerCase().includes(query) ||
      row.id.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });
  const holdCount = data.filter((row) => row.dealTitle?.titleStatus === "ISSUE_HOLD").length;
  const pendingCount = data.filter((row) =>
    ["TITLE_PENDING", "NOT_STARTED"].includes(row.dealTitle?.titleStatus ?? "NOT_STARTED")
  ).length;
  const state: QueueState = loading ? "loading" : error ? "error" : filtered.length === 0 ? "empty" : "default";

  const queueSignals = React.useMemo(
    () => toQueueSignals(allQueueSignals, { maxVisible: 4 }),
    [allQueueSignals]
  );
  const signalsByDealId = React.useMemo(
    () => groupSignalsByEntityId(allQueueSignals, data.map((r) => r.id)),
    [allQueueSignals, data]
  );

  return (
    <QueueLayout
      title={<h1 className={typography.pageTitle}>Title queue</h1>}
      description="Shared queue view for title and DMV workflow."
      kpis={
        <>
          <QueueKpiStrip
            items={[
              { label: "Open title work", value: meta.total.toLocaleString(), hint: "Records currently in title queue" },
              { label: "Pending prep", value: pendingCount.toLocaleString(), hint: "Not yet sent to DMV" },
              { label: "Issue hold", value: holdCount.toLocaleString(), hint: "Needs manual intervention" },
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
              placeholder="Search customer, vehicle, or deal"
              aria-label="Search title queue"
            />
          )}
          filters={(
            <Select
              label="Title status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
          )}
        />
      }
      table={
        <QueueTable
          state={state}
          errorMessage={error ?? undefined}
          onRetry={fetchData}
          emptyTitle="No deals in title queue"
          emptyDescription="Deals will appear here when title processing has started."
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
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Deal date</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Title status</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>SLA start</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Days since delivery</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}><ColumnHeader>Alerts</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCellCompact}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const titleStatus = row.dealTitle?.titleStatus ?? "NOT_STARTED";
                  return (
                    <TableRow key={row.id} className={cn(tableRowHover, tableRowCompact)}>
                      <TableCell className={tableCellCompact}>{row.customer?.name ?? row.customerId.slice(0, 8)}</TableCell>
                      <TableCell className={tableCellCompact}>{vehicleDisplay(row.vehicle)}</TableCell>
                      <TableCell className={tableCellCompact}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className={tableCellCompact}>
                        <StatusBadge variant={statusVariant(titleStatus)}>
                          {TITLE_STATUS_LABELS[titleStatus] ?? titleStatus}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className={tableCellCompact}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className={tableCellCompact}>{daysSinceDelivery(row.deliveredAt)}</TableCell>
                      <TableCell className={tableCellCompact}>
                        {(signalsByDealId.get(row.id)?.length ?? 0) > 0 ? (
                          <SignalBlockerInline items={signalsByDealId.get(row.id) ?? []} maxCount={3} />
                        ) : null}
                      </TableCell>
                      <TableCell className={tableCellCompact}>
                        <RowActions>
                          <Link href={getDealQueueHref(row.id, "title-dmv")}>
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
