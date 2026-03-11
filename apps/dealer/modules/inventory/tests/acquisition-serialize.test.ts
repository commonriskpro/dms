import {
  serializeAcquisitionAppraisal,
  serializeAcquisitionLead,
} from "../serialize-acquisition";

describe("serializeAcquisitionAppraisal", () => {
  it("returns null when appraisal is null", () => {
    expect(serializeAcquisitionAppraisal(null)).toBeNull();
  });

  it("serializes bigint fields to strings", () => {
    const result = serializeAcquisitionAppraisal({
      id: "a1",
      vin: "1HGBH41JXMN109186",
      status: "COMPLETED",
      expectedRetailCents: 2299000n,
      expectedProfitCents: 180000n,
      vehicleId: "v1",
    });

    expect(result).toEqual({
      id: "a1",
      vin: "1HGBH41JXMN109186",
      status: "COMPLETED",
      expectedRetailCents: "2299000",
      expectedProfitCents: "180000",
      vehicleId: "v1",
    });
  });
});

describe("serializeAcquisitionLead", () => {
  it("returns null when lead is null", () => {
    expect(serializeAcquisitionLead(null)).toBeNull();
  });

  it("serializes lead with nested appraisal", () => {
    const now = new Date("2026-03-10T12:00:00.000Z");
    const result = serializeAcquisitionLead({
      id: "l1",
      vin: "1HGBH41JXMN109186",
      sourceType: "AUCTION",
      sellerName: "Seller Name",
      sellerPhone: "555-0100",
      sellerEmail: "seller@example.com",
      askingPriceCents: 1500000n,
      negotiatedPriceCents: 1450000n,
      status: "OPEN",
      appraisalId: "a1",
      appraisal: {
        id: "a1",
        vin: "1HGBH41JXMN109186",
        status: "COMPLETED",
        expectedRetailCents: 2299000n,
        expectedProfitCents: 180000n,
        vehicleId: "v1",
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(result).toEqual({
      id: "l1",
      vin: "1HGBH41JXMN109186",
      sourceType: "AUCTION",
      sellerName: "Seller Name",
      sellerPhone: "555-0100",
      sellerEmail: "seller@example.com",
      askingPriceCents: "1500000",
      negotiatedPriceCents: "1450000",
      status: "OPEN",
      appraisalId: "a1",
      appraisal: {
        id: "a1",
        vin: "1HGBH41JXMN109186",
        status: "COMPLETED",
        expectedRetailCents: "2299000",
        expectedProfitCents: "180000",
        vehicleId: "v1",
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
});
