"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { MutationButton, useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import type { SequenceTemplate, SequenceStep, ApiListResponse, ApiDataResponse } from "./types";
import { shouldFetchCrm } from "./crm-guards";

const LIMIT = 25;
const STEP_TYPES: SelectOption[] = [
  { value: "create_task", label: "Create task" },
  { value: "send_email", label: "Send email" },
  { value: "send_sms", label: "Send SMS" },
];

export function SequencesPage() {
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const { addToast } = useToast();

  const [templates, setTemplates] = React.useState<SequenceTemplate[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTemplate, setEditTemplate] = React.useState<SequenceTemplate | null>(null);
  const [stepsOpen, setStepsOpen] = React.useState<SequenceTemplate | null>(null);
  const [steps, setSteps] = React.useState<SequenceStep[]>([]);
  const [addStepOpen, setAddStepOpen] = React.useState(false);
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [stepType, setStepType] = React.useState("create_task");
  const [stepTitle, setStepTitle] = React.useState("");
  const [stepDelayDays, setStepDelayDays] = React.useState("0");
  const [submitLoading, setSubmitLoading] = React.useState(false);

  const fetchTemplates = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead)) return;
    const params = new URLSearchParams({ limit: String(meta.limit), offset: String(meta.offset) });
    const res = await apiFetch<ApiListResponse<SequenceTemplate>>(`/api/crm/sequence-templates?${params}`);
    setTemplates(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetchTemplates().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, [canRead, meta.offset, fetchTemplates]);

  const openSteps = React.useCallback((t: SequenceTemplate) => {
    setStepsOpen(t);
    if (t.steps && t.steps.length >= 0) setSteps(t.steps);
    else apiFetch<ApiDataResponse<SequenceTemplate>>(`/api/crm/sequence-templates/${t.id}`).then((r) => setSteps(r.data.steps ?? [])).catch(() => setSteps([]));
  }, []);

  const refreshSteps = React.useCallback(() => {
    if (!stepsOpen) return;
    apiFetch<ApiDataResponse<SequenceTemplate>>(`/api/crm/sequence-templates/${stepsOpen.id}`).then((r) => {
      setSteps(r.data.steps ?? []);
      setStepsOpen((prev) => (prev ? { ...prev, steps: r.data.steps } : null));
    }).catch(() => {});
  }, [stepsOpen]);

  const handleCreateTemplate = async () => {
    if (!canWrite) return;
    setSubmitLoading(true);
    try {
      await apiFetch("/api/crm/sequence-templates", {
        method: "POST",
        body: JSON.stringify({ name: formName, description: formDescription || null }),
      });
      addToast("success", "Template created");
      setCreateOpen(false);
      setFormName("");
      setFormDescription("");
      fetchTemplates();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!canWrite || !editTemplate) return;
    setSubmitLoading(true);
    try {
      await apiFetch(`/api/crm/sequence-templates/${editTemplate.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: formName, description: formDescription || null }),
      });
      addToast("success", "Template updated");
      setEditTemplate(null);
      fetchTemplates();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAddStep = async () => {
    if (!canWrite || !stepsOpen) return;
    setSubmitLoading(true);
    try {
      const config: Record<string, unknown> = { delayDays: parseInt(stepDelayDays, 10) || 0 };
      if (stepType === "create_task") config.title = stepTitle || "Follow-up";
      await apiFetch(`/api/crm/sequence-templates/${stepsOpen.id}/steps`, {
        method: "POST",
        body: JSON.stringify({ order: steps.length, stepType, config }),
      });
      addToast("success", "Step added");
      setAddStepOpen(false);
      setStepTitle("");
      setStepDelayDays("0");
      refreshSteps();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/crm/sequence-steps/${stepId}`, { method: "DELETE" });
      addToast("success", "Step deleted");
      refreshSteps();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
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
    return <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); fetchTemplates().finally(() => setLoading(false)); }} />;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text)]">Sequence templates</h1>
        {canWrite && (
          <WriteGuard>
            <Button onClick={() => { setCreateOpen(true); setFormName(""); setFormDescription(""); }} disabled={writeDisabled}>
              Create template
            </Button>
          </WriteGuard>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="rounded-md border border-[var(--border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-[var(--text-soft)]">{t.description ?? "—"}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <WriteGuard>
                          <span className="inline-flex gap-2">
                            <Button size="sm" variant="secondary" disabled={writeDisabled} onClick={() => openSteps(t)}>Steps</Button>
                            <Button size="sm" variant="secondary" disabled={writeDisabled} onClick={() => { setEditTemplate(t); setFormName(t.name); setFormDescription(t.description ?? ""); }}>Edit</Button>
                          </span>
                        </WriteGuard>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {templates.length === 0 && <EmptyState title="No templates" description={canWrite ? "Create a template to add steps." : "No sequence templates."} />}
          <Pagination meta={meta} onPageChange={(o) => setMeta((m) => ({ ...m, offset: o }))} />
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
          <div><Label>Description</Label><Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <MutationButton onClick={handleCreateTemplate} disabled={!formName.trim() || submitLoading}>{submitLoading ? "Creating…" : "Create"}</MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogHeader><DialogTitle>Edit template</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
          <div><Label>Description</Label><Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditTemplate(null)}>Cancel</Button>
          <MutationButton onClick={handleUpdateTemplate} disabled={!formName.trim() || submitLoading}>{submitLoading ? "Saving…" : "Save"}</MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!stepsOpen} onOpenChange={(open) => !open && setStepsOpen(null)}>
        <DialogHeader><DialogTitle>{stepsOpen?.name ?? "Template"} — Steps</DialogTitle></DialogHeader>
        <div className="space-y-2 py-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between rounded border p-2">
              <span>{i + 1}. {s.stepType} {s.config && typeof s.config === "object" && "title" in s.config ? `(${s.config.title})` : ""}</span>
              {canWrite && <WriteGuard><Button size="sm" variant="secondary" disabled={writeDisabled} onClick={() => handleDeleteStep(s.id)}>Delete</Button></WriteGuard>}
            </div>
          ))}
          {canWrite && <WriteGuard><Button size="sm" disabled={writeDisabled} onClick={() => setAddStepOpen(true)}>Add step</Button></WriteGuard>}
        </div>
      </Dialog>

      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogHeader><DialogTitle>Add step</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Type</Label><Select options={STEP_TYPES} value={stepType} onChange={setStepType} /></div>
          {stepType === "create_task" && <div><Label>Title</Label><Input value={stepTitle} onChange={(e) => setStepTitle(e.target.value)} placeholder="Follow-up" /></div>}
          <div><Label>Delay (days)</Label><Input type="number" min={0} value={stepDelayDays} onChange={(e) => setStepDelayDays(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setAddStepOpen(false)}>Cancel</Button>
          <MutationButton onClick={handleAddStep} disabled={submitLoading}>{submitLoading ? "Adding…" : "Add"}</MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
