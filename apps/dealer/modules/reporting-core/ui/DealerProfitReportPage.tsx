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

type DealerProfitReport = {
  summary: { totalGrossCents: string; totalNetCents: string; dealCount: number };
  byMonth: { month: string; dealCount: number; totalGrossCents: string }[];
  bySalesperson: { salespersonId: string | null; salespersonName: string | null; dealCount: number; totalGrossCents: string }[];
  rows: { dealId: string; soldAt: string; salespersonName: string | null; frontGrossCents: string; backGrossCents: string; totalGrossCents: string }[];
};

function downloadCsv(rows: DealerProfitReport["rows"], from: string, to: string) {
  const header = "Date,Deal ID,Salesperson,Front Gross,Back Gross,Total Gross";
  const lines = [
    header,
    ...rows.map((r) =>
      [r.soldAt, r.dealId, r.salespersonName ?? "", r.frontGrossCents, r.backGrossCents, r.totalGrossCents].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dealer-profit-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DealerProfitReportPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const [preset, setPreset] = React.useState<DateRangePreset>("last30");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const range = React.useMemo(
    () => getDateRangeForPreset(preset, customFrom || undefined, customTo || undefined, TIMEZONE),
    [preset, customFrom, customTo]
  );
  const [report, setReport] = React.useState<DealerProfitReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchReport = React.useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/reports/dealer-profit?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      const data = await apiFetch<DealerProfitReport>(url);
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
        <h1 className="text-xl font-semibold text-[var(--text)]">Dealer Profit Report</h1>
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
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Total Gross</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCents(report.summary.totalGrossCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Total Net</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCents(report.summary.totalNetCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{report.summary.dealCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profit by deal</CardTitle>
            </CardHeader>
            <CardContent>
              {report.rows.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No deals in range.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Deal ID</TableHead>
                      <TableHead>Salesperson</TableHead>
                      <TableHead>Front gross</TableHead>
                      <TableHead>Back gross</TableHead>
                      <TableHead>Total gross</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((r) => (
                      <TableRow key={r.dealId}>
                        <TableCell>{r.soldAt}</TableCell>
                        <TableCell className="font-mono text-xs">{r.dealId.slice(0, 8)}…</TableCell>
                        <TableCell>{r.salespersonName ?? "—"}</TableCell>
                        <TableCell>{formatCents(r.frontGrossCents)}</TableCell>
                        <TableCell>{formatCents(r.backGrossCents)}</TableCell>
                        <TableCell>{formatCents(r.totalGrossCents)}</TableCell>
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
