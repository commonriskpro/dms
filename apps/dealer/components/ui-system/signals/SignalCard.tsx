import Link from "next/link";
import { widgetRowSurface } from "@/lib/ui/tokens";
import { SignalSeverityBadge, type SignalSeverity } from "./SignalSeverityBadge";

export type SignalCardProps = {
  title: string;
  description?: string | null;
  severity: SignalSeverity;
  actionHref?: string | null;
  count?: number | null;
};

export function SignalCard({
  title,
  description,
  severity,
  actionHref,
  count,
}: SignalCardProps) {
  const body = (
    <div className={`${widgetRowSurface} flex items-center justify-between gap-3`}>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-[var(--text)]">{title}</p>
        {description ? (
          <p className="line-clamp-1 text-xs text-[var(--muted-text)]">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {typeof count === "number" ? (
          <span className="text-xs font-semibold tabular-nums text-[var(--text)]">{count}</span>
        ) : null}
        <SignalSeverityBadge severity={severity} />
      </div>
    </div>
  );

  if (!actionHref) return body;
  return (
    <Link href={actionHref} className="block">
      {body}
    </Link>
  );
}
