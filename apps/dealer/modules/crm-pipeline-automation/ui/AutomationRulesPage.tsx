"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import type { AutomationRule, ApiListResponse } from "./types";
import { shouldFetchCrm } from "./crm-guards";

const TRIGGER_EVENTS: SelectOption[] = [
  { value: "lead_created", label: "Lead created" },
  { value: "customer.created", label: "Customer created" },
  { value: "opportunity.created", label: "Opportunity created" },
  { value: "opportunity.stage_changed", label: "Opportunity stage changed" },
  { value: "opportunity.status_changed", label: "Opportunity status changed" },
  { value: "customer.task_completed", label: "Customer task completed" },
  { value: "appointment_missed", label: "Appointment missed" },
];

function triggerLabel(value: string): string {
  const o = TRIGGER_EVENTS.find((e) => e.value === value);
  return o?.label ?? value;
}

const LIMIT = 25;

export function AutomationRulesPage() {
  const { hasPermission } = useSession();
  const canRead = hasPermission("crm.read");
  const canWrite = hasPermission("crm.write");
  const { addToast } = useToast();

  const [rules, setRules] = React.useState<AutomationRule[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRule, setEditRule] = React.useState<AutomationRule | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formTrigger, setFormTrigger] = React.useState("opportunity.created");
  const [formSchedule, setFormSchedule] = React.useState<"immediate" | "delayed">("immediate");
  const [formActive, setFormActive] = React.useState(true);
  const [formActions, setFormActions] = React.useState<{ type: string; params?: Record<string, unknown> }[]>([{ type: "create_task", params: { title: "Follow-up", dueInDays: 1 } }]);
  const [submitLoading, setSubmitLoading] = React.useState(false);

  const fetchRules = React.useCallback(async () => {
    if (!shouldFetchCrm(canRead)) return;
    const params = new URLSearchParams({ limit: String(meta.limit), offset: String(meta.offset) });
    const res = await apiFetch<ApiListResponse<AutomationRule>>(
      `/api/crm/automation-rules?${params}`
    );
    setRules(res.data);
    setMeta(res.meta);
  }, [canRead, meta.limit, meta.offset]);

  React.useEffect(() => {
    if (!shouldFetchCrm(canRead)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchRules().catch((e) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, [canRead, meta.offset, fetchRules]);

  const handleCreate = async () => {
    if (!canWrite) return;
    setSubmitLoading(true);
    try {
      await apiFetch("/api/crm/automation-rules", {
        method: "POST",
        body: JSON.stringify({
          name: formName,
          triggerEvent: formTrigger,
          schedule: formSchedule,
          isActive: formActive,
          actions: formActions,
        }),
      });
      addToast("success", "Rule created");
      setCreateOpen(false);
      fetchRules();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!canWrite || !editRule) return;
    setSubmitLoading(true);
    try {
      await apiFetch(`/api/crm/automation-rules/${editRule.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: formName,
          triggerEvent: formTrigger,
          schedule: formSchedule,
          isActive: formActive,
          actions: formActions,
        }),
      });
      addToast("success", "Rule updated");
      setEditRule(null);
      fetchRules();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite || !deleteId) return;
    try {
      await apiFetch(`/api/crm/automation-rules/${deleteId}`, { method: "DELETE" });
      addToast("success", "Rule deleted");
      setDeleteId(null);
      fetchRules();
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
    return (
      <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); fetchRules().finally(() => setLoading(false)); }} />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Automation rules"
        actions={
          canWrite ? (
            <WriteGuard>
              <Button onClick={() => { setCreateOpen(true); setFormName(""); setFormTrigger("lead_created"); setFormSchedule("immediate"); setFormActive(true); setFormActions([{ type: "create_task", params: { title: "Follow-up", dueInDays: 1 } }]); }}>
                Create rule
              </Button>
            </WriteGuard>
          ) : undefined
        }
      />
      <div className="space-y-4">

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="rounded-md border border-[var(--border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{triggerLabel(r.triggerEvent)}</TableCell>
                    <TableCell>{r.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell>{r.schedule}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <WriteGuard>
                          <Button size="sm" variant="secondary" onClick={() => { setEditRule(r); setFormName(r.name); setFormTrigger(r.triggerEvent); setFormSchedule(r.schedule); setFormActive(r.isActive); setFormActions(r.actions?.length ? r.actions : [{ type: "create_task", params: {} }]); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" className="ml-2" onClick={() => setDeleteId(r.id)}>
                            Delete
                          </Button>
                        </WriteGuard>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rules.length === 0 && <EmptyState title="No rules" description="Create a rule to automate actions." />}
          <Pagination meta={meta} onPageChange={(o) => setMeta((m) => ({ ...m, offset: o }))} />
        </>
      )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader><DialogTitle>Create rule</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
          <div><Label>Trigger event</Label><Select options={TRIGGER_EVENTS} value={formTrigger} onChange={setFormTrigger} /></div>
          <div><Label>Schedule</Label><Select options={[{ value: "immediate", label: "Immediate" }, { value: "delayed", label: "Delayed" }]} value={formSchedule} onChange={(v) => setFormSchedule(v as "immediate" | "delayed")} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="active" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} /><Label htmlFor="active">Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <MutationButton onClick={handleCreate} disabled={!formName.trim() || submitLoading}>{submitLoading ? "Creating…" : "Create"}</MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!editRule} onOpenChange={(open) => !open && setEditRule(null)}>
        <DialogHeader><DialogTitle>Edit rule</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
          <div><Label>Trigger event</Label><Select options={TRIGGER_EVENTS} value={formTrigger} onChange={setFormTrigger} /></div>
          <div><Label>Schedule</Label><Select options={[{ value: "immediate", label: "Immediate" }, { value: "delayed", label: "Delayed" }]} value={formSchedule} onChange={(v) => setFormSchedule(v as "immediate" | "delayed")} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="edit-active" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} /><Label htmlFor="edit-active">Active</Label></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setEditRule(null)}>Cancel</Button>
          <MutationButton onClick={handleUpdate} disabled={!formName.trim() || submitLoading}>{submitLoading ? "Saving…" : "Save"}</MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogHeader><DialogTitle>Delete rule?</DialogTitle></DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <MutationButton variant="secondary" onClick={handleDelete}>Delete</MutationButton>
        </DialogFooter>
      </Dialog>
    </PageShell>
  );
}
