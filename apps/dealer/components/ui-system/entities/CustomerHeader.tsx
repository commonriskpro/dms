import * as React from "react";
import { EntityHeader, type EntityMetaItem } from "./EntityHeader";
import { StatusBadge } from "@/components/ui-system/tables";

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  LEAD: "neutral",
  QUALIFIED: "info",
  NEGOTIATING: "warning",
  SOLD: "success",
  INACTIVE: "danger",
  ACTIVE: "info",
};

export function CustomerHeader({
  name,
  status,
  subtitle,
  actions,
  breadcrumbs,
  meta = [],
}: {
  name: string;
  status?: string | null;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  meta?: EntityMetaItem[];
}) {
  return (
    <EntityHeader
      title={name}
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
