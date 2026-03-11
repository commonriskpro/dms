"use client";

import * as React from "react";
import { Popover } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { JourneyBarStage, JourneyBarSignals, SegmentState } from "./types";
import { getNextBestActionLabel } from "./next-best-action-labels";
import { getStageColor } from "./stage-colors";

const STALE_DAYS_THRESHOLD = 7;

interface SegmentedJourneyBarProps {
  stages: JourneyBarStage[];
  currentStageId: string | null;
  /** Optional; derived from currentStageId if not provided. */
  currentIndex?: number;
  signals?: JourneyBarSignals | null;
  nextBestActionKey?: string | null;
  /** When true, clicking current (or a) segment opens popover to change stage. */
  canChangeStage?: boolean;
  /** Called when user selects a new stage in the popover. Parent should PATCH then refetch. */
  onStageChange?: (newStageId: string) => Promise<void>;
  className?: string;
}

function getSegmentState(
  index: number,
  currentIndex: number,
  currentStageId: string | null
): SegmentState {
  if (currentStageId == null) {
    return index === 0 ? "current" : "upcoming";
  }
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "upcoming";
}

function SignalsStrip({
  signals,
}: {
  signals: JourneyBarSignals;
}) {
  // Stable "now" per mount so staleness label is consistent during component life
  const nowMsRef = React.useRef<number>(0);
  if (nowMsRef.current === 0) {
    // eslint-disable-next-line react-hooks/purity -- intentional stable timestamp per mount
    nowMsRef.current = Date.now();
  }
  const nowMs = nowMsRef.current;
  const items: React.ReactNode[] = [];

  if ((signals.overdueTaskCount ?? 0) > 0) {
    items.push(
      <span key="overdue" className="text-[var(--danger)] text-xs font-medium">
        {signals.overdueTaskCount} overdue task{signals.overdueTaskCount === 1 ? "" : "s"}
      </span>
    );
  }

  if (signals.nextAppointment?.start) {
    const date = new Date(signals.nextAppointment.start);
    items.push(
      <span key="appt" className="text-[var(--text-soft)] text-xs">
        Next: {date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
      </span>
    );
  }

  if (signals.lastActivityAt != null) {
    const last = new Date(signals.lastActivityAt);
    const daysSince = Math.floor((nowMs - last.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince >= STALE_DAYS_THRESHOLD) {
      items.push(
        <span key="stale" className="text-[var(--danger)] text-xs">
          {daysSince === 0 ? "Stale" : `No activity in ${daysSince} days`}
        </span>
      );
    }
  }

  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1.5" role="status">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-[var(--border)]" aria-hidden>·</span>}
          {item}
        </React.Fragment>
      ))}
    </div>
  );
}

