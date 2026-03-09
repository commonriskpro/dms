"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardCard, typography } from "@/lib/ui/tokens";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PricingRuleForm } from "./PricingRuleForm";

export type RuleRow = {
  id: string;
  name: string;
  ruleType: string;
  daysInStock: number | null;
  adjustmentPercent: number | null;
  adjustmentCents: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PricingRulesManagerProps = {
  rules: RuleRow[];
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  onMutate: () => void;
};

export function PricingRulesManager({
  rules,
  loading,
  error,
  canWrite,
  onMutate,
}: PricingRulesManagerProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  if (loading) {
    return (
      <div className={dashboardCard}>
        <Skeleton className="h-32 w-full" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className={dashboardCard}>
        <p className="p-4 text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className={dashboardCard}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <p className="text-sm text-[var(--muted-text)]">
            Rules apply in order (age-based first). Preview on vehicle before applying.
          </p>
          {canWrite && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
            >
              Create rule
            </Button>
          )}
        </div>
        {rules.length === 0 ? (
          <EmptyState
            title="No pricing rules"
            description="Create a rule to automate price adjustments (e.g. age-based or clearance)."
            className="py-12"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--surface-2)]">
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Days in stock</TableHead>
                <TableHead scope="col">Adjustment</TableHead>
                <TableHead scope="col">Enabled</TableHead>
                {canWrite ? <TableHead scope="col">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((row) => (
                <TableRow key={row.id} className={typography.table}>
                  <TableCell className="text-[var(--text)]">{row.name}</TableCell>
                  <TableCell className="text-[var(--text)]">{row.ruleType.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-[var(--text)]">
                    {row.daysInStock != null ? row.daysInStock : "—"}
                  </TableCell>
                  <TableCell className="text-[var(--text)]">
                    {row.adjustmentPercent != null && `${row.adjustmentPercent}%`}
                    {row.adjustmentCents != null && ` ${row.adjustmentCents >= 0 ? "+" : ""}${row.adjustmentCents}¢`}
                    {row.adjustmentPercent == null && row.adjustmentCents == null && "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        row.enabled
                          ? "bg-[var(--success-muted)] text-[var(--success-muted-fg)]"
                          : "bg-[var(--muted)] text-[var(--text-soft)]"
                      }`}
                    >
                      {row.enabled ? "Yes" : "No"}
                    </span>
                  </TableCell>
                  {canWrite ? (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingId(row.id)}
                        className="border-[var(--border)]"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {createOpen && (
        <PricingRuleForm
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={onMutate}
        />
      )}
      {editingId && (
        <PricingRuleForm
          open={true}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={onMutate}
          ruleId={editingId}
          initialRule={rules.find((r) => r.id === editingId)}
        />
      )}
    </>
  );
}
