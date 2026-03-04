"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CRM_STAGE_ORDER, getStageLabel } from "@/lib/constants/crm-stages";

export interface CustomerMetricsData {
  newLeadsToday: number;
  leadsThisWeek: number;
  byStatus: Record<string, number>;
  tasksDueToday: number;
}

export interface DashboardCustomersWidgetProps {
  canRead: boolean;
  className?: string;
}

export function DashboardCustomersWidget({ canRead, className = "" }: DashboardCustomersWidgetProps) {
  const [data, setData] = React.useState<CustomerMetricsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<{ data: CustomerMetricsData }>("/api/dashboard/customer-metrics")
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load metrics"))
      .finally(() => setLoading(false));
  }, [canRead]);

  if (!canRead) return null;

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const cards: { title: string; value: number; href: string; label: string }[] = [
    {
      title: "New leads today",
      value: data.newLeadsToday,
      href: "/customers?status=LEAD",
      label: "View leads",
    },
    {
      title: "Leads this week",
      value: data.leadsThisWeek,
      href: "/customers?status=LEAD",
      label: "View leads",
    },
    {
      title: "Tasks due today",
      value: data.tasksDueToday,
      href: "/customers",
      label: "View customers",
    },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.title} href={c.href}>
            <Card className="h-full border border-[var(--border)] bg-[var(--panel)] shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  {c.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold text-[var(--accent)]">{c.value}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <Card className="border border-[var(--border)] bg-[var(--panel)] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
              Customers by stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {CRM_STAGE_ORDER.map((stage) => (
                <Link
                  key={stage}
                  href={`/customers?status=${stage}`}
                  className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-sm hover:bg-[var(--muted)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span className="font-semibold text-[var(--accent)]">
                    {data.byStatus[stage] ?? 0}
                  </span>
                  <span className="text-[var(--text-soft)]">{getStageLabel(stage)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
