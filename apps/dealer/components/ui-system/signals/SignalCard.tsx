import Link from "next/link";
import { widgetRowSurface } from "@/lib/ui/tokens";
import type { SignalSeverity } from "./SignalSeverityBadge";

export type SignalCardProps = {
  title: string;
  description?: string | null;
  severity: SignalSeverity;
  actionHref?: string | null;
  count?: number | null;
};

const DOT_COLOR: Record<SignalSeverity, string> = {
  danger:  "bg-[var(--danger)]",
  warning: "bg-[var(--warning)]",
  success: "bg-[var(--success)]",
  info:    "bg-[var(--accent)]",
};

export function SignalCard({
  title,
  description,
  severity,
  actionHref,
  count,
}: SignalCardProps) {
  const body = (
    <div className={widgetRowSurface}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[severity]}`} aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text)]">{title}</p>
          {description ? (
            <p className="line-clamp-1 text-sm text-[var(--muted-text)]">{description}</p>
          ) : null}
        </div>
      </div>
      {typeof count === "number" ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--muted-text)]">{count}</span>
      ) : null}
    </div>
  );

  if (!actionHref) return body;
  return (
    <Link href={actionHref} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      {body}
    </Link>
  );
}
