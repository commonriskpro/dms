"use client";

import { useCallback, useEffect, useState } from "react";
import {
  platformFetch,
  type AccountsListRes,
  type ListMeta,
  type ApiError,
} from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { useToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "SUSPENDED", label: "SUSPENDED" },
];

const LIMIT = 25;

export default function PlatformAccountsPage() {
  const { userId, role } = usePlatformAuthContext();
  const [data, setData] = useState<AccountsListRes | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", status: "ACTIVE" as string });
  const toast = useToast();

  const isOwner = role === "PLATFORM_OWNER";

  const refetch = useCallback(() => setListVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      limit: String(LIMIT),
      offset: String(offset),
    };
    if (status) params.status = status;
    platformFetch<AccountsListRes>("/api/platform/accounts", {
      params,
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setData(res.data);
          setMeta(res.data.meta);
        } else {
          setError(res.error);
          if (res.status === 403) setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [offset, status, userId, listVersion]);

  const handleCreate = async () => {
    const name = createForm.name.trim();
    const email = createForm.email.trim();
    if (!name || !email) return;
    setCreateLoading(true);
    const res = await platformFetch<{ id: string; name: string; email: string; status: string }>(
      "/api/platform/accounts",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          status: createForm.status || "ACTIVE",
        }),
        platformUserId: userId ?? undefined,
      }
    );
    setCreateLoading(false);
    if (res.ok) {
      toast("Account created", "success");
      setCreateOpen(false);
      setCreateForm({ name: "", email: "", status: "ACTIVE" });
      refetch();
    } else {
      toast(res.error.message, "error");
    }
  };

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">You do not have access.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Platform accounts</h1>
        {isOwner && (
          <Button onClick={() => setCreateOpen(true)}>Create account</Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--text-soft)]">
          {error.message}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Accounts</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              className="w-[140px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data ? null : data.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-soft)]">
              No platform accounts found.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-[var(--text-soft)]">{a.email}</TableCell>
                      <TableCell>{a.status}</TableCell>
                      <TableCell className="text-[var(--text-soft)]">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta && meta.total > LIMIT && (
                <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
                  <p className="text-sm text-[var(--text-soft)]">
                    Showing {offset + 1}–{Math.min(offset + LIMIT, meta.total)} of {meta.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={offset + LIMIT >= meta.total}
                      onClick={() => setOffset((o) => o + LIMIT)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Create platform account</DialogTitle>
          <DialogDescription>
            Add a new platform account. Account status can be ACTIVE or SUSPENDED.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Name</label>
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Account name"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Email</label>
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Status</label>
            <Select
              value={createForm.status}
              onChange={(v) => setCreateForm((f) => ({ ...f, status: v }))}
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "SUSPENDED", label: "SUSPENDED" },
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createLoading || !createForm.name.trim() || !createForm.email.trim()}
          >
            {createLoading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
