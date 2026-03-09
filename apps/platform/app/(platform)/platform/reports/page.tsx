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

type GrowthItem = { period: string; count: number };
type FunnelItem = { status: string; count: number };
type UsageItem = {
  id: string;
  displayName: string;
  legalName: string;
  planKey: string;
  limits: Record<string, unknown> | null;
  status: string;
  provisionedAt: string | null;
  createdAt: string;
};

export default function ReportsPage() {
  const { userId } = usePlatformAuthContext();
  const [growth, setGrowth] = useState<GrowthItem[] | null>(null);
  const [funnel, setFunnel] = useState<FunnelItem[] | null>(null);
  const [usage, setUsage] = useState<{ data: UsageItem[]; meta: { total: number; limit: number; offset: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchReports = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [growthRes, funnelRes, usageRes] = await Promise.all([
      platformFetch<{ data: GrowthItem[] }>("/api/platform/reports/growth?months=12", {
        platformUserId: userId,
      }),
      platformFetch<{ data: FunnelItem[] }>("/api/platform/reports/funnel", {
        platformUserId: userId,
      }),
      platformFetch<{ data: UsageItem[]; meta: { total: number; limit: number; offset: number } }>(
        "/api/platform/reports/usage?limit=20&offset=0",
        { platformUserId: userId }
      ),
    ]);
    if (growthRes.ok) setGrowth(growthRes.data.data);
    if (funnelRes.ok) setFunnel(funnelRes.data.data);
    if (usageRes.ok) setUsage({ data: usageRes.data.data, meta: usageRes.data.meta });
    if (!growthRes.ok && !funnelRes.ok && !usageRes.ok) setError(growthRes.ok ? funnelRes.error! : growthRes.error);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">Sign in to view reports.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Reports</h1>
        <div className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-soft)]">
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Reports</h1>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Application funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel && funnel.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnel.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-[var(--text-soft)]">No data.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dealership growth (by month)</CardTitle>
            </CardHeader>
            <CardContent>
              {growth && growth.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>New dealerships</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {growth.map((row) => (
                      <TableRow key={row.period}>
                        <TableCell>{row.period}</TableCell>
                        <TableCell>{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-[var(--text-soft)]">No data.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenant usage overview</CardTitle>
            </CardHeader>
            <CardContent>
              {usage && usage.data.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display name</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Provisioned</TableHead>
                        <TableHead aria-hidden />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.displayName}</TableCell>
                          <TableCell>{row.planKey}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell className="text-[var(--text-soft)]">
                            {row.provisionedAt
                              ? new Date(row.provisionedAt).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Link href={`/platform/dealerships/${row.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {usage.meta.total > usage.meta.limit && (
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      Showing {usage.data.length} of {usage.meta.total}. View full list in{" "}
                      <Link href="/platform/dealerships" className="text-[var(--accent)] hover:underline">
                        Dealerships
                      </Link>
                      .
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--text-soft)]">No dealerships yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
