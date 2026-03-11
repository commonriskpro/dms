"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
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
import { WriteGuard } from "@/components/write-guard";
import type {
  Vendor,
  VendorCostEntrySummary,
} from "@/lib/types/vendors";
import { VENDOR_TYPE_OPTIONS } from "@/lib/types/vendors";
import { formatCents } from "@/lib/money";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

export function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const id = typeof params?.id === "string" ? params.id : null;

  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");

  const [vendor, setVendor] = React.useState<Vendor | null>(null);
  const [costEntries, setCostEntries] = React.useState<
    VendorCostEntrySummary[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchVendor = React.useCallback(async () => {
    if (!id || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [vRes, entriesRes] = await Promise.all([
        apiFetch<{ data: Vendor }>(`/api/vendors/${id}`),
        apiFetch<{ data: VendorCostEntrySummary[] }>(
          `/api/vendors/${id}/cost-entries?limit=25`
        ),
      ]);
      setVendor(vRes.data);
      setCostEntries(entriesRes.data ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setVendor(null);
      setCostEntries([]);
    } finally {
      setLoading(false);
    }
  }, [id, canRead]);

  React.useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchVendor();
  }, [id, canRead, fetchVendor]);

  if (!id) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">Invalid vendor.</p>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">
          You don&apos;t have access to vendors.
        </p>
      </div>
    );
  }

  if (loading && !vendor) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !vendor) {
    return (
      <ErrorState
        title="Vendor not found"
        message={error}
        onRetry={fetchVendor}
      />
    );
  }

  if (!vendor) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">Vendor not found.</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => router.push("/vendors")}
        >
          Back to vendors
        </Button>
      </div>
    );
  }

  const typeLabel =
    VENDOR_TYPE_OPTIONS.find((o) => o.value === vendor.type)?.label ??
    vendor.type;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/vendors")}
            aria-label="Back to vendors"
          >
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            {vendor.name}
          </h1>
          {vendor.deletedAt && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted-text)]">
              Removed
            </span>
          )}
        </div>
        {canWrite && !vendor.deletedAt && (
          <WriteGuard>
            <Button
              variant="secondary"
              onClick={() => router.push(`/vendors?edit=${vendor.id}`)}
              aria-label={`Edit ${vendor.name}`}
            >
              Edit vendor
            </Button>
          </WriteGuard>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-[var(--muted-text)]">Type</span>
              <p className="font-medium text-[var(--text)]">{typeLabel}</p>
            </div>
            <div>
              <span className="text-[var(--muted-text)]">Status</span>
              <p className="font-medium text-[var(--text)]">
                {vendor.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            {vendor.contactName && (
              <div>
                <span className="text-[var(--muted-text)]">Contact</span>
                <p className="font-medium text-[var(--text)]">
                  {vendor.contactName}
                </p>
              </div>
            )}
            {vendor.phone && (
              <div>
                <span className="text-[var(--muted-text)]">Phone</span>
                <p className="font-medium text-[var(--text)]">{vendor.phone}</p>
              </div>
            )}
            {vendor.email && (
              <div>
                <span className="text-[var(--muted-text)]">Email</span>
                <p className="font-medium text-[var(--text)]">{vendor.email}</p>
              </div>
            )}
            {vendor.address && (
              <div className="sm:col-span-2">
                <span className="text-[var(--muted-text)]">Address</span>
                <p className="font-medium text-[var(--text)]">{vendor.address}</p>
              </div>
            )}
            {vendor.notes && (
              <div className="sm:col-span-2">
                <span className="text-[var(--muted-text)]">Notes</span>
                <p className="font-medium text-[var(--text)]">{vendor.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent cost entries</CardTitle>
          <p className="text-sm text-[var(--muted-text)]">
            Up to 25 most recent cost entries linked to this vendor.
          </p>
        </CardHeader>
        <CardContent>
          {costEntries.length === 0 ? (
            <p className="text-sm text-[var(--muted-text)]">
              No cost entries linked to this vendor yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={inventoryDetailPath(e.vehicleId)}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {e.vehicleSummary || e.stockNumber || e.vehicleId}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">
                      {e.category.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(e.amountCents)}
                    </TableCell>
                    <TableCell className="text-[var(--muted-text)]">
                      {new Date(e.occurredAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
