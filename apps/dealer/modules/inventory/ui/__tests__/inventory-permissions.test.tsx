/**
 * Inventory UI permission gate tests: no fetch when !inventory.read;
 * no mutation UI/requests when inventory.read but !inventory.write.
 * Uses live components: VehicleDetailPage, AddVehiclePage, EditVehicleUi, InventoryPageContentV2, InventoryAgingPage.
 */
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { VehicleDetailPage } from "../VehicleDetailPage";
import { AddVehiclePage } from "@/app/(app)/inventory/new/AddVehiclePage";
import EditVehicleUi from "@/app/(app)/inventory/vehicle/[id]/edit/ui/EditVehicleUi";
import { InventoryPageContentV2 } from "../InventoryPageContentV2";
import { InventoryAgingPage } from "../AgingPage";
import type { InventoryPageOverview } from "@/modules/inventory/service/inventory-page";

let mockPermissions: string[] = [];
const mockFetch = jest.fn();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/inventory",
}));

function inventoryCalls(calls: unknown[]): unknown[] {
  return calls.filter((c) => {
    const url = typeof c === "object" && c !== null && Array.isArray(c) && typeof c[0] === "string" ? c[0] : "";
    return url.includes("/api/inventory");
  });
}

function mutationCalls(calls: unknown[]): unknown[] {
  return calls.filter((c) => {
    if (typeof c !== "object" || c === null || !Array.isArray(c)) return false;
    const url = typeof c[0] === "string" ? c[0] : "";
    if (!url.includes("/api/inventory")) return false;
    const init = c[1] as RequestInit | undefined;
    const method = (init?.method ?? "GET").toUpperCase();
    return method === "POST" || method === "PATCH" || method === "DELETE";
  });
}

const minimalOverview: InventoryPageOverview = {
  kpis: { totalUnits: 0, addedThisWeek: 0, inventoryValueCents: 0, avgValuePerVehicleCents: 0 },
  alerts: { missingPhotos: 0, over90Days: 0, needsRecon: 0 },
  health: { lt30: 0, d30to60: 0, d60to90: 0, gt90: 0 },
  pipeline: { leads: 0, appointments: 0, workingDeals: 0, pendingFunding: 0, soldToday: 0 },
  list: { items: [], page: 1, pageSize: 25, total: 0 },
  filterChips: { floorPlannedCount: 0, previouslySoldCount: 0 },
};

describe("Inventory UI: no fetch when !inventory.read", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockPermissions = [];
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("InventoryPageContentV2 makes no /api/inventory calls on mount when given initialData", async () => {
    render(
      <InventoryPageContentV2
        initialData={minimalOverview}
        currentQuery={{}}
        canWrite={false}
      />
    );
    await waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("VehicleDetailPage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(
      <VehicleDetailPage vehicleId="00000000-0000-0000-0000-000000000001" />
    );
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("AddVehiclePage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(<AddVehiclePage />);
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("EditVehicleUi makes no mutation when !inventory.write (read-only)", async () => {
    mockPermissions = ["inventory.read"];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as URL).href;
      if (url.includes("/api/inventory/") && url.match(/\/api\/inventory\/[^/]+$/)) {
        return new Response(
          JSON.stringify({
            data: {
              id: "00000000-0000-0000-0000-000000000001",
              stockNumber: "STK-1",
              status: "AVAILABLE",
              photos: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("", { status: 404 });
    });
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);

    render(<EditVehicleUi vehicleId="00000000-0000-0000-0000-000000000001" />);
    await waitFor(() => {}, { timeout: 2000 });
    expect(mutationCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("InventoryAgingPage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(<InventoryAgingPage />);
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });
});

describe("Inventory UI: read-only hides write controls and makes no mutations", () => {
  const listResponse = () =>
    new Response(
      JSON.stringify({ data: [], meta: { total: 0, limit: 25, offset: 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  const vehicleResponse = (id: string) =>
    new Response(
      JSON.stringify({
        data: {
          id,
          stockNumber: "STK-1",
          status: "AVAILABLE",
          photos: [],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  beforeEach(() => {
    mockFetch.mockReset();
    mockPermissions = ["inventory.read"];
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as URL).href;
      if (url.includes("/api/inventory/aging")) return listResponse();
      if (url.includes("/api/inventory/") && url.match(/\/api\/inventory\/[^/]+$/)) {
        return vehicleResponse("00000000-0000-0000-0000-000000000001");
      }
      if (url.includes("/api/inventory")) return listResponse();
      return new Response("", { status: 404 });
    });
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("InventoryPageContentV2 does not show Add vehicle when !inventory.write", async () => {
    render(
      <InventoryPageContentV2
        initialData={minimalOverview}
        currentQuery={{}}
        canWrite={false}
      />
    );
    await waitFor(() => {});
    expect(screen.queryByRole("link", { name: /add vehicle/i })).toBeNull();
  });

  it("VehicleDetailPage shows no Edit/Delete when !inventory.write", async () => {
    render(<VehicleDetailPage vehicleId="00000000-0000-0000-0000-000000000001" />);
    await waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/inventory"))).toBe(true);
    });
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(mutationCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("AddVehiclePage shows permission message when inventory.read but !inventory.write", async () => {
    const { container } = render(<AddVehiclePage />);
    expect(container.textContent).toMatch(/don.t have permission to add vehicles/i);
    await waitFor(() => {});
    expect(mutationCalls(mockFetch.mock.calls)).toHaveLength(0);
  });
});
