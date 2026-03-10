"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "@/contexts/session-context";
import { apiFetch } from "@/lib/client/http";
import { formatCents } from "@/lib/money";
import {
  getDateRangeForPreset,
  REPORTS_DEFAULT_TIMEZONE,
  type DateRangePreset,
} from "@/lib/reports/date-range";
import type {
  SalesSummaryResponse,
  SalesByUserResponse,
  InventoryAgingResponse,
  FinancePenetrationResponse,
  MixResponse,
  PipelineResponse,
} from "@/lib/types/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { DateRangePicker } from "./components/DateRangePicker";
import { ExportButtons } from "./components/ExportButtons";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

const TIMEZONE = REPORTS_DEFAULT_TIMEZONE;
const SALES_BY_USER_PAGE_SIZE = 25;
const ReportsChartsRow = dynamic(
  () => import("./components/ReportsChartsRow").then((m) => m.ReportsChartsRow),
  {
    ssr: false,
    loading: () => <ReportsChartsRowSkeleton />,
  }
);

/** Permission gate: when false, no report API fetches must be triggered. Used by tests to assert no fetch when !reports.read. */
export function shouldFetchReports(canRead: boolean): boolean {
  return canRead;
}

type WidgetState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function ReportsPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("reports.read");
  const canExport = hasPermission("reports.export");
  const canFinanceReports = hasPermission("finance.submissions.read");

  const [preset, setPreset] = React.useState<DateRangePreset>("last30");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const range = React.useMemo(
    () =>
      getDateRangeForPreset(preset, customFrom || undefined, customTo || undefined, TIMEZONE),
    [preset, customFrom, customTo]
  );
  const debouncedFrom = useDebounce(range.from, 300);
  const debouncedTo = useDebounce(range.to, 300);
  const asOf = range.to;

  const [salesSummary, setSalesSummary] =
    React.useState<WidgetState<SalesSummaryResponse["data"]>>({ status: "idle" });
  const [salesByUser, setSalesByUser] =
    React.useState<WidgetState<SalesByUserResponse>>({ status: "idle" });
  const [inventoryAging, setInventoryAging] =
    React.useState<WidgetState<InventoryAgingResponse["data"]>>({ status: "idle" });
  const [financePenetration, setFinancePenetration] =
    React.useState<WidgetState<FinancePenetrationResponse["data"]>>({
      status: "idle",
    });
  const [mix, setMix] = React.useState<WidgetState<MixResponse["data"]>>({
    status: "idle",
  });
  const [pipeline, setPipeline] =
    React.useState<WidgetState<PipelineResponse["data"]>>({ status: "idle" });

  const [salesByUserOffset, setSalesByUserOffset] = React.useState(0);

  const fetchAll = React.useCallback(() => {
    if (!shouldFetchReports(canRead)) return;
    setSalesSummary({ status: "loading" });
    setSalesByUser({ status: "loading" });
    setInventoryAging({ status: "loading" });
    setFinancePenetration({ status: "loading" });
    setMix({ status: "loading" });
    setPipeline({ status: "loading" });

    const params = (from: string, to: string) =>
      `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timezone=${encodeURIComponent(TIMEZONE)}`;
    const salesSummaryUrl = `/api/reports/sales-summary?${params(debouncedFrom, debouncedTo)}&groupBy=none`;
    const salesByUserUrl = `/api/reports/sales-by-user?${params(debouncedFrom, debouncedTo)}&limit=${SALES_BY_USER_PAGE_SIZE}&offset=${salesByUserOffset}`;
    const inventoryAgingUrl = `/api/reports/inventory-aging?asOf=${encodeURIComponent(asOf)}&timezone=${encodeURIComponent(TIMEZONE)}`;
    const financePenetrationUrl = `/api/reports/finance-penetration?${params(debouncedFrom, debouncedTo)}`;
    const mixUrl = `/api/reports/mix?${params(debouncedFrom, debouncedTo)}`;
    const pipelineUrl = `/api/reports/pipeline?${params(debouncedFrom, debouncedTo)}&groupBy=day`;

    Promise.all([
      apiFetch<SalesSummaryResponse>(salesSummaryUrl).then((r) => r.data),
      apiFetch<SalesByUserResponse>(salesByUserUrl),
      apiFetch<InventoryAgingResponse>(inventoryAgingUrl).then((r) => r.data),
      apiFetch<FinancePenetrationResponse>(financePenetrationUrl).then(
        (r) => r.data
      ),
      apiFetch<MixResponse>(mixUrl).then((r) => r.data),
      apiFetch<PipelineResponse>(pipelineUrl).then((r) => r.data),
    ])
      .then(([summary, byUser, aging, penetration, mixData, pipelineData]) => {
        setSalesSummary({ status: "success", data: summary });
        setSalesByUser({ status: "success", data: byUser });
        setInventoryAging({ status: "success", data: aging });
        setFinancePenetration({ status: "success", data: penetration });
        setMix({ status: "success", data: mixData });
        setPipeline({ status: "success", data: pipelineData });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load reports";
        setSalesSummary({ status: "error", message: msg });
        setSalesByUser({ status: "error", message: msg });
        setInventoryAging({ status: "error", message: msg });
        setFinancePenetration({ status: "error", message: msg });
        setMix({ status: "error", message: msg });
        setPipeline({ status: "error", message: msg });
      });
  }, [
    canRead,
    debouncedFrom,
    debouncedTo,
    asOf,
    salesByUserOffset,
  ]);

  React.useEffect(() => {
    if (!shouldFetchReports(canRead)) return;
    fetchAll();
  }, [canRead, fetchAll]);

  const handleRangeChange = React.useCallback(
    (p: {
      from: string;
      to: string;
      preset: DateRangePreset;
      customFrom?: string;
      customTo?: string;
    }) => {
      setPreset(p.preset);
      setCustomFrom(p.customFrom ?? "");
      setCustomTo(p.customTo ?? "");
    },
    []
  );

  if (!canRead) {
    return (
      <PageShell>
        <PageHeader title="Reports" description="Operational and performance insights." />
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">
            You don&apos;t have access to reports.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational and performance insights."
        actions={(
          <div className="flex flex-wrap items-center gap-4">
            <DateRangePicker
              from={range.from}
              to={range.to}
              preset={preset}
              customFrom={customFrom}
              customTo={customTo}
              onRangeChange={handleRangeChange}
              timezone={TIMEZONE}
            />
            <ExportButtons
              canExport={canExport}
              dateFrom={debouncedFrom}
              dateTo={debouncedTo}
              asOf={asOf}
            />
          </div>
        )}
      />

      {canFinanceReports && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-sm font-medium text-[var(--text)]">Finance reports</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/reports/profit"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Dealer profit
            </Link>
            <Link
              href="/reports/inventory-roi"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Inventory ROI
            </Link>
            <Link
              href="/reports/salespeople"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Salesperson performance
            </Link>
          </div>
        </div>
      )}

      {/* Top row cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Contracted deals"
          state={salesSummary}
          render={(d) => d.totalDealsCount.toLocaleString()}
        />
        <SummaryCard
          title="Sales volume"
          state={salesSummary}
          render={(d) => formatCents(d.totalSaleVolumeCents)}
        />
        <SummaryCard
          title="Front gross"
          state={salesSummary}
          render={(d) => formatCents(d.totalFrontGrossCents)}
        />
        <FinancePenetrationCard state={financePenetration} />
      </div>

      {/* Charts row (lazy-loaded to defer recharts bundle work) */}
      <ReportsChartsRow
        pipelineState={pipeline}
        salesSummaryState={salesSummary}
        mixState={mix}
        onRetry={fetchAll}
      />

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SalesByUserTable
          state={salesByUser}
          onRetry={fetchAll}
          onPageChange={(offset) => setSalesByUserOffset(offset)}
        />
        <InventoryAgingCard
          state={inventoryAging}
          asOf={asOf}
          onRetry={fetchAll}
        />
      </div>
    </PageShell>
  );
}

