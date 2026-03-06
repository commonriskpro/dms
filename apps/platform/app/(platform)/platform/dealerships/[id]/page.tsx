"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  platformFetch,
  type DealershipDetailRes,
  type ApiError,
} from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { useToast } from "@/components/toast";
import type { PlatformOwnerInviteResponse } from "@dms/contracts";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPlatformUiErrorMessage } from "@/lib/ui-error";

const CAN_CHANGE_STATUS = ["PLATFORM_OWNER"];
const CAN_SEND_OWNER_INVITE = ["PLATFORM_OWNER"];
const CAN_EDIT_PLAN = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"];
const PLAN_KEYS = ["starter", "standard", "enterprise"] as const;

type ProvisionSuccessInfo = {
  requestId: string;
  provisionedAt: string;
  dealerDealershipId: string;
  idempotencyKey: string;
};

type ProvisionErrorInfo = {
  requestId: string;
  idempotencyKey: string;
  upstreamStatus?: number;
};

type StatusFailureInfo = {
  requestId: string;
  upstreamStatus?: number;
  status: string;
  reason: string;
};

function getErrorDetails(details: unknown): { requestId?: string; idempotencyKey?: string; upstreamStatus?: number } {
  if (!details || typeof details !== "object") return {};
  const o = details as Record<string, unknown>;
  return {
    requestId: typeof o.requestId === "string" ? o.requestId : undefined,
    idempotencyKey: typeof o.idempotencyKey === "string" ? o.idempotencyKey : undefined,
    upstreamStatus: typeof o.upstreamStatus === "number" ? o.upstreamStatus : undefined,
  };
}

