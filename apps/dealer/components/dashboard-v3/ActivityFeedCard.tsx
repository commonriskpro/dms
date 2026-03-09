import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";

export function ActivityFeedCard({ rows }: { rows: WidgetRow[] }) {
  const items = rows.slice(0, 5);
  return (
    <WidgetCard title="Activity">
      {items.length === 0 ? (
        <p className="px-3 text-sm text-[var(--muted-text)]">No recent activity.</p>
      ) : (
        <ul>
          {items.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href ?? "/deals"}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/50"
              >
                <span className="truncate text-sm font-medium text-[var(--text)]">{row.label}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--muted-text)]">
                  {row.count.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
