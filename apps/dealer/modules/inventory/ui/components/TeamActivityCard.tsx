"use client";

import type { TeamActivityToday } from "@/modules/customers/service/team-activity";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { cn } from "@/lib/utils";

export type TeamActivityCardProps = {
  team: TeamActivityToday;
  className?: string;
};

const METRICS: { key: keyof TeamActivityToday; label: string }[] = [
  { key: "callsLogged", label: "Calls Logged" },
  { key: "appointmentsSet", label: "Appointments Set" },
  { key: "notesAdded", label: "Notes Added" },
  { key: "callbacksScheduled", label: "Callbacks Scheduled" },
  { key: "dealsStarted", label: "Deals Started" },
];

export function TeamActivityCard({ team, className }: TeamActivityCardProps) {
  return (
    <DMSCard
      className={cn(
        "transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]",
        className
      )}
    >
      <DMSCardHeader className="gap-2 mb-0">
        <DMSCardTitle>Team Activity Today</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="pt-0">
        <ul className="space-y-2" role="list">
          {METRICS.map(({ key, label }) => (
            <li
              key={key}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-input)] px-2 py-1.5 text-sm"
            >
              <span className="text-[var(--text)]">{label}</span>
              <span className="tabular-nums text-[var(--muted-text)]">
                {team[key].toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </DMSCardContent>
    </DMSCard>
  );
}
