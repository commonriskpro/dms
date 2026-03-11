"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomerTask, TasksListResponse } from "@/lib/types/customers";
import { customerDetailPath } from "@/lib/routes/detail-paths";

const TASKS_LIMIT = 10;

export interface TasksPanelProps {
  customerId: string;
  canRead: boolean;
  className?: string;
  /** When changed, refetch tasks (e.g. after adding a task from Lead tab). */
  refreshKey?: number;
}

export function TasksPanel({ customerId, canRead, className = "", refreshKey }: TasksPanelProps) {
  const [tasks, setTasks] = React.useState<CustomerTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<TasksListResponse>(
      `/api/customers/${customerId}/tasks?limit=${TASKS_LIMIT}&completed=false`
    )
      .then((res) => setTasks(res.data))
      .catch(() => setError("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, [customerId, canRead, refreshKey]);

  if (!canRead) return null;

  if (loading) {
    return (
      <div className={className} role="status" aria-label="Loading tasks">
        <h3 className="text-sm font-medium text-[var(--text-soft)] mb-2">Upcoming tasks</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <h3 className="text-sm font-medium text-[var(--text-soft)] mb-2">Upcoming tasks</h3>
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-medium text-[var(--text-soft)] mb-2">Upcoming tasks</h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">No upcoming tasks.</p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0" role="list">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`${customerDetailPath(customerId)}?tab=tasks`}
                className="block rounded-md border border-[var(--border)] bg-[var(--panel)] p-2 text-sm text-[var(--text)] hover:bg-[var(--muted)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span className="font-medium">{t.title}</span>
                {t.dueAt && (
                  <span className="block text-xs text-[var(--text-soft)] mt-0.5">
                    Due {new Date(t.dueAt).toLocaleString()}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
