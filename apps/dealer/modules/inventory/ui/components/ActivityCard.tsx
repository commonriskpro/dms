"use client";

import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import type { VehicleDetailResponse } from "../types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type ActivityCardProps = {
  vehicle: VehicleDetailResponse;
  className?: string;
};

/** Timeline derived from vehicle data; no backend change. */
export function ActivityCard({ vehicle, className }: ActivityCardProps) {
  const hasPhotos = (vehicle.photos?.length ?? 0) > 0;
  const photoDate = hasPhotos && vehicle.photos?.length
    ? vehicle.photos.reduce((latest, p) => {
        const d = new Date(p.createdAt).getTime();
        return d > latest ? d : latest;
      }, 0)
    : null;

  const events: { label: string; date: string }[] = [
    { label: "Vehicle added", date: vehicle.createdAt },
  ];
  if (photoDate) {
    events.push({ label: "Photos uploaded", date: new Date(photoDate).toISOString() });
  }
  if (vehicle.updatedAt && vehicle.updatedAt !== vehicle.createdAt) {
    events.push({ label: "Price updated", date: vehicle.updatedAt });
  }
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Activity</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        <ul className="space-y-0 border-l-2 border-[var(--border)] pl-4 ml-1" role="list">
          {events.map((evt) => (
            <li key={`${evt.date}-${evt.label}`} className="relative pb-4 last:pb-0">
              <span
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--accent)] bg-[var(--surface)]"
                aria-hidden
              />
              <p className="text-sm font-medium text-[var(--text)]">{evt.label}</p>
              <p className={typography.muted}>{formatDate(evt.date)}</p>
            </li>
          ))}
        </ul>
        {events.length === 0 && (
          <p className={typography.muted}>No activity yet.</p>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
