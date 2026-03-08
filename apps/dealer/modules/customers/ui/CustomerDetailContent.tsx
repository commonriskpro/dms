"use client";

import { mainGrid, cardStack } from "@/lib/ui/recipes/layout";
import type { CustomerDetail, TimelineListResponse, CallbacksListResponse } from "@/lib/types/customers";
import { CustomerOverviewCard } from "./components/CustomerOverviewCard";
import { TimelineCard } from "./components/TimelineCard";
import { CallbacksCard } from "./components/CallbacksCard";
import { DealsSummaryCard } from "./components/DealsSummaryCard";
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
}: CustomerDetailContentProps) {
  return (
    <div className={mainGrid}>
      <div className={cardStack}>
        <CustomerOverviewCard customer={customer} />
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
        <DealsSummaryCard />
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
