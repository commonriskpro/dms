"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { WriteGuard } from "@/components/write-guard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { dashboardCard, typography } from "@/lib/ui/tokens";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuctionListingRow } from "./AuctionsPageClient";

export type AuctionResultsProps = {
  results: AuctionListingRow[];
  searching: boolean;
  searched: boolean;
  canCreateAppraisal: boolean;
};

export function AuctionResults({
  results,
  searching,
  searched,
  canCreateAppraisal,
}: AuctionResultsProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleCreateAppraisal = async (listingId: string) => {
    setLoadingId(listingId);
    try {
      await apiFetch(`/api/inventory/auctions/${listingId}/appraise`, { method: "POST" });
      addToast("success", "Appraisal created from listing");
      router.refresh();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLoadingId(null);
    }
  };

  if (searching) {
    return (
      <div className={dashboardCard}>
        <div className="p-6 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!searched) {
    return (
      <div className={dashboardCard}>
        <EmptyState
          title="Search auction listings"
          description="Use the filters above and click Search to find lots (MOCK provider)."
          className="py-12"
        />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={dashboardCard}>
        <EmptyState
          title="No results"
          description="Try different search criteria."
          className="py-12"
        />
      </div>
    );
  }

  return (
    <div className={`${dashboardCard} overflow-hidden`}>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--surface-2)]">
              <TableHead scope="col">Provider</TableHead>
              <TableHead scope="col">Lot ID</TableHead>
              <TableHead scope="col">VIN</TableHead>
              <TableHead scope="col">Vehicle</TableHead>
              <TableHead scope="col">Mileage</TableHead>
              <TableHead scope="col" className="text-right">Current bid</TableHead>
              <TableHead scope="col" className="text-right">Buy now</TableHead>
              <TableHead scope="col">End</TableHead>
              <TableHead scope="col">Location</TableHead>
              {canCreateAppraisal ? <TableHead scope="col">Action</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row) => (
              <TableRow key={row.id} className={typography.table}>
                <TableCell className="text-[var(--text)]">{row.provider}</TableCell>
                <TableCell className="font-mono text-[var(--text)]">{row.auctionLotId}</TableCell>
                <TableCell className="font-mono text-[var(--text)]">{row.vin ?? "—"}</TableCell>
                <TableCell className="text-[var(--text)]">
                  {[row.year, row.make, row.model].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell className="text-[var(--text)]">
                  {row.mileage != null ? row.mileage.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right text-[var(--text)]">
                  {row.currentBidCents != null ? formatCents(row.currentBidCents) : "—"}
                </TableCell>
                <TableCell className="text-right text-[var(--text)]">
                  {row.buyNowCents != null ? formatCents(row.buyNowCents) : "—"}
                </TableCell>
                <TableCell className="text-[var(--muted-text)]">
                  {row.auctionEndAt
                    ? new Date(row.auctionEndAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell className="text-[var(--muted-text)]">{row.location ?? "—"}</TableCell>
                {canCreateAppraisal ? (
                  <TableCell>
                    <WriteGuard>
                      <Button
                        size="sm"
                        className="text-xs bg-[var(--primary)] text-white"
                        onClick={() => handleCreateAppraisal(row.id)}
                        disabled={loadingId === row.id}
                      >
                        Create appraisal
                      </Button>
                    </WriteGuard>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
