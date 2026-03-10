import { SignalSeverityBadge, type SignalSeverity } from "./SignalSeverityBadge";
import type { SignalSurfaceItem } from "./types";

type SignalBlockerInlineProps = {
  items: SignalSurfaceItem[];
  maxCount?: number;
  severity?: SignalSeverity;
};

/**
 * Compact inline cue for section or row: shows count and severity.
 * Use for "1 funding issue" style hints without full list.
 */
export function SignalBlockerInline({
  items,
  maxCount = 3,
  severity,
}: SignalBlockerInlineProps) {
  if (items.length === 0) return null;
  const displayCount = Math.min(items.length, maxCount);
  const effectiveSeverity =
    severity ?? (items.some((i) => i.severity === "danger") ? "danger" : "warning");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <SignalSeverityBadge severity={effectiveSeverity} />
      <span className="font-medium text-[var(--text)]">
        {displayCount} {displayCount === 1 ? "issue" : "issues"}
      </span>
    </span>
  );
}
