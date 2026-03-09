/**
 * mergeDashboardLayout: default layout, RBAC filtering, merge with saved, unknown/removed widgets, fixed widgets, ordering.
 */
import { mergeDashboardLayout, getVisibleLayout } from "../service/merge-dashboard-layout";

describe("mergeDashboardLayout", () => {
  const allPermissions = [
    "inventory.read",
    "crm.read",
    "customers.read",
    "deals.read",
    "lenders.read",
  ];

  it("returns default layout when no saved layout", () => {
    const result = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: null,
    });
    expect(result.length).toBeGreaterThan(0);
    const topRow = result.filter((w) => w.zone === "topRow");
    const main = result.filter((w) => w.zone === "main");
    expect(topRow.length).toBe(4);
    expect(main.length).toBeGreaterThan(0);
    const ordersTop = topRow.map((w) => w.order);
    expect(ordersTop).toEqual([0, 1, 2, 3]);
  });

  it("filters by RBAC: fewer widgets when fewer permissions", () => {
    const result = mergeDashboardLayout({
      permissions: ["inventory.read"],
      savedLayoutRaw: null,
    });
    const ids = result.map((w) => w.widgetId);
    expect(ids).toContain("metrics-inventory");
    expect(ids).not.toContain("metrics-leads");
    expect(ids).not.toContain("metrics-deals");
    expect(ids).not.toContain("metrics-bhph");
  });

  it("merges valid saved layout: visibility and order respected", () => {
    const saved = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
        { widgetId: "metrics-leads", visible: false, zone: "topRow" as const, order: 1 },
        { widgetId: "metrics-deals", visible: true, zone: "topRow" as const, order: 2 },
        { widgetId: "metrics-bhph", visible: true, zone: "topRow" as const, order: 3 },
        { widgetId: "customer-tasks", visible: true, zone: "main" as const, order: 0 },
      ],
    };
    const result = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: saved,
    });
    const leads = result.find((w) => w.widgetId === "metrics-leads");
    expect(leads).toBeDefined();
    expect(leads!.visible).toBe(false);
    const visible = getVisibleLayout(result);
    expect(visible.find((w) => w.widgetId === "metrics-leads")).toBeUndefined();
  });

  it("strips unknown/removed widget ids from saved layout", () => {
    const saved = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
        { widgetId: "removed-widget-id", visible: true, zone: "main" as const, order: 0 },
        { widgetId: "customer-tasks", visible: true, zone: "main" as const, order: 1 },
      ],
    };
    const result = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: saved,
    });
    expect(result.some((w) => w.widgetId === "removed-widget-id")).toBe(false);
    expect(result.some((w) => w.widgetId === "metrics-inventory")).toBe(true);
    expect(result.some((w) => w.widgetId === "customer-tasks")).toBe(true);
  });

  it("strips forbidden widget ids (no permission)", () => {
    const saved = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
        { widgetId: "metrics-leads", visible: true, zone: "topRow" as const, order: 1 },
      ],
    };
    const result = mergeDashboardLayout({
      permissions: ["inventory.read"],
      savedLayoutRaw: saved,
    });
    expect(result.some((w) => w.widgetId === "metrics-leads")).toBe(false);
    expect(result.some((w) => w.widgetId === "metrics-inventory")).toBe(true);
  });

  it("adds missing widgets with default visibility and order", () => {
    const saved = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
      ],
    };
    const result = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: saved,
    });
    expect(result.length).toBeGreaterThan(1);
    const mainWidgets = result.filter((w) => w.zone === "main");
    expect(mainWidgets.length).toBeGreaterThan(0);
  });

  it("normalizes order within each zone to 0..n-1", () => {
    const saved = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-bhph", visible: true, zone: "topRow" as const, order: 99 },
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
        { widgetId: "metrics-leads", visible: true, zone: "topRow" as const, order: 1 },
        { widgetId: "metrics-deals", visible: true, zone: "topRow" as const, order: 2 },
      ],
    };
    const result = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: saved,
    });
    const topRow = result.filter((w) => w.zone === "topRow").sort((a, b) => a.order - b.order);
    const orders = topRow.map((w) => w.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("treats invalid saved payload as no saved layout", () => {
    const result = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: { invalid: true },
    });
    expect(result.length).toBeGreaterThan(0);
    const result2 = mergeDashboardLayout({
      permissions: allPermissions,
      savedLayoutRaw: [],
    });
    expect(result2.length).toBe(result.length);
  });
});

describe("getVisibleLayout", () => {
  it("filters to visible only and sorts by zone then order", () => {
    const effective = mergeDashboardLayout({
      permissions: ["inventory.read", "crm.read", "customers.read"],
      savedLayoutRaw: {
        version: 1,
        widgets: [
          { widgetId: "metrics-inventory", visible: true, zone: "topRow", order: 0 },
          { widgetId: "metrics-leads", visible: false, zone: "topRow", order: 1 },
          { widgetId: "customer-tasks", visible: true, zone: "main", order: 0 },
        ],
      },
    });
    const visible = getVisibleLayout(effective);
    expect(visible.find((w) => w.widgetId === "metrics-leads")).toBeUndefined();
    expect(visible.some((w) => w.widgetId === "metrics-inventory")).toBe(true);
    expect(visible.some((w) => w.widgetId === "customer-tasks")).toBe(true);
    const topRowVisible = visible.filter((w) => w.zone === "topRow");
    const mainVisible = visible.filter((w) => w.zone === "main");
    expect(topRowVisible.length).toBeLessThanOrEqual(effective.filter((w) => w.zone === "topRow").length);
    expect(mainVisible[0]?.order).toBeLessThanOrEqual(mainVisible[1]?.order ?? 0);
  });
});
