"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { Stage, Opportunity } from "../types";

type StageColumnProps = {
  stage: Stage;
  opportunities: Opportunity[];
  totalValueCents: number;
  onMoveStage?: (opportunityId: string, toStageId: string) => void;
  stages: Stage[];
  canWrite: boolean;
  writeDisabled?: boolean;
  onOpenOpportunity: (id: string) => void;
};

function vehicleDisplay(opp: Opportunity): string {
  const v = opp.vehicle;
  if (!v) return "—";
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return v.vin || opp.vehicleId?.slice(0, 8) || "—";
}

function ageDisplay(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

export function StageColumn({
  stage,
  opportunities,
  totalValueCents,
  onMoveStage,
  stages,
  canWrite,
  writeDisabled,
  onOpenOpportunity,
}: StageColumnProps) {
  return (
    <div className="flex h-full min-w-[280px] max-w-[320px] flex-shrink-0 flex-col">
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--text)]">{stage.name}</h3>
            <span className="text-xs text-[var(--text-soft)]">
              {opportunities.length} · {formatCents(String(totalValueCents))}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-2 overflow-y-auto pb-4">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 shadow-sm"
            >
              <button
                type="button"
                onClick={() => onOpenOpportunity(opp.id)}
                className="w-full text-left"
              >
                <p className="font-medium text-[var(--text)]">
                  {opp.customer?.name ?? opp.customerId.slice(0, 8)}
                </p>
                <p className="text-xs text-[var(--text-soft)]">
                  {vehicleDisplay(opp)} · {ageDisplay(opp.createdAt)}
                </p>
                <p className="mt-1 text-sm text-[var(--text)]">
                  {opp.estimatedValueCents
                    ? formatCents(opp.estimatedValueCents)
                    : "—"}
                </p>
                {opp.owner && (
                  <p className="text-xs text-[var(--text-soft)]">
                    {opp.owner.fullName ?? opp.owner.email}
                  </p>
                )}
              </button>
              {canWrite && stages.length > 1 && (
                <div className="mt-2 flex items-center gap-1">
                  <select
                    aria-label="Move to stage"
                    value=""
                    disabled={writeDisabled}
                    onChange={(e) => {
                      const toId = e.target.value;
                      if (toId && toId !== stage.id) {
                        onMoveStage?.(opp.id, toId);
                      }
                      e.target.value = "";
                    }}
                    className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-xs"
                  >
                    <option value="">Move…</option>
                    {stages
                      .filter((s) => s.id !== stage.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
