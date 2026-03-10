import Link from "next/link";
import { widgetRowSurface } from "@/lib/ui/tokens";

type SignalExplanationShape = {
  problem: string;
  whyItMatters: string;
  nextAction: { label: string; href: string } | null;
};

type SignalExplanationItemProps = {
  explanation: SignalExplanationShape;
  timestamp?: string;
  kind?: "created" | "resolved";
};

export function SignalExplanationItem({
  explanation,
  timestamp,
  kind,
}: SignalExplanationItemProps) {
  return (
    <div className={`${widgetRowSurface} flex flex-col gap-2`}>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-[var(--text)]">{explanation.problem}</p>
        <p className="text-xs text-[var(--muted-text)]">{explanation.whyItMatters}</p>
      </div>
      {explanation.nextAction ? (
        <div>
          <Link
            href={explanation.nextAction.href}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {explanation.nextAction.label}
          </Link>
        </div>
      ) : null}
      {timestamp || kind ? (
        <p className="text-[11px] text-[var(--muted-text)]">
          {[timestamp, kind === "created" ? "Created" : kind === "resolved" ? "Resolved" : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
