"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "@/contexts/session-context";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { FileText, Workflow, CheckCircle, ArrowRight } from "@/lib/ui/icons";

type QueueMeta = { total: number; limit: number; offset: number };
type TitleRes = { data: unknown[]; meta: QueueMeta };
type DeliveryRes = { data: unknown[]; meta: QueueMeta };
type FundingRes = { data: unknown[]; meta: QueueMeta };

function QueueCard({
  title,
  description,
  count,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  count: number | null;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
        <Icon size={20} />
      </div>
      <div>
        <p className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">{title}</p>
        <p className="text-sm text-[var(--text-soft)]">{description}</p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums text-[var(--text)]">
          {count != null ? count.toLocaleString() : "—"}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]">
          View queue
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export function OperationsOverviewPage() {
  const { hasPermission } = useSession();
  const canDeals = hasPermission("deals.read");
  const canCrm = hasPermission("crm.read");

  const [titleTotal, setTitleTotal] = React.useState<number | null>(null);
  const [deliveryTotal, setDeliveryTotal] = React.useState<number | null>(null);
  const [fundingTotal, setFundingTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canDeals && !canCrm) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ limit: "1", offset: "0" });
    const promises: Promise<void>[] = [];
    if (canDeals) {
      promises.push(
        apiFetch<TitleRes>(`/api/deals/title?${params}`).then((r) => setTitleTotal(r.meta.total)),
        apiFetch<DeliveryRes>(`/api/deals/delivery?${params}`).then((r) => setDeliveryTotal(r.meta.total)),
        apiFetch<FundingRes>(`/api/deals/funding?${params}`).then((r) => setFundingTotal(r.meta.total))
      );
    }
    Promise.all(promises).catch((e) => setError(getApiErrorMessage(e))).finally(() => setLoading(false));
  }, [canDeals, canCrm]);

  if (!canDeals && !canCrm) {
    return (
      <PageShell className="space-y-6">
        <PageHeader
          title="Operations"
          description="Queue health, bottlenecks, and where to intervene. Title & DMV, delivery, funding, and tasks."
        />
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to operations queues. Deals or CRM access is required.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Operations"
        description="Queue health, bottlenecks, and where to intervene. Title & DMV, delivery, funding, and tasks in one place."
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
        Queues
      </p>
      <p className="max-w-[66ch] text-sm text-[var(--muted-text)]">
        Open each queue to see aging, filters, and to take action. Use Tasks for CRM jobs and follow-up work.
      </p>

      {error && (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {canDeals && (
          <>
            <QueueCard
              title="Title & DMV"
              description="Title work and DMV processing. Track status and clear issues."
              count={loading ? null : titleTotal}
              href="/deals/title"
              icon={FileText}
            />
            <QueueCard
              title="Delivery"
              description="Contracted deals ready for delivery or in progress."
              count={loading ? null : deliveryTotal}
              href="/deals/delivery"
              icon={Workflow}
            />
            <QueueCard
              title="Funding"
              description="Deals awaiting funding approval or completion."
              count={loading ? null : fundingTotal}
              href="/deals/funding"
              icon={Workflow}
            />
          </>
        )}
        {canCrm && (
          <QueueCard
            title="Tasks"
            description="CRM jobs and follow-up work. Command center and pipeline tasks."
            count={null}
            href="/crm/jobs"
            icon={CheckCircle}
          />
        )}
      </div>
    </PageShell>
  );
}
