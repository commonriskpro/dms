/** @jest-environment node */
/**
 * Reporting tenant isolation: Dealer A cannot get Dealer B data.
 */
import * as dealerProfit from "../service/dealer-profit";
import * as inventoryRoi from "../service/inventory-roi";
import * as salespersonPerf from "../service/salesperson-performance";


const dealerAId = "10000000-0000-0000-0000-000000000001";
const dealerBId = "20000000-0000-0000-0000-000000000002";

describe("Reporting tenant isolation", () => {
  it("getDealerProfitReport for Dealer A returns only A data (empty if no A deals)", async () => {
    const report = await dealerProfit.getDealerProfitReport(dealerAId, {
      from: "2020-01-01",
      to: "2030-12-31",
    });
    expect(report.summary.dealCount).toBe(0);
    expect(report.rows).toHaveLength(0);
  });

  it("getInventoryRoiReport for Dealer A returns only A data", async () => {
    const report = await inventoryRoi.getInventoryRoiReport(dealerAId, {
      from: "2020-01-01",
      to: "2030-12-31",
    });
    expect(report.summary.vehicleCount).toBe(0);
    expect(report.rows).toHaveLength(0);
  });

  it("getSalespersonPerformance for Dealer A returns only A data", async () => {
    const report = await salespersonPerf.getSalespersonPerformance(dealerAId, {
      from: "2020-01-01",
      to: "2030-12-31",
      limit: 25,
      offset: 0,
    });
    expect(report.meta.total).toBe(0);
    expect(report.data).toHaveLength(0);
  });
});
