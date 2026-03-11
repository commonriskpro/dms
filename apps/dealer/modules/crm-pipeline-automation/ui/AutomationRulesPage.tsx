"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { getApiErrorMessage } from "@/lib/client/http";
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
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { StatusBadge } from "@/components/ui/status-badge";
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

  const activeCount = rules.filter((rule) => rule.isActive).length;
  const inactiveCount = rules.filter((rule) => !rule.isActive).length;
  const immediateCount = rules.filter((rule) => rule.schedule === "immediate").length;
  const delayedCount = rules.filter((rule) => rule.schedule === "delayed").length;

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
              Automation center
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[44px]">
              CRM automation rules
            </h1>
          </div>
        }
        description="Configuration and monitoring surface for event-driven CRM actions. Keep exceptions visible, but keep daily reps out of this route."
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active rules" value={activeCount.toLocaleString()} sub="currently firing" color="green" trend={[activeCount || 1, activeCount || 1]} />
        <KpiCard label="Inactive rules" value={inactiveCount.toLocaleString()} sub="disabled configurations" color="amber" trend={[inactiveCount || 1, inactiveCount || 1]} />
        <KpiCard label="Immediate" value={immediateCount.toLocaleString()} sub="runs at trigger time" color="blue" trend={[immediateCount || 1, immediateCount || 1]} />
        <KpiCard label="Delayed" value={delayedCount.toLocaleString()} sub="scheduled after trigger" color="violet" trend={[delayedCount || 1, delayedCount || 1]} />
      </div>

      <div className="grid gap-4 min-[1600px]:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.82fr)]">
        <div className="space-y-4">

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="surface-noise overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
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
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-[var(--text)]">{r.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted-text)]">{r.actions?.length ?? 0} downstream actions</p>
                      </div>
                    </TableCell>
                    <TableCell>{triggerLabel(r.triggerEvent)}</TableCell>
                    <TableCell>
                      <StatusBadge variant={r.isActive ? "success" : "neutral"}>
                        {r.isActive ? "Active" : "Inactive"}
                      </StatusBadge>
                    </TableCell>
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

        <div className="space-y-3">
          <Widget compact title="Rule health" subtitle="How this automation surface should be read operationally.">
            <div className="space-y-2 text-sm text-[var(--muted-text)]">
              <p>Active rules should be few, explicit, and tied to measurable CRM events.</p>
              <p>Inactive rules are retained configurations, not queue work for reps.</p>
              <p>When a rule starts causing failures, surface the job exception in command center rather than pulling reps into this page.</p>
            </div>
          </Widget>
          <Widget compact title="Trigger mix" subtitle="Current distribution of automation intent.">
            <div className="space-y-3">
              {TRIGGER_EVENTS.map((event) => {
                const count = rules.filter((rule) => rule.triggerEvent === event.value).length;
                if (count === 0) return null;
                return (
                  <div key={event.value} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--text)]">{event.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--muted-text)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </Widget>
        </div>
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