function SummaryCard({
  title,
  state,
  render,
}: {
  title: string;
  state: WidgetState<SalesSummaryResponse["data"]>;
  render: (data: SalesSummaryResponse["data"]) => React.ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--danger)]">{state.message}</p>
        </CardContent>
      </Card>
    );
  }
  if (state.status === "success") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-[var(--text)]">
            {render(state.data)}
          </p>
        </CardContent>
      </Card>
    );
  }
  return null;
}

function FinancePenetrationCard({
  state,
}: {
  state: WidgetState<FinancePenetrationResponse["data"]>;
}) {
  const title = "Finance penetration";
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--danger)]">{state.message}</p>
        </CardContent>
      </Card>
    );
  }
  if (state.status === "success") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-[var(--text)]">
            {state.data.financePenetrationPercent}%
          </p>
        </CardContent>
      </Card>
    );
  }
  return null;
}

function ReportsChartsRowSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals trend</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Front gross</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash vs finance mix</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function SalesByUserTable({
  state,
  onRetry,
  onPageChange,
}: {
  state: WidgetState<SalesByUserResponse>;
  onRetry: () => void;
  onPageChange: (offset: number) => void;
}) {
  const meta = state.status === "success" ? state.data.meta : { total: 0, limit: 25, offset: 0 };
  const rows = React.useMemo(() => {
    const data = state.status === "success" ? state.data.data : [];
    return data.map((r) => ({
      ...r,
      avgGrossCents:
        r.dealCount > 0
          ? String(Math.round(Number(r.frontGrossCents) / r.dealCount))
          : "0",
    }));
  }, [state]);
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales by user</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales by user</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message={state.message} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }
  if (state.status !== "success") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales by user</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Deals</TableHead>
              <TableHead className="text-right">Sales volume</TableHead>
              <TableHead className="text-right">Front gross</TableHead>
              <TableHead className="text-right">Avg gross</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[var(--text-soft)]">
                  No data for this range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={r.userId ?? i}>
                  <TableCell>
                    {r.displayName ?? (r.userId ? r.userId.slice(0, 8) : "—")}
                  </TableCell>
                  <TableCell className="text-right">{r.dealCount}</TableCell>
                  <TableCell className="text-right">
                    {formatCents(r.saleVolumeCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCents(r.frontGrossCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCents(r.avgGrossCents)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {rows.length > 0 && (
          <div className="p-4 border-t border-[var(--border)]">
            <Pagination
              meta={meta}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryAgingCard({
  state,
  asOf,
  onRetry,
}: {
  state: WidgetState<InventoryAgingResponse["data"]>;
  asOf: string;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory aging</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory aging</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message={state.message} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }
  if (state.status !== "success") return null;
  const d = state.data;
  const buckets = [
    { label: "0–15 days", count: d.agingBuckets.bucket0_15 },
    { label: "16–30 days", count: d.agingBuckets.bucket16_30 },
    { label: "31–60 days", count: d.agingBuckets.bucket31_60 },
    { label: "61–90 days", count: d.agingBuckets.bucket61_90 },
    { label: "90+ days", count: d.agingBuckets.bucket90Plus },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Inventory aging</CardTitle>
        <span className="text-xs text-[var(--text-soft)]">As of {asOf}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {d.byStatus.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.byStatus.map((s) => (
              <span
                key={s.status}
                className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text)]"
              >
                {s.status}: {s.count}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-[var(--text-soft)]">
          Avg days in inventory: <strong className="text-[var(--text)]">{d.averageDaysInInventory}</strong>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => (
              <TableRow key={b.label}>
                <TableCell>{b.label}</TableCell>
                <TableCell className="text-right">{b.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Total inventory value:{" "}
            <strong className="text-[var(--text)]">
              {formatCents(d.totalInventoryValueCents)}
            </strong>
          </span>
          {d.totalListPriceCents != null && (
            <span>
              Total list price:{" "}
              <strong className="text-[var(--text)]">
                {formatCents(d.totalListPriceCents)}
              </strong>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
