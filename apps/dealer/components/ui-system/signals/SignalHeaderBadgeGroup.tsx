import Link from "next/link";
import { SignalSeverityBadge } from "./SignalSeverityBadge";
import type { SignalSurfaceItem } from "./types";

export function SignalHeaderBadgeGroup({
  items,
  maxVisible = 3,
}: {
  items: SignalSurfaceItem[];
  maxVisible?: number;
}) {
  const visible = items.slice(0, maxVisible);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((item) => {
        const badge = (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]">
            <SignalSeverityBadge severity={item.severity} />
            <span className="max-w-[12rem] truncate">{item.title}</span>
            {typeof item.count === "number" ? (
              <span className="tabular-nums text-[var(--text-soft)]">{item.count}</span>
            ) : null}
          </span>
        );

        if (!item.actionHref) return <span key={item.key}>{badge}</span>;
        return (
          <Link key={item.key} href={item.actionHref} className="inline-flex">
            {badge}
          </Link>
        );
      })}
    </div>
  );
}
