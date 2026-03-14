"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { Button } from "@/components/ui/button";
import { customerDetailPath } from "@/lib/routes/detail-paths";

export type SalesRepSummary = {
  kpis: {
    openOpportunities: number;
    dueNow: number;
    waitingConversations: number;
    overdueTasks: number;
    callbacksDueToday: number;
    inboundWaiting: number;
  };
  myTasksCount: number;
  dueNowItems: { id: string; title: string; detail: string; href: string; whenLabel?: string | null; severity?: string }[];
  myTasksSlice: { id: string; title: string; customerId: string; customerName: string }[];
};

type SalesHubClientProps = {
  summary: SalesRepSummary;
  permissions: string[];
};

function hasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes(permission);
}

export function SalesHubClient({ summary, permissions }: SalesHubClientProps) {
  const canCrm = hasPermission(permissions, "crm.read");
  const canCustomers = hasPermission(permissions, "customers.read");
  const canDeals = hasPermission(permissions, "deals.read");
  const canWriteCrm = canCrm && hasPermission(permissions, "crm.write");

  const { kpis, myTasksCount, dueNowItems, myTasksSlice } = summary;

  const showPipeline = canCrm;
  const showDueNow = canCrm;
  const showMyTasks = canCustomers || canCrm;
  const showInbox = canCrm;
  const showOverdue = canCrm && (kpis.overdueTasks > 0 || kpis.callbacksDueToday > 0);

  const hasAnyKpi = showPipeline || showDueNow || showMyTasks || showInbox || showOverdue;

  return (
    <PageShell
      fullWidth={false}
      contentClassName="px-4 sm:px-6 lg:px-8"
      className="flex flex-col space-y-6"
    >
      <PageHeader
        title="Sales"
        description="Your pipeline, follow-ups, and inbox at a glance."
      />

      {!hasAnyKpi ? (
        <Widget title="My sales" subtitle="No CRM or customer data available for your role.">
          <p className="text-sm text-[var(--muted-text)]">
            You need access to CRM, Customers, or Deals to see your sales hub. Go to the Dashboard or ask your admin for access.
          </p>
          {canDeals && (
            <div className="mt-4">
              <Link href="/deals">
                <Button variant="secondary">Open Deals</Button>
              </Link>
            </div>
          )}
        </Widget>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {showPipeline && (
              <Link href="/crm/opportunities?scope=mine&view=board" className="block">
                <KpiCard
                  label="My pipeline"
                  value={kpis.openOpportunities}
                  sub="open opportunities"
                  color="blue"
                  trend={[kpis.openOpportunities, kpis.openOpportunities]}
                />
              </Link>
            )}
            {showDueNow && (
              <Link href="/crm?scope=mine" className="block">
                <KpiCard
                  label="Due now"
                  value={kpis.dueNow}
                  sub="callbacks, tasks, inbox"
                  color="amber"
                  accentValue={kpis.dueNow > 0}
                  hasUpdate={kpis.dueNow > 0}
                  trend={[kpis.dueNow, kpis.dueNow]}
                />
              </Link>
            )}
            {showMyTasks && (
              <Link href="/crm?scope=mine" className="block">
                <KpiCard
                  label="My tasks"
                  value={myTasksCount}
                  sub="follow-ups"
                  color="violet"
                  accentValue={myTasksCount > 0}
                  hasUpdate={myTasksCount > 0}
                  trend={[myTasksCount, myTasksCount]}
                />
              </Link>
            )}
            {showInbox && (
              <Link href="/crm/inbox" className="block">
                <KpiCard
                  label="Inbox"
                  value={kpis.waitingConversations}
                  sub="waiting on reply"
                  color="cyan"
                  accentValue={kpis.waitingConversations > 0}
                  hasUpdate={kpis.waitingConversations > 0}
                  trend={[kpis.waitingConversations, kpis.waitingConversations]}
                />
              </Link>
            )}
            {showOverdue && (
              <Link href="/crm?scope=mine" className="block">
                <KpiCard
                  label="Overdue"
                  value={kpis.overdueTasks + kpis.callbacksDueToday}
                  sub="tasks and callbacks"
                  color="amber"
                  accentValue={kpis.overdueTasks + kpis.callbacksDueToday > 0}
                  hasUpdate={kpis.overdueTasks + kpis.callbacksDueToday > 0}
                  trend={[kpis.overdueTasks + kpis.callbacksDueToday, kpis.overdueTasks + kpis.callbacksDueToday]}
                />
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCrm && (
              <>
                <Link href="/crm?scope=mine">
                  <Button variant="secondary" size="sm">Command center</Button>
                </Link>
                <Link href="/crm/opportunities?scope=mine&view=board">
                  <Button variant="secondary" size="sm">Pipeline</Button>
                </Link>
                <Link href="/crm/inbox">
                  <Button variant="secondary" size="sm">Inbox</Button>
                </Link>
                {canWriteCrm && (
                  <Link href="/crm/opportunities">
                    <Button size="sm" className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">New opportunity</Button>
                  </Link>
                )}
              </>
            )}
            {canDeals && (
              <Link href="/deals">
                <Button variant="secondary" size="sm">Deals</Button>
              </Link>
            )}
          </div>

          {(dueNowItems.length > 0 || myTasksSlice.length > 0) && (
            <Widget title="Do next" subtitle="Up to 10 items that need your attention.">
              <ul className="space-y-2">
                {dueNowItems.slice(0, 10).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-[var(--muted-text)]">{item.whenLabel ?? item.detail}</span>
                    </Link>
                  </li>
                ))}
                {dueNowItems.length === 0 &&
                  myTasksSlice.slice(0, 10).map((task) => (
                    <li key={task.id}>
                      <Link
                        href={customerDetailPath(task.customerId)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <span className="font-medium">{task.title}</span>
                        <span className="text-xs text-[var(--muted-text)]">{task.customerName}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Widget>
          )}
        </>
      )}
    </PageShell>
  );
}
