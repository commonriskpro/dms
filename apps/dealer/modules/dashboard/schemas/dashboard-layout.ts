/**
 * Zod schemas for dashboard layout personalization.
 * Used to validate saved payloads and API request bodies.
 */
import { z } from "zod";

export const ZONE_IDS = ["topRow", "main"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const zoneIdSchema = z.enum(ZONE_IDS);

/** Single widget placement in saved layout */
export const widgetPlacementSchema = z.object({
  widgetId: z.string().min(1).max(128),
  visible: z.boolean(),
  zone: zoneIdSchema,
  order: z.number().int().min(0),
});

export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;

const MAX_WIDGET_ENTRIES = 50;
const MAX_JSON_BYTES = 64 * 1024;

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

export type SaveLayoutBody = z.infer<typeof saveLayoutBodySchema>;

/** Parse and validate raw JSON from DB; returns null if invalid */
export function parseLayoutJson(raw: unknown): DashboardLayoutPayload | null {
  if (raw == null) return null;
  const parsed = dashboardLayoutPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Validate payload size (rough byte cap) */
export function isPayloadWithinSizeLimit(payload: DashboardLayoutPayload): boolean {
  try {
    const s = JSON.stringify(payload);
    return s.length <= MAX_JSON_BYTES;
  } catch {
    return false;
  }
}
