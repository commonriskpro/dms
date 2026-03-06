"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  platformFetch,
  type ApplicationDetailRes,
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
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformUiErrorMessage } from "@/lib/ui-error";
import { OnboardingStatusPanel, type OnboardingStatusData } from "./OnboardingStatusPanel";

const CAN_APPROVE_REJECT = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"];
const CAN_PROVISION_INVITE = ["PLATFORM_OWNER"];

type ApplicationDetailClientProps = {
  appId: string;
  initialOnboardingStatus: OnboardingStatusData | null;
};

export function ApplicationDetailClient({
  appId,
  initialOnboardingStatus,
}: ApplicationDetailClientProps) {
  const id = appId;
  const { userId, role } = usePlatformAuthContext();
  const [app, setApp] = useState<ApplicationDetailRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const toast = useToast();

  const canApproveReject = role && CAN_APPROVE_REJECT.includes(role);
  const canProvisionInvite = role && CAN_PROVISION_INVITE.includes(role);

  const refetch = () => {
    if (!id) return;
    setLoading(true);
    platformFetch<ApplicationDetailRes>(`/api/platform/applications/${id}`, {
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (res.ok) setApp(res.data);
        else setError(res.error);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  const handleApprove = async () => {
    if (!id || !userId) return;
    setActionLoading(true);
    const res = await platformFetch<{ id: string; status: "APPROVED" }>(
      `/api/platform/applications/${id}/approve`,
      {
        method: "POST",
        platformUserId: userId,
      }
    );
    setActionLoading(false);
    if (res.ok) {
      toast("Application approved", "success");
      refetch();
    } else {
      toast(res.error.message || "Failed to approve", "error");
      if (res.status === 403) refetch();
    }
  };

  const handleRejectSubmit = async () => {
    if (!id || !userId || !rejectReason.trim()) return;
    setActionLoading(true);
    const res = await platformFetch<{ id: string; status: "REJECTED" }>(
      `/api/platform/applications/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
        platformUserId: userId,
      }
    );
    setActionLoading(false);
    if (res.ok) {
      toast("Application rejected", "success");
      setRejectOpen(false);
      setRejectReason("");
      refetch();
    } else {
      toast(res.error.message || "Failed to reject", "error");
      if (res.status === 403) refetch();
    }
  };

  const handleProvision = async () => {
    if (!id || !userId) return;
    setProvisionLoading(true);
    const res = await platformFetch<{ dealershipId: string; displayName: string; status: string }>(
      `/api/platform/applications/${id}/provision`,
      { method: "POST", platformUserId: userId }
    );
    setProvisionLoading(false);
    if (res.ok) {
      toast("Dealership provisioned", "success");
      refetch();
    } else {
      toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Provision failed" }), "error");
      if (res.status === 403) refetch();
    }
  };

  const handleInviteOwner = async () => {
    if (!id || !userId) return;
    setInviteLoading(true);
    const res = await platformFetch<{ inviteId: string; status: string }>(
      `/api/platform/applications/${id}/invite-owner`,
      { method: "POST", platformUserId: userId }
    );
    setInviteLoading(false);
    if (res.ok) {
      toast("Invite sent successfully", "success");
      refetch();
    } else {
      toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Invite failed" }), "error");
      if (res.status === 403) refetch();
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

  if (loading && !app) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !app) {
    return (
      <div className="space-y-4">
        <Link href="/platform/applications" className="text-[var(--accent)] hover:underline text-sm">
          ← Applications
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error.message} {error.code === "FORBIDDEN" && "(403)"}
        </div>
      </div>
    );
  }

  if (!app) return null;

  return (
    <div className="space-y-4">
      <Link href="/platform/applications" className="text-[var(--accent)] hover:underline text-sm">
        ← Applications
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--text)]">Application</h1>

      {initialOnboardingStatus && (
        <OnboardingStatusPanel data={initialOnboardingStatus} />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Details</CardTitle>
          <div className="flex flex-wrap gap-2">
            {canApproveReject && app.status === "APPLIED" && (
              <>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={actionLoading}>
                  Reject
                </Button>
              </>
            )}
            {canProvisionInvite && app.status === "APPROVED" && (
              <>
                {!app.dealershipId && (
                  <Button onClick={handleProvision} disabled={provisionLoading}>
                    {provisionLoading ? "Provisioning…" : "Provision Dealership"}
                  </Button>
                )}
                <Button
                  onClick={handleInviteOwner}
                  disabled={inviteLoading}
                  variant={app.dealershipId ? undefined : "secondary"}
                >
                  {inviteLoading ? "Sending…" : "Invite Owner"}
                </Button>
                {app.dealershipId && (
                  <Link href={`/platform/dealerships/${app.dealershipId}`}>
                    <Button variant="secondary" type="button">Open Dealership</Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><span className="text-[var(--text-soft)]">Status:</span> {app.status}</p>
          <p><span className="text-[var(--text-soft)]">Legal name:</span> {app.legalName}</p>
          <p><span className="text-[var(--text-soft)]">Display name:</span> {app.displayName}</p>
          <p><span className="text-[var(--text-soft)]">Contact email:</span> {app.contactEmail}</p>
          {app.contactPhone && (
            <p><span className="text-[var(--text-soft)]">Contact phone:</span> {app.contactPhone}</p>
          )}
          {app.dealership && (
            <p>
              <span className="text-[var(--text-soft)]">Linked dealership:</span>{" "}
              {app.dealership.displayName} ({app.dealership.status})
              {app.dealership.provisionedAt && (
                <span className="text-[var(--text-soft)] text-sm">
                  {" "}· Provisioned {new Date(app.dealership.provisionedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          )}
          {app.ownerInviteStatus && (
            <p>
              <span className="text-[var(--text-soft)]">Owner invite:</span>{" "}
              {app.ownerInviteStatus.status}
              {app.ownerInviteStatus.expiresAt && app.ownerInviteStatus.status === "PENDING" && (
                <span className="text-[var(--text-soft)] text-sm">
                  {" "}· Expires {new Date(app.ownerInviteStatus.expiresAt).toLocaleString()}
                </span>
              )}
              {app.ownerInviteStatus.acceptedAt && (
                <span className="text-[var(--text-soft)] text-sm">
                  {" "}· Accepted {new Date(app.ownerInviteStatus.acceptedAt).toLocaleString()}
                </span>
              )}
            </p>
          )}
          {app.notes && (
            <p><span className="text-[var(--text-soft)]">Notes:</span> {app.notes}</p>
          )}
          {app.reviewNotes && (
            <p><span className="text-[var(--text-soft)]">Review notes:</span> {app.reviewNotes}</p>
          )}
          {app.rejectionReason && (
            <p><span className="text-[var(--text-soft)]">Rejection reason:</span> {app.rejectionReason}</p>
          )}
          <p><span className="text-[var(--text-soft)]">Created:</span> {new Date(app.createdAt).toLocaleString()}</p>
          <p><span className="text-[var(--text-soft)]">Updated:</span> {new Date(app.updatedAt).toLocaleString()}</p>
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>Reason is required and will be stored in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            label="Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason"
            maxLength={2000}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRejectSubmit}
            disabled={!rejectReason.trim() || actionLoading}
          >
            Reject
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
