"use client";

import * as React from "react";
import Link from "next/link";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";
import type { CustomerCallbackItem } from "@/lib/types/customers";

const stripClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]";
const primaryCtaClass =
  "inline-flex items-center font-medium text-sm text-[var(--accent)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

export type NextActionZoneProps = {
  contextSignals: SignalSurfaceItem[];
  callbacks: CustomerCallbackItem[];
  customerId: string;
  canReadCrm: boolean;
};

/**
 * Compact next-action zone: one primary CTA (signal with action, or earliest callback, or Open conversation).
 * Optionally one risk line from first warning/danger signal.
 */
export function NextActionZone({
  contextSignals,
  callbacks,
  customerId,
  canReadCrm,
}: NextActionZoneProps) {
  const primary = React.useMemo(() => {
    const withAction = contextSignals.find((s) => s.actionLabel && s.actionHref);
    if (withAction)
      return {
        label: withAction.title,
        href: withAction.actionHref!,
        external: (withAction.actionHref ?? "").startsWith("http"),
      };
    const scheduled = callbacks
      .filter((c) => c.status === "SCHEDULED")
      .sort((a, b) => new Date(a.callbackAt).getTime() - new Date(b.callbackAt).getTime())[0];
    if (scheduled) {
      const d = new Date(scheduled.callbackAt);
      const today = new Date();
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      return {
        label: isToday ? "Callback due today" : `Callback due ${d.toLocaleDateString()}`,
        href: canReadCrm ? `/crm/inbox?customerId=${encodeURIComponent(customerId)}` : "#",
        external: false,
      };
    }
    if (canReadCrm)
      return { label: "Open conversation", href: `/crm/inbox?customerId=${encodeURIComponent(customerId)}`, external: false };
    return null;
  }, [contextSignals, callbacks, customerId, canReadCrm]);

  const riskLine = React.useMemo(() => {
    const wd = contextSignals.find((s) => s.severity === "warning" || s.severity === "danger");
    if (!wd || (primary && wd.title === primary.label)) return null;
    return wd;
  }, [contextSignals, primary]);

  if (!primary && !riskLine) return null;

  return (
    <div className={stripClass} role="region" aria-label="Next action">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {primary ? (
          <span className="text-sm text-[var(--text-soft)]">
            Next:{" "}
            {primary.external ? (
              <a
                href={primary.href}
                target="_blank"
                rel="noopener noreferrer"
                className={primaryCtaClass}
              >
                {primary.label}
              </a>
            ) : (
              <Link href={primary.href} className={primaryCtaClass}>
                {primary.label}
              </Link>
            )}
          </span>
        ) : null}
        {riskLine ? (
          <span className="text-sm text-[var(--warning-text)]">
            Risk: {riskLine.actionHref ? (
              <Link href={riskLine.actionHref} className={primaryCtaClass}>
                {riskLine.title}
              </Link>
            ) : (
              riskLine.title
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}
