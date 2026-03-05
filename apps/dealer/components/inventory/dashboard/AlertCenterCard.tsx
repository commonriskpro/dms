"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Bell } from "@/lib/ui/icons";
import { ICON_SIZES } from "@/lib/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type AlertCenterItem = {
  key: string;
  title: string;
  recommendation?: string;
  count: number;
  severity: "low" | "medium" | "high";
  hrefQuery: Record<string, string>;
};

export type AlertCenterCardProps = {
  alerts: AlertCenterItem[];
};

function buildDashboardHref(pathname: string, hrefQuery: Record<string, string>): string {
  const params = new URLSearchParams(hrefQuery);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function AlertCenterCard({ alerts }: AlertCenterCardProps) {
  const pathname = usePathname();

  return (
    <DMSCard className="h-full transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]">
      <DMSCardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <DMSCardTitle className="text-sm font-medium text-[var(--text)]">
          Alert Center
        </DMSCardTitle>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)]"
          aria-hidden
        >
          <Bell size={ICON_SIZES.card} className="text-[var(--muted-text)]" />
        </span>
      </DMSCardHeader>
      <DMSCardContent className="pt-0">
        <ul className="space-y-1" role="list">
          {alerts.map((alert) => {
            const isNone = alert.key === "none";
            const variant =
              alert.severity === "high"
                ? "danger"
                : alert.severity === "medium"
                  ? "warning"
                  : "neutral";
            if (isNone) {
              return (
                <li key={alert.key}>
                  <div className="rounded-[var(--radius-input)] px-2 py-2 text-sm text-[var(--muted-text)]">
                    {alert.title}
                  </div>
                </li>
              );
            }
            const href = buildDashboardHref(pathname, alert.hrefQuery);
            return (
              <li key={alert.key}>
                <Link
                  href={href}
                  className="flex flex-col gap-0.5 rounded-[var(--radius-input)] px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{alert.title}</span>
                    {alert.count > 0 && (
                      <StatusBadge variant={variant}>
                        {alert.count}
                      </StatusBadge>
                    )}
                  </div>
                  {alert.recommendation && alert.count > 0 && (
                    <span className="text-xs text-[var(--muted-text)]">
                      {alert.recommendation}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </DMSCardContent>
    </DMSCard>
  );
}
