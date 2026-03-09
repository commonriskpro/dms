/**
 * Merges registry defaults with saved layout preferences.
 * Returns deterministic effective layout for rendering.
 */
import type { DashboardLayoutPayload, WidgetPlacement } from "../schemas/dashboard-layout";
import { parseLayoutJson } from "../schemas/dashboard-layout";
import {
  WIDGET_REGISTRY,
  getWidgetById,
  filterByPermissions,
  getDefaultLayout,
  type EffectiveWidgetItem,
  type WidgetId,
} from "../config/widget-registry";

export type MergeInput = {
  permissions: string[];
  savedLayoutRaw: unknown;
};

/** Normalize order to 0..n-1 within each zone */
function normalizeOrder(items: EffectiveWidgetItem[]): EffectiveWidgetItem[] {
  const byZone = new Map<string, EffectiveWidgetItem[]>();
  for (const item of items) {
    const list = byZone.get(item.zone) ?? [];
    list.push(item);
    byZone.set(item.zone, list);
  }
  const result: EffectiveWidgetItem[] = [];
  for (const zone of ["topRow", "main"] as const) {
    const list = byZone.get(zone) ?? [];
    list.sort((a, b) => a.order - b.order);
    list.forEach((item, i) => {
      result.push({ ...item, order: i });
    });
  }
  return result;
}

/**
 * Merge default layout (from registry, filtered by RBAC) with saved preference.
 * - Unknown/removed widget ids in saved payload are ignored.
 * - Forbidden widgets (no permission) are never included.
 * - Fixed widgets keep default visibility/zone/order.
 * - Missing widgets get default visibility and order.
 * - Duplicate widget ids in saved are deduplicated (keep first).
 */
export function mergeDashboardLayout(input: MergeInput): EffectiveWidgetItem[] {
  const { permissions, savedLayoutRaw } = input;
  const allowedDefinitions = filterByPermissions(WIDGET_REGISTRY, permissions);
  const allowedIds = new Set(allowedDefinitions.map((w) => w.id));

  const defaultItems = getDefaultLayout(permissions);
  const defaultByWidgetId = new Map<string, EffectiveWidgetItem>();
  for (const item of defaultItems) {
    defaultByWidgetId.set(item.widgetId, item);
  }

  const saved = parseLayoutJson(savedLayoutRaw);
  const seenIds = new Set<string>();

  const mergedByWidgetId = new Map<string, EffectiveWidgetItem>();

  if (saved?.widgets) {
    for (const p of saved.widgets) {
      if (seenIds.has(p.widgetId)) continue;
      seenIds.add(p.widgetId);
      if (!allowedIds.has(p.widgetId as WidgetId)) continue;
      const def = getWidgetById(p.widgetId);
      if (!def) continue;
      if (def.fixed) {
        const d = defaultByWidgetId.get(p.widgetId);
        if (d) mergedByWidgetId.set(p.widgetId, d);
        continue;
      }
      const zone = def.allowedZones.includes(p.zone) ? p.zone : def.defaultZone;
      mergedByWidgetId.set(p.widgetId, {
        widgetId: p.widgetId as WidgetId,
        zone,
        order: p.order,
        visible: p.visible,
        title: def.title,
        definition: def,
      });
    }
  }

  for (const def of allowedDefinitions) {
    if (!mergedByWidgetId.has(def.id)) {
      mergedByWidgetId.set(def.id, {
        widgetId: def.id,
        zone: def.defaultZone,
        order: def.defaultOrder,
        visible: def.defaultVisible,
        title: def.title,
        definition: def,
      });
    }
  }

  const list = Array.from(mergedByWidgetId.values());
  return normalizeOrder(list);
}

/** Effective layout filtered to visible widgets only, sorted by zone then order */
export function getVisibleLayout(effective: EffectiveWidgetItem[]): EffectiveWidgetItem[] {
  return effective.filter((w) => w.visible).sort((a, b) => {
    const zoneOrder = a.zone === "topRow" ? 0 : 1;
    const zoneOrderB = b.zone === "topRow" ? 0 : 1;
    if (zoneOrder !== zoneOrderB) return zoneOrder - zoneOrderB;
    return a.order - b.order;
  });
}

export type EffectiveLayoutInput = {
  permissions: string[];
  savedLayoutRaw: unknown;
};

/** One-shot: merge and return visible layout. Used by dashboard page and API. */
export function getEffectiveVisibleLayout(input: EffectiveLayoutInput): EffectiveWidgetItem[] {
  const effective = mergeDashboardLayout(input);
  return getVisibleLayout(effective);
}

/** Serializable layout item for client (no definition object). */
export type SerializableLayoutItem = {
  widgetId: string;
  zone: "topRow" | "main";
  order: number;
  visible: boolean;
  title: string;
  description?: string;
  hideable?: boolean;
  fixed?: boolean;
};

/** Convert effective layout to serializable array for client. */
export function toSerializableLayout(effective: EffectiveWidgetItem[]): SerializableLayoutItem[] {
  return effective.map((w) => ({
    widgetId: w.widgetId,
    zone: w.zone,
    order: w.order,
    visible: w.visible,
    title: w.title,
    description: w.definition.description,
    hideable: w.definition.hideable,
    fixed: w.definition.fixed,
  }));
}
