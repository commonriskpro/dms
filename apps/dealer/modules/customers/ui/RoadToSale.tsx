"use client";

import * as React from "react";
import {
  CRM_STAGE_ORDER,
  getStageLabel,
  getStageIndex,
} from "@/lib/constants/crm-stages";

export interface RoadToSaleProps {
  currentStage: string;
  /** Optional timestamp for tooltip (e.g. last stage change or updatedAt). */
  stageChangedAt?: string | null;
  className?: string;
}

/**
 * Horizontal Road-to-Sale progress bar (DealerCenter-style).
 * Circles connected by lines; completed = solid, current = blue, future = muted outline.
 */
export function RoadToSale({ currentStage, stageChangedAt, className = "" }: RoadToSaleProps) {
  const currentIdx = getStageIndex(currentStage);
  const isSold = currentStage === "SOLD";
  const isLost = currentStage === "INACTIVE";

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      role="progressbar"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={CRM_STAGE_ORDER.length}
      aria-label={`Road to sale: ${getStageLabel(currentStage)}`}
    >
      {CRM_STAGE_ORDER.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        let circleClass = "border-2 border-[var(--muted)] bg-[var(--panel)]";
        let lineClass = "bg-[var(--muted)]";
        if (isSold && stage === "SOLD") {
          circleClass = "bg-[var(--success)] border-[var(--success)]";
          lineClass = "bg-[var(--success)]";
        } else if (isLost && stage === "INACTIVE") {
          circleClass = "bg-[var(--danger)] border-[var(--danger)]";
          lineClass = "bg-[var(--danger)]";
        } else if (isCompleted) {
          circleClass = "bg-[var(--text-soft)] border-[var(--text-soft)]";
          lineClass = "bg-[var(--text-soft)]";
        } else if (isCurrent) {
          circleClass = "bg-[var(--accent)] border-[var(--accent)] ring-2 ring-[var(--accent)]/30 ring-offset-2 ring-offset-[var(--panel)]";
          lineClass = "bg-[var(--accent)]";
        }

        const tooltipText =
          stageChangedAt && isCurrent
            ? `${getStageLabel(stage)} (updated ${new Date(stageChangedAt).toLocaleDateString()})`
            : getStageLabel(stage);

        return (
          <React.Fragment key={stage}>
            {idx > 0 && (
              <div
                className={`h-0.5 w-3 shrink-0 ${lineClass}`}
                aria-hidden
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-3 w-3 shrink-0 rounded-full ${circleClass} transition-colors`}
                title={tooltipText}
                aria-hidden
              />
              <span
                className={`text-[10px] leading-tight max-w-[4rem] text-center truncate ${
                  isCurrent ? "font-semibold text-[var(--accent)]" : "text-[var(--text-soft)]"
                }`}
                title={tooltipText}
              >
                {getStageLabel(stage)}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
