/**
 * Zod schemas for dashboard layout personalization.
 * Used to validate saved payloads and API request bodies.
 */
import { createHash } from "crypto";
import { z } from "zod";

export const ZONE_IDS = ["topRow", "main"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const zoneIdSchema = z.enum(ZONE_IDS);

/** Single widget placement in saved layout (strict for API body) */
export const widgetPlacementSchema = z.object({
  widgetId: z.string().min(1).max(128),
  visible: z.boolean(),
  zone: zoneIdSchema,
  order: z.number().int().min(0),
  widgetVersion: z.number().int().min(1).optional(),
});

export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;

/** Placement schema for parsing from DB (allows missing widgetVersion for legacy) */
const widgetPlacementParseSchema = widgetPlacementSchema.partial({ widgetVersion: true });

export const MAX_WIDGET_ENTRIES = 50;
/** Hardening: max serialized payload size 10KB to prevent unbounded growth */
export const MAX_JSON_BYTES = 10_240;

/** Full dashboard layout payload (saved or default) */
export const dashboardLayoutPayloadSchema = z
  .object({
    version: z.literal(1),
    widgets: z.array(widgetPlacementSchema).max(MAX_WIDGET_ENTRIES),
  })
  .strict();

export type DashboardLayoutPayload = z.infer<typeof dashboardLayoutPayloadSchema>;

/** Validate no duplicate widget ids in array */
function noDuplicateWidgetIds(widgets: WidgetPlacement[]): boolean {
  const ids = new Set<string>();
  for (const w of widgets) {
    if (ids.has(w.widgetId)) return false;
    ids.add(w.widgetId);
  }
  return true;
}

export const dashboardLayoutPayloadWithDuplicatesSchema = dashboardLayoutPayloadSchema.refine(
  (data) => noDuplicateWidgetIds(data.widgets),
  { message: "Duplicate widget ids are not allowed" }
);

/** Request body for save layout API */
export const saveLayoutBodySchema = dashboardLayoutPayloadWithDuplicatesSchema;

/** Schema for parsing stored JSON (legacy rows may lack widgetVersion) */
const dashboardLayoutPayloadParseSchema = z
  .object({
    version: z.literal(1),
    widgets: z.array(widgetPlacementParseSchema).max(MAX_WIDGET_ENTRIES),
  })
  .strict();

/** Parse and validate raw JSON from DB; returns null if invalid. Accepts legacy layouts without widgetVersion. */
export function parseLayoutJson(raw: unknown): DashboardLayoutPayload | null {
  if (raw == null) return null;
  const parsed = dashboardLayoutPayloadParseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;
  const widgets: WidgetPlacement[] = data.widgets.map((w) => ({
    widgetId: w.widgetId,
    visible: w.visible,
    zone: w.zone,
    order: w.order,
    ...(w.widgetVersion != null ? { widgetVersion: w.widgetVersion } : {}),
  }));
  return { version: 1, widgets };
}

/** Validate payload size (normalized then serialized; enforces 10KB cap). */
export function isPayloadWithinSizeLimit(payload: DashboardLayoutPayload): boolean {
  try {
    const normalized = normalizeDashboardLayout(payload);
    const s = serializeNormalizedDashboardLayout(normalized);
    return s.length <= MAX_JSON_BYTES;
  } catch {
    return false;
  }
}

/**
 * Normalize layout deterministically: group by zone, sort within zone by (order, widgetId), renumber order 0..n-1.
 * Same semantic layout produces identical output.
 */
export function normalizeDashboardLayout(payload: DashboardLayoutPayload): DashboardLayoutPayload {
  const byZone = { topRow: [] as WidgetPlacement[], main: [] as WidgetPlacement[] };
  for (const w of payload.widgets) {
    byZone[w.zone].push({ ...w });
  }
  const cmp = (a: WidgetPlacement, b: WidgetPlacement) =>
    a.order !== b.order ? a.order - b.order : a.widgetId.localeCompare(b.widgetId);
  byZone.topRow.sort(cmp);
  byZone.main.sort(cmp);
  const widgets: WidgetPlacement[] = [];
  byZone.topRow.forEach((w, i) => widgets.push({ ...w, order: i }));
  byZone.main.forEach((w, i) => widgets.push({ ...w, order: i }));
  return { version: 1, widgets };
}

/** Deterministic JSON string for normalized payload (stable key order). */
export function serializeNormalizedDashboardLayout(payload: DashboardLayoutPayload): string {
  return JSON.stringify(payload);
}

/** Compute SHA-256 hex checksum of normalized serialized payload. */
export function computeDashboardLayoutChecksum(payload: DashboardLayoutPayload): string {
  const normalized = normalizeDashboardLayout(payload);
  const str = serializeNormalizedDashboardLayout(normalized);
  return createHash("sha256").update(str, "utf8").digest("hex");
}
