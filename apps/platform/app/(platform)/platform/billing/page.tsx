"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch, type ApiError } from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type BillingItem = {
  id: string;
  displayName: string;
  planKey: string;
  limits: Record<string, unknown> | null;
  status: string;
};

export default function BillingPage() {
  const { userId } = usePlatformAuthContext();
  const [data, setData] = useState<{ data: BillingItem[]; planKeys: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchBilling = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await platformFetch<{
      data: BillingItem[];
      meta: { total: number; limit: number; offset: number };
      planKeys: string[];
    }>("/api/platform/billing?limit=50&offset=0", {
      platformUserId: userId,
    });
    if (res.ok) setData({ data: res.data.data, planKeys: res.data.planKeys ?? [] });
    else setError(res.error);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">Sign in to view billing.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Billing</h1>
        <div className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-soft)]">
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Plan overview</CardTitle>
          <p className="text-sm font-normal text-[var(--text-soft)]">
            Internal plan management. No external billing or payment methods. Use View to edit plan and limits per dealership.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : data ? (
            <>
              {data.planKeys.length > 0 && (
                <p className="mb-4 text-sm text-[var(--text-soft)]">
                  Plan keys in use: {data.planKeys.join(", ")}
                </p>
              )}
              {data.data.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-soft)]">
                  No dealerships yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dealership</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Limits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead aria-hidden />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.displayName}</TableCell>
                        <TableCell>{row.planKey}</TableCell>
                        <TableCell className="text-[var(--text-soft)] font-mono text-xs">
                          {row.limits && Object.keys(row.limits).length > 0
                            ? JSON.stringify(row.limits)
                            : "—"}
                        </TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>
                          <Link href={`/platform/dealerships/${row.id}`}>
                            <span className="text-sm text-[var(--accent)] hover:underline">
                              View / Edit plan
                            </span>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
