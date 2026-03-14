"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch, getApiErrorMessage } from "@/lib/client/http";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { widgetTokens, tableTokens } from "@/lib/ui/tokens";
import { Globe } from "@/lib/ui/icons";

type Summary = { pageViews: number; vdpViews: number; leads: number };
type TopPageRow = { path: string; views: number };
type TopVdpRow = { vehicleId: string; views: number };
type LeadsBySourceRow = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; leads: number };

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function WebsiteAnalyticsPage() {
  const [range, setRange] = React.useState(defaultRange);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [topPages, setTopPages] = React.useState<TopPageRow[]>([]);
  const [topVdps, setTopVdps] = React.useState<TopVdpRow[]>([]);
  const [leadsBySource, setLeadsBySource] = React.useState<LeadsBySourceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const from = range.from;
    const to = range.to;
    setLoading(true);
    setError(null);
    const q = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    Promise.all([
      apiFetch<{ data: Summary }>(`/api/websites/analytics/summary${q}`),
      apiFetch<{ data: TopPageRow[] }>(`/api/websites/analytics/top-pages${q}&limit=10`),
      apiFetch<{ data: TopVdpRow[] }>(`/api/websites/analytics/top-vdps${q}&limit=10`),
      apiFetch<{ data: LeadsBySourceRow[] }>(`/api/websites/analytics/leads-by-source${q}`),
    ])
      .then(([s, p, v, l]) => {
        setSummary(s.data);
        setTopPages(p.data);
        setTopVdps(v.data);
        setLeadsBySource(l.data);
      })
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-[var(--radius-card)]" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;

  const s = summary ?? { pageViews: 0, vdpViews: 0, leads: 0 };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Website Analytics</h1>
          <p className="text-sm text-[var(--text-soft)]">
            Page views, VDP views, and lead attribution for your website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]"
          />
          <span className="text-sm text-[var(--text-soft)]">to</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]"
          />
        </div>
        <Link
          href="/websites"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
        >
          <Globe size={14} />
          Back to Website
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={widgetTokens.widgetCompactKpi}>
          <p className="text-sm font-medium text-[var(--text-soft)]">Page views</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{s.pageViews.toLocaleString()}</p>
        </div>
        <div className={widgetTokens.widgetCompactKpi}>
          <p className="text-sm font-medium text-[var(--text-soft)]">VDP views</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{s.vdpViews.toLocaleString()}</p>
        </div>
        <div className={widgetTokens.widgetCompactKpi}>
          <p className="text-sm font-medium text-[var(--text-soft)]">Leads</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{s.leads.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top pages</CardTitle>
          </CardHeader>
          <CardContent>
            {topPages.length === 0 ? (
              <EmptyState title="No page views" description="No page views in this period." />
            ) : (
              <div className={tableTokens.shell}>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={tableTokens.columnHeader}>Path</th>
                      <th className={`${tableTokens.columnHeader} text-right`}>Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPages.map((row) => (
                      <tr key={row.path} className={tableTokens.rowHover}>
                        <td className={tableTokens.cell}>{row.path || "/"}</td>
                        <td className={`${tableTokens.cell} text-right`}>{row.views.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top VDPs</CardTitle>
          </CardHeader>
          <CardContent>
            {topVdps.length === 0 ? (
              <EmptyState title="No VDP views" description="No vehicle page views in this period." />
            ) : (
              <div className={tableTokens.shell}>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={tableTokens.columnHeader}>Vehicle ID</th>
                      <th className={`${tableTokens.columnHeader} text-right`}>Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVdps.map((row) => (
                      <tr key={row.vehicleId} className={tableTokens.rowHover}>
                        <td className={tableTokens.cell}>
                          <code className="text-xs">{row.vehicleId.slice(0, 8)}…</code>
                        </td>
                        <td className={`${tableTokens.cell} text-right`}>{row.views.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads by source</CardTitle>
          <p className="text-sm text-[var(--text-soft)]">UTM attribution for website leads</p>
        </CardHeader>
        <CardContent>
          {leadsBySource.length === 0 ? (
            <EmptyState title="No leads" description="No website leads in this period." />
          ) : (
            <div className={tableTokens.shell}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={tableTokens.columnHeader}>Source</th>
                    <th className={tableTokens.columnHeader}>Medium</th>
                    <th className={tableTokens.columnHeader}>Campaign</th>
                    <th className={`${tableTokens.columnHeader} text-right`}>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsBySource.map((row, i) => (
                    <tr key={i} className={tableTokens.rowHover}>
                      <td className={tableTokens.cell}>{row.utmSource ?? "—"}</td>
                      <td className={tableTokens.cell}>{row.utmMedium ?? "—"}</td>
                      <td className={tableTokens.cell}>{row.utmCampaign ?? "—"}</td>
                      <td className={`${tableTokens.cell} text-right`}>{row.leads.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