export function SegmentedJourneyBar({
  stages,
  currentStageId,
  currentIndex: currentIndexProp,
  signals,
  nextBestActionKey,
  canChangeStage = false,
  onStageChange,
  className = "",
}: SegmentedJourneyBarProps) {
  const resolvedCurrentIndex =
    currentIndexProp ??
    (currentStageId ? stages.findIndex((s) => s.id === currentStageId) : 0);
  const safeCurrentIndex = resolvedCurrentIndex >= 0 ? resolvedCurrentIndex : 0;

  const [popoverStageId, setPopoverStageId] = React.useState<string | null>(null);
  const [transitioning, setTransitioning] = React.useState(false);

  const handleSelectStage = React.useCallback(
    async (newStageId: string) => {
      if (newStageId === currentStageId || !onStageChange) {
        setPopoverStageId(null);
        return;
      }
      setTransitioning(true);
      try {
        await onStageChange(newStageId);
        setPopoverStageId(null);
      } finally {
        setTransitioning(false);
      }
    },
    [currentStageId, onStageChange]
  );

  if (stages.length === 0) {
    return (
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 ${className}`}>
        <p className="text-sm text-[var(--text-soft)]">No stages in pipeline.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-sm ${className}`}>
      <div
        className="flex flex-wrap items-center gap-0"
        role="progressbar"
        aria-valuenow={safeCurrentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={stages.length}
        aria-label={`Journey: ${stages[safeCurrentIndex]?.name ?? "Unknown"} stage`}
      >
        {stages.map((stage, index) => {
          const state = getSegmentState(index, safeCurrentIndex, currentStageId);
          const isCurrent = state === "current";
          const isCompleted = state === "completed";
          const isUpcoming = state === "upcoming";

          const colorVar = getStageColor(stage.colorKey);
          const segmentBg =
            isCurrent && colorVar
              ? colorVar
              : isCurrent
                ? "var(--accent)"
                : isCompleted
                  ? "var(--text-soft)"
                  : "var(--muted)";
          const segmentOpacity = isUpcoming ? 0.7 : 1;
          const segmentBorder =
            isCurrent
              ? "2px solid var(--accent)"
              : "1px solid var(--border)";

          const segmentContent = (
            <span className="inline-flex items-center gap-1 truncate">
              {isCompleted && (
                <span className="shrink-0 text-[10px] text-[var(--panel)]" aria-hidden>
                  ✓
                </span>
              )}
              <span className="truncate">{stage.name}</span>
            </span>
          );

          const segmentClasses = `
            flex items-center justify-center min-w-[80px] max-w-[140px] px-2 py-1.5 rounded
            text-xs font-medium border transition-colors
            ${isUpcoming ? "opacity-70" : ""}
          `;

          const style: React.CSSProperties = {
            backgroundColor: segmentBg,
            border: segmentBorder,
            opacity: segmentOpacity,
          };
          if (isUpcoming) {
            style.color = "var(--text-soft)";
            style.backgroundColor = "var(--muted)";
          } else {
            style.color = "var(--panel)";
          }

          const segmentEl = (
            <div
              key={stage.id}
              className="flex items-center gap-0.5 shrink-0"
              style={{ flex: "1 1 0", minWidth: 0 }}
            >
              {index > 0 && (
                <div
                  className="h-0.5 shrink-0 flex-1 min-w-[8px] max-w-[24px] rounded"
                  style={{ backgroundColor: isCompleted ? "var(--text-soft)" : "var(--border)" }}
                  aria-hidden
                />
              )}
              {canChangeStage && onStageChange ? (
                <Popover
                  open={popoverStageId === stage.id}
                  onOpenChange={(open) => setPopoverStageId(open ? stage.id : null)}
                  align="start"
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      className={segmentClasses}
                      style={style}
                      onClick={() => setPopoverStageId(popoverStageId === stage.id ? null : stage.id)}
                      aria-label={`Stage: ${stage.name}. Click to change stage.`}
                      aria-haspopup="listbox"
                      aria-expanded={popoverStageId === stage.id}
                      disabled={transitioning}
                    >
                      {segmentContent}
                    </Button>
                  }
                >
                  <ul role="listbox" className="max-h-[240px] overflow-y-auto">
                    {stages.map((s) => (
                      <li key={s.id} role="option" aria-selected={s.id === currentStageId}>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start px-3 py-2 text-sm hover:bg-[var(--muted)] focus:bg-[var(--muted)] focus-visible:outline focus-visible:ring-0"
                          onClick={() => handleSelectStage(s.id)}
                          disabled={s.id === currentStageId}
                          aria-selected={s.id === currentStageId}
                        >
                          {s.name}
                          {s.id === currentStageId && " (current)"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Popover>
              ) : (
                <div
                  className={segmentClasses}
                  style={style}
                  title={canChangeStage ? undefined : "No permission to change stage"}
                  aria-label={`Stage: ${stage.name}`}
                >
                  {segmentContent}
                </div>
              )}
            </div>
          );

          return <React.Fragment key={stage.id}>{segmentEl}</React.Fragment>;
        })}
      </div>

      {signals && (signals.overdueTaskCount !== undefined || signals.nextAppointment || signals.lastActivityAt != null) && (
        <SignalsStrip signals={signals} />
      )}

      {nextBestActionKey && (
        <p className="text-xs text-[var(--text-soft)] mt-1.5" role="status">
          Next: {getNextBestActionLabel(nextBestActionKey)}
        </p>
      )}
    </div>
  );
}
