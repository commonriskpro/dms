import { severityBadgeClasses } from "@/lib/ui/tokens";

export type SignalSeverity = "info" | "success" | "warning" | "danger";

export function SignalSeverityBadge({ severity }: { severity: SignalSeverity }) {
  const normalized = severity === "success" ? "info" : severity;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityBadgeClasses[normalized]}`}
    >
      {normalized}
    </span>
  );
}
