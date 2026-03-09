export type SignalUiSeverity = "info" | "warning" | "danger";

export type SignalSurfaceItem = {
  id: string;
  key: string;
  code: string;
  domain: "inventory" | "crm" | "deals" | "operations" | "acquisition";
  title: string;
  description?: string | null;
  severity: SignalUiSeverity;
  actionLabel?: string | null;
  actionHref?: string | null;
  count?: number | null;
  happenedAt?: string;
  createdAt?: string;
  resolvedAt?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};
