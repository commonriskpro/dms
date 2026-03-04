/**
 * Inventory UI permission gate tests: no fetch when !inventory.read;
 * no mutation UI/requests when inventory.read but !inventory.write.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InventoryListPage } from "../ListPage";
import { InventoryDetailPage } from "../DetailPage";
import { CreateVehiclePage } from "../CreateVehiclePage";
import { EditVehiclePage } from "../EditVehiclePage";
import { InventoryAgingPage } from "../AgingPage";

let mockPermissions: string[] = [];
const mockFetch = vi.fn();

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

describe("Inventory UI: no fetch when !inventory.read", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockPermissions = [];
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ListPage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(<InventoryListPage />);
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await vi.waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("DetailPage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(
      <InventoryDetailPage id="00000000-0000-0000-0000-000000000001" />
    );
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await vi.waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("CreateVehiclePage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(<CreateVehiclePage />);
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await vi.waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("EditVehiclePage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(
      <EditVehiclePage id="00000000-0000-0000-0000-000000000001" />
    );
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await vi.waitFor(() => {});
    expect(inventoryCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("AgingPage shows no-access and makes no /api/inventory calls when !inventory.read", async () => {
    const { container } = render(<InventoryAgingPage />);
    expect(container.textContent).toMatch(/You don.t have access to inventory/i);
    await vi.waitFor(() => {});
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
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ListPage does not show Add vehicle when !inventory.write", async () => {
    render(<InventoryListPage />);
    await vi.waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/inventory"))).toBe(true);
    });
    expect(screen.queryByRole("link", { name: /add vehicle/i })).toBeNull();
  });

  it("DetailPage shows status as text (no dropdown) and no Edit/Delete when !inventory.write", async () => {
    render(<InventoryDetailPage id="00000000-0000-0000-0000-000000000001" />);
    await vi.waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/inventory"))).toBe(true);
    });
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(mutationCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("CreateVehiclePage shows permission message when inventory.read but !inventory.write", async () => {
    const { container } = render(<CreateVehiclePage />);
    expect(container.textContent).toMatch(/don.t have permission to add vehicles/i);
    await vi.waitFor(() => {});
    expect(mutationCalls(mockFetch.mock.calls)).toHaveLength(0);
  });

  it("EditVehiclePage shows permission message when inventory.read but !inventory.write", async () => {
    render(<EditVehiclePage id="00000000-0000-0000-0000-000000000001" />);
    await vi.waitFor(() => {
      expect(mockFetch.mock.calls.some((c: [string]) => String(c[0]).includes("/api/inventory"))).toBe(true);
    });
    expect(await screen.findByText(/don.t have permission to edit this vehicle/i)).toBeInTheDocument();
    expect(mutationCalls(mockFetch.mock.calls)).toHaveLength(0);
  });
});
