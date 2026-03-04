"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "@/contexts/session-context";
import { apiFetch } from "@/lib/client/http";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DashboardData,
  DashboardMyTask,
  DashboardNewProspect,
  DashboardPipelineStage,
  DashboardStaleLead,
} from "@/modules/dashboard/ui/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const { hasPermission, activeDealership, lifecycleStatus } = useSession();
  const canAccess =
    hasPermission("customers.read") || hasPermission("crm.read");

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDashboard = React.useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: DashboardData }>("/api/dashboard");
      setData(res.data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  React.useEffect(() => {
    if (!canAccess) return;
    fetchDashboard();
  }, [canAccess, fetchDashboard]);

  if (!canAccess) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">
          You don&apos;t have access to the dashboard.
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-[var(--danger)] mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard()}
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Retry loading dashboard"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = data ?? {};
  const hasAnyWidget =
    d.myTasks !== undefined ||
    d.newProspects !== undefined ||
    d.pipelineFunnel !== undefined ||
    d.staleLeads !== undefined ||
    d.appointments !== undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>

      {activeDealership && (
        <Card className="border-[var(--accent)]/30 bg-[var(--muted)]/30">
          <CardHeader>
            <CardTitle className="text-lg">Welcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-[var(--text)]">
              <span className="font-medium">Dealership:</span> {activeDealership.name}
            </p>
            <p className="text-sm text-[var(--text)]">
              <span className="font-medium">Status:</span> {lifecycleStatus ?? "ACTIVE"}
            </p>
            {hasPermission("admin.memberships.read") && (
              <Link
                href="/admin/users"
                className="inline-block text-sm text-[var(--accent)] hover:underline mt-2"
              >
                Invite teammates →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {!hasAnyWidget && (
        <Card>
          <CardContent className="p-6">
            <p className="text-[var(--text-soft)]">No dashboard data available.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {d.myTasks !== undefined && (
          <Card aria-label="My Tasks">
            <CardHeader>
              <CardTitle className="text-lg">My Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {d.myTasks.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No tasks</p>
              ) : (
                <ul className="space-y-3">
                  {(d.myTasks as DashboardMyTask[]).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={t.link}
                        className="block rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm hover:bg-[var(--muted)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        <span className="font-medium text-[var(--text)]">
                          {t.title}
                        </span>
                        <span className="mt-1 block text-[var(--text-soft)]">
                          Due {formatDate(t.dueAt)} · {t.customerName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {d.newProspects !== undefined && (
          <Card aria-label="New Prospects">
            <CardHeader>
              <CardTitle className="text-lg">New Prospects</CardTitle>
            </CardHeader>
            <CardContent>
              {d.newProspects.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No prospects</p>
              ) : (
                <ul className="space-y-3">
                  {(d.newProspects as DashboardNewProspect[]).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/customers/${p.id}`}
                        className="block rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm hover:bg-[var(--muted)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        <span className="font-medium text-[var(--text)]">
                          {p.name}
                        </span>
                        <span className="mt-1 block text-[var(--text-soft)]">
                          {formatDate(p.createdAt)}
                          {(p.primaryPhone || p.primaryEmail) && (
                            <> · {p.primaryPhone || p.primaryEmail}</>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {d.pipelineFunnel !== undefined && (
          <Card aria-label="Pipeline Funnel">
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {/* If backend adds value/amountCents per stage, display with formatCents(amountCents) from @/lib/money */}
              {!d.pipelineFunnel.stages?.length ? (
                <p className="text-sm text-[var(--text-soft)]">No stages</p>
              ) : (
                <ul className="space-y-2">
                  {(d.pipelineFunnel.stages as DashboardPipelineStage[]).map(
                    (s) => (
                      <li
                        key={s.stageId}
                        className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-sm"
                      >
                        <span className="text-[var(--text)]">{s.stageName}</span>
                        <span className="font-semibold text-[var(--accent)]">
                          {s.count}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {d.staleLeads !== undefined && (
          <Card aria-label="Stale Leads">
            <CardHeader>
              <CardTitle className="text-lg">Stale Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {d.staleLeads.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">No stale leads</p>
              ) : (
                <ul className="space-y-3">
                  {(d.staleLeads as DashboardStaleLead[]).map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/customers/${l.id}`}
                        className="block rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm hover:bg-[var(--muted)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        <span className="font-medium text-[var(--text)]">
                          {l.name}
                        </span>
                        <span className="mt-1 block text-[var(--text-soft)]">
                          Last activity {formatDate(l.lastActivityAt)} ·{" "}
                          {l.daysSinceActivity} day
                          {l.daysSinceActivity !== 1 ? "s" : ""} since
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {d.appointments !== undefined && (
          <Card aria-label="Appointments">
            <CardHeader>
              <CardTitle className="text-lg">Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-soft)]">
                Appointments coming soon
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
