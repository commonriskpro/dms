"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, type SelectOption } from "@/components/ui/select";
import { MutationButton, useWriteDisabled } from "@/components/write-guard";
import { PageShell } from "@/components/ui/page-shell";
import { CustomerHeader } from "@/components/ui-system/entities";
import {
  ActivityTimeline,
  SignalContextBlock,
  SignalExplanationItem,
  SignalHeaderBadgeGroup,
  TimelineItem,
  type SignalSurfaceItem,
} from "@/components/ui-system";
import { typography } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { CustomerForm } from "./CustomerForm";
import { RoadToSale } from "./RoadToSale";
import { JourneyBarWidget } from "@/modules/crm-pipeline-automation/ui/JourneyBarWidget";
import { getStageLabel, CRM_STAGES } from "@/lib/constants/crm-stages";
import { CustomerDetailContent } from "./CustomerDetailContent";
import { NextActionZone } from "./components/NextActionZone";
import type {
  CustomerDetail,
  CustomerNote,
  CustomerTask,
  CustomerActivityItem,
  CustomerStatus,
  CustomerPhoneInput,
  CustomerEmailInput,
  NotesListResponse,
  TasksListResponse,
  ActivityListResponse,
  TimelineListResponse,
  CallbacksListResponse,
} from "@/lib/types/customers";
import { CUSTOMER_STATUS_OPTIONS } from "@/lib/types/customers";
import {
  fetchDomainSignals,
  toContextSignals,
  toHeaderSignals,
  toSignalKeys,
} from "@/modules/intelligence/ui/surface-adapters";
import { toSignalExplanation } from "@/modules/intelligence/ui/explanation-adapters";
import { toTimelineSignalEvents } from "@/modules/intelligence/ui/timeline-adapters";

type MemberOption = { id: string; fullName: string | null; email: string };

export type CustomerDetailPageProps = {
  id: string;
  initialCustomer?: CustomerDetail | null;
  initialTimeline?: TimelineListResponse | null;
  initialCallbacks?: CallbacksListResponse | null;
};

