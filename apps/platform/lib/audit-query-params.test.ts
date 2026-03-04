import { buildAuditQueryParams, buildAuditQueryString } from "./audit-query-params";

describe("buildAuditQueryParams", () => {
  it("includes limit and offset with defaults when omitted", () => {
    const out = buildAuditQueryParams({});
    expect(out.limit).toBe("20");
    expect(out.offset).toBe("0");
    expect(Object.keys(out)).toEqual(["limit", "offset"]);
  });

  it("uses provided limit and offset", () => {
    const out = buildAuditQueryParams({ limit: 10, offset: 40 });
    expect(out.limit).toBe("10");
    expect(out.offset).toBe("40");
  });

  it("includes non-empty filter fields", () => {
    const out = buildAuditQueryParams({
      action: "dealership.provision",
      targetType: "dealership",
      targetId: "550e8400-e29b-41d4-a716-446655440000",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      actor: "660e8400-e29b-41d4-a716-446655440001",
      limit: 20,
      offset: 0,
    });
    expect(out.action).toBe("dealership.provision");
    expect(out.targetType).toBe("dealership");
    expect(out.targetId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(out.dateFrom).toBe("2025-01-01");
    expect(out.dateTo).toBe("2025-01-31");
    expect(out.actor).toBe("660e8400-e29b-41d4-a716-446655440001");
  });

  it("omits empty or whitespace-only filter values", () => {
    const out = buildAuditQueryParams({
      action: "  ",
      targetType: "",
      targetId: "",
      limit: 20,
      offset: 0,
    });
    expect(out.action).toBeUndefined();
    expect(out.targetType).toBeUndefined();
    expect(out.targetId).toBeUndefined();
    expect(out.limit).toBe("20");
    expect(out.offset).toBe("0");
  });

  it("trims string values", () => {
    const out = buildAuditQueryParams({
      action: "  provision  ",
      limit: 20,
      offset: 0,
    });
    expect(out.action).toBe("provision");
  });
});

describe("buildAuditQueryString", () => {
  it("returns encoded query string", () => {
    const qs = buildAuditQueryString({
      action: "test",
      limit: 10,
      offset: 0,
    });
    expect(qs).toBe("action=test&limit=10&offset=0");
  });
});
