"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  platformFetch,
  type ApiError,
} from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { isInviteButtonVisible } from "@/lib/platform-users-ui";
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
import { getPlatformUiErrorMessage } from "@/lib/ui-error";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s.trim());
}

type PlatformUserItem = {
  id: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
  email?: string | null;
  displayName?: string | null;
  lastSignInAt?: string | null;
};

type UsersListRes = {
  data: PlatformUserItem[];
  meta: { total: number; limit: number; offset: number };
};

const ROLE_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All roles" },
  { value: "PLATFORM_OWNER", label: "Owner" },
  { value: "PLATFORM_COMPLIANCE", label: "Compliance" },
  { value: "PLATFORM_SUPPORT", label: "Support" },
];

const ROLE_OPTIONS: SelectOption[] = [
  { value: "PLATFORM_OWNER", label: "Owner" },
  { value: "PLATFORM_COMPLIANCE", label: "Compliance" },
  { value: "PLATFORM_SUPPORT", label: "Support" },
];

const PLATFORM_ROLES = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"] as const;
function isValidPlatformRole(v: string): v is (typeof PLATFORM_ROLES)[number] {
  return PLATFORM_ROLES.includes(v as (typeof PLATFORM_ROLES)[number]);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(s: string): boolean {
  return EMAIL_REGEX.test(s.trim());
}

const LIMIT = 20;

type InviteResponse = {
  ok: true;
  invited: boolean;
  userId?: string;
  role: string;
  alreadySentRecently?: boolean;
};

export default function PlatformUsersPage() {
  const searchParams = useSearchParams();
  const { userId, role } = usePlatformAuthContext();
  const [data, setData] = useState<UsersListRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") ?? "");
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [searchApplied, setSearchApplied] = useState(searchParams.get("q") ?? "");
  const [offset, setOffset] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("PLATFORM_SUPPORT");
  const [addUserIdError, setAddUserIdError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("PLATFORM_SUPPORT");
  const [inviteEmailError, setInviteEmailError] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [confirmDemoteOpen, setConfirmDemoteOpen] = useState<{ id: string; role: string; isDisable: boolean } | null>(null);
  const toast = useToast();

  const isOwner = role === "PLATFORM_OWNER";

  const fetchList = useCallback(
    (off: number) => {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {
        limit: String(LIMIT),
        offset: String(off),
      };
      if (roleFilter) params.role = roleFilter;
      if (searchApplied.trim()) params.q = searchApplied.trim();
      const query = new URLSearchParams(params).toString();
      platformFetch<UsersListRes>(`/api/platform/users?${query}`, {
        platformUserId: userId ?? undefined,
      })
        .then((res) => {
          if (res.ok) {
            setData(res.data);
            setOffset(off);
          } else {
            setError(res.error);
            if (res.status === 403 || res.status === 401) setData(null);
          }
        })
        .finally(() => setLoading(false));
    },
    [userId, roleFilter, searchApplied]
  );

  useEffect(() => {
    fetchList(0);
  }, [fetchList]);

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("role", value);
    else next.delete("role");
    if (searchApplied) next.set("q", searchApplied);
    window.history.replaceState(null, "", `?${next.toString()}`);
    fetchList(0);
  };

  const applySearch = () => {
    const trimmed = searchInput.trim();
    setSearchApplied(trimmed);
    const next = new URLSearchParams(searchParams);
    if (roleFilter) next.set("role", roleFilter);
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    window.history.replaceState(null, "", `?${next.toString()}`);
    fetchList(0);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(
      () => toast("User ID copied to clipboard", "success"),
      () => toast("Failed to copy", "error")
    );
  };

  const handleAddSubmit = async () => {
    const trimmed = addUserId.trim();
    if (!trimmed) {
      setAddUserIdError("User ID is required.");
      return;
    }
    if (!isValidUUID(trimmed)) {
      setAddUserIdError("Enter a valid UUID (e.g. from Supabase Dashboard → Authentication → Users).");
      return;
    }
    setAddUserIdError("");
    setAddSaving(true);
    try {
      const res = await platformFetch<{ data: PlatformUserItem }>("/api/platform/users", {
        method: "POST",
        body: JSON.stringify({ id: trimmed, role: addRole }),
        platformUserId: userId ?? undefined,
      });
      if (res.ok) {
        toast("User added", "success");
        setAddOpen(false);
        setAddUserId("");
        setAddRole("PLATFORM_SUPPORT");
        fetchList(0);
      } else {
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Failed to add user",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setAddSaving(false);
    }
  };

  const handleInviteSubmit = async () => {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) {
      setInviteEmailError("Email is required.");
      return;
    }
    if (!isValidEmail(inviteEmail)) {
      setInviteEmailError("Enter a valid email address.");
      return;
    }
    if (!isValidPlatformRole(inviteRole)) {
      toast("Please select a valid role.", "error");
      return;
    }
    setInviteEmailError("");
    setInviteSaving(true);
    try {
      const res = await platformFetch<InviteResponse>("/api/platform/users/invite", {
        method: "POST",
        body: JSON.stringify({ email: trimmed, role: inviteRole }),
        platformUserId: userId ?? undefined,
      });
      if (res.ok) {
        const { invited, alreadySentRecently } = res.data;
        if (alreadySentRecently) {
          toast("Invite already sent recently for this email.", "success");
        } else if (!invited) {
          toast("User exists and role was synced. No new invite email was sent.", "success");
        } else {
          toast(`Invite sent to ${trimmed}`, "success");
        }
        setInviteOpen(false);
        setInviteEmail("");
        setInviteRole("PLATFORM_SUPPORT");
        fetchList(0);
      } else {
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Failed to send invite.",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setInviteSaving(false);
    }
  };

  const handleRoleChange = async (row: PlatformUserItem, newRole: string) => {
    if (row.role === newRole) return;
    const isDemotingOwner = row.role === "PLATFORM_OWNER";
    if (isDemotingOwner) {
      setConfirmDemoteOpen({ id: row.id, role: newRole, isDisable: false });
      return;
    }
    await doPatchRole(row.id, newRole, row.role);
  };

  const doPatchRole = async (id: string, newRole: string, previousRole: string) => {
    setPatchingId(id);
    try {
      const res = await platformFetch<{ data: PlatformUserItem }>(`/api/platform/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
        platformUserId: userId ?? undefined,
      });
      if (res.ok) {
        toast("Role updated", "success");
        fetchList(offset);
      } else {
        if (res.error?.code === "CONFLICT" && res.error?.message?.toLowerCase().includes("last")) {
          toast("Cannot remove the last platform owner.", "error");
        } else {
          toast(
            getPlatformUiErrorMessage({
              status: res.status,
              error: res.error,
              fallback: "Failed to update role",
            }),
            "error"
          );
        }
        fetchList(offset);
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setPatchingId(null);
      setConfirmDemoteOpen(null);
    }
  };

  const handleConfirmDemote = () => {
    if (!confirmDemoteOpen) return;
    doPatchRole(confirmDemoteOpen.id, confirmDemoteOpen.role, "PLATFORM_OWNER");
  };

  const handleDisable = (row: PlatformUserItem) => {
    if (row.disabledAt) return;
    if (row.role === "PLATFORM_OWNER") {
      setConfirmDemoteOpen({ id: row.id, role: row.role, isDisable: true });
      return;
    }
    doPatchDisabled(row.id, true);
  };

  const handleEnable = (row: PlatformUserItem) => {
    if (!row.disabledAt) return;
    doPatchDisabled(row.id, false);
  };

  const doPatchDisabled = async (id: string, disabled: boolean) => {
    setPatchingId(id);
    try {
      const res = await platformFetch<{ data: PlatformUserItem }>(`/api/platform/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled }),
        platformUserId: userId ?? undefined,
      });
      if (res.ok) {
        toast(disabled ? "User disabled" : "User enabled", "success");
        fetchList(offset);
      } else {
        if (res.error?.code === "CONFLICT" && res.error?.message?.toLowerCase().includes("last")) {
          toast("Cannot remove the last platform owner.", "error");
        } else {
          toast(
            getPlatformUiErrorMessage({
              status: res.status,
              error: res.error,
              fallback: "Failed to update user",
            }),
            "error"
          );
        }
        fetchList(offset);
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setPatchingId(null);
      setConfirmDemoteOpen(null);
    }
  };

  const handleConfirmDisable = () => {
    if (!confirmDemoteOpen?.isDisable) return;
    doPatchDisabled(confirmDemoteOpen.id, true);
  };

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">Sign in again to access platform users.</p>
        </CardContent>
      </Card>
    );
  }

  if (error?.code === "UNAUTHORIZED" || error?.code === "FORBIDDEN") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">
            {error.code === "UNAUTHORIZED" ? "Sign in again to access platform users." : "You don't have access to platform users."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Internal platform staff and access control. Only platform users can access this app.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Users</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Role"
              options={ROLE_FILTER_OPTIONS}
              value={roleFilter}
              onChange={handleRoleFilterChange}
              className="w-40"
            />
            <Input
              label="Search by ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="UUID"
              className="max-w-xs"
            />
            <Button variant="secondary" onClick={applySearch}>Search</Button>
            {isInviteButtonVisible(role) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setInviteOpen(true);
                  setInviteEmailError("");
                  setInviteEmail("");
                  setInviteRole("PLATFORM_SUPPORT");
                }}
              >
                Invite user
              </Button>
            )}
            {isOwner && (
              <Button onClick={() => { setAddOpen(true); setAddUserIdError(""); setAddUserId(""); setAddRole("PLATFORM_SUPPORT"); }}>
                Add user
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : !data?.data?.length ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-[var(--text-soft)]">No platform users yet.</p>
              <p className="text-sm text-[var(--text-soft)]">
                Add by user ID or invite by email (Owner only).
              </p>
              {isOwner && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={() => { setAddOpen(true); setAddUserIdError(""); setAddUserId(""); setAddRole("PLATFORM_SUPPORT"); }}>
                    Add user
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setInviteOpen(true); setInviteEmailError(""); setInviteEmail(""); setInviteRole("PLATFORM_SUPPORT"); }}>
                    Invite user
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    {isOwner && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="font-mono text-sm">{row.id.slice(0, 8)}…</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={() => handleCopyId(row.id)}
                          aria-label="Copy user ID"
                        >
                          Copy
                        </Button>
                      </TableCell>
                      <TableCell className="text-[var(--text)]">
                        {row.displayName?.trim() ?? "—"}
                      </TableCell>
                      <TableCell className="text-[var(--text)]">
                        {row.email?.trim() ?? "—"}
                      </TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Select
                            value={row.role}
                            options={ROLE_OPTIONS}
                            onChange={(v) => handleRoleChange(row, v)}
                            disabled={!!patchingId}
                            className="w-40"
                          />
                        ) : (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[var(--muted)] text-[var(--text)]">
                            {row.role.replace("PLATFORM_", "")}
                          </span>
                        )}
                        {patchingId === row.id && (
                          <span className="ml-2 inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            row.disabledAt
                              ? "bg-[var(--muted)] text-[var(--text-soft)]"
                              : "bg-[var(--muted)] text-[var(--text)]"
                          }`}
                        >
                          {row.disabledAt ? "Disabled" : "Active"}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-[var(--muted-text)]">
                        {row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          {row.disabledAt ? (
                            <Button variant="secondary" size="sm" disabled={!!patchingId} onClick={() => handleEnable(row)}>
                              Enable
                            </Button>
                          ) : (
                            <Button variant="secondary" size="sm" disabled={!!patchingId} onClick={() => handleDisable(row)}>
                              Disable
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.meta && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-[var(--text-soft)]">{data.meta.total} total</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => fetchList(Math.max(0, offset - LIMIT))}>
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!data.meta || offset + LIMIT >= data.meta.total}
                      onClick={() => fetchList(offset + LIMIT)}
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogHeader>
          <DialogTitle>Add platform user</DialogTitle>
          <DialogDescription>
            User ID must be the Supabase auth user UUID (from Supabase Dashboard → Authentication → Users).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            label="User ID (UUID)"
            value={addUserId}
            onChange={(e) => { setAddUserId(e.target.value); setAddUserIdError(""); }}
            placeholder="00000000-0000-0000-0000-000000000000"
            error={addUserIdError}
          />
          <Select label="Role" options={ROLE_OPTIONS} value={addRole} onChange={setAddRole} className="w-full" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSubmit} isLoading={addSaving} disabled={addSaving}>
            Add user
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogHeader>
          <DialogTitle>Invite platform user</DialogTitle>
          <DialogDescription>
            Send an invite or sync role. If the user already exists or was invited recently, no new email may be sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setInviteEmailError("");
            }}
            placeholder="user@example.com"
            error={inviteEmailError}
            autoComplete="email"
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={inviteRole}
            onChange={setInviteRole}
            className="w-full"
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setInviteOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleInviteSubmit} isLoading={inviteSaving} disabled={inviteSaving}>
            Send invite
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!confirmDemoteOpen} onOpenChange={(open) => !open && setConfirmDemoteOpen(null)}>
        <DialogHeader>
          <DialogTitle>Confirm</DialogTitle>
          <DialogDescription>
            {confirmDemoteOpen?.isDisable
              ? "This user is a platform owner. Disabling them may leave no owners. Are you sure?"
              : "This user is a platform owner. Demoting them may leave no owners. Are you sure?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmDemoteOpen(null)}>Cancel</Button>
          <Button
            onClick={confirmDemoteOpen?.isDisable ? handleConfirmDisable : handleConfirmDemote}
            disabled={!!patchingId}
          >
            Continue
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
