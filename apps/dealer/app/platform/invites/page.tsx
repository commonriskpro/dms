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

type InviteRow = {
  id: string;
  dealershipId: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
  acceptedAt?: string;
};

type InvitesListResponse = {
  data: InviteRow[];
  meta: { total: number; limit: number; offset: number };
};

type DealershipOption = { id: string; name: string };
type DealershipsResponse = { data: DealershipOption[] };
type RoleOption = { id: string; name: string };
type RolesResponse = { data: RoleOption[] };

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PlatformInvitesPage() {
  const { addToast } = useToast();
  const [dealerships, setDealerships] = React.useState<DealershipOption[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = React.useState("");
  const [data, setData] = React.useState<InviteRow[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 20, offset: 0 });
  const [statusFilter, setStatusFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createEmail, setCreateEmail] = React.useState("");
  const [createRoleId, setCreateRoleId] = React.useState("");
  const [createExpiresAt, setCreateExpiresAt] = React.useState("");
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [loadingRoles, setLoadingRoles] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [resendTarget, setResendTarget] = React.useState<InviteRow | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<InviteRow | null>(null);
  const [actioning, setActioning] = React.useState(false);

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
    fetchDealerships();
  }, [fetchDealerships]);

  const fetchRoles = React.useCallback(async (dealershipId: string) => {
    setLoadingRoles(true);
    try {
      const res = await apiFetch<RolesResponse>(
        `/api/platform/dealerships/${dealershipId}/roles`
      );
      setRoles(res.data);
    } catch {
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedDealershipId) {
      fetchRoles(selectedDealershipId);
    } else {
      setRoles([]);
    }
  }, [selectedDealershipId, fetchRoles]);

  const fetchInvites = React.useCallback(async () => {
    if (!selectedDealershipId) {
      setData([]);
      setMeta((m) => ({ ...m, total: 0 }));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(meta.limit));
      params.set("offset", String(meta.offset));
      if (statusFilter) params.set("status", statusFilter);
      const res = await apiFetch<InvitesListResponse>(
        `/api/platform/dealerships/${selectedDealershipId}/invites?${params}`
      );
      setData(res.data);
      setMeta((m) => ({ ...m, total: res.meta.total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedDealershipId, meta.limit, meta.offset, statusFilter]);

  React.useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCreateInvite = async () => {
    if (!selectedDealershipId || !createEmail.trim() || !createRoleId) return;
    setCreating(true);
    try {
      const body: { email: string; roleId: string; expiresAt?: string } = {
        email: createEmail.trim(),
        roleId: createRoleId,
      };
      if (createExpiresAt.trim()) {
        const d = new Date(createExpiresAt.trim());
        if (!Number.isNaN(d.getTime())) body.expiresAt = d.toISOString();
      }
      await apiFetch(`/api/platform/dealerships/${selectedDealershipId}/invites`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      addToast("success", "Invite created");
      setCreateOpen(false);
      setCreateEmail("");
      setCreateRoleId("");
      setCreateExpiresAt("");
      fetchInvites();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async () => {
    if (!resendTarget || !selectedDealershipId) return;
    setActioning(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await apiFetch(
        `/api/platform/dealerships/${selectedDealershipId}/invites/${resendTarget.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
        }
      );
      addToast("success", "Invite resent with new expiry");
      setResendTarget(null);
      fetchInvites();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Resend failed");
    } finally {
      setActioning(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !selectedDealershipId) return;
    setActioning(true);
    try {
      await apiFetch(
        `/api/platform/dealerships/${selectedDealershipId}/invites/${revokeTarget.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ cancel: true }),
          expectNoContent: true,
        }
      );
      addToast("success", "Invite revoked");
      setRevokeTarget(null);
      fetchInvites();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setActioning(false);
    }
  };

  const openCreateModal = () => {
    setCreateEmail("");
    setCreateRoleId("");
    setCreateExpiresAt("");
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Platform Admin — Invites</h1>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Create and manage invites by dealership.</p>

      <Card className="mt-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Invites</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Dealership"
              options={[{ value: "", label: "Select dealership" }, ...dealerships.map((d) => ({ value: d.id, label: d.name }))]}
              value={selectedDealershipId}
              onChange={setSelectedDealershipId}
              aria-label="Select dealership"
            />
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label="Filter by status"
            />
            <Button onClick={openCreateModal} disabled={!selectedDealershipId}>
              Create invite
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedDealershipId ? (
            <p className="text-sm text-[var(--text-soft)]">Select a dealership to view and manage invites.</p>
          ) : error && data.length === 0 ? (
            <ErrorState message={error} onRetry={fetchInvites} />
          ) : loading && data.length === 0 ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          ) : data.length === 0 ? (
            <EmptyState
              title="No invites"
              description="Send an invite to add someone to this dealership."
              actionLabel="Create invite"
              onAction={openCreateModal}
            />
          ) : (
            <>
              <div className="rounded-md border border-[var(--border)] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.roleName}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>
                          {row.expiresAt
                            ? new Date(row.expiresAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {row.status === "PENDING" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setResendTarget(row)}
                                aria-label={`Resend invite to ${row.email}`}
                              >
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevokeTarget(row)}
                                className="text-amber-600"
                                aria-label={`Revoke invite for ${row.email}`}
                              >
                                Revoke
                              </Button>
                            </>
                          )}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby="create-invite-desc">
          <DialogHeader>
            <DialogTitle>Create invite</DialogTitle>
          </DialogHeader>
          <p id="create-invite-desc" className="text-[var(--text-soft)] text-sm">
            Send an invite to join this dealership with a role.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="email@example.com"
                aria-required="true"
              />
            </div>
            <Select
              label="Role"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              value={createRoleId}
              onChange={setCreateRoleId}
              disabled={loadingRoles}
              aria-label="Select role"
            />
            <div>
              <label htmlFor="invite-expires" className="block text-sm font-medium mb-1">
                Expires at (optional)
              </label>
              <Input
                id="invite-expires"
                type="datetime-local"
                value={createExpiresAt}
                onChange={(e) => setCreateExpiresAt(e.target.value)}
                aria-label="Optional expiry date and time"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateInvite}
              disabled={
                !createEmail.trim() ||
                !createRoleId ||
                creating
              }
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resendTarget} onOpenChange={(open) => !open && setResendTarget(null)}>
        <DialogContent aria-describedby="resend-invite-desc">
          <DialogHeader>
            <DialogTitle>Resend invite</DialogTitle>
          </DialogHeader>
          <p id="resend-invite-desc" className="text-sm text-[var(--text-soft)]">
            Generate a new link and extend expiry for {resendTarget?.email}?
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResendTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleResend} disabled={actioning}>
              {actioning ? "Resending…" : "Resend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent aria-describedby="revoke-invite-desc">
          <DialogHeader>
            <DialogTitle>Revoke invite</DialogTitle>
          </DialogHeader>
          <p id="revoke-invite-desc" className="text-sm text-[var(--text-soft)]">
            Are you sure you want to revoke this invite? The link will no longer work.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRevoke} disabled={actioning}>
              {actioning ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
