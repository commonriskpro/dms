"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch, type ApplicationsListRes, type ListMeta, type ApiError } from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { APPLICATION_STATUS } from "@dms/contracts";
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
import { useToast } from "@/components/toast";
import { getPlatformUiErrorMessage } from "@/lib/ui-error";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  ...APPLICATION_STATUS.map((s) => ({ value: s, label: s })),
];

const CAN_CREATE_APPLICATION = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"];
const CAN_PROVISION_INVITE = ["PLATFORM_OWNER"];
const LIMIT = 20;

export default function ApplicationsListPage() {
  const { userId, role } = usePlatformAuthContext();
  const [data, setData] = useState<ApplicationsListRes | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [newAppOpen, setNewAppOpen] = useState(false);
  const [newAppLoading, setNewAppLoading] = useState(false);
  const [newAppForm, setNewAppForm] = useState({
    legalName: "",
    displayName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });
  const toast = useToast();

  const canCreateApplication = role != null && CAN_CREATE_APPLICATION.includes(role);
  const canProvisionInvite = role != null && CAN_PROVISION_INVITE.includes(role);
  const [actionRowId, setActionRowId] = useState<string | null>(null);

  const handleProvision = async (applicationId: string) => {
    if (!userId) return;
    setActionRowId(applicationId);
    try {
      const res = await platformFetch<{ dealershipId: string }>(`/api/platform/applications/${applicationId}/provision`, {
        method: "POST",
        platformUserId: userId,
      });
      if (res.ok) {
        toast("Dealership provisioned", "success");
        refetchList();
      } else {
        toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Provision failed" }), "error");
      }
    } finally {
      setActionRowId(null);
    }
  };

  const handleInviteOwner = async (applicationId: string) => {
    if (!userId) return;
    setActionRowId(applicationId);
    try {
      const res = await platformFetch<{ inviteId: string }>(`/api/platform/applications/${applicationId}/invite-owner`, {
        method: "POST",
        platformUserId: userId,
      });
      if (res.ok) {
        toast("Invite sent", "success");
        refetchList();
      } else {
        toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Invite failed" }), "error");
      }
    } finally {
      setActionRowId(null);
    }
  };

  const handleCreateApplication = async (): Promise<void> => {
    if (!userId) return;
    const body = {
      legalName: newAppForm.legalName.trim(),
      displayName: newAppForm.displayName.trim(),
      contactEmail: newAppForm.contactEmail.trim(),
      ...(newAppForm.contactPhone.trim() && { contactPhone: newAppForm.contactPhone.trim() }),
      ...(newAppForm.notes.trim() && { notes: newAppForm.notes.trim() }),
    };
    setNewAppLoading(true);
    try {
      const res = await platformFetch<{ id: string; status: string; legalName: string; displayName: string; contactEmail: string; createdAt: string }>(
        "/api/platform/applications",
        {
          method: "POST",
          body: JSON.stringify(body),
          platformUserId: userId,
        }
      );
      if (res.ok) {
        toast("Application created", "success");
        setNewAppOpen(false);
        setNewAppForm({ legalName: "", displayName: "", contactEmail: "", contactPhone: "", notes: "" });
        refetchList();
      } else {
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Failed to create application",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setNewAppLoading(false);
    }
  };


  const refetchList = useCallback(() => {
    setListVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      limit: String(LIMIT),
      offset: String(offset),
    };
    if (status) params.status = status;
    platformFetch<ApplicationsListRes>("/api/platform/applications", {
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

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">Sign in again to access applications.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Applications</h1>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error.message} {error.code === "FORBIDDEN" && "(403)"}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>List</CardTitle>
          <div className="flex items-center gap-2">
            {canCreateApplication && (
              <Button onClick={() => { setNewAppOpen(true); setNewAppForm({ legalName: "", displayName: "", contactEmail: "", contactPhone: "", notes: "" }); }}>
                New Application
              </Button>
            )}
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              className="w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !data?.data?.length ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-[var(--text-soft)]">No applications yet. Create one to get started.</p>
              {canCreateApplication && (
                <Button
                  onClick={() => {
                    setNewAppOpen(true);
                    setNewAppForm({
                      legalName: "",
                      displayName: "",
                      contactEmail: "",
                      contactPhone: "",
                      notes: "",
                    });
                  }}
                >
                  New Application
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Legal name</TableHead>
                    <TableHead>Display name</TableHead>
                    <TableHead>Contact email</TableHead>
                    <TableHead>Created</TableHead>
                    {canProvisionInvite && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={`/platform/applications/${row.id}`} className="text-[var(--accent)] hover:underline">
                          {row.status}
                        </Link>
                      </TableCell>
                      <TableCell>{row.legalName}</TableCell>
                      <TableCell>{row.displayName}</TableCell>
                      <TableCell>{row.contactEmail}</TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      {canProvisionInvite && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.status === "APPROVED" && !row.dealershipId && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleProvision(row.id)}
                                disabled={actionRowId === row.id}
                              >
                                {actionRowId === row.id ? "…" : "Provision"}
                              </Button>
                            )}
                            {row.status === "APPROVED" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleInviteOwner(row.id)}
                                disabled={actionRowId === row.id}
                              >
                                {actionRowId === row.id ? "…" : "Invite Owner"}
                              </Button>
                            )}
                            {row.dealershipId && (
                              <Link href={`/platform/dealerships/${row.dealershipId}`}>
                                <Button size="sm" variant="secondary" type="button">Open Dealership</Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-[var(--text-soft)]">
                    {meta.total} total
                  </span>
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

      <Dialog open={newAppOpen} onOpenChange={setNewAppOpen}>
        <DialogHeader>
          <DialogTitle>New Application</DialogTitle>
          <DialogDescription>Create a new dealer application. Required fields: legal name, display name, contact email.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 py-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await handleCreateApplication();
          }}
        >
          <Input
            label="Legal name"
            value={newAppForm.legalName}
            onChange={(e) => setNewAppForm((f) => ({ ...f, legalName: e.target.value }))}
            placeholder="Legal entity name"
            required
            maxLength={500}
          />
          <Input
            label="Display name"
            value={newAppForm.displayName}
            onChange={(e) => setNewAppForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Display name"
            required
            maxLength={200}
          />
          <Input
            label="Contact email"
            type="email"
            value={newAppForm.contactEmail}
            onChange={(e) => setNewAppForm((f) => ({ ...f, contactEmail: e.target.value }))}
            placeholder="contact@example.com"
            required
          />
          <Input
            label="Contact phone (optional)"
            value={newAppForm.contactPhone}
            onChange={(e) => setNewAppForm((f) => ({ ...f, contactPhone: e.target.value }))}
            placeholder="+1 234 567 8900"
            maxLength={50}
          />
          <Input
            label="Notes (optional)"
            value={newAppForm.notes}
            onChange={(e) => setNewAppForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Internal notes"
            maxLength={2000}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setNewAppOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={newAppLoading || !newAppForm.legalName.trim() || !newAppForm.displayName.trim() || !newAppForm.contactEmail.trim()}
            >
              {newAppLoading ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
