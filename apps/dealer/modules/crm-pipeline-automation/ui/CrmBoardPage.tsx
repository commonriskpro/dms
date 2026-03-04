"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { MutationButton, useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StageColumn } from "./components/StageColumn";
import type {
  Pipeline,
  Stage,
  Opportunity,
  ApiListResponse,
  ApiDataResponse,
} from "./types";
import { parseDollarsToCents } from "@/lib/money";
import { shouldFetchCrm } from "./crm-guards";

type CustomersListRes = { data: { id: string; name: string }[]; meta?: { total: number } };

export function CrmBoardPage() {
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const { addToast } = useToast();

  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(null);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [customers, setCustomers] = React.useState<{ id: string; name: string }[]>([]);
  const [createCustomerId, setCreateCustomerId] = React.useState("");
  const [createStageId, setCreateStageId] = React.useState("");
  const [createValueDollars, setCreateValueDollars] = React.useState("");
  const [createOwnerId, setCreateOwnerId] = React.useState("");
  const [owners, setOwners] = React.useState<{ id: string; fullName: string | null; email: string }[]>([]);

  const abortRef = React.useRef<AbortController | null>(null);

  const fetchPipelines = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead)) return;
    const res = await apiFetch<ApiListResponse<Pipeline>>("/api/crm/pipelines?limit=100");
    setPipelines(res.data);
    const defaultPipe = res.data.find((p) => p.isDefault) ?? res.data[0];
    if (defaultPipe && !selectedPipelineId) setSelectedPipelineId(defaultPipe.id);
  }, [canRead, selectedPipelineId]);

  const fetchStages = React.useCallback(async (pipelineId: string) => {
    if (!shouldFetchCrm(canRead)) return;
    const res = await apiFetch<ApiDataResponse<Stage[]>>(
      `/api/crm/pipelines/${pipelineId}/stages`
    );
    setStages(res.data);
  }, [canRead]);

  const fetchOpportunities = React.useCallback(async (pipelineId: string) => {
    if (!shouldFetchCrm(canRead)) return;
    const params = new URLSearchParams({
      pipelineId,
      status: "OPEN",
      limit: "500",
      offset: "0",
    });
    const res = await apiFetch<ApiListResponse<Opportunity>>(
      `/api/crm/opportunities?${params}`
    );
    setOpportunities(res.data);
  }, [canRead]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    fetchPipelines().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      abortRef.current?.abort();
    };
  }, [canRead, fetchPipelines]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead) || !selectedPipelineId) return;
    fetchStages(selectedPipelineId).catch(() => {});
    fetchOpportunities(selectedPipelineId).catch(() => {});
  }, [canRead, selectedPipelineId, fetchStages, fetchOpportunities]);

  React.useEffect(() => {
    if (selectedPipelineId && pipelines.length > 0) setLoading(false);
  }, [selectedPipelineId, pipelines.length]);

  const refreshBoard = React.useCallback(() => {
    if (selectedPipelineId) {
      fetchOpportunities(selectedPipelineId).catch(() => {});
    }
  }, [selectedPipelineId, fetchOpportunities]);

  const handleMoveStage = React.useCallback(
    async (opportunityId: string, toStageId: string) => {
      if (!canWrite) return;
      try {
        await apiFetch(`/api/crm/opportunities/${opportunityId}`, {
          method: "PATCH",
          body: JSON.stringify({ stageId: toStageId }),
        });
        addToast("success", "Opportunity moved");
        refreshBoard();
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      }
    },
    [canWrite, addToast, refreshBoard]
  );

  const openCreateModal = React.useCallback(() => {
    setCreateOpen(true);
    setCreateCustomerId("");
    setCreateStageId(stages[0]?.id ?? "");
    setCreateValueDollars("");
    setCreateOwnerId("");
    if (canRead) {
      apiFetch<CustomersListRes>("/api/customers?limit=200")
        .then((r) => setCustomers(r.data?.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })) ?? []))
        .catch(() => setCustomers([]));
      if (hasPermission("admin.memberships.read")) {
        apiFetch<{ data: { user: { id: string; fullName: string | null; email: string } }[] }>("/api/admin/memberships?limit=100")
          .then((r) => setOwners(r.data?.map((x) => x.user).filter(Boolean) ?? []))
          .catch(() => setOwners([]));
      }
    }
  }, [stages, canRead, hasPermission]);

  const handleCreateOpportunity = React.useCallback(async () => {
    if (!canWrite || !selectedPipelineId || !createCustomerId || !createStageId) return;
    setCreateLoading(true);
    try {
      const body: Record<string, unknown> = {
        customerId: createCustomerId,
        stageId: createStageId,
      };
      const cents = parseDollarsToCents(createValueDollars);
      if (cents) body.estimatedValueCents = cents;
      if (createOwnerId) body.ownerId = createOwnerId;
      await apiFetch(`/api/crm/opportunities`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      addToast("success", "Opportunity created");
      setCreateOpen(false);
      refreshBoard();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setCreateLoading(false);
    }
  }, [
    canWrite,
    selectedPipelineId,
    createCustomerId,
    createStageId,
    createValueDollars,
    createOwnerId,
    addToast,
    refreshBoard,
  ]);

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
        onRetry={() => {
          setError(null);
          setLoading(true);
          fetchPipelines().then(() => {}).catch((e) => setError(e instanceof Error ? e.message : "Failed"));
        }}
      />
    );
  }

  if (loading || pipelines.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-[280px]" />
          ))}
        </div>
      </div>
    );
  }

  const pipelineOptions: SelectOption[] = pipelines.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const stageOptions: SelectOption[] = stages.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const oppsByStage = stages.map((stage) => {
    const list = opportunities.filter((o) => o.stageId === stage.id);
    const total = list.reduce(
      (sum, o) => sum + (o.estimatedValueCents ? parseInt(o.estimatedValueCents, 10) : 0),
      0
    );
    return { stage, opportunities: list, totalValueCents: total };
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-[var(--text)]">Pipeline</h1>
          {pipelineOptions.length > 1 && (
            <Select
              label="Pipeline"
              options={pipelineOptions}
              value={selectedPipelineId ?? ""}
              onChange={(v) => setSelectedPipelineId(v)}
              aria-label="Select pipeline"
            />
          )}
        </div>
        {canWrite && (
          <WriteGuard>
            <Button onClick={openCreateModal} disabled={writeDisabled}>New Opportunity</Button>
          </WriteGuard>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {oppsByStage.map(({ stage, opportunities: list, totalValueCents }) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            opportunities={list}
            totalValueCents={totalValueCents}
            onMoveStage={handleMoveStage}
            stages={stages}
            canWrite={canWrite}
            writeDisabled={writeDisabled}
            onOpenOpportunity={(id) => window.location.assign(`/crm/opportunities/${id}`)}
          />
        ))}
      </div>

      {stages.length === 0 && (
        <EmptyState
          title="No stages"
          description="Add stages to this pipeline to see the board."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>New Opportunity</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="create-customer">Customer *</Label>
              <Select
                id="create-customer"
                options={[
                  { value: "", label: "Select customer" },
                  ...customers.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={createCustomerId}
                onChange={setCreateCustomerId}
              />
            </div>
            <div>
              <Label htmlFor="create-stage">Stage *</Label>
              <Select
                id="create-stage"
                options={stageOptions}
                value={createStageId}
                onChange={setCreateStageId}
              />
            </div>
            <div>
              <Label htmlFor="create-value">Est. value ($)</Label>
              <Input
                id="create-value"
                type="text"
                placeholder="0.00"
                value={createValueDollars}
                onChange={(e) => setCreateValueDollars(e.target.value)}
              />
            </div>
            {owners.length > 0 && (
              <div>
                <Label htmlFor="create-owner">Assigned to</Label>
                <Select
                  id="create-owner"
                  options={[
                    { value: "", label: "Unassigned" },
                    ...owners.map((u) => ({
                      value: u.id,
                      label: u.fullName || u.email || u.id.slice(0, 8),
                    })),
                  ]}
                  value={createOwnerId}
                  onChange={setCreateOwnerId}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <MutationButton
              onClick={handleCreateOpportunity}
              disabled={!createCustomerId || !createStageId || createLoading}
            >
              {createLoading ? "Creating…" : "Create"}
            </MutationButton>
          </DialogFooter>
      </Dialog>
    </div>
  );
}
