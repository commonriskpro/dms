"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";

type PendingUserRow = {
  id: string;
  userId: string;
  email: string;
  createdAt: string;
};

type PendingListResponse = {
  data: PendingUserRow[];
  meta: { total: number; limit: number; offset: number };
};

type DealershipOption = { id: string; name: string };
type DealershipsResponse = { data: DealershipOption[]; meta: { total: number } };
type RoleOption = { id: string; name: string };
type RolesResponse = { data: RoleOption[] };

export default function PlatformUsersPage() {
  const { addToast } = useToast();
  const [data, setData] = React.useState<PendingUserRow[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [approveTarget, setApproveTarget] = React.useState<PendingUserRow | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<PendingUserRow | null>(null);
  const [dealerships, setDealerships] = React.useState<DealershipOption[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = React.useState("");
  const [selectedRoleId, setSelectedRoleId] = React.useState("");
  const [loadingRoles, setLoadingRoles] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(meta.limit));
      params.set("offset", String(meta.offset));
      if (search.trim()) params.set("search", search.trim());
      const res = await apiFetch<PendingListResponse>(`/api/platform/pending-users?${params}`);
      setData(res.data);
      setMeta((m) => ({ ...m, total: res.meta.total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [meta.limit, meta.offset, search]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const fetchDealerships = React.useCallback(async () => {
    try {
      const res = await apiFetch<DealershipsResponse>(
        "/api/platform/dealerships?limit=500&offset=0"
      );
      setDealerships(res.data);
    } catch {
      setDealerships([]);
    }
  }, []);

  React.useEffect(() => {
    if (approveTarget) {
      fetchDealerships();
      setSelectedDealershipId("");
      setSelectedRoleId("");
      setRoles([]);
    }
  }, [approveTarget, fetchDealerships]);

  React.useEffect(() => {
    if (!selectedDealershipId) {
      setRoles([]);
      setSelectedRoleId("");
      return;
    }
    let cancelled = false;
    setLoadingRoles(true);
    apiFetch<RolesResponse>(`/api/platform/dealerships/${selectedDealershipId}/roles`)
      .then((res) => {
        if (!cancelled) {
          setRoles(res.data);
          setSelectedRoleId("");
        }
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDealershipId]);

  const handleApprove = async () => {
    if (!approveTarget || !selectedDealershipId || !selectedRoleId) return;
    setApproving(true);
    try {
      await apiFetch(`/api/platform/pending-users/${approveTarget.userId}/approve`, {
        method: "POST",
        body: JSON.stringify({ dealershipId: selectedDealershipId, roleId: selectedRoleId }),
      });
      addToast("success", "User approved and linked to dealership");
      setApproveTarget(null);
      fetchList();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await apiFetch(`/api/platform/pending-users/${rejectTarget.userId}/reject`, {
        method: "POST",
        expectNoContent: true,
      });
      addToast("success", "User rejected");
      setRejectTarget(null);
      fetchList();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Reject failed");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Platform Admin — Pending users</h1>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Approve or reject users waiting for dealership access.</p>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Pending users</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchList()}
              className="w-48"
              aria-label="Search by email"
            />
            <Button variant="secondary" onClick={fetchList}>
              Apply
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && data.length === 0 ? (
            <ErrorState message={error} onRetry={fetchList} />
          ) : loading && data.length === 0 ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          ) : data.length === 0 ? (
            <EmptyState
              title="No pending users"
              description="Users waiting for approval will appear here."
            />
          ) : (
            <>
              <div className="rounded-md border border-[var(--border)] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setApproveTarget(row)}
                          aria-label={`Approve ${row.email}`}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRejectTarget(row)}
                          className="text-amber-600"
                          aria-label={`Reject ${row.email}`}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                meta={meta}
                onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent aria-describedby="approve-desc">
          <DialogHeader>
            <DialogTitle>Approve user</DialogTitle>
          </DialogHeader>
          <p id="approve-desc" className="text-[var(--text-soft)] text-sm">
            Link {approveTarget?.email} to a dealership with a role.
          </p>
          <div className="space-y-3">
            <Select
              label="Dealership"
              options={dealerships.map((d) => ({ value: d.id, label: d.name }))}
              value={selectedDealershipId}
              onChange={setSelectedDealershipId}
              aria-label="Select dealership"
            />
            <Select
              label="Role"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              value={selectedRoleId}
              onChange={setSelectedRoleId}
              disabled={!selectedDealershipId || loadingRoles}
              aria-label="Select role"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!selectedDealershipId || !selectedRoleId || approving}
            >
              {approving ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent aria-describedby="reject-user-desc">
          <DialogHeader>
            <DialogTitle>Reject user</DialogTitle>
          </DialogHeader>
          <p id="reject-user-desc" className="text-sm text-[var(--text-soft)]">
            Are you sure you want to reject this user? They will not get access to any dealership.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
