"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { WorkspaceNextActionRow } from "@/components/ui-system/layout";
import { KpiCard } from "@/components/ui-system/widgets";
import { Widget } from "@/components/ui-system/widgets/Widget";
import { Button } from "@/components/ui/button";
import { customerDetailPath } from "@/lib/routes/detail-paths";
import type { SalesRepSummary } from "./SalesHubClient.types";

export type { SalesRepSummary, SalesRepSummaryItem } from "./SalesHubClient.types";

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
  const canWriteCustomers = canCustomers && hasPermission(permissions, "customers.write");
  const canWriteDeals = canDeals && hasPermission(permissions, "deals.write");

  const { kpis, myTasksCount, dueNowItems, myTasksSlice, staleProspects, pipelineBlockers, sequenceExceptions } =
    summary;

  const overdueCount = kpis.overdueTasks + kpis.callbacksDueToday;
  const showPipeline = canCrm;
  const showDueNow = canCrm;
  const showMyTasks = canCustomers || canCrm;
  const showInbox = canCrm;
  const showOverdue = canCrm && overdueCount > 0;
  const hasAnyKpi = showPipeline || showDueNow || showMyTasks || showInbox || showOverdue;

  const needsAttentionCount = dueNowItems.length + (overdueCount > 0 ? overdueCount : 0);
  const hasNeedsAttention = dueNowItems.length > 0 || overdueCount > 0;
  const followUpItems = [
    ...myTasksSlice.map((t) => ({ id: t.id, title: t.title, href: customerDetailPath(t.customerId), meta: t.customerName })),
    ...(staleProspects ?? []).map((p) => ({ id: p.id, title: p.title, href: p.href, meta: p.whenLabel ?? p.detail })),
  ];
  const hasFollowUp = followUpItems.length > 0;
  const hasPipelineBlockers = (pipelineBlockers?.length ?? 0) > 0;
  const hasSequenceExceptions = (sequenceExceptions?.length ?? 0) > 0;

  return (
    <PageShell
      fullWidth={false}
      contentClassName="px-4 sm:px-6 lg:px-8"
      className="flex flex-col space-y-6"
    >
      <PageHeader
        title="Sales"
        description="Your commercial home: what needs attention now, who to follow up with, and where to go next. Lead → contact → opportunity → deal."
      />

      {!hasAnyKpi ? (
        <Widget title="Sales workspace" subtitle="No CRM or customer data for your role yet.">
          <p className="text-sm text-[var(--muted-text)]">
            This is your home for the full journey: leads, follow-up, pipeline, and deals. You need access to CRM, Customers, or Deals to see it. Ask your admin or go to Dashboard.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canDeals && (
              <Link href="/deals">
                <Button className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">Open Deals</Button>
              </Link>
            )}
            <Link href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </div>
        </Widget>
      ) : (
        <>
          {/* Quick actions: primary create, then journey links (CRM → Customers → Deals) */}
          <div className="flex flex-wrap items-center gap-2" data-workspace="quick-actions">
            {canWriteCrm && (
              <Link href="/crm/opportunities">
                <Button size="sm" className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
                  New opportunity
                </Button>
              </Link>
            )}
            {canWriteCustomers && (
              <Link href="/customers/new">
                <Button variant="secondary" size="sm">Add lead</Button>
              </Link>
            )}
            {canWriteDeals && (
              <Link href="/deals/new">
                <Button variant="secondary" size="sm">New deal</Button>
              </Link>
            )}
            {canCrm && (
              <>
                <Link href="/crm?scope=mine">
                  <Button variant="outline" size="sm">Command center</Button>
                </Link>
                <Link href="/crm/opportunities?scope=mine&view=board">
                  <Button variant="outline" size="sm">Pipeline</Button>
                </Link>
                <Link href="/crm/inbox">
                  <Button variant="outline" size="sm">Inbox</Button>
                </Link>
              </>
            )}
            {canCustomers && (
              <Link href="/customers">
                <Button variant="outline" size="sm">Customers</Button>
              </Link>
            )}
            {canDeals && (
              <Link href="/deals">
                <Button variant="outline" size="sm">Deals</Button>
              </Link>
            )}
          </div>

          {/* 1. Needs attention now — due now + overdue */}
          {hasNeedsAttention && (
            <Widget
              title="Needs attention now"
              subtitle={
                needsAttentionCount === 0
                  ? undefined
                  : `${dueNowItems.length} due now${overdueCount > 0 ? `, ${overdueCount} overdue` : ""}`
              }
              action={
                canCrm && dueNowItems.length + overdueCount > 0 ? (
                  <Link href="/crm?scope=mine">
                    <Button variant="ghost" size="sm">Open command center</Button>
                  </Link>
                ) : null
              }
            >
              <ul className="space-y-2">
                {dueNowItems.slice(0, 10).map((item) => (
                  <li key={item.id}>
                    <WorkspaceNextActionRow
                      title={item.title}
                      meta={item.whenLabel ?? item.detail}
                      href={item.href}
                      severity={item.severity}
                    />
                  </li>
                ))}
                {dueNowItems.length === 0 && overdueCount > 0 && (
                  <li>
                    <WorkspaceNextActionRow
                      title={`${overdueCount} overdue — clear them in Command center`}
                      href="/crm?scope=mine"
                      severity="danger"
                    />
                  </li>
                )}
              </ul>
            </Widget>
          )}

          {/* 2. Who needs follow-up — my tasks + stale prospects */}
          {hasFollowUp && (
            <Widget
              title="Who needs follow-up"
              subtitle={`${myTasksSlice.length} task${myTasksSlice.length === 1 ? "" : "s"}${staleProspects?.length ? `, ${staleProspects.length} stale prospect${staleProspects.length === 1 ? "" : "s"}` : ""}`}
              action={
                (canCrm || canCustomers) ? (
                  <Link href="/crm?scope=mine">
                    <Button variant="ghost" size="sm">View all</Button>
                  </Link>
                ) : null
              }
            >
              <ul className="space-y-2">
                {followUpItems.slice(0, 10).map((item) => (
                  <li key={item.id}>
                    <WorkspaceNextActionRow title={item.title} meta={item.meta} href={item.href} />
                  </li>
                ))}
              </ul>
            </Widget>
          )}

          {/* 3. Pipeline & inbox — KPIs and go-to */}
          <Widget
            title="Pipeline & inbox"
            subtitle="Quick glance and links to work."
            action={null}
          >
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
                    value={overdueCount}
                    sub="tasks and callbacks"
                    color="amber"
                    accentValue={overdueCount > 0}
                    hasUpdate={overdueCount > 0}
                    trend={[overdueCount, overdueCount]}
                  />
                </Link>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canCrm && (
                <>
                  <Link href="/crm?scope=mine" className="text-sm text-[var(--accent)] hover:underline">Command center</Link>
                  <span className="text-[var(--muted-text)]">·</span>
                  <Link href="/crm/opportunities?scope=mine&view=board" className="text-sm text-[var(--accent)] hover:underline">Pipeline</Link>
                  <span className="text-[var(--muted-text)]">·</span>
                  <Link href="/crm/inbox" className="text-sm text-[var(--accent)] hover:underline">Inbox</Link>
                </>
              )}
            </div>
          </Widget>

          {/* 4. Pipeline blockers & sequence exceptions — when present */}
          {(hasPipelineBlockers || hasSequenceExceptions) && (
            <Widget
              title="Pipeline health"
              subtitle="Opportunities that need owner, next action, or due date; or sequences that need attention."
            >
              <ul className="space-y-2">
                {(pipelineBlockers ?? []).map((item) => (
                  <li key={item.id}>
                    <WorkspaceNextActionRow
                      title={item.title}
                      meta={item.whenLabel ?? item.detail}
                      href={item.href}
                      severity={item.severity}
                    />
                  </li>
                ))}
                {(sequenceExceptions ?? []).map((item) => (
                  <li key={item.id}>
                    <WorkspaceNextActionRow
                      title={item.title}
                      meta={item.whenLabel ?? item.detail}
                      href={item.href}
                      severity={item.severity}
                    />
                  </li>
                ))}
              </ul>
            </Widget>
          )}

          {/* 5. Deals — next stage of the journey */}
          {canDeals && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--text)]">Deals</span>
              <span className="text-sm text-[var(--muted-text)]">— structure, contract, title, funding.</span>
              <Link href="/deals" className="text-sm text-[var(--accent)] hover:underline">Open Deals</Link>
              {canWriteDeals && (
                <>
                  <span className="text-[var(--muted-text)]">·</span>
                  <Link href="/deals/new" className="text-sm text-[var(--accent)] hover:underline">New deal</Link>
                </>
              )}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
