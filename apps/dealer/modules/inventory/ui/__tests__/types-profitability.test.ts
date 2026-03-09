/**
 * Inventory profitability type helpers: getTotalInvestedCents, getProjectedGrossCents.
 * Ledger-derived display values for list/detail.
 */
import { getTotalInvestedCents, getProjectedGrossCents } from "../types";

describe("getTotalInvestedCents", () => {
  it("returns totalInvestedCents when present", () => {
    expect(getTotalInvestedCents({ totalInvestedCents: "1000000" })).toBe("1000000");
    expect(getTotalInvestedCents({ totalInvestedCents: "0" })).toBe("0");
  });

  it("returns empty when totalInvestedCents missing and no breakdown", () => {
    expect(getTotalInvestedCents({})).toBe("");
  });

  it("sums breakdown when totalInvestedCents not provided", () => {
    expect(
      getTotalInvestedCents({
        auctionCostCents: "1000000",
        transportCostCents: "100000",
        reconCostCents: "50000",
        miscCostCents: "50000",
      })
    ).toBe("1200000");
  });

  it("prefers totalInvestedCents over breakdown", () => {
    expect(
      getTotalInvestedCents({
        totalInvestedCents: "999",
        auctionCostCents: "1000000",
        transportCostCents: "0",
        reconCostCents: "0",
        miscCostCents: "0",
      })
    ).toBe("999");
  });
});

describe("getProjectedGrossCents", () => {
  it("returns projectedGrossCents when present", () => {
    expect(getProjectedGrossCents({ projectedGrossCents: "500000" })).toBe("500000");
  });

  it("computes sale minus total invested when projectedGrossCents not provided", () => {
    expect(
      getProjectedGrossCents({
        salePriceCents: "2000000",
        totalInvestedCents: "1650000",
      })
    ).toBe("350000");
  });

  it("computes from breakdown when neither projectedGrossCents nor totalInvestedCents", () => {
    expect(
      getProjectedGrossCents({
        salePriceCents: "2000000",
        auctionCostCents: "1500000",
        transportCostCents: "50000",
        reconCostCents: "50000",
        miscCostCents: "0",
      })
    ).toBe("400000"); // 20000 - 16000
  });

  it("returns empty when sale or invested missing and no projectedGrossCents", () => {
    expect(getProjectedGrossCents({ salePriceCents: "1000" })).toBe("");
    expect(getProjectedGrossCents({ totalInvestedCents: "500" })).toBe("");
  });
});
