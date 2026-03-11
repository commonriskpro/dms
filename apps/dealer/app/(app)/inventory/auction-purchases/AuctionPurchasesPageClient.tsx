"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { WriteGuard } from "@/components/write-guard";
import { typography } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, type SelectOption } from "@/components/ui/select";
import { formatCents } from "@/lib/money";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { AuctionPurchaseForm } from "./AuctionPurchaseForm";
import type { AuctionPurchaseRow } from "./page";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

export type AuctionPurchasesPageClientProps = {
  initialData: {
    data: AuctionPurchaseRow[];
    total: number;
    limit: number;
    offset: number;
  };
  currentQuery: { status: string };
  canWrite: boolean;
};

export function AuctionPurchasesPageClient({
  initialData,
  currentQuery,
  canWrite,
}: AuctionPurchasesPageClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);

  const handleCreated = React.useCallback(() => {
    setCreateOpen(false);
    router.refresh();
  }, [router]);

  const handleStatusChange = React.useCallback(
    async (id: string, status: string) => {
      try {
        await apiFetch(`/api/inventory/auction-purchases/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        addToast("success", "Status updated");
        router.refresh();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to update status");
      }
    },
    [addToast, router]
  );

  const { data, total, limit, offset } = initialData;
  const hasNext = offset + data.length < total;
  const hasPrev = offset > 0;
  const nextOffset = offset + limit;
  const prevOffset = Math.max(0, offset - limit);

  return (
    <div className={sectionStack}>
      <PageHeader
        title={<h1 className={typography.pageTitle}>Auction purchases</h1>}
        actions={
          canWrite ? (
            <WriteGuard>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
              >
                Create purchase
              </Button>
            </WriteGuard>
          ) : null
        }
      />
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] overflow-hidden">
        {data.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted-text)]">
            No auction purchases yet. Create one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auction</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Shipping</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.auctionName}</TableCell>
                  <TableCell>{row.lotNumber}</TableCell>
                  <TableCell className="text-right">{formatCents(row.purchasePriceCents)}</TableCell>
                  <TableCell className="text-right">{formatCents(row.feesCents)}</TableCell>
                  <TableCell className="text-right">{formatCents(row.shippingCents)}</TableCell>
                  <TableCell>
                    {row.etaDate ? new Date(row.etaDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    {row.vehicle ? (
                      <Link
                        href={inventoryDetailPath(row.vehicle.id)}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {row.vehicle.year} {row.vehicle.make} {row.vehicle.model} ({row.vehicle.stockNumber})
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <Select
                        value={row.status}
                        onChange={(v) => handleStatusChange(row.id, v)}
                        options={STATUS_OPTIONS}
                        className="w-[130px]"
                      />
                    ) : (
                      row.status
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {total > limit && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2">
            <span className="text-sm text-[var(--muted-text)]">
              {offset + 1}–{Math.min(offset + data.length, total)} of {total}
            </span>
            <div className="flex gap-2">
              {hasPrev && (
                <Link
                  href={`/inventory/auction-purchases?offset=${prevOffset}&limit=${limit}${currentQuery.status ? `&status=${currentQuery.status}` : ""}`}
                >
                  <Button variant="secondary" size="sm">Previous</Button>
                </Link>
              )}
              {hasNext && (
                <Link
                  href={`/inventory/auction-purchases?offset=${nextOffset}&limit=${limit}${currentQuery.status ? `&status=${currentQuery.status}` : ""}`}
                >
                  <Button variant="secondary" size="sm">Next</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
      {createOpen && (
        <AuctionPurchaseForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={handleCreated}
        />
      )}
    </div>
  );
}
