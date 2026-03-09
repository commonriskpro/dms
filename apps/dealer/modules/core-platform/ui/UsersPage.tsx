"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import type { MembershipsListResponse, MembershipResponse } from "@/lib/types/memberships";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import Link from "next/link";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

interface RoleOption {
  id: string;
  name: string;
}

export function UsersPage() {
  const { user: currentUser, hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("admin.users.read") || hasPermission("admin.memberships.read");
  const canWrite = hasPermission("admin.users.invite") || hasPermission("admin.memberships.write");
  const canAssignRoles = hasPermission("admin.roles.assign");
  const canManageOverrides = hasPermission("admin.permissions.manage");

  const [memberships, setMemberships] = React.useState<MembershipResponse[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<"active" | "disabled" | "">("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRoleId, setInviteRoleId] = React.useState("");
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editMembership, setEditMembership] = React.useState<MembershipResponse | null>(null);
  const [editRoleId, setEditRoleId] = React.useState("");
  const [editLoading, setEditLoading] = React.useState(false);
  const [disableTarget, setDisableTarget] = React.useState<MembershipResponse | null>(null);
  const [disableLoading, setDisableLoading] = React.useState(false);

  const fetchRoles = React.useCallback(async () => {
    const data = await apiFetch<{ data: { id: string; name: string }[] }>(
      "/api/admin/roles?limit=100"
    );
    setRoles(data.data);
    if (!inviteRoleId && data.data[0]) setInviteRoleId(data.data[0].id);
  }, [inviteRoleId]);

  const fetchMemberships = React.useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({
      limit: String(meta.limit),
      offset: String(meta.offset),
    });
    if (statusFilter) params.set("status", statusFilter);
    if (roleFilter) params.set("roleId", roleFilter);
    const data = await apiFetch<MembershipsListResponse>(
      `/api/admin/memberships?${params}`
    );
    setMemberships(data.data);
    setMeta(data.meta);
  }, [canRead, meta.limit, meta.offset, statusFilter, roleFilter]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchRoles();
    fetchMemberships().catch((e) => setError(e instanceof Error ? e.message : "Failed to load")).finally(() => setLoading(false));
  }, [canRead, meta.offset, statusFilter, roleFilter, fetchMemberships, fetchRoles]);

  React.useEffect(() => {
    if (canRead && roles.length && inviteOpen && !inviteRoleId) {
      setInviteRoleId(roles[0].id);
    }
  }, [canRead, roles, inviteOpen, inviteRoleId]);

  const handleInvite = async () => {
    if (!canWrite || !inviteEmail.trim() || !inviteRoleId) return;
    setInviteLoading(true);
    try {
      await apiFetch("/api/admin/memberships", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), roleId: inviteRoleId }),
      });
      addToast("success", "Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      fetchMemberships();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const openEdit = (m: MembershipResponse) => {
    setEditMembership(m);
    setEditRoleId(m.roleId);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!canWrite || !editMembership) return;
    setEditLoading(true);
    try {
      await apiFetch(`/api/admin/memberships/${editMembership.id}`, {
        method: "PATCH",
        body: JSON.stringify({ roleId: editRoleId }),
      });
      addToast("success", "Member updated");
      setEditOpen(false);
      fetchMemberships();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!canWrite || !disableTarget) return;
    const isSelf = currentUser?.id === disableTarget.userId;
    if (isSelf) {
      addToast("error", "You cannot disable your own membership.");
      setDisableTarget(null);
      return;
    }
    setDisableLoading(true);
    try {
      await apiFetch(`/api/admin/memberships/${disableTarget.id}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      addToast("success", "Member disabled");
      setDisableTarget(null);
      fetchMemberships();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setDisableLoading(false);
    }
  };

  const roleOptions: SelectOption[] = roles.map((r) => ({ value: r.id, label: r.name }));

  if (!canRead) {
    return (
      <PageShell>
        <PageHeader title="Users" description="Manage team members and roles." />
        <p className="mt-2 text-[var(--text-soft)]">You don’t have permission to view this page.</p>
      </PageShell>
    );
  }

  if (loading && memberships.length === 0) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (error && memberships.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Users" description="Manage team members and roles." />
        <ErrorState message={error} onRetry={fetchMemberships} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Users" description="Manage team members and roles." />

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          {canWrite && (
            <WriteGuard>
              <Button size="sm" onClick={() => { setInviteOpen(true); setInviteEmail(""); }}>
                Invite
              </Button>
            </WriteGuard>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "" | "active" | "disabled");
                setMeta((m) => ({ ...m, offset: 0 }));
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setMeta((m) => ({ ...m, offset: 0 }));
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {memberships.length === 0 ? (
            <EmptyState
              title="No members"
              description="Invite your first team member."
              actionLabel={canWrite ? "Invite member" : undefined}
              onAction={canWrite ? () => setInviteOpen(true) : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    {canWrite && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <span>{m.user?.fullName ?? m.user?.email ?? m.userId}</span>
                        {m.user?.email && (
                          <span className="block text-xs text-[var(--text-soft)]">{m.user.email}</span>
                        )}
                      </TableCell>
                      <TableCell>{m.role?.name ?? m.roleId}</TableCell>
                      <TableCell>
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>{m.disabledAt ? "Disabled" : "Active"}</TableCell>
                      {canWrite && (
                        <TableCell>
                          {!m.disabledAt && (
                            <WriteGuard>
                              {(canAssignRoles || canManageOverrides) ? (
                                <Link href={`/admin/users/${m.userId}`}>
                                  <Button variant="ghost" size="sm">Edit</Button>
                                </Link>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--danger)]"
                                onClick={() => setDisableTarget(m)}
                                aria-label={`Disable ${m.user?.email}`}
                              >
                                Disable
                              </Button>
                            </WriteGuard>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta.total > meta.limit && (
                <Pagination
                  meta={meta}
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                  className="mt-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>Send an invitation by email. They must have an account or sign up.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select
            label="Role"
            options={roleOptions}
            value={inviteRoleId}
            onChange={setInviteRoleId}
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton onClick={handleInvite} isLoading={inviteLoading}>
            Invite
          </MutationButton>
        </DialogFooter>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          {editMembership && (
            <DialogDescription>
              {editMembership.user?.email}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select
            label="Role"
            options={roleOptions}
            value={editRoleId}
            onChange={setEditRoleId}
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton onClick={handleEdit} isLoading={editLoading}>
            Save
          </MutationButton>
        </DialogFooter>
      </Dialog>

      {/* Disable confirm */}
      <Dialog open={!!disableTarget} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <DialogHeader>
          <DialogTitle>Disable member</DialogTitle>
          <DialogDescription>
            {disableTarget && currentUser?.id === disableTarget.userId ? (
              "You cannot disable your own membership. Ask another admin to do it."
            ) : (
              `Disable ${disableTarget?.user?.email ?? "this member"}? They will no longer be able to sign in to this dealership.`
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {disableTarget && currentUser?.id !== disableTarget.userId && (
            <MutationButton variant="danger" onClick={handleDisable} isLoading={disableLoading}>
              Disable
            </MutationButton>
          )}
        </DialogFooter>
      </Dialog>
    </PageShell>
  );
}
