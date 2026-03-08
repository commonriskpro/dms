import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { WidgetRow } from "./types";

export function ActivityFeedCard({ rows }: { rows: WidgetRow[] }) {
  const items = rows.slice(0, 5);
  return (
    <WidgetCard title="Activity" subtitle="Recent workflow movement">
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted-text)]">No recent activity.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href ?? "/deals"}
                className="flex min-h-[36px] items-center justify-between gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 hover:bg-[var(--surface)]"
              >
                <span className="truncate text-[13px] font-medium text-[var(--text)]">{row.label}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted-text)]">
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
