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
}: CustomerDetailContentProps) {
  return (
    <div className={mainGrid}>
      <div className={cardStack}>
        <CustomerOverviewCard customer={customer} />
        <ActiveOpportunityDealCard
          customerId={customerId}
          canReadDeals={canReadDeals}
          canReadCrm={canReadCrm}
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
      <aside className={`${cardStack} w-full min-w-0 lg:w-[280px]`} role="complementary">
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
        <TasksCard customerId={customerId} canRead={canRead} refreshKey={refreshKey} />
        <TagsStatusCard customer={customer} />
        {signalTimeline}
      </aside>
    </div>
  );
}
