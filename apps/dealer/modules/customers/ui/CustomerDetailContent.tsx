"use client";

import { mainGrid, cardStack } from "@/lib/ui/recipes/layout";
import type { CustomerDetail, TimelineListResponse, CallbacksListResponse } from "@/lib/types/customers";
import { ActiveOpportunityDealCard } from "./components/ActiveOpportunityDealCard";
import { CustomerOverviewCard } from "./components/CustomerOverviewCard";
import { TimelineCard } from "./components/TimelineCard";
import { CallbacksCard } from "./components/CallbacksCard";
import { NextActionsCard } from "./components/NextActionsCard";
import { TasksCard } from "./components/TasksCard";
import { TagsStatusCard } from "./components/TagsStatusCard";

export type CustomerDetailContentMode = "page" | "modal";

export type CustomerDetailContentProps = {
  customer: CustomerDetail;
  customerId: string;
  mode: CustomerDetailContentMode;
  canRead: boolean;
  canWrite: boolean;
  refreshKey?: number;
  initialTimeline?: TimelineListResponse | null;
  initialCallbacks?: CallbacksListResponse | null;
  onOpenSms?: () => void;
  onOpenEmail?: () => void;
  onOpenAppointment?: () => void;
  onOpenAddTask?: () => void;
  onOpenDisposition?: () => void;
  onAddNote?: () => void;
  signalRailTop?: React.ReactNode;
  signalTimeline?: React.ReactNode;
  canReadDeals?: boolean;
  canReadCrm?: boolean;
  returnTo?: string | null;
};

/**
 * Reusable customer detail layout: mainGrid (1fr + 280px), left cardStack
 * (overview, notes, activity, deals), right rail (next actions, tasks, tags/status).
 */
export function CustomerDetailContent({
  customer,
  customerId,
  mode,
  canRead,
  canWrite,
  refreshKey = 0,
  initialTimeline,
  initialCallbacks,
  onOpenSms,
  onOpenEmail,
  onOpenAppointment,
  onOpenAddTask,
  onOpenDisposition,
  onAddNote,
  signalRailTop,
  signalTimeline,
  canReadDeals = false,
  canReadCrm = false,
  returnTo,
}: CustomerDetailContentProps) {
  const primaryPhone = customer.phones?.find((p) => p.isPrimary) ?? customer.phones?.[0];
  const primaryEmail = customer.emails?.find((e) => e.isPrimary) ?? customer.emails?.[0];
  const leadSummary = [customer.leadSource, customer.leadCampaign, customer.leadMedium]
    .filter(Boolean)
    .join(" · ");
  const modalHeader = mode === "modal" ? (
    <section className="border-b border-[color:rgba(148,163,184,0.12)] px-6 pb-4 pt-6 sm:px-7">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.16fr)_320px]">
        <div className="rounded-[24px] border border-[color:rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
            Customer record
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
            {customer.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-text)]">
            <span className="rounded-full border border-[color:rgba(148,163,184,0.16)] bg-[rgba(255,255,255,0.03)] px-3 py-1">
              {customer.status}
            </span>
            {leadSummary ? <span>{leadSummary}</span> : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] border border-[color:rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.022)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Primary phone</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{primaryPhone?.value ?? "—"}</p>
            </div>
            <div className="rounded-[18px] border border-[color:rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.022)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Primary email</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">{primaryEmail?.value ?? "—"}</p>
            </div>
            <div className="rounded-[18px] border border-[color:rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.022)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Owner</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                {customer.assignedToProfile?.fullName ?? customer.assignedToProfile?.email ?? "Unassigned"}
              </p>
            </div>
            <div className="rounded-[18px] border border-[color:rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.022)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]/85">Last activity</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                {customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          {signalRailTop}
          <NextActionsCard
            customer={customer}
            customerId={customerId}
            canRead={canRead}
            canWrite={canWrite}
            onOpenSms={onOpenSms}
            onOpenEmail={onOpenEmail}
            onOpenAppointment={onOpenAppointment}
            onOpenAddTask={onOpenAddTask}
            onOpenDisposition={onOpenDisposition}
          />
        </aside>
      </div>
    </section>
  ) : null;

  const layoutClass =
    mode === "modal"
      ? "grid grid-cols-1 gap-5 px-6 py-5 min-[1700px]:grid-cols-[minmax(0,1.18fr)_320px] sm:px-7"
      : mainGrid;

  const leftStackClass = mode === "modal" ? "flex min-w-0 flex-col gap-5" : cardStack;
  const railClass =
    mode === "modal"
      ? "flex min-w-0 flex-col gap-5"
      : `${cardStack} w-full min-w-0 lg:w-[280px]`;

  return (
    <div className={mode === "modal" ? "flex min-h-full flex-col bg-[var(--surface)]" : undefined}>
      {modalHeader}
      <div className={layoutClass}>
      <div className={leftStackClass}>
        {mode !== "modal" ? <CustomerOverviewCard customer={customer} /> : null}
        <ActiveOpportunityDealCard
          customerId={customerId}
          canReadDeals={canReadDeals}
          canReadCrm={canReadCrm}
          returnTo={returnTo}
        />
        <TimelineCard
          customerId={customerId}
          canRead={canRead}
          canWrite={canWrite}
          initialData={initialTimeline ?? undefined}
        />
        <CallbacksCard
          customerId={customerId}
          canRead={canRead}
          canWrite={canWrite}
          initialData={initialCallbacks ?? undefined}
        />
      </div>
      <aside className={railClass} role="complementary">
        {mode !== "modal" ? signalRailTop : null}
        {mode !== "modal" ? (
          <NextActionsCard
            customer={customer}
            customerId={customerId}
            canRead={canRead}
            canWrite={canWrite}
            onOpenSms={onOpenSms}
            onOpenEmail={onOpenEmail}
            onOpenAppointment={onOpenAppointment}
            onOpenAddTask={onOpenAddTask}
            onOpenDisposition={onOpenDisposition}
          />
        ) : null}
        <TasksCard customerId={customerId} canRead={canRead} refreshKey={refreshKey} />
        <TagsStatusCard customer={customer} />
        {signalTimeline}
      </aside>
      </div>
    </div>
  );
}
