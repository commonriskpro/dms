"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@/lib/money";

type ProfitData = {
  frontEndGrossCents: string;
  backEndGrossCents: string;
  totalGrossCents: string;
  feesCents: string;
  productsCents: string;
  netProfitCents: string;
};

export function DealProfitCard({ dealId }: { dealId: string }) {
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read") || hasPermission("deals.read");
  const [data, setData] = React.useState<ProfitData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<ProfitData>(`/api/deals/${dealId}/profit`)
      .then(setData)
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [dealId, canRead]);

  if (!canRead) return null;
  if (error) return null;
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Front gross</dt>
            <dd>{formatCents(data.frontEndGrossCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Back gross</dt>
            <dd>{formatCents(data.backEndGrossCents)}</dd>
          </div>
          <div className="flex justify-between pt-2 border-t border-[var(--border)]">
            <dt className="font-medium">Net profit</dt>
            <dd className="font-medium">{formatCents(data.netProfitCents)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
