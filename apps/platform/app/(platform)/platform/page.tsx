"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch, type ApiError } from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardData = {
  kpis: {
    totalDealerships: number;
    activeDealerships: number;
    totalApplications: number;
    appliedApplications: number;
    totalPlatformUsers: number;
    applicationsLast7Days: number;
    activeSubscriptions?: number;
    trialSubscriptions?: number;
    monthlyRevenueEstimate?: number;
  };
  recentApplications: Array<{
    id: string;
    status: string;
    displayName: string;
    legalName: string;
    contactEmail: string;
    createdAt: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: string;
  }>;
};

export default function PlatformDashboardPage() {
  const { userId } = usePlatformAuthContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await platformFetch<DashboardData>("/api/platform/dashboard", {
      platformUserId: userId,
    });
    if (res.ok) setData(res.data);
    else setError(res.error);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">Sign in to view the dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--text-soft)]">
          {error.message} {error.code === "FORBIDDEN" && "(403)"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  Total dealerships
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--text)]">
                  {data.kpis.totalDealerships}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  Active dealerships
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--text)]">
                  {data.kpis.activeDealerships}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  Total applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--text)]">
                  {data.kpis.totalApplications}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  Pending (APPLIED)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--text)]">
                  {data.kpis.appliedApplications}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  Platform users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--text)]">
                  {data.kpis.totalPlatformUsers}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                  Applications (last 7 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--text)]">
                  {data.kpis.applicationsLast7Days}
                </p>
              </CardContent>
            </Card>
            {data.kpis.activeSubscriptions != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                    Active subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-[var(--text)]">
                    {data.kpis.activeSubscriptions}
                  </p>
                </CardContent>
              </Card>
            )}
            {data.kpis.trialSubscriptions != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                    Trial accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-[var(--text)]">
                    {data.kpis.trialSubscriptions}
                  </p>
                </CardContent>
              </Card>
            )}
            {data.kpis.monthlyRevenueEstimate != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--text-soft)]">
                    Monthly revenue (est.)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-[var(--text)]">
                    ${data.kpis.monthlyRevenueEstimate.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Recent applications</CardTitle>
                <Link href="/platform/applications">
                  <Button variant="secondary" size="sm">
                    View all
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {data.recentApplications.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-soft)]">
                    No applications yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead aria-hidden />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentApplications.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.displayName}</TableCell>
                          <TableCell>{a.status}</TableCell>
                          <TableCell className="text-[var(--text-soft)]">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Link href={`/platform/applications/${a.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Recent audit</CardTitle>
                <Link href="/platform/audit">
                  <Button variant="secondary" size="sm">
                    View all
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {data.recentAudit.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-soft)]">
                    No audit entries yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentAudit.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.action}</TableCell>
                          <TableCell className="text-[var(--text-soft)]">
                            {e.targetType}
                            {e.targetId ? ` · ${String(e.targetId).slice(0, 8)}…` : ""}
                          </TableCell>
                          <TableCell className="text-[var(--text-soft)]">
                            {new Date(e.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link href="/platform/dealerships">
                <Button variant="secondary" size="sm">
                  Dealerships
                </Button>
              </Link>
              <Link href="/platform/applications">
                <Button variant="secondary" size="sm">
                  Applications
                </Button>
              </Link>
              <Link href="/platform/monitoring">
                <Button variant="secondary" size="sm">
                  Monitoring
                </Button>
              </Link>
              <Link href="/platform/reports">
                <Button variant="secondary" size="sm">
                  Reports
                </Button>
              </Link>
              <Link href="/platform/audit">
                <Button variant="secondary" size="sm">
                  Audit Logs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