export default function DealershipDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { userId, role } = usePlatformAuthContext();
  const [d, setD] = useState<DealershipDetailRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<"suspend" | "close" | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [ownerInviteOpen, setOwnerInviteOpen] = useState(false);
  const [ownerInviteEmail, setOwnerInviteEmail] = useState("");
  const [ownerInviteLoading, setOwnerInviteLoading] = useState(false);
  const [ownerInviteAcceptUrl, setOwnerInviteAcceptUrl] = useState<string | null>(null);
  const [copyInviteLinkLabel, setCopyInviteLinkLabel] = useState<string>("Copy invite link");
  const toast = useToast();

  // Provision: idempotency key generated on first click; show and reuse for retry
  const [provisionIdempotencyKey, setProvisionIdempotencyKey] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<ProvisionSuccessInfo | null>(null);
  const [provisionError, setProvisionError] = useState<ProvisionErrorInfo | null>(null);

  // Status: last failure for retry and dealer-call-failed indicator
  const [lastStatusFailure, setLastStatusFailure] = useState<StatusFailureInfo | null>(null);

  const [planEditOpen, setPlanEditOpen] = useState(false);
  const [planKeyEdit, setPlanKeyEdit] = useState("");
  const [limitsEdit, setLimitsEdit] = useState("{}");
  const [planSaving, setPlanSaving] = useState(false);
  const [supportSessionConfirmOpen, setSupportSessionConfirmOpen] = useState(false);
  const [supportSessionLoading, setSupportSessionLoading] = useState(false);

  const canChangeStatus = role && CAN_CHANGE_STATUS.includes(role);
  const canSendOwnerInvite = role && CAN_SEND_OWNER_INVITE.includes(role);
  const canEditPlan = role && CAN_EDIT_PLAN.includes(role);
  const canStartSupportSession = role === "PLATFORM_OWNER" && !!d?.dealerDealershipId;

  const [invitesData, setInvitesData] = useState<{
    data: Array<{
      id: string;
      emailMasked: string;
      roleName: string;
      status: string;
      expiresAt: string | null;
      createdAt: string;
      acceptedAt: string | null;
    }>;
    meta: { total: number; limit: number; offset: number };
  } | null>(null);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const CAN_REVOKE_INVITE = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"];

  const refetch = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    platformFetch<DealershipDetailRes>(`/api/platform/dealerships/${id}`, {
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (res.ok) {
          setD(res.data);
        } else {
          setError(res.error);
          if (res.status === 401) setUnauthorized(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id, userId]);

  useEffect(() => {
    if (!id) return;
    refetch();
  }, [id, refetch]);

  const fetchInvites = useCallback(() => {
    if (!id || !d?.dealerDealershipId || !userId) return;
    setInvitesLoading(true);
    platformFetch<{ data: Array<{ id: string; emailMasked: string; roleName: string; status: string; expiresAt: string | null; createdAt: string; acceptedAt: string | null }>; meta: { total: number; limit: number; offset: number } }>(
      `/api/platform/dealerships/${id}/invites?limit=50&offset=0`,
      { platformUserId: userId }
    )
      .then((res) => {
        if (res.ok) setInvitesData({ data: res.data.data, meta: res.data.meta });
        else setInvitesData(null);
      })
      .finally(() => setInvitesLoading(false));
  }, [id, d?.dealerDealershipId, userId]);

  useEffect(() => {
    if (d?.dealerDealershipId) fetchInvites();
    else setInvitesData(null);
  }, [d?.dealerDealershipId, fetchInvites]);

  const openPlanEdit = () => {
    if (!d) return;
    setPlanKeyEdit(d.planKey);
    setLimitsEdit(
      d.limits && typeof d.limits === "object"
        ? JSON.stringify(d.limits, null, 2)
        : "{}"
    );
    setPlanEditOpen(true);
  };

  const handleSavePlan = async () => {
    if (!id || !userId) return;
    let limitsObj: Record<string, unknown> = {};
    try {
      limitsObj = JSON.parse(limitsEdit);
      if (typeof limitsObj !== "object" || limitsObj === null) limitsObj = {};
    } catch {
      toast("Invalid JSON for limits", "error");
      return;
    }
    setPlanSaving(true);
    try {
      const res = await platformFetch<{ id: string; displayName: string; planKey: string; limits: unknown; updatedAt: string }>(
        `/api/platform/dealerships/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ planKey: planKeyEdit, limits: limitsObj }),
          platformUserId: userId,
        }
      );
      if (res.ok) {
        toast("Plan updated", "success");
        setPlanEditOpen(false);
        refetch();
      } else {
        toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Failed to update plan" }), "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setPlanSaving(false);
    }
  };

  const handleStartSupportSession = async () => {
    if (!id || !userId) return;
    setSupportSessionLoading(true);
    try {
      const res = await platformFetch<{ redirectUrl: string }>(
        "/api/platform/impersonation/start",
        {
          method: "POST",
          body: JSON.stringify({ platformDealershipId: id }),
          platformUserId: userId,
        }
      );
      if (res.ok) {
        setSupportSessionConfirmOpen(false);
        window.location.href = res.data.redirectUrl;
      } else {
        toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Failed to start support session" }), "error");
        setSupportSessionLoading(false);
      }
    } catch {
      toast("Network error", "error");
      setSupportSessionLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!userId || !id) return;
    setRevokingInviteId(inviteId);
    try {
      const res = await platformFetch<unknown>(
        `/api/platform/dealerships/${id}/invites/${inviteId}/revoke`,
        { method: "PATCH", platformUserId: userId }
      );
      if (res.ok) {
        toast("Invite revoked", "success");
        fetchInvites();
      } else {
        toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Revoke failed" }), "error");
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setRevokingInviteId(null);
    }
  };

  const openReasonModal = (action: "suspend" | "close") => {
    setReasonAction(action);
    setReason("");
    setReasonOpen(true);
  };

  const submitReasonAction = async () => {
    if (!reason.trim() || !reasonAction) return;
    setActionLoading(true);
    setLastStatusFailure(null);
    const status = reasonAction === "suspend" ? "SUSPENDED" : "CLOSED";
    const payload = { status, reason: reason.trim() };
    try {
      const res = await platformFetch<{ ok: boolean; requestId?: string }>(
        `/api/platform/dealerships/${id}/status`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          platformUserId: userId ?? undefined,
        }
      );
      if (!res.ok && "status" in res && res.status === 401) setUnauthorized(true);
      if (res.ok) {
        const requestId = res.data?.requestId;
        toast(requestId ? `Status updated. RequestId: ${requestId}` : "Status updated", "success");
        setReasonOpen(false);
        setReasonAction(null);
        setReason("");
        refetch();
      } else {
        const details = getErrorDetails(res.error.details);
        if (res.status === 502) {
          setLastStatusFailure({
            requestId: details.requestId ?? "—",
            upstreamStatus: details.upstreamStatus,
            status,
            reason: reason.trim(),
          });
        }
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Status update failed",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    setLastStatusFailure(null);
    const payload = { status: "ACTIVE" as const, reason: "" };
    try {
      const res = await platformFetch<{ ok: boolean; requestId?: string }>(
        `/api/platform/dealerships/${id}/status`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          platformUserId: userId ?? undefined,
        }
      );
      if (!res.ok && "status" in res && res.status === 401) setUnauthorized(true);
      if (res.ok) {
        const requestId = res.data?.requestId;
        toast(requestId ? `Dealership activated. RequestId: ${requestId}` : "Dealership activated", "success");
        refetch();
      } else {
        const details = getErrorDetails(res.error.details);
        if (res.status === 502) {
          setLastStatusFailure({
            requestId: details.requestId ?? "—",
            upstreamStatus: details.upstreamStatus,
            status: "ACTIVE",
            reason: "",
          });
        }
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Activate failed",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryStatus = async () => {
    if (!lastStatusFailure) return;
    setActionLoading(true);
    const payload = lastStatusFailure.reason
      ? { status: lastStatusFailure.status, reason: lastStatusFailure.reason }
      : { status: lastStatusFailure.status };
    try {
      const res = await platformFetch<{ ok: boolean; requestId?: string }>(
        `/api/platform/dealerships/${id}/status`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          platformUserId: userId ?? undefined,
        }
      );
      if (!res.ok && "status" in res && res.status === 401) setUnauthorized(true);
      if (res.ok) {
        const requestId = res.data?.requestId;
        toast(requestId ? `Status updated. RequestId: ${requestId}` : "Status updated", "success");
        setLastStatusFailure(null);
        refetch();
      } else {
        const details = getErrorDetails(res.error.details);
        if (res.status === 502) {
          setLastStatusFailure((prev) =>
            prev
              ? { ...prev, requestId: details.requestId ?? prev.requestId, upstreamStatus: details.upstreamStatus }
              : null
          );
        }
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Status update failed",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleProvision = async () => {
    const key = provisionIdempotencyKey ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : null);
    if (!key) return;
    if (!provisionIdempotencyKey) setProvisionIdempotencyKey(key);
    setProvisionError(null);
    setActionLoading(true);
    try {
      const res = await platformFetch<{
        status: string;
        dealerDealershipId?: string;
        provisionedAt?: string;
        requestId?: string;
        idempotencyKey?: string;
      }>(`/api/platform/dealerships/${id}/provision`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key }),
        platformUserId: userId ?? undefined,
      });
      if (!res.ok && "status" in res && res.status === 401) setUnauthorized(true);
      if (res.ok) {
        setProvisionSuccess({
          requestId: res.data.requestId ?? "—",
          provisionedAt: res.data.provisionedAt ?? "",
          dealerDealershipId: res.data.dealerDealershipId ?? "",
          idempotencyKey: res.data.idempotencyKey ?? key,
        });
        setProvisionError(null);
        toast("Dealership provisioned", "success");
        refetch();
      } else {
        const isDealerFail =
          !res.ok && (("status" in res && res.status === 502) || res.error.code === "DEALER_PROVISION_FAILED");
        const details = getErrorDetails(res.error.details);
        if (isDealerFail) {
          setProvisionError({
            requestId: details.requestId ?? "—",
            idempotencyKey: details.idempotencyKey ?? key,
            upstreamStatus: details.upstreamStatus,
          });
        }
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Provision failed",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryProvision = async () => {
    const key = provisionIdempotencyKey ?? provisionError?.idempotencyKey;
    if (!key) return;
    setProvisionError(null);
    setActionLoading(true);
    try {
      const res = await platformFetch<{
        status: string;
        dealerDealershipId?: string;
        provisionedAt?: string;
        requestId?: string;
        idempotencyKey?: string;
      }>(`/api/platform/dealerships/${id}/provision`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key }),
        platformUserId: userId ?? undefined,
      });
      if (!res.ok && "status" in res && res.status === 401) setUnauthorized(true);
      if (res.ok) {
        setProvisionSuccess({
          requestId: res.data.requestId ?? "—",
          provisionedAt: res.data.provisionedAt ?? "",
          dealerDealershipId: res.data.dealerDealershipId ?? "",
          idempotencyKey: res.data.idempotencyKey ?? key,
        });
        setProvisionError(null);
        toast("Dealership provisioned", "success");
        refetch();
      } else {
        const isDealerFail =
          ("status" in res && res.status === 502) || res.error.code === "DEALER_PROVISION_FAILED";
        const details = getErrorDetails(res.error.details);
        if (isDealerFail) {
          setProvisionError({
            requestId: details.requestId ?? "—",
            idempotencyKey: details.idempotencyKey ?? key,
            upstreamStatus: details.upstreamStatus,
          });
        }
        toast(
          getPlatformUiErrorMessage({
            status: res.status,
            error: res.error,
            fallback: "Provision failed",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied to clipboard`, "success");
    } catch {
      toast(`Failed to copy ${label}`, "error");
    }
  };

  const handleSendOwnerInvite = async () => {
    if (!ownerInviteEmail.trim()) return;
    setOwnerInviteLoading(true);
    setOwnerInviteAcceptUrl(null);
    try {
      const res = await platformFetch<PlatformOwnerInviteResponse>(
        `/api/platform/dealerships/${id}/owner-invite`,
        {
          method: "POST",
          body: JSON.stringify({ email: ownerInviteEmail.trim() }),
          platformUserId: userId ?? undefined,
        }
      );
      if (!res.ok && "status" in res && res.status === 401) setUnauthorized(true);
      if (res.ok && res.data) {
        if (res.data.alreadySentRecently) {
          toast("Invite already sent recently. Link re-shown.", "success");
        } else {
          toast("Invite email sent.", "success");
        }
        if (res.data.acceptUrl) {
          setOwnerInviteAcceptUrl(res.data.acceptUrl);
        } else {
          setOwnerInviteOpen(false);
          setOwnerInviteEmail("");
        }
      } else {
        toast(
          getPlatformUiErrorMessage({
            status: !res.ok ? res.status : undefined,
            error: !res.ok ? res.error : null,
            fallback: "Send owner invite failed",
          }),
          "error"
        );
      }
    } catch {
      toast("Network error. Please retry.", "error");
    } finally {
      setOwnerInviteLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!ownerInviteAcceptUrl) return;
    try {
      await navigator.clipboard.writeText(ownerInviteAcceptUrl);
      setCopyInviteLinkLabel("Copied!");
      toast("Invite link copied to clipboard", "success");
      setTimeout(() => setCopyInviteLinkLabel("Copy invite link"), 2000);
    } catch {
      toast("Failed to copy link", "error");
    }
  };

  const closeOwnerInviteModal = () => {
    setOwnerInviteOpen(false);
    setOwnerInviteEmail("");
    setOwnerInviteAcceptUrl(null);
    setCopyInviteLinkLabel("Copy invite link");
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

  if (loading && !d) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (unauthorized || (error && !d)) {
    return (
      <div className="space-y-4">
        <Link href="/platform/dealerships" className="text-[var(--accent)] hover:underline text-sm">
          ← Dealerships
        </Link>
        {unauthorized ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-[var(--text)] mb-2">Sign in again to continue.</p>
              <Link
                href="/platform/login"
                className="text-[var(--accent)] font-medium hover:underline"
              >
                Sign in again
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error?.message} {error?.code === "FORBIDDEN" && "(403)"}
          </div>
        )}
      </div>
    );
  }

  if (!d) return null;

  const lifecycleStatuses = ["ACTIVE", "SUSPENDED", "CLOSED"];
  const isLifecycleStatus = lifecycleStatuses.includes(d.status);

  return (
    <div className="space-y-4">
      <Link href="/platform/dealerships" className="text-[var(--accent)] hover:underline text-sm">
        ← Dealerships
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dealership</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registry</CardTitle>
          {canChangeStatus && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                disabled={
                  actionLoading ||
                  d.status !== "APPROVED" ||
                  !!d.dealerDealershipId
                }
                onClick={handleProvision}
                title={
                  d.status !== "APPROVED"
                    ? "Only APPROVED dealerships can be provisioned"
                    : d.dealerDealershipId
                      ? "Already provisioned"
                      : "Provision dealer tenant"
                }
              >
                Provision
              </Button>
              <Button
                variant="secondary"
                disabled={actionLoading || d.status === "ACTIVE"}
                onClick={handleActivate}
                title="Set status to ACTIVE"
              >
                Set ACTIVE
              </Button>
              <Button
                variant="secondary"
                disabled={actionLoading || d.status === "SUSPENDED"}
                onClick={() => openReasonModal("suspend")}
              >
                Suspend
              </Button>
              <Button
                variant="danger"
                disabled={actionLoading || d.status === "CLOSED"}
                onClick={() => openReasonModal("close")}
              >
                Close
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="flex items-center gap-2">
            <span className="text-[var(--text-soft)]">Status:</span>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium ${
                isLifecycleStatus
                  ? d.status === "ACTIVE"
                    ? "bg-green-100 text-green-800"
                    : d.status === "SUSPENDED"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-200 text-slate-800"
                  : "bg-[var(--muted)] text-[var(--text)]"
              }`}
              aria-label={`Lifecycle status: ${d.status}`}
            >
              {d.status}
            </span>
          </p>

          {lastStatusFailure && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Last status change could not be applied at dealer</p>
              <p className="mt-1 text-[var(--text-soft)]">
                RequestId: {lastStatusFailure.requestId}
                {lastStatusFailure.upstreamStatus != null && ` · Upstream status: ${lastStatusFailure.upstreamStatus}`}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={handleRetryStatus}
                disabled={actionLoading}
                aria-label="Retry last status change"
              >
                Retry last status change
              </Button>
            </div>
          )}

          {(provisionIdempotencyKey || provisionError?.idempotencyKey) && !d.dealerDealershipId && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-sm">
              <p className="text-[var(--text-soft)] mb-1">Idempotency key</p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="flex-1 min-w-0 break-all font-mono text-xs bg-[var(--bg)] px-2 py-1 rounded">
                  {provisionIdempotencyKey ?? provisionError?.idempotencyKey}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      provisionIdempotencyKey ?? provisionError?.idempotencyKey ?? "",
                      "Idempotency key"
                    )
                  }
                  aria-label="Copy idempotency key"
                >
                  Copy
                </Button>
                {!d.dealerDealershipId && canChangeStatus && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setProvisionError(null);
                      setProvisionSuccess(null);
                      if (typeof crypto !== "undefined" && crypto.randomUUID) {
                        setProvisionIdempotencyKey(crypto.randomUUID());
                      } else {
                        setProvisionIdempotencyKey(null);
                      }
                    }}
                    aria-label="Generate new idempotency key"
                  >
                    Generate new key
                  </Button>
                )}
              </div>
            </div>
          )}

          {provisionSuccess && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <p className="font-medium">Provisioned successfully</p>
              <p className="mt-1">RequestId: {provisionSuccess.requestId}</p>
              <p className="mt-1">Provisioned at: {provisionSuccess.provisionedAt ? new Date(provisionSuccess.provisionedAt).toLocaleString() : "—"}</p>
              <p className="mt-1">Dealer dealership ID: {provisionSuccess.dealerDealershipId || "—"}</p>
            </div>
          )}

          {provisionError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Dealer call failed</p>
              <p className="mt-1">RequestId: {provisionError.requestId}</p>
              <p className="mt-1">Idempotency key: {provisionError.idempotencyKey}</p>
              {provisionError.upstreamStatus != null && (
                <p className="mt-1">Upstream status: {provisionError.upstreamStatus}</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={handleRetryProvision}
                disabled={actionLoading}
                aria-label="Retry provision with same idempotency key"
              >
                Retry Provision
              </Button>
            </div>
          )}

          <p><span className="text-[var(--text-soft)]">Legal name:</span> {d.legalName}</p>
          <p><span className="text-[var(--text-soft)]">Display name:</span> {d.displayName}</p>
          <p><span className="text-[var(--text-soft)]">Plan:</span> {d.planKey}</p>
          {d.dealerDealershipId && (
            <p><span className="text-[var(--text-soft)]">Dealer dealership ID:</span> {d.dealerDealershipId}</p>
          )}
          {canSendOwnerInvite && d.dealerDealershipId && (
            <div className="pt-2">
              <Button
                variant="secondary"
                onClick={() => { setOwnerInviteOpen(true); setOwnerInviteEmail(""); }}
              >
                Send Owner Invite
              </Button>
            </div>
          )}
          {d.provisionedAt && (
            <p><span className="text-[var(--text-soft)]">Provisioned at:</span> {new Date(d.provisionedAt).toLocaleString()}</p>
          )}
          <p><span className="text-[var(--text-soft)]">Created:</span> {new Date(d.createdAt).toLocaleString()}</p>
          <p><span className="text-[var(--text-soft)]">Updated:</span> {new Date(d.updatedAt).toLocaleString()}</p>
        </CardContent>
      </Card>

      {d.dealerDealershipId && (
        <Card>
          <CardHeader>
            <CardTitle>Invites</CardTitle>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : invitesData?.data.length ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      {role && CAN_REVOKE_INVITE.includes(role) && <TableHead aria-label="Actions" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitesData.data.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.emailMasked}</TableCell>
                        <TableCell>{inv.roleName}</TableCell>
                        <TableCell>{inv.status}</TableCell>
                        <TableCell className="text-[var(--text-soft)]">
                          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleString() : "—"}
                        </TableCell>
                        {role && CAN_REVOKE_INVITE.includes(role) && (
                          <TableCell>
                            {inv.status === "PENDING" ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={revokingInviteId === inv.id}
                                onClick={() => handleRevokeInvite(inv.id)}
                              >
                                {revokingInviteId === inv.id ? "…" : "Revoke"}
                              </Button>
                            ) : null}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-sm text-[var(--text-soft)]">{invitesData.meta.total} total</p>
              </>
            ) : (
              <p className="py-4 text-sm text-[var(--text-soft)]">No invites. Use &quot;Send Owner Invite&quot; above to add one.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Plan</CardTitle>
          {canEditPlan && (
            <Button variant="secondary" size="sm" onClick={openPlanEdit}>
              Edit plan
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p><span className="text-[var(--text-soft)]">Plan key:</span> {d.planKey}</p>
          {d.limits && typeof d.limits === "object" && Object.keys(d.limits as object).length > 0 ? (
            <p className="mt-2"><span className="text-[var(--text-soft)]">Limits:</span> <code className="text-xs bg-[var(--muted)] px-1 rounded">{JSON.stringify(d.limits)}</code></p>
          ) : (
            <p className="mt-2 text-[var(--text-soft)]">No limits set.</p>
          )}
        </CardContent>
      </Card>

      {canStartSupportSession && (
        <Card>
          <CardHeader>
            <CardTitle>Support session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text-soft)] mb-3">
              Open the dealer app as this dealership. You will see a banner and can end the session from there. Session lasts 2 hours.
            </p>
            <Button
              variant="secondary"
              onClick={() => setSupportSessionConfirmOpen(true)}
              disabled={supportSessionLoading}
            >
              {supportSessionLoading ? "Starting…" : "Open as dealer"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/platform/audit?targetType=dealership&targetId=${id}`}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View activity in Audit Logs →
          </Link>
        </CardContent>
      </Card>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogHeader>
          <DialogTitle>
            {reasonAction === "suspend" ? "Suspend dealership" : "Close dealership"}
          </DialogTitle>
          <DialogDescription>
            Reason is required and will be stored in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason"
            maxLength={2000}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setReasonOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={submitReasonAction}
            disabled={!reason.trim() || actionLoading}
          >
            {reasonAction === "suspend" ? "Suspend" : "Close"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={planEditOpen} onOpenChange={setPlanEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit plan</DialogTitle>
          <DialogDescription>Update plan key and limits for this dealership. Limits must be valid JSON (e.g. {`{"seat_limit": 10}`}).</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Plan key</label>
            <select
              value={planKeyEdit}
              onChange={(e) => setPlanKeyEdit(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            >
              {PLAN_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Limits (JSON)</label>
            <textarea
              value={limitsEdit}
              onChange={(e) => setLimitsEdit(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-mono text-[var(--text)]"
              spellCheck={false}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setPlanEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePlan} disabled={planSaving}>{planSaving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={supportSessionConfirmOpen} onOpenChange={(open) => !supportSessionLoading && setSupportSessionConfirmOpen(open)}>
        <DialogHeader>
          <DialogTitle>Start support session</DialogTitle>
          <DialogDescription>
            You will be redirected to the dealer app as this dealership. A banner will indicate you are in a support session. The session lasts 2 hours. You can end it anytime from the dealer app.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setSupportSessionConfirmOpen(false)} disabled={supportSessionLoading}>Cancel</Button>
          <Button onClick={handleStartSupportSession} disabled={supportSessionLoading}>{supportSessionLoading ? "Starting…" : "Continue"}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={ownerInviteOpen} onOpenChange={(open) => !open && closeOwnerInviteModal()}>
        <DialogHeader>
          <DialogTitle>Send Owner Invite</DialogTitle>
          <DialogDescription>
            {ownerInviteAcceptUrl
              ? "Invite sent. Copy the link below and send it to the invitee."
              : "Send an invite to the email address to become the dealership owner in the dealer portal."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {!ownerInviteAcceptUrl ? (
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={ownerInviteEmail}
              onChange={(e) => setOwnerInviteEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-soft)]">
                Emails can take a minute. If not received, copy the link below.
              </p>
              <p className="text-sm font-medium text-[var(--text-soft)]">Invite link</p>
              <p className="text-sm text-[var(--text)] break-all rounded bg-[var(--muted)] p-2" title={ownerInviteAcceptUrl}>
                {ownerInviteAcceptUrl}
              </p>
              <Button
                variant="secondary"
                onClick={handleCopyInviteLink}
                aria-label={copyInviteLinkLabel}
              >
                {copyInviteLinkLabel}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          {ownerInviteAcceptUrl ? (
            <Button onClick={closeOwnerInviteModal}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeOwnerInviteModal}>
                Cancel
              </Button>
              <Button
                onClick={handleSendOwnerInvite}
                disabled={!ownerInviteEmail.trim() || ownerInviteLoading}
              >
                {ownerInviteLoading ? "Sending…" : "Send invite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}
