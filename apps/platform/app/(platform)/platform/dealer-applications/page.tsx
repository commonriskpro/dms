"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/lib/api-client";
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
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "submitted" },
  { value: "under_review", label: "under_review" },
  { value: "approved", label: "approved" },
  { value: "rejected", label: "rejected" },
  { value: "activation_sent", label: "activation_sent" },
  { value: "activated", label: "activated" },
  { value: "draft", label: "draft" },
  { value: "invited", label: "invited" },
];

const LIMIT = 25;

type DealerAppListItem = {
  id: string;
  source: string;
  status: string;
  ownerEmail: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  dealershipId: string | null;
  platformApplicationId: string | null;
  platformDealershipId: string | null;
  createdAt: string;
};

export default function DealerApplicationsListPage() {
  const { userId } = usePlatformAuthContext();
  const [data, setData] = useState<DealerAppListItem[]>([]);
  const [meta, setMeta] = useState<{ total: number; limit: number; offset: number } | null>(null);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setOffset(0);
    setLoading(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      limit: String(LIMIT),
      offset: String(offset),
    };
    if (status) params.status = status;
    platformFetch<{ data: DealerAppListItem[]; meta: { total: number; limit: number; offset: number } }>(
      "/api/platform/dealer-applications",
      { params, platformUserId: userId ?? undefined }
    )
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setData(res.data.data);
          setMeta(res.data.meta);
        } else {
          setError(res.error?.message ?? "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset, status, userId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dealer applications</h1>
      <p className="text-sm text-[var(--text-soft)]">
        Applications submitted via the public apply or invite flow. Review and manage lifecycle.
      </p>
      {error && (
        <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-muted)] px-4 py-2 text-sm text-[var(--danger-muted-fg)]">
          {error}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Queue</CardTitle>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            className="w-40"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !data.length ? (
            <p className="py-8 text-center text-[var(--text-soft)]">No dealer applications found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Owner email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/platform/dealer-applications/${row.id}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {row.status}
                      </Link>
                    </TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>{row.ownerEmail}</TableCell>
                    <TableCell>
                      {row.submittedAt
                        ? new Date(row.submittedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {meta && meta.total > LIMIT && (
            <p className="mt-3 text-sm text-[var(--text-soft)]">
              Showing {data.length} of {meta.total}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
