jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
}));

jest.mock("@/lib/api/handler", () => ({
  getSessionContextOrNull: jest.fn(),
}));

jest.mock("@/modules/inventory/service/vehicle", () => ({
  getVehicle: jest.fn(),
  listVehiclePhotos: jest.fn(),
}));

import { getSessionContextOrNull } from "@/lib/api/handler";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import Page from "../page";

describe("Vehicle detail modal page (namespaced intercepting route)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not call inventory services when id is not a valid UUID", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      activeDealershipId: "dealer-1",
      permissions: ["inventory.read"],
    });

    await Page({ params: Promise.resolve({ id: "not-a-uuid" }) });

    expect(inventoryService.getVehicle).not.toHaveBeenCalled();
    expect(inventoryService.listVehiclePhotos).not.toHaveBeenCalled();
  });

  it("does not call inventory services when session lacks inventory.read", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      activeDealershipId: "dealer-1",
      permissions: ["customers.read"],
    });

    await Page({
      params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }),
    });

    expect(inventoryService.getVehicle).not.toHaveBeenCalled();
    expect(inventoryService.listVehiclePhotos).not.toHaveBeenCalled();
  });
});
