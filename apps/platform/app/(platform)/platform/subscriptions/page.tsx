"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  platformFetch,
  type SubscriptionsListRes,
  type SubscriptionListItem,
  type ListMeta,
  type ApiError,
  type DealershipsListRes,
} from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { useToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const BILLING_STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "TRIAL", label: "TRIAL" },
  { value: "PAST_DUE", label: "PAST_DUE" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const PLAN_OPTIONS: SelectOption[] = [
  { value: "STARTER", label: "STARTER" },
  { value: "PRO", label: "PRO" },
  { value: "ENTERPRISE", label: "ENTERPRISE" },
];

const LIMIT = 25;

export default function PlatformSubscriptionsPage() {
  const { userId, role } = usePlatformAuthContext();
  const [data, setData] = useState<SubscriptionsListRes | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [billingStatus, setBillingStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    dealershipId: "",
    plan: "STARTER",
    billingStatus: "TRIAL",
  });
  const [editSub, setEditSub] = useState<SubscriptionListItem | null>(null);
  const [editForm, setEditForm] = useState({ plan: "", billingStatus: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [dealerships, setDealerships] = useState<DealershipsListRes | null>(null);
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
    if (billingStatus) params.billingStatus = billingStatus;
    platformFetch<SubscriptionsListRes>("/api/platform/subscriptions", {
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
  }, [offset, billingStatus, userId, listVersion]);

  useEffect(() => {
    if (!createOpen || !userId) return;
    platformFetch<DealershipsListRes>("/api/platform/dealerships", {
      params: { limit: "100", offset: "0" },
      platformUserId: userId,
    }).then((res) => {
      if (res.ok) setDealerships(res.data);
    });
  }, [createOpen, userId]);

  const handleCreate = async () => {
    const dealershipId = createForm.dealershipId.trim();
    if (!dealershipId) return;
    setCreateLoading(true);
    const res = await platformFetch<{ id: string }>("/api/platform/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        dealershipId,
        plan: createForm.plan,
        billingStatus: createForm.billingStatus,
      }),
      platformUserId: userId ?? undefined,
    });
    setCreateLoading(false);
    if (res.ok) {
      toast("Subscription created", "success");
      setCreateOpen(false);
      setCreateForm({ dealershipId: "", plan: "STARTER", billingStatus: "TRIAL" });
      refetch();
    } else {
      toast(res.error.message, "error");
    }
  };

  const openEdit = (sub: SubscriptionListItem) => {
    setEditSub(sub);
    setEditForm({ plan: sub.plan, billingStatus: sub.billingStatus });
  };

  const handleEdit = async () => {
    if (!editSub) return;
    setEditLoading(true);
    const res = await platformFetch<{ id: string }>(
      `/api/platform/subscriptions/${editSub.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          plan: editForm.plan,
          billingStatus: editForm.billingStatus,
        }),
        platformUserId: userId ?? undefined,
      }
    );
    setEditLoading(false);
    if (res.ok) {
      toast("Subscription updated", "success");
      setEditSub(null);
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
        <h1 className="text-2xl font-semibold text-[var(--text)]">Subscriptions</h1>
        {isOwner && (
          <Button onClick={() => setCreateOpen(true)}>Create subscription</Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--text-soft)]">
          {error.message}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Subscriptions</CardTitle>
          <Select
            value={billingStatus}
            onChange={setBillingStatus}
            options={BILLING_STATUS_OPTIONS}
            className="w-[160px]"
          />
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
              No subscriptions found.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealership</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Billing status</TableHead>
                    <TableHead>Period end</TableHead>
                    <TableHead>Created</TableHead>
                    {isOwner && <TableHead aria-hidden />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/platform/dealerships/${s.dealershipId}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {s.dealershipName}
                        </Link>
                      </TableCell>
                      <TableCell>{s.plan}</TableCell>
                      <TableCell>{s.billingStatus}</TableCell>
                      <TableCell className="text-[var(--text-soft)]">
                        {s.currentPeriodEnd
                          ? new Date(s.currentPeriodEnd).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[var(--text-soft)]">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                            Change plan
                          </Button>
                        </TableCell>
                      )}
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
          <DialogTitle>Create subscription</DialogTitle>
          <DialogDescription>
            Create a subscription for a dealership. The dealership must exist and must not already have a subscription.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Dealership</label>
            <Select
              value={createForm.dealershipId}
              onChange={(v) => setCreateForm((f) => ({ ...f, dealershipId: v }))}
              options={[
                { value: "", label: "Select dealership" },
                ...(dealerships?.data ?? []).map((d) => ({
                  value: d.id,
                  label: `${d.displayName} (${d.id.slice(0, 8)}…)`,
                })),
              ]}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Plan</label>
            <Select
              value={createForm.plan}
              onChange={(v) => setCreateForm((f) => ({ ...f, plan: v }))}
              options={PLAN_OPTIONS}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Billing status</label>
            <Select
              value={createForm.billingStatus}
              onChange={(v) => setCreateForm((f) => ({ ...f, billingStatus: v }))}
              options={BILLING_STATUS_OPTIONS.filter((o) => o.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createLoading || !createForm.dealershipId}
          >
            {createLoading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!editSub} onOpenChange={(open) => !open && setEditSub(null)}>
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            {editSub && (
              <>Update plan or billing status for {editSub.dealershipName}.</>
            )}
          </DialogDescription>
        </DialogHeader>
        {editSub && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-[var(--text)]">Plan</label>
              <Select
                value={editForm.plan}
                onChange={(v) => setEditForm((f) => ({ ...f, plan: v }))}
                options={PLAN_OPTIONS}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-[var(--text)]">Billing status</label>
              <Select
                value={editForm.billingStatus}
                onChange={(v) => setEditForm((f) => ({ ...f, billingStatus: v }))}
                options={BILLING_STATUS_OPTIONS.filter((o) => o.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditSub(null)} disabled={editLoading}>
            Cancel
          </Button>
          <Button onClick={handleEdit} disabled={editLoading}>
            {editLoading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
