import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";

export function ActivityFeedCard({ rows }: { rows: WidgetRow[] }) {
  const items = rows.slice(0, 5);
  return (
    <WidgetCard title="Activity">
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted-text)]">No recent activity.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href ?? "/deals"}
                className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 hover:bg-[var(--surface)]"
              >
                <span className="truncate text-sm text-[var(--text)]">{row.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--muted-text)]">
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
