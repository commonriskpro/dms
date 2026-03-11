"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
import { dashboardCard, severityBadgeClasses, typography } from "@/lib/ui/tokens";
import { EmptyState } from "@/components/empty-state";
import type { AppraisalRow } from "./page";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

const STATUS_BADGE: Record<string, keyof typeof severityBadgeClasses> = {
  DRAFT: "info",
  APPROVED: "success",
  REJECTED: "danger",
  PURCHASED: "success",
  CONVERTED: "success",
};

export type AppraisalsTableProps = {
  rows: AppraisalRow[];
  total: number;
  limit: number;
  offset: number;
  canWrite: boolean;
  onMutate: () => void;
};

export function AppraisalsTable({
  rows,
  total,
  limit,
  offset,
  canWrite,
  onMutate,
}: AppraisalsTableProps) {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleApprove = async (id: string) => {
    const ok = await confirm({
      title: "Approve appraisal",
      description: "This appraisal will be marked as approved and can be converted to inventory.",
      confirmText: "Approve",
    });
    if (!ok) return;
    setLoadingId(id);
    try {
      await apiFetch(`/api/inventory/appraisals/${id}/approve`, { method: "POST" });
      addToast("success", "Appraisal approved");
      onMutate();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const ok = await confirm({
      title: "Reject appraisal",
      description: "This appraisal will be marked as rejected. It cannot be converted to inventory.",
      confirmText: "Reject",
      variant: "danger",
    });
    if (!ok) return;
    setLoadingId(id);
    try {
      await apiFetch(`/api/inventory/appraisals/${id}/reject`, { method: "POST" });
      addToast("success", "Appraisal rejected");
      onMutate();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLoadingId(null);
    }
  };

  const handleConvert = async (id: string) => {
    const ok = await confirm({
      title: "Convert to inventory",
      description: "A new vehicle will be created from this appraisal and linked to it.",
      confirmText: "Convert",
    });
    if (!ok) return;
    setLoadingId(id);
    try {
      await apiFetch(`/api/inventory/appraisals/${id}/convert`, { method: "POST" });
      addToast("success", "Converted to inventory");
      onMutate();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setLoadingId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className={dashboardCard}>
        <EmptyState
          title="No appraisals"
          description="Create an appraisal to get started."
          className="py-12"
        />
      </div>
    );
  }

  return (
    <div className={`${dashboardCard} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">Appraisal table</h2>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            Keep valuation decisions, approval, and conversion actions in the same operating surface.
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--muted-text)]">
          {total.toLocaleString()} appraisals
        </span>
      </div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--surface-2)]">
              <TableHead scope="col">VIN</TableHead>
              <TableHead scope="col">Source</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">Expected Retail</TableHead>
              <TableHead scope="col" className="text-right">Expected Profit</TableHead>
              <TableHead scope="col">Created</TableHead>
              {canWrite ? <TableHead scope="col" className="w-[120px]">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const badgeClass = STATUS_BADGE[row.status] ?? "info";
              const loading = loadingId === row.id;
              return (
                <TableRow key={row.id} className={typography.table}>
                  <TableCell>
                    <span className="font-mono text-[var(--text)]">{row.vin}</span>
                  </TableCell>
                  <TableCell className="text-[var(--text)]">{row.sourceType.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${severityBadgeClasses[badgeClass]}`}
                    >
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[var(--text)]">
                    {formatCents(row.expectedRetailCents)}
                  </TableCell>
                  <TableCell className="text-right text-[var(--text)]">
                    {formatCents(row.expectedProfitCents)}
                  </TableCell>
                  <TableCell className="text-[var(--muted-text)]">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  {canWrite ? (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.status === "DRAFT" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs border-[var(--border)]"
                              onClick={() => handleApprove(row.id)}
                              disabled={loading}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs border-[var(--border)] text-[var(--danger)]"
                              onClick={() => handleReject(row.id)}
                              disabled={loading}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {(row.status === "APPROVED" || row.status === "DRAFT") && !row.vehicleId && (
                          <Button
                            size="sm"
                            className="text-xs bg-[var(--primary)] text-white"
                            onClick={() => handleConvert(row.id)}
                            disabled={loading}
                          >
                            Convert
                          </Button>
                        )}
                        {row.vehicleId && (
                          <Link href={inventoryDetailPath(row.vehicleId)}>
                            <Button size="sm" variant="secondary" className="text-xs">
                              View vehicle
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {total > limit && (
        <div className="px-4 py-2 border-t border-[var(--border)] text-sm text-[var(--muted-text)]">
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
        </div>
      )}
    </div>
  );
}
