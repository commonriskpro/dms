/** @jest-environment node */
/**
 * Marketplace feed: buildFeed returns vehicle list with id, vin, price, photos, description.
 * Inventory service is mocked.
 */
import * as marketplaceService from "../service/marketplace";
import * as inventoryService from "@/modules/inventory/service/vehicle";

jest.mock("@/modules/inventory/service/vehicle");

const mockGetFeedVehicles = inventoryService.getFeedVehicles as jest.MockedFunction<
  typeof inventoryService.getFeedVehicles
>;

const dealerId = "d1000000-0000-0000-0000-000000000001";

describe("Marketplace feed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns items with vehicle id, vin, price, photos, description for facebook format", async () => {
    mockGetFeedVehicles.mockResolvedValue([
      {
        id: "v1",
        vin: "1HGBH41JXMN109186",
        year: 2021,
        make: "Honda",
        model: "Accord",
        trim: "EX",
        stockNumber: "STK001",
        mileage: 15000,
        salePriceCents: BigInt(2500000),
        vehiclePhotos: [
          { fileObjectId: "f1", fileObject: { path: "vehicles/v1/photo1.jpg" } },
        ],
      },
    ] as never);

    const result = await marketplaceService.buildFeed(dealerId, "facebook", { limit: 50 });

    expect(mockGetFeedVehicles).toHaveBeenCalledWith(dealerId, 50);
    expect(result.format).toBe("facebook");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "v1",
      vin: "1HGBH41JXMN109186",
      year: 2021,
      make: "Honda",
      model: "Accord",
      description: "2021 Honda Accord EX",
      price: "25000.00",
      priceCents: "2500000",
      stockNumber: "STK001",
      mileage: 15000,
    });
    expect(result.items[0].photos).toHaveLength(1);
    expect(result.items[0].photos[0].fileObjectId).toBe("f1");
  });

  it("returns same shape for autotrader format", async () => {
    mockGetFeedVehicles.mockResolvedValue([]);

    const result = await marketplaceService.buildFeed(dealerId, "autotrader", { limit: 100 });

    expect(mockGetFeedVehicles).toHaveBeenCalledWith(dealerId, 100);
    expect(result.format).toBe("autotrader");
    expect(result.items).toEqual([]);
  });

  it("caps limit at 500", async () => {
    mockGetFeedVehicles.mockResolvedValue([]);

    await marketplaceService.buildFeed(dealerId, "facebook", { limit: 999 });

    expect(mockGetFeedVehicles).toHaveBeenCalledWith(dealerId, 500);
  });
});
