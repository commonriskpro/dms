"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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
import { Pagination } from "@/components/pagination";

type DealershipDetail = {
  id: string;
  name: string;
  slug?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  locationsCount: number;
  membersCount: number;
};

type MemberRow = {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  roleId: string;
  roleName: string;
  disabledAt?: string;
  createdAt: string;
};

type RoleOption = { id: string; name: string };

export default function PlatformDealershipDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { addToast } = useToast();
  const [dealership, setDealership] = React.useState<DealershipDetail | null>(null);
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);
  const [addEmail, setAddEmail] = React.useState("");
  const [addRoleId, setAddRoleId] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [disableDealershipOpen, setDisableDealershipOpen] = React.useState(false);
  const [enableDealershipOpen, setEnableDealershipOpen] = React.useState(false);
  const [actioning, setActioning] = React.useState(false);

  const fetchDealership = React.useCallback(async () => {
    if (!id) return;
    try {
      const d = await apiFetch<DealershipDetail>(`/api/platform/dealerships/${id}`);
      setDealership(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dealership");
    }
  }, [id]);

  const fetchMembers = React.useCallback(async () => {
    if (!id) return;
    try {
      const params = new URLSearchParams();
      params.set("limit", String(meta.limit));
      params.set("offset", String(meta.offset));
      const res = await apiFetch<{ data: MemberRow[]; meta: { total: number; limit: number; offset: number } }>(
        `/api/platform/dealerships/${id}/members?${params}`
      );
      setMembers(res.data);
      setMeta((m) => ({ ...m, total: res.meta.total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    }
  }, [id, meta.limit, meta.offset]);

  const fetchRoles = React.useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ data: RoleOption[] }>(`/api/platform/dealerships/${id}/roles`);
      setRoles(res.data);
      if (res.data.length && !addRoleId) setAddRoleId(res.data[0].id);
    } catch {
      setRoles([]);
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchDealership(), fetchRoles()]).finally(() => setLoading(false));
  }, [id, fetchDealership, fetchRoles]);

  React.useEffect(() => {
    if (!id) return;
    fetchMembers();
  }, [id, fetchMembers]);

  const handleAddMember = async () => {
    if (!addEmail.trim() || !addRoleId) return;
    setAdding(true);
    try {
      await apiFetch(`/api/platform/dealerships/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: addEmail.trim().toLowerCase(), roleId: addRoleId }),
      });
      addToast("success", "Member added");
      setAddMemberOpen(false);
      setAddEmail("");
      fetchMembers();
      fetchDealership();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Add member failed");
    } finally {
      setAdding(false);
    }
  };

  const handleDisableDealership = async () => {
    setActioning(true);
    try {
      await apiFetch(`/api/platform/dealerships/${id}/disable`, { method: "POST" });
      addToast("success", "Dealership disabled");
      setDisableDealershipOpen(false);
      fetchDealership();
      fetchMembers();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Disable failed");
    } finally {
      setActioning(false);
    }
  };

  const handleEnableDealership = async () => {
    setActioning(true);
    try {
      await apiFetch(`/api/platform/dealerships/${id}/enable`, { method: "POST" });
      addToast("success", "Dealership enabled");
      setEnableDealershipOpen(false);
      fetchDealership();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Enable failed");
    } finally {
      setActioning(false);
    }
  };

  const handleImpersonate = async () => {
    try {
      await apiFetch("/api/platform/impersonate", {
        method: "POST",
        body: JSON.stringify({ dealershipId: id }),
        expectNoContent: true,
      });
      addToast("success", "Impersonating dealership. Redirecting…");
      router.push("/inventory");
      router.refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Impersonate failed");
    }
  };

  const handleMemberRoleChange = async (membershipId: string, roleId: string) => {
    try {
      await apiFetch(`/api/platform/dealerships/${id}/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ roleId }),
      });
      addToast("success", "Role updated");
      fetchMembers();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleMemberDisable = async (membershipId: string) => {
    try {
      await apiFetch(`/api/platform/dealerships/${id}/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: true }),
      });
      addToast("success", "Membership disabled");
      fetchMembers();
      fetchDealership();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Disable failed");
    }
  };

  const handleMemberEnable = async (membershipId: string) => {
    try {
      await apiFetch(`/api/platform/dealerships/${id}/members/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: false }),
      });
      addToast("success", "Membership enabled");
      fetchMembers();
      fetchDealership();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Enable failed");
    }
  };

  if (loading && !dealership) {
    return <div className="text-[var(--text-soft)]">Loading…</div>;
  }
  if (error && !dealership) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!dealership) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/platform/dealerships" className="text-sm text-[var(--accent)] hover:underline">
            ← Dealerships
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">{dealership.name}</h1>
          <p className="text-sm text-[var(--text-soft)]">
            {dealership.slug ?? "—"} · {dealership.isActive ? "Active" : "Disabled"} ·{" "}
            {dealership.locationsCount} locations · {dealership.membersCount} members
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleImpersonate}>
            Impersonate
          </Button>
          {dealership.isActive ? (
            <Button variant="secondary" className="text-amber-600" onClick={() => setDisableDealershipOpen(true)}>
              Disable dealership
            </Button>
          ) : (
            <Button variant="secondary" className="text-green-600" onClick={() => setEnableDealershipOpen(true)}>
              Enable dealership
            </Button>
          )}
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--text)]">Members</h2>
          <Button size="sm" onClick={() => { setAddMemberOpen(true); fetchRoles(); }} disabled={!dealership.isActive}>
            Add member
          </Button>
        </div>
        <div className="rounded-md border border-[var(--border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-[var(--text-soft)]">
                    No members
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.fullName ?? "—"}</TableCell>
                    <TableCell>
                      <select
                        className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                        value={m.roleId}
                        onChange={(e) => handleMemberRoleChange(m.id, e.target.value)}
                        disabled={!!m.disabledAt}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>{m.disabledAt ? "Disabled" : "Active"}</TableCell>
                    <TableCell className="text-right">
                      {m.disabledAt ? (
                        <Button variant="ghost" size="sm" onClick={() => handleMemberEnable(m.id)}>
                          Enable
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-600"
                          onClick={() => handleMemberDisable(m.id)}
                        >
                          Disable
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pagination
          meta={meta}
          onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
        />
      </section>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <label className="text-sm font-medium">Role</label>
            <select
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
              value={addRoleId}
              onChange={(e) => setAddRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddMemberOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!addEmail.trim() || !addRoleId || adding}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableDealershipOpen} onOpenChange={setDisableDealershipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable dealership</DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-soft)]">
            Disable &quot;{dealership.name}&quot;? All memberships will be disabled.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDisableDealershipOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDisableDealership} disabled={actioning}>
              {actioning ? "Disabling…" : "Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={enableDealershipOpen} onOpenChange={setEnableDealershipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable dealership</DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-soft)]">
            Enable &quot;{dealership.name}&quot;? Memberships will not be auto-enabled.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEnableDealershipOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEnableDealership} disabled={actioning}>
              {actioning ? "Enabling…" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
