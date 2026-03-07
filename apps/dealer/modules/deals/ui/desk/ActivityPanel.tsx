"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealHistoryEntry } from "../types";

export interface ActivityPanelProps {
  activity: DealHistoryEntry[];
  total: number;
}

export function ActivityPanel({ activity, total }: ActivityPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Activity</CardTitle>
        <p className="text-xs text-[var(--muted-text)]">Status changes</p>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-[var(--muted-text)]">No activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0"
              >
                <span className="font-medium text-[var(--text)]">
                  {h.fromStatus ?? "—"} → {h.toStatus}
                </span>
                <span className="text-xs text-[var(--muted-text)]">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        {total > activity.length && (
          <p className="mt-2 text-xs text-[var(--muted-text)]">
            Showing {activity.length} of {total}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
