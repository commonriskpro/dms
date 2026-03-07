"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";

type CreditApplicationListItem = {
  id: string;
  dealId: string | null;
  customerId: string;
  status: string;
  applicantFirstName: string;
  applicantLastName: string;
  submittedAt: string | null;
  decisionedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LenderApplicationItem = {
  id: string;
  creditApplicationId: string;
  dealId: string;
  lenderName: string;
  status: string;
  stipulationCount: number;
  submittedAt: string | null;
  decisionedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const CREDIT_STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  READY_TO_SUBMIT: "info",
  SUBMITTED: "info",
  APPROVED: "success",
  DENIED: "danger",
  CONDITIONALLY_APPROVED: "warning",
  WITHDRAWN: "neutral",
};

const LENDER_STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  RECEIVED: "info",
  APPROVED: "success",
  DENIED: "danger",
  COUNTER_OFFER: "warning",
  STIP_PENDING: "warning",
  FUNDED: "success",
  CANCELLED: "neutral",
};

export function DealCreditTab({
  dealId,
  dealStatus,
}: {
  dealId: string;
  dealStatus: string;
}) {
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");

  const [creditApps, setCreditApps] = React.useState<CreditApplicationListItem[]>([]);
  const [lenderAppsByCredit, setLenderAppsByCredit] = React.useState<Record<string, LenderApplicationItem[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canRead || !dealId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ data: CreditApplicationListItem[]; meta: { total: number } }>(
      `/api/credit-applications?dealId=${encodeURIComponent(dealId)}&limit=50`
    )
      .then((res) => {
        if (cancelled) return;
        setCreditApps(res.data ?? []);
        setLoading(false);
        return res.data ?? [];
      })
      .then((list) => {
        if (cancelled || !list?.length) return;
        list.forEach((app) => {
          apiFetch<{ data: LenderApplicationItem[] }>(
            `/api/lender-applications?creditApplicationId=${encodeURIComponent(app.id)}&limit=50`
          ).then((r) => {
            if (cancelled) return;
            setLenderAppsByCredit((prev) => ({ ...prev, [app.id]: r.data ?? [] }));
          });
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(getApiErrorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, dealId]);

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--muted-text)]">You don’t have permission to view credit applications.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState message={error} />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credit & Lender Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credit & Lender Applications</CardTitle>
        <p className="text-sm text-[var(--muted-text)]">
          Internal credit applications and lender submissions for this deal.
        </p>
      </CardHeader>
      <CardContent>
        {creditApps.length === 0 ? (
          <p className="text-sm text-[var(--muted-text)]">No credit applications for this deal yet.</p>
        ) : (
          <div className="space-y-4">
            {creditApps.map((app) => (
              <div
                key={app.id}
                className="rounded-lg border border-[var(--border)] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--text)]">
                    {app.applicantFirstName} {app.applicantLastName}
                  </span>
                  <StatusBadge variant={CREDIT_STATUS_VARIANT[app.status] ?? "neutral"}>
                    {app.status.replace(/_/g, " ")}
                  </StatusBadge>
                  {app.submittedAt && (
                    <span className="text-xs text-[var(--muted-text)]">
                      Submitted {new Date(app.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <LenderAppsTable creditApplicationId={app.id} lenderApps={lenderAppsByCredit[app.id] ?? []} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LenderAppsTable({
  creditApplicationId,
  lenderApps,
}: {
  creditApplicationId: string;
  lenderApps: LenderApplicationItem[];
}) {
  if (lenderApps.length === 0) return null;
  return (
    <div className="ml-2 mt-2">
      <p className="text-xs font-medium text-[var(--muted-text)] mb-1">Lender applications</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lender</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Stips</TableHead>
            <TableHead className="text-right">Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lenderApps.map((la) => (
            <TableRow key={la.id}>
              <TableCell className="font-medium">{la.lenderName}</TableCell>
              <TableCell>
                <StatusBadge variant={LENDER_STATUS_VARIANT[la.status] ?? "neutral"}>
                  {la.status.replace(/_/g, " ")}
                </StatusBadge>
              </TableCell>
              <TableCell>{la.stipulationCount}</TableCell>
              <TableCell className="text-right text-[var(--muted-text)]">
                {la.submittedAt
                  ? new Date(la.submittedAt).toLocaleDateString()
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
