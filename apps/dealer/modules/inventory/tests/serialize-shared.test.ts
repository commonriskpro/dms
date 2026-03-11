import { serializeAppraisal } from "../serialize-appraisal";
import { serializeAuctionPurchase } from "../serialize-auction-purchase";

describe("serializeAppraisal", () => {
  it("returns null for null input", () => {
    expect(serializeAppraisal(null)).toBeNull();
  });

  it("serializes bigint and date fields", () => {
    const now = new Date("2026-03-10T12:00:00.000Z");
    const result = serializeAppraisal({
      id: "a1",
      vin: "1HGBH41JXMN109186",
      sourceType: "TRADE_IN",
      vehicleId: "v1",
      appraisedBy: "user-1",
      acquisitionCostCents: 1000n,
      reconEstimateCents: 200n,
      transportEstimateCents: 300n,
      feesEstimateCents: 400n,
      expectedRetailCents: 2000n,
      expectedWholesaleCents: 1500n,
      expectedTradeInCents: 1700n,
      expectedProfitCents: 500n,
      status: "DRAFT",
      notes: "n",
      createdAt: now,
      updatedAt: now,
      vehicle: { id: "v1" },
    });

    expect(result).toEqual({
      id: "a1",
      vin: "1HGBH41JXMN109186",
      sourceType: "TRADE_IN",
      vehicleId: "v1",
      appraisedBy: "user-1",
      acquisitionCostCents: "1000",
      reconEstimateCents: "200",
      transportEstimateCents: "300",
      feesEstimateCents: "400",
      expectedRetailCents: "2000",
      expectedWholesaleCents: "1500",
      expectedTradeInCents: "1700",
      expectedProfitCents: "500",
      status: "DRAFT",
      notes: "n",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      vehicle: { id: "v1" },
    });
  });
});

describe("serializeAuctionPurchase", () => {
  it("returns null for null input", () => {
    expect(serializeAuctionPurchase(null)).toBeNull();
  });

  it("serializes bigint and date fields", () => {
    const now = new Date("2026-03-10T12:00:00.000Z");
    const result = serializeAuctionPurchase({
      id: "p1",
      vehicleId: "v1",
      vehicle: { id: "v1" },
      auctionName: "Auction A",
      lotNumber: "LOT-1",
      purchasePriceCents: 1000000n,
      feesCents: 10000n,
      shippingCents: 5000n,
      etaDate: now,
      status: "PENDING",
      notes: "note",
      createdAt: now,
      updatedAt: now,
    });

    expect(result).toEqual({
      id: "p1",
      vehicleId: "v1",
      vehicle: { id: "v1" },
      auctionName: "Auction A",
      lotNumber: "LOT-1",
      purchasePriceCents: "1000000",
      feesCents: "10000",
      shippingCents: "5000",
      etaDate: now.toISOString(),
      status: "PENDING",
      notes: "note",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
});
