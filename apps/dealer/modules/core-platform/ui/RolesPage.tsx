"use client";

import * as React from "react";
import { apiFetch, HttpError } from "@/lib/client/http";
import type {
  RoleResponse,
  RolesListResponse,
  PermissionsListResponse,
  PermissionResponse,
} from "@/lib/types/roles";
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
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

function groupByModule(permissions: PermissionResponse[]): Map<string | null, PermissionResponse[]> {
  const map = new Map<string | null, PermissionResponse[]>();
  for (const p of permissions) {
    const mod = p.module ?? null;
    if (!map.has(mod)) map.set(mod, []);
    map.get(mod)!.push(p);
  }
  return map;
}

export function RolesPage() {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("admin.roles.read");
  const canWrite = hasPermission("admin.roles.write");

  const [roles, setRoles] = React.useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionResponse[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createPermissionIds, setCreatePermissionIds] = React.useState<string[]>([]);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRole, setEditRole] = React.useState<RoleResponse | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editPermissionIds, setEditPermissionIds] = React.useState<string[]>([]);
  const [editLoading, setEditLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<RoleResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const fetchRoles = React.useCallback(async () => {
    if (!canRead) return;
    const data = await apiFetch<RolesListResponse>(
      `/api/admin/roles?limit=${meta.limit}&offset=${meta.offset}&includeSystem=true`
    );
    setRoles(data.data);
    setMeta(data.meta);
  }, [canRead, meta.limit, meta.offset]);

  const fetchPermissions = React.useCallback(async () => {
    try {
      const data = await apiFetch<PermissionsListResponse>("/api/admin/permissions");
      setPermissions(data.data);
    } catch {
      setPermissions([]);
    }
  }, []);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchRoles(), fetchPermissions()])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [canRead, fetchRoles, fetchPermissions]);

  const handleCreate = async () => {
    if (!canWrite || !createName.trim()) return;
    setCreateLoading(true);
    try {
      await apiFetch("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim(), permissionIds: createPermissionIds }),
      });
      addToast("success", "Role created");
      setCreateOpen(false);
      setCreateName("");
      setCreatePermissionIds([]);
      fetchRoles();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (role: RoleResponse) => {
    setEditRole(role);
    setEditName(role.name);
    setEditPermissionIds(role.permissionIds ?? []);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!canWrite || !editRole) return;
    setEditLoading(true);
    try {
      await apiFetch(`/api/admin/roles/${editRole.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), permissionIds: editPermissionIds }),
      });
      addToast("success", "Role updated");
      setEditOpen(false);
      fetchRoles();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/admin/roles/${deleteTarget.id}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      addToast("success", "Role deleted");
      setDeleteTarget(null);
      fetchRoles();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      if (e instanceof HttpError && e.code === "CONFLICT") {
        addToast("error", "Role is in use. Reassign or remove members first.");
      } else {
        addToast("error", message);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const togglePermission = (
    id: string,
    current: string[],
    setCurrent: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setCurrent((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const groupedPermissions = React.useMemo(
    () => groupByModule(permissions),
    [permissions]
  );

  if (!canRead) {
    return (
      <PageShell>
        <PageHeader title="Roles" description="Manage roles and permissions." />
        <p className="mt-2 text-[var(--text-soft)]">You don’t have permission to view this page.</p>
      </PageShell>
    );
  }

  if (loading && roles.length === 0) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (error && roles.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Roles" description="Manage roles and permissions." />
        <ErrorState message={error} onRetry={fetchRoles} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Roles" description="Manage roles and permissions." />

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Roles</CardTitle>
          {canWrite && (
            <WriteGuard>
              <Button size="sm" onClick={() => { setCreateOpen(true); setCreateName(""); setCreatePermissionIds([]); }}>
                Create role
              </Button>
            </WriteGuard>
          )}
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <EmptyState
              title="No roles"
              description="Create a custom role."
              actionLabel={canWrite ? "Create role" : undefined}
              onAction={canWrite ? () => setCreateOpen(true) : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Permissions</TableHead>
                    {canWrite && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.isSystem ? "Yes" : "No"}</TableCell>
                      <TableCell>{(r.permissionIds?.length ?? 0)}</TableCell>
                      {canWrite && (
                        <TableCell>
                          <WriteGuard>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                              Edit
                            </Button>
                            {!r.isSystem && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--danger)]"
                                onClick={() => setDeleteTarget(r)}
                                aria-label={`Delete ${r.name}`}
                              >
                                Delete
                              </Button>
                            )}
                          </WriteGuard>
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
          <DialogDescription>Add a custom role and assign permissions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <div>
            <span className="text-sm font-medium block mb-2">Permissions</span>
            <div className="max-h-48 overflow-y-auto rounded border border-[var(--border)] p-2 space-y-2">
              {Array.from(groupedPermissions.entries()).map(([mod, perms]) => (
                <div key={mod ?? "none"}>
                  <span className="text-xs font-medium text-[var(--text-soft)] block mb-1">
                    {mod ?? "Other"}
                  </span>
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={createPermissionIds.includes(p.id)}
                        onChange={() => togglePermission(p.id, createPermissionIds, setCreatePermissionIds)}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="text-sm">{p.key}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton onClick={handleCreate} isLoading={createLoading}>
            Create
          </MutationButton>
        </DialogFooter>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
          {editRole && (
            <DialogDescription>
              {editRole.isSystem ? "System roles have limited edits." : ""}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={editRole?.isSystem}
          />
          <div>
            <span className="text-sm font-medium block mb-2">Permissions</span>
            <div className="max-h-48 overflow-y-auto rounded border border-[var(--border)] p-2 space-y-2">
              {Array.from(groupedPermissions.entries()).map(([mod, perms]) => (
                <div key={mod ?? "none"}>
                  <span className="text-xs font-medium text-[var(--text-soft)] block mb-1">
                    {mod ?? "Other"}
                  </span>
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={editPermissionIds.includes(p.id)}
                        onChange={() => togglePermission(p.id, editPermissionIds, setEditPermissionIds)}
                        disabled={editRole?.isSystem}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="text-sm">{p.key}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
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

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Delete role</DialogTitle>
          <DialogDescription>
            Delete &quot;{deleteTarget?.name}&quot;? This will fail if the role is assigned to any members.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton variant="danger" onClick={handleDelete} isLoading={deleteLoading}>
            Delete
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </PageShell>
  );
}
