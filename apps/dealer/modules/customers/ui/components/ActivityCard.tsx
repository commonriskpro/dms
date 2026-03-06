"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { ActivityTimeline } from "@/modules/customers/ui/ActivityTimeline";

export type ActivityCardProps = {
  customerId: string;
  canRead: boolean;
};

export function ActivityCard({ customerId, canRead }: ActivityCardProps) {
  if (!canRead) return null;

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Activity</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent>
        <ActivityTimeline customerId={customerId} canRead={canRead} variant="cards" />
      </DMSCardContent>
    </DMSCard>
  );
}
