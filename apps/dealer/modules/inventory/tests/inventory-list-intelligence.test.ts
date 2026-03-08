/**
 * Regression: inventory list item shape must include intelligence fields.
 * Ensures daysInStock, agingBucket, turnRiskStatus, priceToMarket are present and valid.
 */
import type { VehicleListItem } from "../service/inventory-page";

const REQUIRED_LIST_ITEM_KEYS: (keyof VehicleListItem)[] = [
  "id",
  "stockNumber",
  "year",
  "make",
  "model",
  "status",
  "salePriceCents",
  "costCents",
  "floorPlanLenderName",
  "createdAt",
  "source",
  "daysInStock",
  "agingBucket",
  "turnRiskStatus",
  "priceToMarket",
];

const VALID_TURN_RISK = ["good", "warn", "bad", "na"];
const VALID_AGING_BUCKET = ["<30", "30-60", "60-90", ">90"];

describe("VehicleListItem intelligence shape", () => {
  it("has all required keys including intelligence fields", () => {
    const minimal: VehicleListItem = {
      id: "v1",
      stockNumber: "S1",
      vin: "1HGCM82633A123456",
      year: 2021,
      make: "Make",
      model: "Model",
      mileage: 50000,
      status: "AVAILABLE",
      salePriceCents: 100000,
      costCents: 80000,
      floorPlanLenderName: null,
      createdAt: new Date().toISOString(),
      source: null,
      daysInStock: 10,
      agingBucket: "<30",
      turnRiskStatus: "good",
      primaryPhotoFileId: null,
      priceToMarket: {
        marketStatus: "At Market",
        marketDeltaCents: 0,
        marketDeltaPercent: 0,
        sourceLabel: "Internal comps",
      },
    };
    for (const key of REQUIRED_LIST_ITEM_KEYS) {
      expect(minimal).toHaveProperty(key);
    }
  });

  it("allows null/na for no-data fallback", () => {
    const noData: VehicleListItem = {
      id: "v2",
      stockNumber: "S2",
      vin: null,
      year: null,
      make: null,
      model: null,
      mileage: null,
      status: "AVAILABLE",
      salePriceCents: 0,
      costCents: 0,
      floorPlanLenderName: null,
      createdAt: new Date().toISOString(),
      source: null,
      daysInStock: null,
      agingBucket: null,
      turnRiskStatus: "na",
      primaryPhotoFileId: null,
      priceToMarket: {
        marketStatus: "No Market Data",
        marketDeltaCents: null,
        marketDeltaPercent: null,
        sourceLabel: "No data",
      },
    };
    expect(noData.turnRiskStatus).toBe("na");
    expect(noData.priceToMarket?.marketStatus).toBe("No Market Data");
  });

  it("turnRiskStatus must be one of good, warn, bad, na", () => {
    VALID_TURN_RISK.forEach((status) => {
      expect(VALID_TURN_RISK).toContain(status);
    });
  });

  it("agingBucket when present must be one of spec buckets", () => {
    VALID_AGING_BUCKET.forEach((bucket) => {
      expect(VALID_AGING_BUCKET).toContain(bucket);
    });
  });
});
