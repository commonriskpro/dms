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
import { Select, type SelectOption } from "@/components/ui/select";
import { MutationButton } from "@/components/write-guard";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
const TYPE_LABELS: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

type AccountItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const typeOptions: SelectOption[] = ACCOUNT_TYPES.map((t) => ({
  value: t,
  label: TYPE_LABELS[t] ?? t,
}));

export function AccountsPageClient() {
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const canWrite = hasPermission("finance.submissions.write");

  const [list, setList] = React.useState<AccountItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createCode, setCreateCode] = React.useState("");
  const [createName, setCreateName] = React.useState("");
  const [createType, setCreateType] = React.useState<string>("ASSET");
  const [createSubmitting, setCreateSubmitting] = React.useState(false);

  const fetchList = React.useCallback(
    async (offset = 0) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          data: AccountItem[];
          meta: { total: number; limit: number; offset: number };
        }>(`/api/accounting/accounts?limit=25&offset=${offset}`);
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
    if (!canWrite || !createCode.trim() || !createName.trim()) return;
    setCreateSubmitting(true);
    try {
      await apiFetch("/api/accounting/accounts", {
        method: "POST",
        body: JSON.stringify({ code: createCode.trim(), name: createName.trim(), type: createType }),
      });
      addToast("success", "Account created");
      setCreateOpen(false);
      setCreateCode("");
      setCreateName("");
      setCreateType("ASSET");
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
          <p className="text-sm text-[var(--muted-text)]">You don&apos;t have permission to view accounts.</p>
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
            <CardTitle className="text-base">Chart of accounts</CardTitle>
            <p className="text-sm text-[var(--text-soft)]">General ledger accounts.</p>
          </div>
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
              Add account
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : list.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No accounts. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{TYPE_LABELS[row.type] ?? row.type}</TableCell>
                    <TableCell>{row.isActive ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>Create a new ledger account. Code must be unique per dealership.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            label="Code"
            value={createCode}
            onChange={(e) => setCreateCode(e.target.value)}
            placeholder="e.g. 1000"
          />
          <Input
            label="Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Account name"
          />
          <Select
            label="Type"
            options={typeOptions}
            value={createType}
            onChange={setCreateType}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!createCode.trim() || !createName.trim() || createSubmitting}>
            {createSubmitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
