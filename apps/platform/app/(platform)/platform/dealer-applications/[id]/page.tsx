"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { platformFetch } from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/toast";
import { getPlatformUiErrorMessage } from "@/lib/ui-error";

type DetailData = {
  id: string;
  source: string;
  status: string;
  ownerEmail: string;
  inviteId: string | null;
  invitedByUserId: string | null;
  dealershipId: string | null;
  platformApplicationId: string | null;
  platformDealershipId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  activationSentAt: string | null;
  activatedAt: string | null;
  reviewerUserId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  profile: Record<string, unknown> | null;
};

const CAN_APPROVE_REJECT = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"];

export default function DealerApplicationDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { userId, role } = usePlatformAuthContext();
  const [app, setApp] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const toast = useToast();

  const canApproveReject = role != null && CAN_APPROVE_REJECT.includes(role);

  const refetch = useCallback(() => {
    if (!id) return;
    setLoading(true);
    platformFetch<DetailData>(`/api/platform/dealer-applications/${id}`, {
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (res.ok) {
          setApp(res.data);
          setReviewNotes((res.data.reviewNotes as string) ?? "");
        } else setError(res.error?.message ?? "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [id, userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleApprove = async () => {
    if (!id || !userId) return;
    setActionLoading(true);
    const res = await platformFetch<Record<string, unknown>>(
      `/api/platform/dealer-applications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
        platformUserId: userId,
      }
    );
    setActionLoading(false);
    if (res.ok) {
      toast("Application approved", "success");
      refetch();
    } else {
      toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Approve failed" }), "error");
    }
  };

  const handleRejectSubmit = async () => {
    if (!id || !userId || !rejectReason.trim()) return;
    setActionLoading(true);
    const res = await platformFetch<Record<string, unknown>>(
      `/api/platform/dealer-applications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected", rejectionReason: rejectReason.trim() }),
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
      toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Reject failed" }), "error");
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !userId) return;
    setNotesSaving(true);
    const res = await platformFetch<Record<string, unknown>>(
      `/api/platform/dealer-applications/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ reviewNotes: reviewNotes.trim() || null }),
        platformUserId: userId,
      }
    );
    setNotesSaving(false);
    if (res.ok) {
      toast("Notes saved", "success");
      refetch();
    } else {
      toast(getPlatformUiErrorMessage({ status: res.status, error: res.error, fallback: "Save failed" }), "error");
    }
  };

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
        <Link href="/platform/dealer-applications" className="text-sm text-[var(--accent)] hover:underline">
          ← Dealer applications
        </Link>
        <p className="text-[var(--danger-muted-fg)]">{error}</p>
      </div>
    );
  }

  if (!app) return null;

  const profile = app.profile ?? {};
  const biz = (profile.businessInfo as Record<string, unknown>) ?? {};
  const owner = (profile.ownerInfo as Record<string, unknown>) ?? {};
  const contact = (profile.primaryContact as Record<string, unknown>) ?? {};
  const pricing = (profile.pricingPackageInterest as Record<string, unknown>) ?? {};

  return (
    <div className="space-y-4">
      <Link href="/platform/dealer-applications" className="text-sm text-[var(--accent)] hover:underline">
        ← Dealer applications
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dealer application</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lifecycle</CardTitle>
          <div className="flex flex-wrap gap-2">
            {canApproveReject && (app.status === "submitted" || app.status === "under_review") && (
              <>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => setRejectOpen(true)} disabled={actionLoading}>
                  Reject
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-[var(--text-soft)]">Status:</span> {app.status}</p>
          <p><span className="text-[var(--text-soft)]">Source:</span> {app.source}</p>
          <p><span className="text-[var(--text-soft)]">Owner email:</span> {app.ownerEmail}</p>
          {app.submittedAt && (
            <p><span className="text-[var(--text-soft)]">Submitted:</span> {new Date(app.submittedAt).toLocaleString()}</p>
          )}
          {app.approvedAt && (
            <p><span className="text-[var(--text-soft)]">Approved:</span> {new Date(app.approvedAt).toLocaleString()}</p>
          )}
          {app.rejectedAt && (
            <p><span className="text-[var(--text-soft)]">Rejected:</span> {new Date(app.rejectedAt).toLocaleString()}</p>
          )}
          {app.activationSentAt && (
            <p><span className="text-[var(--text-soft)]">Activation sent:</span> {new Date(app.activationSentAt).toLocaleString()}</p>
          )}
          {app.activatedAt && (
            <p><span className="text-[var(--text-soft)]">Activated:</span> {new Date(app.activatedAt).toLocaleString()}</p>
          )}
          {app.dealershipId && (
            <p><span className="text-[var(--text-soft)]">Dealership ID:</span> {app.dealershipId}</p>
          )}
          <p><span className="text-[var(--text-soft)]">Created:</span> {new Date(app.createdAt).toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review notes</CardTitle>
          <CardDescription>Internal notes for this application. Not visible to applicant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="min-h-[80px] w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Review notes…"
          />
          <Button variant="secondary" size="sm" onClick={handleSaveNotes} disabled={notesSaving}>
            {notesSaving ? "Saving…" : "Save notes"}
          </Button>
        </CardContent>
      </Card>

      {app.rejectionReason && (
        <Card>
          <CardHeader>
            <CardTitle>Rejection reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--text)]">{app.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Application data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-[var(--text)]">Business</p>
            <p><span className="text-[var(--text-soft)]">Name:</span> {String(biz.businessName ?? "—")}</p>
            <p><span className="text-[var(--text-soft)]">Phone:</span> {String(biz.businessPhone ?? "—")}</p>
            <p><span className="text-[var(--text-soft)]">Address:</span> {String(biz.businessAddress ?? "—")}</p>
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Owner</p>
            <p><span className="text-[var(--text-soft)]">Name:</span> {String(owner.fullName ?? "—")}</p>
            <p><span className="text-[var(--text-soft)]">Email:</span> {String(owner.email ?? app.ownerEmail)}</p>
            <p><span className="text-[var(--text-soft)]">Phone:</span> {String(owner.phone ?? "—")}</p>
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Primary contact</p>
            <p><span className="text-[var(--text-soft)]">Same as owner:</span> {contact.sameAsOwner ? "Yes" : "No"}</p>
            {!contact.sameAsOwner && (
              <>
                <p><span className="text-[var(--text-soft)]">Name:</span> {String(contact.fullName ?? "—")}</p>
                <p><span className="text-[var(--text-soft)]">Email:</span> {String(contact.email ?? "—")}</p>
              </>
            )}
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Pricing / package</p>
            <p><span className="text-[var(--text-soft)]">Preference:</span> {String(pricing.bundlePreference ?? "—")}</p>
            <p><span className="text-[var(--text-soft)]">Interest:</span> {String(pricing.packageInterest ?? "—")}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>Reason is required and will be stored.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            label="Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason"
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
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
