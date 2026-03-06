"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MutationButton } from "@/components/write-guard";

type Role = { id: string; name: string; key: string | null; rolePermissions: { permission: { key: string } }[] };
type PermissionRow = { id: string; key: string; description: string | null; module: string | null };
type Override = { permissionKey: string; enabled: boolean };

type UserDetail = {
  id: string;
  userId: string;
  user: { id: string; email: string; fullName: string | null };
  role: { id: string; name: string };
  roleIds: string[];
  permissionOverrides: Override[];
};

function computeEffective(
  roleIds: string[],
  roles: Role[],
  overrides: Override[]
): Set<string> {
  const base = new Set<string>();
  for (const r of roles) {
    if (roleIds.includes(r.id)) {
      for (const rp of r.rolePermissions) base.add(rp.permission.key);
    }
  }
  for (const o of overrides) {
    if (o.enabled) base.add(o.permissionKey);
    else base.delete(o.permissionKey);
  }
  return base;
}

export function UserDetailClient({
  user,
  roles,
  permissionsCatalog,
  canAssignRoles,
  canManageOverrides,
}: {
  user: UserDetail;
  roles: Role[];
  permissionsCatalog: PermissionRow[];
  canAssignRoles: boolean;
  canManageOverrides: boolean;
}) {
  const { addToast } = useToast();
  const [roleIds, setRoleIds] = React.useState<string[]>(user.roleIds);
  const [overrides, setOverrides] = React.useState<Override[]>(user.permissionOverrides);
  const [rolesLoading, setRolesLoading] = React.useState(false);
  const [overrideLoading, setOverrideLoading] = React.useState<string | null>(null);

  const effective = computeEffective(roleIds, roles, overrides);
  const overrideMap = new Map(overrides.map((o) => [o.permissionKey, o.enabled]));

  const handleSaveRoles = async () => {
    if (!canAssignRoles) return;
    setRolesLoading(true);
    try {
      await apiFetch(`/api/admin/users/${user.userId}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roleIds }),
      });
      addToast("success", "Roles updated");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const handleToggleOverride = async (permissionKey: string, nextEnabled: boolean) => {
    if (!canManageOverrides) return;
    setOverrideLoading(permissionKey);
    try {
      await apiFetch(`/api/admin/users/${user.userId}/permission-overrides`, {
        method: "PATCH",
        body: JSON.stringify({ permissionKey, enabled: nextEnabled }),
      });
      setOverrides((prev) => {
        const rest = prev.filter((o) => o.permissionKey !== permissionKey);
        return [...rest, { permissionKey, enabled: nextEnabled }];
      });
      addToast("success", "Permission updated");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update permission");
    } finally {
      setOverrideLoading(null);
    }
  };

  const toggleRole = (roleId: string) => {
    if (!canAssignRoles) return;
    setRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const byModule = React.useMemo(() => {
    const map = new Map<string | null, PermissionRow[]>();
    for (const p of permissionsCatalog) {
      const mod = p.module ?? "other";
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a ?? "").localeCompare(b ?? ""));
  }, [permissionsCatalog]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">← Users</Button>
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {user.user?.fullName ?? user.user?.email ?? user.userId}
        </h1>
      </div>
      {user.user?.email && (
        <p className="text-sm text-[var(--muted-text)]">{user.user.email}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <p className="text-sm text-[var(--muted-text)]">
            User has the union of permissions from all selected roles. Overrides below can add or revoke.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                  disabled={!canAssignRoles}
                  aria-label={r.name}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
                <span className="text-sm">{r.name}</span>
              </label>
            ))}
          </div>
          {canAssignRoles && (
            <MutationButton onClick={handleSaveRoles} isLoading={rolesLoading}>
              Save roles
            </MutationButton>
          )}
        </CardContent>
      </Card>

      {canManageOverrides && (
        <Card>
          <CardHeader>
            <CardTitle>Permission overrides</CardTitle>
            <p className="text-sm text-[var(--muted-text)]">
              Override grants (add) or revokes (remove) a permission for this user regardless of roles.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {byModule.map(([module, perms]) => (
              <div key={module ?? "other"}>
                <h3 className="text-sm font-medium text-[var(--text)] mb-2 capitalize">
                  {module ?? "Other"}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {perms.map((p) => {
                    const effectiveState = effective.has(p.key);
                    const override = overrideMap.get(p.key);
                    const isOverride = override !== undefined;
                    const loading = overrideLoading === p.key;
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={effectiveState}
                          onChange={() =>
                            handleToggleOverride(p.key, !effectiveState)
                          }
                          disabled={loading}
                          aria-label={p.key}
                          className="h-4 w-4 rounded border-[var(--border)]"
                        />
                        <span className="truncate" title={p.key}>
                          {p.key}
                        </span>
                        {isOverride && (
                          <span className="text-xs text-[var(--muted-text)]">(override)</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
