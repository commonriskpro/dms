"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { TasksPanel } from "@/modules/customers/ui/TasksPanel";

export type TasksCardProps = {
  customerId: string;
  canRead: boolean;
  refreshKey?: number;
};

export function TasksCard({ customerId, canRead, refreshKey }: TasksCardProps) {
  if (!canRead) return null;

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Tasks</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent>
        <TasksPanel customerId={customerId} canRead={canRead} refreshKey={refreshKey} />
      </DMSCardContent>
    </DMSCard>
  );
}
