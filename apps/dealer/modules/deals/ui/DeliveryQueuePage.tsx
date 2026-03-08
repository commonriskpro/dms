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
  tableHeadCell,
  tableCell,
  tablePaginationFooter,
} from "@/lib/ui/recipes/table";

type DeliveryDealItem = {
  id: string;
  customerId: string;
  createdAt: string;
  deliveryStatus?: string | null;
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
};

type Response = { data: DeliveryDealItem[]; meta: { total: number; limit: number; offset: number } };
type QueueState = "loading" | "error" | "empty" | "default";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "not_set", label: "Not set" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
];

function statusVariant(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (status.includes("deliver")) return "success";
  if (status.includes("ready")) return "info";
  if (status.includes("hold") || status.includes("issue")) return "warning";
  return "neutral";
}

function vehicleDisplay(v: DeliveryDealItem["vehicle"]): string {
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.stockNumber || "—";
}

export function DeliveryQueuePage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("deals.read");
  const [data, setData] = React.useState<DeliveryDealItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ limit: "25", offset: String(meta.offset) });
    const res = await apiFetch<Response>(`/api/deals/delivery?${params.toString()}`);
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

  if (!canRead) {
    return (
      <QueueLayout
        title="Delivery queue"
        description="Track post-contract delivery readiness."
        table={
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-[var(--text-soft)]">You don&apos;t have access to deals.</p>
          </div>
        }
      />
    );
  }

  const filtered = data.filter((row) => {
    const status = (row.deliveryStatus ?? "").toLowerCase();
    const vehicle = vehicleDisplay(row.vehicle).toLowerCase();
    const customer = (row.customer?.name ?? row.customerId).toLowerCase();
    const matchesSearch =
      search.trim().length === 0 ||
      customer.includes(search.toLowerCase()) ||
      vehicle.includes(search.toLowerCase()) ||
      row.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "" ||
      (statusFilter === "not_set" && !status) ||
      status.includes(statusFilter);
    return matchesSearch && matchesStatus;
  });
  const deliveredCount = data.filter((row) => row.deliveredAt != null).length;
  const readyCount = data.filter((row) => (row.deliveryStatus ?? "").toLowerCase().includes("ready")).length;
  const activeCount = Math.max(meta.total - deliveredCount, 0);
  const state: QueueState = loading ? "loading" : error ? "error" : filtered.length === 0 ? "empty" : "default";

  return (
    <QueueLayout
      title="Delivery queue"
      description="Shared queue view for deals in delivery workflow."
      kpis={
        <QueueKpiStrip
          items={[
            { label: "In queue", value: meta.total.toLocaleString(), hint: "Current records in delivery queue" },
            { label: "Ready now", value: readyCount.toLocaleString(), hint: "Marked ready for delivery" },
            { label: "Open follow-up", value: activeCount.toLocaleString(), hint: "Not yet marked delivered" },
          ]}
        />
      }
      filters={
        <TableToolbar
          search={(
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, vehicle, or deal"
              aria-label="Search delivery queue"
            />
          )}
          filters={(
            <Select
              label="Status"
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
          emptyTitle="No deals ready for delivery"
          emptyDescription="Deals will appear when they are marked ready for delivery."
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
                  <TableHead className={tableHeadCell}><ColumnHeader>Customer</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCell}><ColumnHeader>Vehicle</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCell}><ColumnHeader>Contract date</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCell}><ColumnHeader>Delivery status</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCell}><ColumnHeader>SLA start</ColumnHeader></TableHead>
                  <TableHead className={tableHeadCell}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const statusLabel = row.deliveryStatus ?? "Not set";
                  return (
                    <TableRow key={row.id} className={tableRowHover}>
                      <TableCell className={tableCell}>{row.customer?.name ?? row.customerId.slice(0, 8)}</TableCell>
                      <TableCell className={tableCell}>{vehicleDisplay(row.vehicle)}</TableCell>
                      <TableCell className={tableCell}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className={tableCell}>
                        <StatusBadge variant={statusVariant(statusLabel.toLowerCase())}>{statusLabel}</StatusBadge>
                      </TableCell>
                      <TableCell className={tableCell}>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className={tableCell}>
                        <RowActions>
                          <Link href={`/deals/${row.id}`}>
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
