/**
 * Dashboard layout zod schemas: validation, duplicate rejection, parseLayoutJson, size limit.
 */
import {
  dashboardLayoutPayloadSchema,
  dashboardLayoutPayloadWithDuplicatesSchema,
  saveLayoutBodySchema,
  parseLayoutJson,
  isPayloadWithinSizeLimit,
  widgetPlacementSchema,
  zoneIdSchema,
} from "../schemas/dashboard-layout";

describe("dashboard layout schemas", () => {
  const validPlacement = {
    widgetId: "metrics-inventory",
    visible: true,
    zone: "topRow",
    order: 0,
  };

  it("accepts valid widget placement", () => {
    expect(widgetPlacementSchema.safeParse(validPlacement).success).toBe(true);
  });

  it("rejects invalid zone", () => {
    expect(zoneIdSchema.safeParse("invalid").success).toBe(false);
    expect(zoneIdSchema.safeParse("main").success).toBe(true);
  });

  it("accepts valid full payload", () => {
    const payload = { version: 1, widgets: [validPlacement] };
    expect(dashboardLayoutPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects duplicate widget ids", () => {
    const payload = {
      version: 1,
      widgets: [
        { ...validPlacement, widgetId: "metrics-inventory" },
        { ...validPlacement, widgetId: "metrics-inventory", order: 1 },
      ],
    };
    expect(dashboardLayoutPayloadWithDuplicatesSchema.safeParse(payload).success).toBe(false);
    expect(saveLayoutBodySchema.safeParse(payload).success).toBe(false);
  });

  it("accepts payload with unique widget ids", () => {
    const payload = {
      version: 1,
      widgets: [
        { ...validPlacement, widgetId: "metrics-inventory" },
        { ...validPlacement, widgetId: "metrics-leads", order: 1 },
      ],
    };
    expect(saveLayoutBodySchema.safeParse(payload).success).toBe(true);
  });

  it("rejects version other than 1", () => {
    expect(dashboardLayoutPayloadSchema.safeParse({ version: 2, widgets: [] }).success).toBe(false);
  });

  it("rejects extra keys (strict)", () => {
    expect(
      dashboardLayoutPayloadSchema.safeParse({ version: 1, widgets: [], extra: true }).success
    ).toBe(false);
  });

  it("rejects too many widget entries", () => {
    const widgets = Array.from({ length: 51 }, (_, i) => ({
      ...validPlacement,
      widgetId: `widget-${i}`,
      order: i,
    }));
    expect(dashboardLayoutPayloadSchema.safeParse({ version: 1, widgets }).success).toBe(false);
  });
});

describe("parseLayoutJson", () => {
  it("returns null for null/undefined", () => {
    expect(parseLayoutJson(null)).toBeNull();
    expect(parseLayoutJson(undefined)).toBeNull();
  });

  it("returns parsed payload for valid JSON", () => {
    const raw = { version: 1, widgets: [{ widgetId: "a", visible: true, zone: "main", order: 0 }] };
    const result = parseLayoutJson(raw);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.widgets).toHaveLength(1);
  });

  it("returns null for invalid structure", () => {
    expect(parseLayoutJson({ version: 2, widgets: [] })).toBeNull();
    expect(parseLayoutJson({ widgets: [] })).toBeNull();
    expect(parseLayoutJson("string")).toBeNull();
  });
});

describe("isPayloadWithinSizeLimit", () => {
  it("returns true for small payload", () => {
    const payload = { version: 1 as const, widgets: [{ widgetId: "a", visible: true, zone: "main" as const, order: 0 }] };
    expect(isPayloadWithinSizeLimit(payload)).toBe(true);
  });
});
