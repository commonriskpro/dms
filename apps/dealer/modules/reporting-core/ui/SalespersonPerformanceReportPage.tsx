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
import { Pagination } from "@/components/pagination";

const TIMEZONE = REPORTS_DEFAULT_TIMEZONE;
const PAGE_SIZE = 25;

type SalespersonPerformanceReport = {
  data: {
    salespersonId: string | null;
    salespersonName: string | null;
    dealsClosed: number;
    grossProfitCents: string;
    averageProfitPerDealCents: string;
  }[];
  meta: { total: number; limit: number; offset: number };
};

function downloadCsv(data: SalespersonPerformanceReport["data"], from: string, to: string) {
  const header = "Salesperson,Deals closed,Gross profit,Avg per deal";
  const lines = [
    header,
    ...data.map((r) =>
      [
        r.salespersonName ?? "Unknown",
        r.dealsClosed,
        r.grossProfitCents,
        r.averageProfitPerDealCents,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salesperson-performance-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SalespersonPerformanceReportPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const [preset, setPreset] = React.useState<DateRangePreset>("last30");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const range = React.useMemo(
    () => getDateRangeForPreset(preset, customFrom || undefined, customTo || undefined, TIMEZONE),
    [preset, customFrom, customTo]
  );
  const [report, setReport] = React.useState<SalespersonPerformanceReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchReport = React.useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/reports/salesperson-performance?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=${PAGE_SIZE}&offset=${offset}`;
      const data = await apiFetch<SalespersonPerformanceReport>(url);
      setReport(data);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [canRead, range.from, range.to, offset]);

  React.useEffect(() => {
    if (!canRead) return;
    fetchReport();
  }, [canRead, fetchReport]);

  const handleRangeChange = React.useCallback(
    (p: { from: string; to: string; preset: DateRangePreset; customFrom?: string; customTo?: string }) => {
      setPreset(p.preset);
      setCustomFrom(p.customFrom ?? "");
      setCustomTo(p.customTo ?? "");
      setOffset(0);
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
        <h1 className="text-xl font-semibold text-[var(--text)]">Salesperson Performance</h1>
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
            onClick={() => report?.data && downloadCsv(report.data, range.from, range.to)}
            disabled={!report?.data?.length}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      {loading && <Skeleton className="h-48 w-full" />}

      {report && !loading && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance by salesperson</CardTitle>
              <p className="text-sm text-[var(--text-soft)]">{report.meta.total} salesperson(s)</p>
            </CardHeader>
            <CardContent>
              {report.data.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No data in range.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Salesperson</TableHead>
                        <TableHead>Deals closed</TableHead>
                        <TableHead>Gross profit</TableHead>
                        <TableHead>Avg per deal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.data.map((r) => (
                        <TableRow key={r.salespersonId ?? "__null__"}>
                          <TableCell className="font-medium">{r.salespersonName ?? "—"}</TableCell>
                          <TableCell>{r.dealsClosed}</TableCell>
                          <TableCell>{formatCents(r.grossProfitCents)}</TableCell>
                          <TableCell>{formatCents(r.averageProfitPerDealCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination
                    meta={{ total: report.meta.total, limit: report.meta.limit, offset: report.meta.offset }}
                    onPageChange={(newOffset) => setOffset(newOffset)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
