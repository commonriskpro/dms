"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MutationButton } from "@/components/write-guard";
import { formatCents } from "@/lib/money";

type ExpenseItem = {
  id: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amountCents: string;
  incurredOn: string;
  status: string;
  dealId: string | null;
  vehicleId: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = { OPEN: "Open", POSTED: "Posted", VOID: "Void" };

export function ExpensesPageClient() {
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const canWrite = hasPermission("finance.submissions.write");

  const [list, setList] = React.useState<ExpenseItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createCategory, setCreateCategory] = React.useState("");
  const [createVendor, setCreateVendor] = React.useState("");
  const [createDescription, setCreateDescription] = React.useState("");
  const [createAmount, setCreateAmount] = React.useState("");
  const [createIncurredOn, setCreateIncurredOn] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [createSubmitting, setCreateSubmitting] = React.useState(false);

  const fetchList = React.useCallback(
    async (offset = 0) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          data: ExpenseItem[];
          meta: { total: number; limit: number; offset: number };
        }>(`/api/expenses?limit=25&offset=${offset}`);
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

  const handleCreate = async () => {
    if (!canWrite || !createCategory.trim()) return;
    const amountCents = Math.round(parseFloat(createAmount || "0") * 100);
    if (Number.isNaN(amountCents) || amountCents < 0) {
      addToast("error", "Enter a valid amount");
      return;
    }
    setCreateSubmitting(true);
    try {
      await apiFetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          category: createCategory.trim(),
          vendor: createVendor.trim() || null,
          description: createDescription.trim() || null,
          amountCents: String(amountCents),
          incurredOn: new Date(createIncurredOn).toISOString(),
        }),
      });
      addToast("success", "Expense created");
      setCreateOpen(false);
      setCreateCategory("");
      setCreateVendor("");
      setCreateDescription("");
      setCreateAmount("");
      setCreateIncurredOn(new Date().toISOString().slice(0, 10));
      fetchList(meta.offset);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--muted-text)]">You don&apos;t have permission to view expenses.</p>
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Expenses</CardTitle>
            <p className="text-sm text-[var(--text-soft)]">Dealership expense tracking.</p>
          </div>
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
              Add expense
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : list.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No expenses. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell className="text-[var(--text-soft)]">{row.vendor ?? "—"}</TableCell>
                    <TableCell>{formatCents(row.amountCents)}</TableCell>
                    <TableCell>{row.incurredOn}</TableCell>
                    <TableCell>{STATUS_LABELS[row.status] ?? row.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>New expense</DialogTitle>
          <DialogDescription>Record a dealership expense. Amount in dollars.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input label="Category" value={createCategory} onChange={(e) => setCreateCategory(e.target.value)} placeholder="e.g. Advertising" />
          <Input label="Vendor" value={createVendor} onChange={(e) => setCreateVendor(e.target.value)} placeholder="Optional" />
          <Input label="Description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Optional" />
          <Input label="Amount ($)" type="number" step="0.01" value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} placeholder="0.00" />
          <Input label="Date" type="date" value={createIncurredOn} onChange={(e) => setCreateIncurredOn(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!createCategory.trim() || createSubmitting}>
            {createSubmitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
