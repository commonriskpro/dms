"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { MutationButton, useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { formatCents, parseDollarsToCents, centsToDollarInput } from "@/lib/money";
import type {
  Opportunity,
  OpportunityActivity,
  SequenceInstance,
  Stage,
  SequenceTemplate,
  ApiDataResponse,
  ApiListResponse,
} from "./types";
import { opportunityStatusToVariant } from "./types";
import { StatusBadge } from "@/components/ui/status-badge";
import { shouldFetchCrm } from "./crm-guards";
import { customerDetailPath } from "@/lib/routes/detail-paths";
import { JourneyBarWidget } from "./JourneyBarWidget";

type OpportunityDetailPageProps = { opportunityId: string };

export function OpportunityDetailPage({ opportunityId }: OpportunityDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const { addToast } = useToast();
  const returnTo = searchParams.get("returnTo");
  const withReturnTo = React.useCallback(
    (href: string) => {
      if (!returnTo) return href;
      const [base, existingQuery = ""] = href.split("?");
      const params = new URLSearchParams(existingQuery);
      params.set("returnTo", returnTo);
      const nextQuery = params.toString();
      return nextQuery ? `${base}?${nextQuery}` : base;
    },
    [returnTo]
  );

  const [opportunity, setOpportunity] = React.useState<Opportunity | null>(null);
  const [activity, setActivity] = React.useState<OpportunityActivity[]>([]);
  const [activityMeta, setActivityMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [sequences, setSequences] = React.useState<SequenceInstance[]>([]);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [editStageId, setEditStageId] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<Opportunity["status"]>("OPEN");
  const [editValueDollars, setEditValueDollars] = React.useState("");
  const [editOwnerId, setEditOwnerId] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [editNextActionText, setEditNextActionText] = React.useState("");
  const [editNextActionAt, setEditNextActionAt] = React.useState("");
  const [owners, setOwners] = React.useState<{ id: string; fullName: string | null; email: string }[]>([]);

  const [activeTab, setActiveTab] = React.useState("overview");
  const [startSeqOpen, setStartSeqOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<SequenceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [startSeqLoading, setStartSeqLoading] = React.useState(false);
  const [queueReturnNotice, setQueueReturnNotice] = React.useState<string | null>(null);
  const buildQueueReturnHref = React.useCallback(() => {
    if (!returnTo) return null;
    const [base, existingQuery = ""] = returnTo.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("refreshed", "1");
    if (opportunity?.customerId) params.set("workedCustomerId", opportunity.customerId);
    params.set("workedOpportunityId", opportunityId);
    const nextQuery = params.toString();
    return nextQuery ? `${base}?${nextQuery}` : base;
  }, [opportunity?.customerId, opportunityId, returnTo]);

  const refreshOpportunity = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead) || !opportunityId) return;
    const res = await apiFetch<ApiDataResponse<Opportunity>>(
      `/api/crm/opportunities/${opportunityId}`
    );
    setOpportunity(res.data);
    setEditStageId(res.data.stageId);
    setEditStatus(res.data.status);
    setEditValueDollars(res.data.estimatedValueCents ? centsToDollarInput(res.data.estimatedValueCents) : "");
    setEditOwnerId(res.data.ownerId ?? "");
    setEditNotes(res.data.notes ?? "");
    setEditNextActionText(res.data.nextActionText ?? "");
    setEditNextActionAt(res.data.nextActionAt ? new Date(res.data.nextActionAt).toISOString().slice(0, 16) : "");
  }, [canRead, opportunityId]);

  const refreshActivity = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead) || !opportunityId) return;
    const res = await apiFetch<ApiListResponse<OpportunityActivity>>(
      `/api/crm/opportunities/${opportunityId}/activity?limit=50&offset=0`
    );
    setActivity(res.data);
    setActivityMeta(res.meta);
  }, [canRead, opportunityId]);

  const refreshSequences = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead) || !opportunityId) return;
    const res = await apiFetch<ApiDataResponse<SequenceInstance[]>>(
      `/api/crm/opportunities/${opportunityId}/sequences`
    );
    setSequences(res.data);
  }, [canRead, opportunityId]);

  const loadData = React.useCallback(() => {
    if (!shouldFetchCrm(canRead) || !opportunityId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<ApiDataResponse<Opportunity>>(`/api/crm/opportunities/${opportunityId}`),
      apiFetch<ApiListResponse<OpportunityActivity>>(`/api/crm/opportunities/${opportunityId}/activity?limit=50&offset=0`),
      apiFetch<ApiDataResponse<SequenceInstance[]>>(`/api/crm/opportunities/${opportunityId}/sequences`),
    ])
      .then(([oppRes, actRes, seqRes]) => {
        setOpportunity(oppRes.data);
        setEditStageId(oppRes.data.stageId);
        setEditStatus(oppRes.data.status);
        setEditValueDollars(oppRes.data.estimatedValueCents ? centsToDollarInput(oppRes.data.estimatedValueCents) : "");
        setEditOwnerId(oppRes.data.ownerId ?? "");
        setEditNotes(oppRes.data.notes ?? "");
        setEditNextActionText(oppRes.data.nextActionText ?? "");
        setEditNextActionAt(oppRes.data.nextActionAt ? new Date(oppRes.data.nextActionAt).toISOString().slice(0, 16) : "");
        setActivity(actRes.data);
        setActivityMeta(actRes.meta);
        setSequences(seqRes.data);
        const pipelineId = oppRes.data.stage?.pipelineId;
        if (pipelineId) {
          return apiFetch<ApiDataResponse<Stage[]>>(`/api/crm/pipelines/${pipelineId}/stages`).then((s) => setStages(s.data));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [canRead, opportunityId]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead) || !opportunityId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [canRead, opportunityId, loadData]);

  React.useEffect(() => {
    if (!hasPermission("admin.memberships.read")) return;
    apiFetch<{ data: { user: { id: string; fullName: string | null; email: string } }[] }>("/api/admin/memberships?limit=100")
      .then((r) => setOwners(r.data?.map((x) => x.user).filter(Boolean) ?? []))
      .catch(() => {});
  }, [hasPermission]);

  const handleSaveOverview = async () => {
    if (!canWrite || !opportunityId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        stageId: editStageId,
        status: editStatus,
        notes: editNotes || null,
        nextActionText: editNextActionText || null,
        nextActionAt: editNextActionAt ? new Date(editNextActionAt).toISOString() : null,
      };
      const cents = parseDollarsToCents(editValueDollars);
      if (cents) body.estimatedValueCents = cents;
      else body.estimatedValueCents = null;
      body.ownerId = editOwnerId || null;
      await apiFetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      addToast("success", "Saved");
      setQueueReturnNotice("Opportunity updated. Return to the queue when you’re ready for the next record.");
      refreshOpportunity();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleStartSequence = async () => {
    if (!canWrite || !opportunityId || !selectedTemplateId) return;
    setStartSeqLoading(true);
    try {
      await apiFetch(`/api/crm/opportunities/${opportunityId}/sequences`, {
        method: "POST",
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      addToast("success", "Sequence started");
      setQueueReturnNotice("Sequence started. Return to the queue when you’re ready for the next record.");
      setStartSeqOpen(false);
      setSelectedTemplateId("");
      refreshSequences();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setStartSeqLoading(false);
    }
  };

  const handleInstanceStatus = async (instanceId: string, status: "active" | "paused" | "stopped") => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/crm/sequence-instances/${instanceId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      addToast("success", "Updated");
      setQueueReturnNotice("Sequence status updated. Return to the queue when you’re ready for the next record.");
      refreshSequences();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleSkipStep = async (instanceId: string, stepInstanceId: string) => {
    if (!canWrite) return;
    try {
      await apiFetch(
        `/api/crm/sequence-instances/${instanceId}/steps/${stepInstanceId}/skip`,
        { method: "POST" }
      );
      addToast("success", "Step skipped");
      setQueueReturnNotice("Sequence step skipped. Return to the queue when you’re ready for the next record.");
      refreshSequences();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleQuickStatus = async (status: Opportunity["status"]) => {
    if (!canWrite || !opportunityId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "LOST" ? { lossReason: "Updated from opportunity workspace" } : {}),
        }),
      });
      addToast("success", "Opportunity updated");
      setQueueReturnNotice("Opportunity status updated. Return to the queue when you’re ready for the next record.");
      await refreshOpportunity();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don&apos;t have access to CRM.</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => { setError(null); loadData(); }}
      />
    );
  }

  if (loading || !opportunity) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const stageOptions: SelectOption[] = stages.map((s) => ({ value: s.id, label: s.name }));
  const ownerOptions: SelectOption[] = [
    { value: "", label: "Unassigned" },
    ...owners.map((u) => ({ value: u.id, label: u.fullName || u.email || u.id.slice(0, 8) })),
  ];
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(opportunity.updatedAt).getTime()) / 86_400_000));
  const nextActionLabel = opportunity.nextActionAt ? new Date(opportunity.nextActionAt).toLocaleString() : "Not scheduled";
  const missingCommitment = !opportunity.nextActionText || !opportunity.nextActionAt;

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10"
      className="flex flex-col space-y-4"
    >
      <PageHeader
        title={
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Opportunity workspace
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
                {opportunity.customer?.name ?? opportunity.customerId.slice(0, 8)}
              </h1>
              <StatusBadge variant={opportunityStatusToVariant(opportunity.status)}>{opportunity.status}</StatusBadge>
            </div>
          </div>
        }
        description={`Stage ${opportunity.stage?.name ?? "unknown"} · created ${new Date(opportunity.createdAt).toLocaleDateString()} · ${missingCommitment ? "needs a next-step commitment" : "follow-up committed"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {returnTo ? (
              <Link href={returnTo}>
                <Button size="sm" variant="secondary">Back to queue</Button>
              </Link>
            ) : null}
            <Link href={withReturnTo(customerDetailPath(opportunity.customerId))}>
              <Button size="sm" variant="secondary">Customer</Button>
            </Link>
            <Link href={withReturnTo(`/crm/inbox?customerId=${encodeURIComponent(opportunity.customerId)}`)}>
              <Button size="sm" variant="secondary">Inbox</Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => router.push(returnTo ?? "/crm/opportunities?view=list")}>
              Back to pipeline
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Est. value" value={opportunity.estimatedValueCents ? formatCents(opportunity.estimatedValueCents) : "—"} sub="current opportunity value" color="blue" trend={[1, 1]} />
        <KpiCard label="Next action" value={opportunity.nextActionText ?? "Not set"} sub={nextActionLabel} color="amber" accentValue={missingCommitment} hasUpdate={missingCommitment} trend={[1, 1]} />
        <KpiCard label="Owner" value={opportunity.owner?.fullName ?? opportunity.owner?.email ?? "Unassigned"} sub="current accountability" color="cyan" trend={[1, 1]} />
        <KpiCard label="Age" value={ageDays === 0 ? "Today" : `${ageDays}d`} sub="since last movement" color="violet" trend={[Math.max(ageDays, 1), Math.max(ageDays, 1)]} />
      </div>

      <JourneyBarWidget
        opportunityId={opportunityId}
        canRead={canRead}
        canWrite={canWrite}
        onStageChanged={refreshOpportunity}
      />

      {returnTo && queueReturnNotice ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text)]">{queueReturnNotice}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setQueueReturnNotice(null)}>
                Stay here
              </Button>
              <Link href={buildQueueReturnHref() ?? returnTo}>
                <Button size="sm">Return to queue</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 min-[1600px]:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.82fr)]">
        <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} aria-label="Opportunity sections">
        <TabsList>
          <TabsTrigger value="overview" selected={activeTab === "overview"} onSelect={() => setActiveTab("overview")}>Overview</TabsTrigger>
          <TabsTrigger value="activity" selected={activeTab === "activity"} onSelect={() => setActiveTab("activity")}>Activity</TabsTrigger>
          <TabsTrigger value="sequences" selected={activeTab === "sequences"} onSelect={() => setActiveTab("sequences")}>Sequences</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" selected={activeTab === "overview"}>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[var(--text-soft)]">
                Customer ID: {opportunity.customerId}
                {opportunity.vehicleId && ` · Vehicle: ${opportunity.vehicleId}`}
                {opportunity.dealId && ` · Deal: ${opportunity.dealId}`}
              </p>
              {canWrite ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Stage</Label>
                      <Select options={stageOptions} value={editStageId} onChange={setEditStageId} />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        options={[
                          { value: "OPEN", label: "Open" },
                          { value: "WON", label: "Won" },
                          { value: "LOST", label: "Lost" },
                        ]}
                        value={editStatus}
                        onChange={(v) => setEditStatus(v as Opportunity["status"])}
                      />
                    </div>
                    <div>
                      <Label>Est. value ($)</Label>
                      <Input
                        value={editValueDollars}
                        onChange={(e) => setEditValueDollars(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Assigned to</Label>
                      <Select options={ownerOptions} value={editOwnerId} onChange={setEditOwnerId} />
                    </div>
                    <div>
                      <Label>Next action</Label>
                      <Input
                        value={editNextActionText}
                        onChange={(e) => setEditNextActionText(e.target.value)}
                        placeholder="Call with trade-in range"
                      />
                    </div>
                    <div>
                      <Label>Next action due</Label>
                      <Input
                        type="datetime-local"
                        value={editNextActionAt}
                        onChange={(e) => setEditNextActionAt(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <MutationButton onClick={handleSaveOverview} disabled={saving || writeDisabled}>
                    {saving ? "Saving…" : "Save"}
                  </MutationButton>
                </>
              ) : (
                <p className="text-[var(--text-soft)]">You need crm.write to edit.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" selected={activeTab === "activity"}>
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {activity.map((a) => (
                  <li
                    key={a.id}
                    className="rounded border border-[var(--border)] p-2 text-sm"
                  >
                    <span className="font-medium">{a.activityType}</span>
                    {a.fromStage && a.toStage && (
                      <span> · {a.fromStage.name} → {a.toStage.name}</span>
                    )}
                    {a.actor && <span> · {a.actor.fullName ?? a.actor.id}</span>}
                    <span className="text-[var(--text-soft)]">
                      {" "}
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                    {a.metadata && Object.keys(a.metadata).length > 0 && (
                      <pre className="mt-1 overflow-auto text-xs">
                        {JSON.stringify(a.metadata, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
              {activity.length === 0 && (
                <p className="text-[var(--text-soft)]">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" selected={activeTab === "sequences"}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sequences</CardTitle>
                {canWrite && (
                  <WriteGuard>
                    <Button
                      disabled={writeDisabled}
                      onClick={() => {
                        setStartSeqOpen(true);
                        apiFetch<ApiListResponse<SequenceTemplate>>("/api/crm/sequence-templates?limit=100")
                          .then((r) => setTemplates(r.data))
                          .catch(() => setTemplates([]));
                      }}
                    >
                      Start sequence
                    </Button>
                  </WriteGuard>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!canWrite && (
                <p className="mb-4 text-sm text-[var(--text-soft)]">You need crm.write to start or control sequences.</p>
              )}
              <ul className="space-y-4">
                {sequences.map((inst) => (
                  <li
                    key={inst.id}
                    className="rounded border border-[var(--border)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{inst.template.name}</span>
                      <span className="text-sm text-[var(--text-soft)]">
                        {inst.status} · Started {new Date(inst.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {canWrite && inst.status !== "stopped" && (
                      <WriteGuard>
                        <div className="mt-2 flex gap-2">
                          {inst.status === "active" && (
                            <Button size="sm" variant="secondary" disabled={writeDisabled} onClick={() => handleInstanceStatus(inst.id, "paused")}>
                              Pause
                            </Button>
                          )}
                          {inst.status === "paused" && (
                            <Button size="sm" variant="secondary" disabled={writeDisabled} onClick={() => handleInstanceStatus(inst.id, "active")}>
                              Resume
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" disabled={writeDisabled} onClick={() => handleInstanceStatus(inst.id, "stopped")}>
                            Stop
                          </Button>
                        </div>
                      </WriteGuard>
                    )}
                    {inst.stepInstances && inst.stepInstances.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {inst.stepInstances.map((si) => (
                          <li key={si.id} className="flex items-center gap-2">
                            <span>{si.step.stepType}</span>
                            <span className="text-[var(--text-soft)]">{si.status}</span>
                            {canWrite && si.status === "pending" && (
                              <WriteGuard>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={writeDisabled}
                                  onClick={() => handleSkipStep(inst.id, si.id)}
                                >
                                  Skip
                                </Button>
                              </WriteGuard>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              {sequences.length === 0 && (
                <p className="text-[var(--text-soft)]">No sequences for this opportunity.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>

        <div className="space-y-3">
          <Widget compact title="Quick actions" subtitle="Keep opportunity movement and follow-up maintenance inside this workspace.">
            <div className="flex flex-wrap gap-2">
              {canWrite ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => handleQuickStatus("WON")} disabled={saving || writeDisabled}>
                    Mark won
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleQuickStatus("LOST")} disabled={saving || writeDisabled}>
                    Mark lost
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleQuickStatus("OPEN")} disabled={saving || writeDisabled}>
                    Re-open
                  </Button>
                </>
              ) : null}
              <Link href={withReturnTo(`/crm/inbox?customerId=${encodeURIComponent(opportunity.customerId)}`)}>
                <Button size="sm" variant="secondary">Open inbox</Button>
              </Link>
              <Link href={withReturnTo(customerDetailPath(opportunity.customerId))}>
                <Button size="sm" variant="secondary">Open customer</Button>
              </Link>
            </div>
          </Widget>

          <Widget compact title="Execution read" subtitle="What needs attention before you leave this record.">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text)]">Next action commitment</span>
                <StatusBadge variant={missingCommitment ? "warning" : "success"}>
                  {missingCommitment ? "Missing" : "Set"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text)]">Sequences running</span>
                <span className="font-semibold tabular-nums text-[var(--muted-text)]">{sequences.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text)]">Recent activity</span>
                <span className="font-semibold tabular-nums text-[var(--muted-text)]">{activityMeta.total}</span>
              </div>
            </div>
          </Widget>
        </div>
      </div>

      <Dialog open={startSeqOpen} onOpenChange={setStartSeqOpen}>
        <DialogHeader>
          <DialogTitle>Start sequence</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label>Template</Label>
          <Select
            options={[
              { value: "", label: "Select template" },
              ...templates.map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setStartSeqOpen(false)}>
            Cancel
          </Button>
          <MutationButton
            onClick={handleStartSequence}
            disabled={!selectedTemplateId || startSeqLoading}
          >
            {startSeqLoading ? "Starting…" : "Start"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </PageShell>
  );
}