export function CustomerDetailPage({
  id,
  initialCustomer: initialCustomerProp,
  initialTimeline,
  initialCallbacks,
}: CustomerDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("customers.read");
  const canWrite = hasPermission("customers.write");
  const { disabled: writeDisabled } = useWriteDisabled();
  const canMutate = canWrite && !writeDisabled;
  const canReadCrm = hasPermission("crm.read");
  const canWriteCrm = hasPermission("crm.write");
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
  const buildQueueReturnHref = React.useCallback(() => {
    if (!returnTo) return null;
    const [base, existingQuery = ""] = returnTo.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("refreshed", "1");
    params.set("workedCustomerId", id);
    const nextQuery = params.toString();
    return nextQuery ? `${base}?${nextQuery}` : base;
  }, [id, returnTo]);

  const [customer, setCustomer] = React.useState<CustomerDetail | null>(initialCustomerProp ?? null);
  const [loading, setLoading] = React.useState(!initialCustomerProp);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("lead");
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [stageChangeOpen, setStageChangeOpen] = React.useState(false);
  const [stageChangeValue, setStageChangeValue] = React.useState<string>("");
  const [stageChangeLoading, setStageChangeLoading] = React.useState(false);
  const [addNoteOpen, setAddNoteOpen] = React.useState(false);
  const [addTaskOpen, setAddTaskOpen] = React.useState(false);
  const [smsOpen, setSmsOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [appointmentOpen, setAppointmentOpen] = React.useState(false);
  const [dispositionOpen, setDispositionOpen] = React.useState(false);
  const [leadRefreshKey, setLeadRefreshKey] = React.useState(0);
  const [assignedOptions, setAssignedOptions] = React.useState<{ value: string; label: string }[]>([]);
  const [surfaceSignals, setSurfaceSignals] = React.useState<SignalSurfaceItem[]>([]);
  const [queueReturnNotice, setQueueReturnNotice] = React.useState<string | null>(null);

  const fetchCustomer = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: CustomerDetail }>(`/api/customers/${id}`);
      setCustomer(res.data);
      setError(null);
      setNotFound(false);
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 404) {
        setNotFound(true);
        setCustomer(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load customer");
      }
    } finally {
      setLoading(false);
    }
  }, [id, canRead]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    if (initialCustomerProp) {
      setCustomer(initialCustomerProp);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCustomer();
  }, [canRead, id, fetchCustomer, initialCustomerProp]);

  React.useEffect(() => {
    if (!hasPermission("admin.memberships.read")) return;
    apiFetch<{ data: { user: MemberOption }[] }>("/api/admin/memberships?limit=100")
      .then((res) => {
        const seen = new Set<string>();
        const list: { value: string; label: string }[] = [];
        for (const m of res.data ?? []) {
          const u = m.user;
          if (u && !seen.has(u.id)) {
            seen.add(u.id);
            list.push({ value: u.id, label: u.fullName ?? u.email ?? u.id });
          }
        }
        setAssignedOptions(list);
      })
      .catch(() => setAssignedOptions([]));
  }, [hasPermission]);

  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "lead" || tab === "tasks" || tab === "appointments") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  React.useEffect(() => {
    let mounted = true;
    fetchDomainSignals({
      domain: "crm",
      includeResolved: true,
      limit: 40,
    })
      .then((signals) => {
        if (!mounted) return;
        setSurfaceSignals(signals);
      })
      .catch(() => {
        if (!mounted) return;
        setSurfaceSignals([]);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleEditSubmit = async (body: {
    name: string;
    status: CustomerStatus;
    leadSource?: string;
    leadCampaign?: string;
    leadMedium?: string;
    assignedTo?: string;
    tags?: string[];
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    phones?: CustomerPhoneInput[];
    emails?: CustomerEmailInput[];
  }) => {
    if (!canWrite) return;
    setEditSubmitting(true);
    try {
      await apiFetch<{ data: CustomerDetail }>(`/api/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      addToast("success", "Customer updated");
      setQueueReturnNotice("Customer updated. Return to the queue when you’re ready for the next record.");
      setEditOpen(false);
      fetchCustomer();
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canMutate) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/customers/${id}`, { method: "DELETE", expectNoContent: true });
      addToast("success", "Customer deleted");
      router.push("/customers");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleStageChangeConfirm = async () => {
    if (!canMutate || !stageChangeValue) return;
    setStageChangeLoading(true);
    try {
      await apiFetch<{ data: CustomerDetail }>(`/api/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: stageChangeValue as CustomerStatus }),
      });
      addToast("success", "Stage updated");
      setQueueReturnNotice("Customer stage updated. Return to the queue when you’re ready for the next record.");
      setStageChangeOpen(false);
      setStageChangeValue("");
      fetchCustomer();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setStageChangeLoading(false);
    }
  };

  const entityScope = React.useMemo(
    () => ({ entityType: "Customer", entityId: id }),
    [id]
  );
  const headerSignals = React.useMemo(
    () =>
      toHeaderSignals(surfaceSignals, {
        maxVisible: 3,
        entity: entityScope,
      }),
    [surfaceSignals, entityScope]
  );
  const contextSignals = React.useMemo(
    () =>
      toContextSignals(surfaceSignals, {
        maxVisible: 5,
        entity: entityScope,
        suppressKeys: toSignalKeys(headerSignals),
      }),
    [surfaceSignals, entityScope, headerSignals]
  );
  const timelineSignalEvents = React.useMemo(
    () =>
      toTimelineSignalEvents(surfaceSignals, {
        maxVisible: 8,
        entity: entityScope,
      }),
    [surfaceSignals, entityScope]
  );

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don’t have access to this customer.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link href={returnTo ?? "/customers"} className="text-sm text-[var(--accent)] hover:underline">
          ← {returnTo ? "Back to CRM queue" : "Back to customers"}
        </Link>
        <ErrorState title="Customer not found" message="It may have been deleted." onRetry={() => router.push(returnTo ?? "/customers")} />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Link href={returnTo ?? "/customers"} className="text-sm text-[var(--accent)] hover:underline">
          ← {returnTo ? "Back to CRM queue" : "Back to customers"}
        </Link>
        <ErrorState message={error ?? "Customer not found"} onRetry={fetchCustomer} />
      </div>
    );
  }

  const addressParts = [
    customer.addressLine1,
    customer.addressLine2,
    [customer.city, customer.region, customer.postalCode].filter(Boolean).join(" "),
    customer.country,
  ].filter(Boolean);

  const stageOptions: SelectOption[] = CRM_STAGES.map((s) => ({ value: s, label: getStageLabel(s) }));
  const stageBadgeClass =
    customer.status === "SOLD"
      ? "bg-[var(--success)]/15 text-[var(--success)]"
      : customer.status === "INACTIVE"
        ? "bg-[var(--danger)]/15 text-[var(--danger)]"
        : customer.status === "ACTIVE"
          ? "bg-[var(--accent)]/15 text-[var(--accent)]"
          : "bg-[var(--muted)] text-[var(--text-soft)]";

  return (
    <PageShell className={sectionStack}>
      <CustomerHeader
        name={customer.name}
        status={customer.status}
        subtitle={`Created ${new Date(customer.createdAt).toLocaleDateString()}`}
        breadcrumbs={(
          <Link
            href={returnTo ?? "/customers"}
            className="text-sm text-[var(--accent)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            ← {returnTo ? "Back to CRM queue" : "Back to customers"}
          </Link>
        )}
        meta={[
          { label: "Primary phone", value: customer.phones?.find((p) => p.isPrimary)?.value ?? customer.phones?.[0]?.value ?? "—" },
          { label: "Primary email", value: customer.emails?.find((e) => e.isPrimary)?.value ?? customer.emails?.[0]?.value ?? "—" },
        ]}
        actions={(
          <div className="flex flex-col items-end gap-2">
            <SignalHeaderBadgeGroup items={headerSignals} />
            <div className="flex flex-wrap items-center gap-2">
              {canWrite ? (
                <>
                  <MutationButton variant="secondary" onClick={() => setEditOpen(true)} disabled={!canMutate}>
                    Edit
                  </MutationButton>
                  <MutationButton variant="danger" onClick={() => setDeleteConfirmOpen(true)} disabled={!canMutate}>
                    Delete
                  </MutationButton>
                </>
              ) : (
                <span className="text-sm text-[var(--text-soft)]">Not allowed to edit or delete</span>
              )}
            </div>
          </div>
        )}
      />

      <div className="surface-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                CRM workspace
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                Work the customer record first
              </h2>
              <p className="max-w-3xl text-sm text-[var(--muted-text)]">
                Keep follow-up, communication, callbacks, and pipeline context anchored here before dropping into inbox or opportunity detail.
              </p>
            </div>

            <LeadActionStrip
              customer={customer}
              customerId={id}
              returnTo={returnTo}
              canRead={canRead}
              canWrite={canMutate}
              canReadCrm={!!canReadCrm}
              onOpenSms={() => setSmsOpen(true)}
              onOpenEmail={() => setEmailOpen(true)}
              onOpenAppointment={() => setAppointmentOpen(true)}
              onOpenAddTask={() => setAddTaskOpen(true)}
              onOpenDisposition={() => setDispositionOpen(true)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                Journey stage
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadgeClass}`}>
                  {getStageLabel(customer.status)}
                </span>
                {canMutate ? (
                  <Button size="sm" variant="secondary" onClick={() => setStageChangeOpen(true)}>
                    Change
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                Lead source
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {customer.leadSource ?? "Not captured"}
              </p>
            </div>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                Record owner
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {customer.assignedToProfile?.fullName ?? customer.assignedToProfile?.email ?? "Unassigned"}
              </p>
            </div>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                Last change
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {new Date(customer.updatedAt).toLocaleString()}
              </p>
            </div>
            {addressParts.length > 0 ? (
              <div className="col-span-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                  Location context
                </p>
                <p className="mt-2 text-sm text-[var(--text)]">{addressParts.join(", ")}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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

      {canReadCrm ? (
        <JourneyBarWidget
          customerId={id}
          canRead={canReadCrm}
          canWrite={canWriteCrm}
          onStageChanged={fetchCustomer}
        />
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
          <RoadToSale currentStage={customer.status} stageChangedAt={customer.updatedAt} />
        </div>
      )}

      <NextActionZone
        contextSignals={contextSignals}
        callbacks={initialCallbacks?.data ?? []}
        customerId={id}
        canReadCrm={!!canReadCrm}
      />

      <CustomerDetailContent
        customer={customer}
        customerId={id}
        mode="page"
        canRead={canRead}
        canWrite={canMutate}
        refreshKey={leadRefreshKey}
        initialTimeline={initialTimeline ?? undefined}
        initialCallbacks={initialCallbacks ?? undefined}
        onOpenSms={() => setSmsOpen(true)}
        onOpenEmail={() => setEmailOpen(true)}
        onOpenAppointment={() => setAppointmentOpen(true)}
        onOpenAddTask={() => setAddTaskOpen(true)}
        onOpenDisposition={() => setDispositionOpen(true)}
        onAddNote={() => setAddNoteOpen(true)}
        signalRailTop={
          <SignalContextBlock title="Customer intelligence" items={contextSignals} />
        }
        canReadDeals={hasPermission("deals.read")}
        canReadCrm={!!canReadCrm}
        returnTo={returnTo}
        signalTimeline={
          <ActivityTimeline
            title="Intelligence timeline"
            emptyTitle="No intelligence events"
            emptyDescription="Signal lifecycle events for this customer appear here."
          >
            {timelineSignalEvents.map((event) => (
              <TimelineItem
                key={event.key}
                title={event.title}
                timestamp={new Date(event.timestamp).toLocaleString()}
                detail={
                  event.signal ? (
                    <SignalExplanationItem
                      explanation={toSignalExplanation(event.signal)}
                      kind={event.kind}
                    />
                  ) : (
                    event.detail
                  )
                }
              />
            ))}
          </ActivityTimeline>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>Update customer details below.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <CustomerForm
            key={editOpen ? "open" : "closed"}
            customer={customer}
            assignedOptions={assignedOptions}
            onSubmit={handleEditSubmit}
            submitLabel="Save"
            isLoading={editSubmitting}
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogHeader>
          <DialogTitle>Delete customer?</DialogTitle>
          <DialogDescription>
            This will permanently delete this customer and their notes and tasks. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton variant="danger" onClick={handleDelete} disabled={deleteLoading || !canMutate}>
            {deleteLoading ? "Deleting…" : "Delete"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={stageChangeOpen} onOpenChange={setStageChangeOpen}>
        <DialogHeader>
          <DialogTitle>Change stage</DialogTitle>
          <DialogDescription>
            Confirm the new stage for this customer. This will update the road-to-sale progress.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select
            label="New stage"
            options={stageOptions}
            value={stageChangeValue}
            onChange={setStageChangeValue}
            aria-label="New stage"
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton onClick={handleStageChangeConfirm} disabled={stageChangeLoading || !stageChangeValue || !canMutate}>
            {stageChangeLoading ? "Saving…" : "Confirm"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <AddNoteDialog
        customerId={id}
        open={addNoteOpen}
        onOpenChange={setAddNoteOpen}
        onSuccess={() => { addToast("success", "Note added"); setQueueReturnNotice("Note added. Return to the queue when you’re ready for the next record."); fetchCustomer(); }}
        canWrite={canMutate}
      />
      <AddTaskDialog
        customerId={id}
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        onSuccess={() => {
          addToast("success", "Task added");
          setQueueReturnNotice("Task added. Return to the queue when you’re ready for the next record.");
          fetchCustomer();
          setLeadRefreshKey((k) => k + 1);
        }}
        canWrite={canMutate}
      />
      <SmsDialog
        customerId={id}
        phone={customer?.phones?.find((p) => p.isPrimary)?.value ?? customer?.phones?.[0]?.value ?? ""}
        open={smsOpen}
        onOpenChange={setSmsOpen}
        onSuccess={() => {
          addToast("success", "SMS sent");
          setQueueReturnNotice("SMS sent. Return to the queue when you’re ready for the next record.");
          setLeadRefreshKey((k) => k + 1);
        }}
        onError={(msg) => addToast("error", msg)}
        canWrite={canMutate}
      />
      <EmailDialog
        customerId={id}
        email={customer?.emails?.find((e) => e.isPrimary)?.value ?? customer?.emails?.[0]?.value ?? ""}
        open={emailOpen}
        onOpenChange={setEmailOpen}
        onSuccess={() => {
          addToast("success", "Email sent");
          setQueueReturnNotice("Email sent. Return to the queue when you’re ready for the next record.");
          setLeadRefreshKey((k) => k + 1);
        }}
        onError={(msg) => addToast("error", msg)}
        canWrite={canMutate}
      />
      <ScheduleAppointmentDialog
        customerId={id}
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        onSuccess={() => {
          addToast("success", "Appointment scheduled");
          setQueueReturnNotice("Appointment scheduled. Return to the queue when you’re ready for the next record.");
          setLeadRefreshKey((k) => k + 1);
        }}
        onError={(msg) => addToast("error", msg)}
        canWrite={canMutate}
      />
      <DispositionDialog
        customerId={id}
        currentStatus={(customer?.status ?? "LEAD") as CustomerStatus}
        open={dispositionOpen}
        onOpenChange={setDispositionOpen}
        onSuccess={() => {
          addToast("success", "Disposition updated");
          setQueueReturnNotice("Disposition updated. Return to the queue when you’re ready for the next record.");
          fetchCustomer();
          setLeadRefreshKey((k) => k + 1);
        }}
        onError={(msg) => addToast("error", msg)}
        canWrite={canMutate}
      />
    </PageShell>
  );
}

const actionStripButtonClass =
  "inline-flex items-center justify-center font-medium border border-transparent px-2.5 py-1.5 text-sm rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

export function LeadActionStrip({
  customer,
  customerId,
  returnTo,
  canRead,
  canWrite,
  canReadCrm,
  onOpenSms,
  onOpenEmail,
  onOpenAppointment,
  onOpenAddTask,
  onOpenDisposition,
}: {
  customer: CustomerDetail;
  customerId?: string;
  returnTo?: string | null;
  canRead: boolean;
  canWrite: boolean;
  canReadCrm?: boolean;
  onOpenSms: () => void;
  onOpenEmail?: () => void;
  onOpenAppointment: () => void;
  onOpenAddTask: () => void;
  onOpenDisposition: () => void;
}) {
  const primaryPhone = customer.phones?.find((p) => p.isPrimary) ?? customer.phones?.[0];
  const primaryEmail = customer.emails?.find((e) => e.isPrimary) ?? customer.emails?.[0];
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

  return (
    <div className="flex flex-wrap gap-2 mb-4" role="toolbar" aria-label="Lead actions">
      {canRead && primaryPhone ? (
        <a
          href={`tel:${primaryPhone.value.replace(/\D/g, "")}`}
          aria-label="Phone call"
          className={actionStripButtonClass}
        >
          Call
        </a>
      ) : null}
      {canWrite && (
        <Button size="sm" onClick={onOpenSms} aria-label="Send SMS">
          Send SMS
        </Button>
      )}
      {canWrite && onOpenEmail ? (
        <Button size="sm" onClick={onOpenEmail} aria-label="Send email">
          Send email
        </Button>
      ) : null}
      {canRead && primaryEmail ? (
        <a
          href={`mailto:${primaryEmail.value}`}
          aria-label="Open email client"
          className={actionStripButtonClass}
        >
          Email
        </a>
      ) : null}
      {canWrite && (
        <Button size="sm" onClick={onOpenAppointment} aria-label="Schedule appointment">
          Schedule Appointment
        </Button>
      )}
      {canWrite && (
        <Button size="sm" onClick={onOpenAddTask} aria-label="Add task">
          Add Task
        </Button>
      )}
      {canWrite && (
        <Button size="sm" variant="secondary" onClick={onOpenDisposition} aria-label="Disposition">
          Disposition
        </Button>
      )}
      {canReadCrm && customerId ? (
        <Link href={withReturnTo(`/crm/inbox?customerId=${encodeURIComponent(customerId)}`)}>
          <Button size="sm" variant="secondary" aria-label="Open inbox">
            Open Inbox
          </Button>
        </Link>
      ) : null}
      {canReadCrm && customerId ? (
        <Link href={withReturnTo(`/crm/opportunities?view=list&customerId=${encodeURIComponent(customerId)}`)}>
          <Button size="sm" variant="secondary" aria-label="Open opportunity">
            Open Opportunity
          </Button>
        </Link>
      ) : null}
    </div>
  );
}

function SmsDialog({
  customerId,
  phone,
  open,
  onOpenChange,
  onSuccess,
  onError,
  canWrite,
}: {
  customerId: string;
  phone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  canWrite: boolean;
}) {
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const canSend = canWrite && phone.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setLoading(true);
    try {
      await apiFetch("/api/messages/sms", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          phone: phone.trim(),
          message: message.trim(),
        }),
      });
      setMessage("");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Send SMS</DialogTitle>
        <DialogDescription>
          {phone.trim() ? "Message will be sent via Twilio and logged to the customer timeline." : "Add a phone number for this customer to send SMS."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        {phone.trim() ? (
          <>
            <p className="text-sm text-[var(--text-soft)] mb-2">To: {phone}</p>
            <label htmlFor="sms-message" className="block text-sm font-medium text-[var(--text)] mb-1">
              Message
            </label>
            <textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message…"
              rows={3}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              aria-label="SMS message"
              required
            />
          </>
        ) : null}
        <DialogFooter>
          <DialogClose>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={loading || !canSend}>
            {loading ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function EmailDialog({
  customerId,
  email,
  open,
  onOpenChange,
  onSuccess,
  onError,
  canWrite,
}: {
  customerId: string;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  canWrite: boolean;
}) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const canSend = canWrite && email.trim().length > 0 && subject.trim().length > 0 && body.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setLoading(true);
    try {
      await apiFetch("/api/messages/email", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          email: email.trim(),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      setSubject("");
      setBody("");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Send email</DialogTitle>
        <DialogDescription>
          {email.trim() ? "Email will be sent via SendGrid and logged to the customer timeline." : "Add an email address for this customer to send email."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        {email.trim() ? (
          <>
            <p className="text-sm text-[var(--text-soft)] mb-2">To: {email}</p>
            <label htmlFor="email-subject" className="block text-sm font-medium text-[var(--text)] mb-1">
              Subject
            </label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="mb-2 bg-[var(--panel)]"
              required
            />
            <label htmlFor="email-body" className="block text-sm font-medium text-[var(--text)] mb-1">
              Message
            </label>
            <textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message…"
              rows={5}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              aria-label="Email body"
              required
            />
          </>
        ) : null}
        <DialogFooter>
          <DialogClose>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={loading || !canSend}>
            {loading ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function ScheduleAppointmentDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
  onError,
  canWrite,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  canWrite: boolean;
}) {
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !scheduledAt.trim()) return;
    setLoading(true);
    try {
      const iso = new Date(scheduledAt).toISOString();
      await apiFetch(`/api/customers/${customerId}/appointments`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt: iso, notes: notes.trim() || undefined }),
      });
      setScheduledAt("");
      setNotes("");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Schedule Appointment</DialogTitle>
        <DialogDescription>Set date and time. Activity will be logged.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Date and time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
        <div>
          <label htmlFor="appointment-notes" className="block text-sm font-medium text-[var(--text)] mb-1">
            Notes (optional)
          </label>
          <textarea
            id="appointment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes…"
            rows={2}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
            aria-label="Appointment notes"
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={loading || !scheduledAt.trim()}>
            {loading ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function DispositionDialog({
  customerId,
  currentStatus,
  open,
  onOpenChange,
  onSuccess,
  onError,
  canWrite,
}: {
  customerId: string;
  currentStatus: CustomerStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  canWrite: boolean;
}) {
  const [status, setStatus] = React.useState<string>(currentStatus);
  const [followUpTitle, setFollowUpTitle] = React.useState("");
  const [followUpDueAt, setFollowUpDueAt] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setFollowUpTitle("");
      setFollowUpDueAt("");
    }
  }, [open, currentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setLoading(true);
    try {
      const body: { status: CustomerStatus; followUpTask?: { title: string; dueAt?: string } } = {
        status: status as CustomerStatus,
      };
      if (followUpTitle.trim()) {
        body.followUpTask = {
          title: followUpTitle.trim(),
          dueAt: followUpDueAt.trim() ? new Date(followUpDueAt).toISOString() : undefined,
        };
      }
      await apiFetch(`/api/customers/${customerId}/disposition`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      onError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const statusOptions: SelectOption[] = CUSTOMER_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Disposition</DialogTitle>
        <DialogDescription>Update status and optionally create a follow-up task.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Status"
          options={statusOptions}
          value={status}
          onChange={setStatus}
          aria-label="Disposition status"
        />
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">Follow-up task (optional)</p>
          <Input
            label="Task title"
            value={followUpTitle}
            onChange={(e) => setFollowUpTitle(e.target.value)}
            placeholder="Title"
          />
          <Input
            label="Due (optional)"
            type="datetime-local"
            value={followUpDueAt}
            onChange={(e) => setFollowUpDueAt(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function AddNoteDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
  canWrite,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  canWrite: boolean;
}) {
  const [body, setBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Add note</DialogTitle>
        <DialogDescription>Add a note to this customer&apos;s activity.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note…"
          rows={3}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
          aria-label="Note body"
        />
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
        <DialogFooter>
          <DialogClose className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-[var(--muted)] text-[var(--text)] hover:bg-slate-200 border border-[var(--border)]">
            Cancel
          </DialogClose>
          <Button type="submit" disabled={loading || !body.trim()}>
            {loading ? "Adding…" : "Add note"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function AddTaskDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
  canWrite,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  canWrite: boolean;
}) {
  const [title, setTitle] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/customers/${customerId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          dueAt: dueAt.trim() ? new Date(dueAt).toISOString() : undefined,
          description: description.trim() || undefined,
        }),
      });
      setTitle("");
      setDueAt("");
      setDescription("");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Add task</DialogTitle>
        <DialogDescription>Create a task for this customer.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          required
        />
        <Input
          label="Due (optional)"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <div>
          <label htmlFor="task-description" className="block text-sm font-medium text-[var(--text)] mb-1">
            Description (optional)
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description…"
            rows={2}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
            aria-label="Task description"
          />
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <DialogFooter>
          <DialogClose className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-[var(--muted)] text-[var(--text)] hover:bg-slate-200 border border-[var(--border)]">
            Cancel
          </DialogClose>
          <Button type="submit" disabled={loading || !title.trim()}>
            {loading ? "Adding…" : "Add task"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function NotesTab({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const { addToast } = useToast();
  const [data, setData] = React.useState<CustomerNote[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [newBody, setNewBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");

  const fetchNotes = React.useCallback(async () => {
    const params = new URLSearchParams({ limit: String(meta.limit), offset: String(meta.offset) });
    const res = await apiFetch<NotesListResponse>(`/api/customers/${customerId}/notes?${params}`);
    setData(res.data);
    setMeta(res.meta);
  }, [customerId, meta.limit, meta.offset]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetchNotes().catch((e) => setError(e instanceof Error ? e.message : "Failed to load notes")).finally(() => setLoading(false));
  }, [fetchNotes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !newBody.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: newBody.trim() }),
      });
      addToast("success", "Note added");
      setNewBody("");
      fetchNotes();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (noteId: string) => {
    if (!canWrite || !editBody.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/customers/${customerId}/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: editBody.trim() }),
      });
      addToast("success", "Note updated");
      setEditingId(null);
      fetchNotes();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/customers/${customerId}/notes/${noteId}`, { method: "DELETE", expectNoContent: true });
      addToast("success", "Note deleted");
      fetchNotes();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite && (
          <form onSubmit={handleAdd} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text)]">Add note</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Write a note…"
              rows={3}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              aria-label="Note body"
            />
            <Button type="submit" disabled={submitting || !newBody.trim()}>
              {submitting ? "Adding…" : "Add note"}
            </Button>
          </form>
        )}
        {!canWrite && (
          <p className="text-sm text-[var(--text-soft)]">You need customers.write to add or edit notes.</p>
        )}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchNotes} />
        ) : data.length === 0 ? (
          <EmptyState title="No notes" description="Add a note to get started." />
        ) : (
          <>
            <ul className="space-y-4">
              {data.map((note) => (
                <li key={note.id} className="rounded-lg border border-[var(--border)] p-4">
                  {editingId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
                        aria-label="Edit note body"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEdit(note.id)} disabled={submitting}>
                          Save
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{note.body}</p>
                      <p className="mt-2 text-xs text-[var(--text-soft)]">
                        {note.createdByProfile?.fullName ?? note.createdByProfile?.email ?? "Unknown"} ·{" "}
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                      {canWrite && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(note.id); setEditBody(note.body); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(note.id)}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {meta.total > meta.limit && (
              <Pagination meta={meta} onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TasksTab({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const { addToast } = useToast();
  const [data, setData] = React.useState<CustomerTask[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [completedFilter, setCompletedFilter] = React.useState<string>("");
  const [newTitle, setNewTitle] = React.useState("");
  const [newDue, setNewDue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const fetchTasks = React.useCallback(async () => {
    const params = new URLSearchParams({ limit: String(meta.limit), offset: String(meta.offset) });
    if (completedFilter === "true") params.set("completed", "true");
    if (completedFilter === "false") params.set("completed", "false");
    const res = await apiFetch<TasksListResponse>(`/api/customers/${customerId}/tasks?${params}`);
    setData(res.data);
    setMeta(res.meta);
  }, [customerId, meta.limit, meta.offset, completedFilter]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTasks().catch((e) => setError(e instanceof Error ? e.message : "Failed to load tasks")).finally(() => setLoading(false));
  }, [fetchTasks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !newTitle.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/customers/${customerId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          dueAt: newDue.trim() ? new Date(newDue).toISOString() : undefined,
        }),
      });
      addToast("success", "Task added");
      setNewTitle("");
      setNewDue("");
      fetchTasks();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/customers/${customerId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      addToast("success", "Task completed");
      fetchTasks();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!canWrite) return;
    try {
      await apiFetch(`/api/customers/${customerId}/tasks/${taskId}`, { method: "DELETE", expectNoContent: true });
      addToast("success", "Task deleted");
      fetchTasks();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite && (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <Input
              label="New task"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="min-w-[200px]"
            />
            <Input
              label="Due (optional)"
              type="datetime-local"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="w-48"
            />
            <Button type="submit" disabled={submitting || !newTitle.trim()}>
              {submitting ? "Adding…" : "Add task"}
            </Button>
          </form>
        )}
        {!canWrite && (
          <p className="text-sm text-[var(--text-soft)]">You need customers.write to add or complete tasks.</p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={completedFilter === "" ? "secondary" : "ghost"}
            onClick={() => setCompletedFilter("")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={completedFilter === "false" ? "secondary" : "ghost"}
            onClick={() => setCompletedFilter("false")}
          >
            Pending
          </Button>
          <Button
            size="sm"
            variant={completedFilter === "true" ? "secondary" : "ghost"}
            onClick={() => setCompletedFilter("true")}
          >
            Completed
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchTasks} />
        ) : data.length === 0 ? (
          <EmptyState title="No tasks" description="Add a task to get started." />
        ) : (
          <>
            <ul className="space-y-2">
              {data.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3"
                >
                  <div>
                    <p className={`font-medium ${task.completedAt ? "text-[var(--text-soft)] line-through" : ""}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-[var(--text-soft)]">
                      Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : "—"}
                      {task.completedAt && ` · Completed ${new Date(task.completedAt).toLocaleString()}`}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex gap-2">
                      {!task.completedAt && (
                        <Button size="sm" variant="secondary" onClick={() => handleComplete(task.id)}>
                          Complete
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(task.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {meta.total > meta.limit && (
              <Pagination meta={meta} onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityTab({ customerId }: { customerId: string }) {
  const [data, setData] = React.useState<CustomerActivityItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const fetchActivity = React.useCallback(async () => {
    const params = new URLSearchParams({ limit: String(meta.limit), offset: String(meta.offset) });
    const res = await apiFetch<ActivityListResponse>(`/api/customers/${customerId}/activity?${params}`);
    setData(res.data);
    setMeta(res.meta);
  }, [customerId, meta.limit, meta.offset]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetchActivity().catch((e) => setError(e instanceof Error ? e.message : "Failed to load activity")).finally(() => setLoading(false));
  }, [fetchActivity]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchActivity} />
        ) : data.length === 0 ? (
          <EmptyState title="No activity" description="Activity will appear here." />
        ) : (
          <>
            <ul className="space-y-3">
              {data.map((item) => (
                <li key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--text)]">{item.activityType}</p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {item.actor?.fullName ?? item.actor?.email ?? "System"} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-[var(--accent)] hover:underline"
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          aria-expanded={expandedId === item.id}
                        >
                          {expandedId === item.id ? "Hide" : "Show"} metadata
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedId === item.id && item.metadata && (
                    <pre className="mt-2 overflow-x-auto rounded bg-[var(--muted)] p-2 text-xs">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
            {meta.total > meta.limit && (
              <Pagination meta={meta} onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
