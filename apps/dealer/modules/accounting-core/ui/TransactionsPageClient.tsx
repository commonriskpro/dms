"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type TransactionItem = {
  id: string;
  referenceType: string;
  referenceId: string | null;
  memo: string | null;
  postedAt: string | null;
  createdAt: string;
  entries?: { id: string; direction: string; amountCents: string; accountId: string }[];
};

export function TransactionsPageClient() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");

  const [list, setList] = React.useState<TransactionItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [exportFrom, setExportFrom] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = React.useState(false);

  const fetchList = React.useCallback(
    async (offset = 0) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          data: TransactionItem[];
          meta: { total: number; limit: number; offset: number };
        }>(`/api/accounting/transactions?limit=25&offset=${offset}`);
        setList(res.data ?? []);
        setMeta(res.meta ?? { total: 0, limit: 25, offset });
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [canRead]
  );

  React.useEffect(() => {
    if (!canRead) setLoading(false);
    else fetchList(0);
  }, [canRead, fetchList]);

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--muted-text)]">You don&apos;t have permission to view transactions.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState message={error} />
        </CardContent>
      </Card>
    );
  }

  const handleExport = async () => {
    if (!canRead) return;
    setExporting(true);
    try {
      const url = `/api/accounting/export?from=${encodeURIComponent(exportFrom)}&to=${encodeURIComponent(exportTo)}&format=csv`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `accounting-export-${exportFrom}-${exportTo}.csv`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transactions</CardTitle>
        <p className="text-sm text-[var(--text-soft)]">General ledger transactions. Create and post via API or future UI.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : list.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">No transactions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.referenceType}{row.referenceId ? ` · ${row.referenceId.slice(0, 8)}…` : ""}</TableCell>
                  <TableCell className="text-[var(--text-soft)]">{row.memo ?? "—"}</TableCell>
                  <TableCell>{row.postedAt ? new Date(row.postedAt).toLocaleDateString() : "Draft"}</TableCell>
                  <TableCell className="text-[var(--text-soft)]">{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>

    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Export</CardTitle>
        <p className="text-sm text-[var(--text-soft)]">Download posted transactions as CSV (date range).</p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <Input label="From" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
        <Input label="To" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Download CSV"}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
