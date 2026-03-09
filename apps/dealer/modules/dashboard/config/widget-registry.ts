/**
 * Central server-safe registry for dashboard widgets.
 * Used for default layout, RBAC filtering, and merge logic.
 */
import type { ZoneId } from "../schemas/dashboard-layout";

export type WidgetId =
  | "metrics-inventory"
  | "metrics-leads"
  | "metrics-deals"
  | "metrics-bhph"
  | "customer-tasks"
  | "floorplan-lending"
  | "finance-notices"
  | "inventory-alerts"
  | "deal-pipeline"
  | "recommended-actions"
  | "upcoming-appointments"
  | "quick-actions";

export interface WidgetDefinition {
  id: WidgetId;
  version: number;
  title: string;
  description: string;
  allowedZones: ZoneId[];
  defaultZone: ZoneId;
  defaultOrder: number;
  defaultVisible: boolean;
  requiredPermissions: string[];
  fixed?: boolean;
  hideable?: boolean;
  featureFlag?: string;
}

const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: "metrics-inventory",
    version: 1,
    title: "Inventory",
    description: "Inventory count and deltas",
    allowedZones: ["topRow"],
    defaultZone: "topRow",
    defaultOrder: 1,
    defaultVisible: true,
    requiredPermissions: ["inventory.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "metrics-leads",
    version: 1,
    title: "Leads",
    description: "Leads count and deltas",
    allowedZones: ["topRow"],
    defaultZone: "topRow",
    defaultOrder: 2,
    defaultVisible: true,
    requiredPermissions: ["crm.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "metrics-deals",
    version: 1,
    title: "Deals",
    description: "Deals count and deltas",
    allowedZones: ["topRow"],
    defaultZone: "topRow",
    defaultOrder: 3,
    defaultVisible: true,
    requiredPermissions: ["deals.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "metrics-bhph",
    version: 1,
    title: "BHPH",
    description: "BHPH count and deltas",
    allowedZones: ["topRow"],
    defaultZone: "topRow",
    defaultOrder: 4,
    defaultVisible: true,
    requiredPermissions: ["lenders.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "customer-tasks",
    version: 1,
    title: "Customer Tasks",
    description: "Appointments, prospects, follow-ups, credit apps",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 1,
    defaultVisible: true,
    requiredPermissions: ["customers.read", "crm.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "floorplan-lending",
    version: 1,
    title: "Floorplan Lending",
    description: "Floorplan utilization and limits",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 2,
    defaultVisible: true,
    requiredPermissions: ["lenders.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "finance-notices",
    version: 1,
    title: "Finance Notices",
    description: "Stipulations and finance alerts",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 3,
    defaultVisible: true,
    requiredPermissions: ["lenders.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "inventory-alerts",
    version: 1,
    title: "Inventory Alerts",
    description: "Cars in recon, pending tasks, low stock",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 4,
    defaultVisible: true,
    requiredPermissions: ["inventory.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "deal-pipeline",
    version: 1,
    title: "Deal Pipeline",
    description: "Pending deals, submitted, contracts to review",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 5,
    defaultVisible: true,
    requiredPermissions: ["deals.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "recommended-actions",
    version: 1,
    title: "Recommended Actions",
    description: "Next best actions from CRM",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 6,
    defaultVisible: true,
    requiredPermissions: ["crm.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "upcoming-appointments",
    version: 1,
    title: "Upcoming Appointments",
    description: "Upcoming appointments",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 7,
    defaultVisible: true,
    requiredPermissions: ["crm.read"],
    fixed: false,
    hideable: true,
  },
  {
    id: "quick-actions",
    version: 1,
    title: "Quick Actions",
    description: "Add vehicle, add lead, start deal",
    allowedZones: ["main"],
    defaultZone: "main",
    defaultOrder: 8,
    defaultVisible: true,
    requiredPermissions: ["inventory.read", "customers.read", "deals.read"],
    fixed: false,
    hideable: true,
  },
];

const BY_ID = new Map<WidgetId, WidgetDefinition>(WIDGET_DEFINITIONS.map((w) => [w.id, w]));

export const WIDGET_REGISTRY = WIDGET_DEFINITIONS;

/** Get widget definition by id; returns undefined if unknown/removed */
export function getWidgetById(id: string): WidgetDefinition | undefined {
  return BY_ID.get(id as WidgetId);
}

/** Check if user has at least one of the widget's required permissions */
export function widgetAllowedByPermissions(widget: WidgetDefinition, permissions: string[]): boolean {
  const permSet = new Set(permissions);
  return widget.requiredPermissions.some((p) => permSet.has(p));
}

/** Filter registry to widgets allowed by permissions (and optional feature flags) */
export function filterByPermissions(
  widgets: WidgetDefinition[],
  permissions: string[],
  _featureFlags?: Set<string>
): WidgetDefinition[] {
  return widgets.filter((w) => {
    if (!widgetAllowedByPermissions(w, permissions)) return false;
    if (w.featureFlag && _featureFlags && !_featureFlags.has(w.featureFlag)) return false;
    return true;
  });
}

export type EffectiveWidgetItem = {
  widgetId: WidgetId;
  zone: ZoneId;
  order: number;
  visible: boolean;
  title: string;
  definition: WidgetDefinition;
};

/** Build default layout (all allowed widgets, default zone/order/visible) */
export function getDefaultLayout(permissions: string[]): EffectiveWidgetItem[] {
  const allowed = filterByPermissions(WIDGET_REGISTRY, permissions);
  const topRow = allowed
    .filter((w) => w.defaultZone === "topRow")
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
  const main = allowed
    .filter((w) => w.defaultZone === "main")
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
  const result: EffectiveWidgetItem[] = [];
  topRow.forEach((w) => {
    result.push({
      widgetId: w.id,
      zone: "topRow",
      order: w.defaultOrder,
      visible: w.defaultVisible,
      title: w.title,
      definition: w,
    });
  });
  main.forEach((w) => {
    result.push({
      widgetId: w.id,
      zone: "main",
      order: w.defaultOrder,
      visible: w.defaultVisible,
      title: w.title,
      definition: w,
    });
  });
  return result;
}
