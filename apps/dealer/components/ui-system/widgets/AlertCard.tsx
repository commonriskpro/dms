import * as React from "react";
import { StatusBadge } from "@/components/ui-system/tables/StatusBadge";
import { Widget } from "./Widget";

export type AlertCardProps = {
  title: string;
  body: React.ReactNode;
  /**
   * Canonical severity is "danger" to align with shared theme/token naming.
   * "error" remains as a backwards-compatible alias.
   */
  severity: "success" | "warning" | "danger" | "error" | "info" | "neutral";
  action?: React.ReactNode;
  metadata?: React.ReactNode;
};

export function AlertCard({ title, body, severity, action, metadata }: AlertCardProps) {
  const variant = severity === "error" ? "danger" : severity;
  const severityLabel = severity === "error" ? "danger" : severity;

  return (
    <Widget
      title={
        <div className="flex items-center gap-2">
          <span>{title}</span>
          <StatusBadge variant={variant}>{severityLabel}</StatusBadge>
        </div>
      }
      action={action}
    >
      <div className="space-y-2 text-sm">
        <p className="text-[var(--text)]">{body}</p>
        {metadata ? <div className="text-[var(--muted-text)]">{metadata}</div> : null}
      </div>
    </Widget>
  );
}
