"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { formatCents } from "@/lib/money";
import {
  getDateRangeForPreset,
  REPORTS_DEFAULT_TIMEZONE,
  type DateRangePreset,
} from "@/lib/reports/date-range";
import { DateRangePicker } from "@/modules/reports/ui/components/DateRangePicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const TIMEZONE = REPORTS_DEFAULT_TIMEZONE;

type InventoryRoiReport = {
  summary: {
    totalPurchaseCostCents: string;
    totalSalePriceCents: string;
    totalGrossProfitCents: string;
    vehicleCount: number;
    avgDaysInStock: number;
  };
  rows: {
    vehicleId: string;
    dealId: string;
    stockNumber: string;
    vin: string | null;
    purchaseCostCents: string;
    reconCostCents: string;
    salePriceCents: string;
    grossProfitCents: string;
    daysInStock: number;
    soldAt: string;
  }[];
};

function downloadCsv(rows: InventoryRoiReport["rows"], from: string, to: string) {
  const header = "Sold At,Stock,VIN,Purchase Cost,Recon,Sale Price,Gross Profit,Days in Stock";
  const lines = [
    header,
    ...rows.map((r) =>
      [
        r.soldAt,
        r.stockNumber,
        r.vin ?? "",
        r.purchaseCostCents,
        r.reconCostCents,
        r.salePriceCents,
        r.grossProfitCents,
        r.daysInStock,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-roi-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InventoryRoiReportPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const [preset, setPreset] = React.useState<DateRangePreset>("last30");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const range = React.useMemo(
    () => getDateRangeForPreset(preset, customFrom || undefined, customTo || undefined, TIMEZONE),
    [preset, customFrom, customTo]
  );
  const [report, setReport] = React.useState<InventoryRoiReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchReport = React.useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/reports/inventory-roi?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      const data = await apiFetch<InventoryRoiReport>(url);
      setReport(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [canRead, range.from, range.to]);

  React.useEffect(() => {
    if (!canRead) return;
    fetchReport();
  }, [canRead, fetchReport]);

  const handleRangeChange = React.useCallback(
    (p: { from: string; to: string; preset: DateRangePreset; customFrom?: string; customTo?: string }) => {
      setPreset(p.preset);
      setCustomFrom(p.customFrom ?? "");
      setCustomTo(p.customTo ?? "");
    },
    []
  );

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--text-soft)]">You don&apos;t have permission to view this report.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[var(--text)]">Inventory ROI Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            from={range.from}
            to={range.to}
            preset={preset}
            customFrom={customFrom}
            customTo={customTo}
            onRangeChange={handleRangeChange}
            timezone={TIMEZONE}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => report?.rows && downloadCsv(report.rows, range.from, range.to)}
            disabled={!report?.rows?.length}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      {loading && <Skeleton className="h-48 w-full" />}

      {report && !loading && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Total purchase cost</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{formatCents(report.summary.totalPurchaseCostCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Total sale price</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{formatCents(report.summary.totalSalePriceCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Total gross profit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{formatCents(report.summary.totalGrossProfitCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Avg days in stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{report.summary.avgDaysInStock}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sold vehicles</CardTitle>
              <p className="text-sm text-[var(--text-soft)]">{report.summary.vehicleCount} vehicles</p>
            </CardHeader>
            <CardContent>
              {report.rows.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No sold vehicles in range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sold</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>VIN</TableHead>
                      <TableHead>Purchase</TableHead>
                      <TableHead>Recon</TableHead>
                      <TableHead>Sale price</TableHead>
                      <TableHead>Gross profit</TableHead>
                      <TableHead>Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((r) => (
                      <TableRow key={r.dealId}>
                        <TableCell>{r.soldAt}</TableCell>
                        <TableCell>{r.stockNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{r.vin ?? "—"}</TableCell>
                        <TableCell>{formatCents(r.purchaseCostCents)}</TableCell>
                        <TableCell>{formatCents(r.reconCostCents)}</TableCell>
                        <TableCell>{formatCents(r.salePriceCents)}</TableCell>
                        <TableCell>{formatCents(r.grossProfitCents)}</TableCell>
                        <TableCell>{r.daysInStock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
