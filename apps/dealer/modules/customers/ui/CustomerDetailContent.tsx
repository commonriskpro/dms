"use client";

import { mainGrid, cardStack } from "@/lib/ui/recipes/layout";
import type { CustomerDetail } from "@/lib/types/customers";
import { CustomerOverviewCard } from "./components/CustomerOverviewCard";
import { NotesCard } from "./components/NotesCard";
import { ActivityCard } from "./components/ActivityCard";
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
  onOpenSms?: () => void;
  onOpenAppointment?: () => void;
  onOpenAddTask?: () => void;
  onOpenDisposition?: () => void;
  onAddNote?: () => void;
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
  onOpenSms,
  onOpenAppointment,
  onOpenAddTask,
  onOpenDisposition,
  onAddNote,
}: CustomerDetailContentProps) {
  return (
    <div className={mainGrid}>
      <div className={cardStack}>
        <CustomerOverviewCard customer={customer} />
        <NotesCard
          customerId={customerId}
          canRead={canRead}
          canWrite={canWrite}
          onAddNote={onAddNote}
        />
        <ActivityCard customerId={customerId} canRead={canRead} />
        <DealsSummaryCard />
      </div>
      <aside className={`${cardStack} w-full min-w-0 lg:w-[280px]`} role="complementary">
        <NextActionsCard
          customer={customer}
          canRead={canRead}
          canWrite={canWrite}
          onOpenSms={onOpenSms}
          onOpenAppointment={onOpenAppointment}
          onOpenAddTask={onOpenAddTask}
          onOpenDisposition={onOpenDisposition}
        />
        <TasksCard customerId={customerId} canRead={canRead} refreshKey={refreshKey} />
        <TagsStatusCard customer={customer} />
      </aside>
    </div>
  );
}
