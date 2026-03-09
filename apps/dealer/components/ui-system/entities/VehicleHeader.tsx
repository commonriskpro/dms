import * as React from "react";
import { EntityHeader, type EntityMetaItem } from "./EntityHeader";
import { StatusBadge } from "@/components/ui-system/tables";

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  AVAILABLE: "success",
  HOLD: "warning",
  SOLD: "neutral",
  WHOLESALE: "info",
  REPAIR: "warning",
  ARCHIVED: "danger",
};

export function VehicleHeader({
  title,
  status,
  subtitle,
  actions,
  breadcrumbs,
  meta = [],
}: {
  title: string;
  status?: string | null;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  meta?: EntityMetaItem[];
}) {
  return (
    <EntityHeader
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      actions={actions}
      meta={meta}
      status={
        status ? (
          <StatusBadge variant={STATUS_VARIANT[status] ?? "neutral"}>{status}</StatusBadge>
        ) : undefined
      }
    />
  );
}
