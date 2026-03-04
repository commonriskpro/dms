/**
 * Unit tests: finance penetration percent logic.
 */
import { computePenetrationPercent } from "../../service/finance-penetration";

describe("Reports: penetration percent", () => {
  it("computes percent when total > 0", () => {
    expect(computePenetrationPercent(38, 50)).toBe(76);
    expect(computePenetrationPercent(31, 50)).toBe(62);
    expect(computePenetrationPercent(0, 50)).toBe(0);
    expect(computePenetrationPercent(50, 50)).toBe(100);
  });

  it("0/N → 0%", () => {
    expect(computePenetrationPercent(0, 50)).toBe(0);
  });

  it("N/N → 100%", () => {
    expect(computePenetrationPercent(50, 50)).toBe(100);
  });

  it("returns 0 when total is 0", () => {
    expect(computePenetrationPercent(0, 0)).toBe(0);
    expect(computePenetrationPercent(10, 0)).toBe(0);
  });

  it("rounds to integer", () => {
    expect(computePenetrationPercent(1, 3)).toBe(33);
    expect(computePenetrationPercent(2, 3)).toBe(67);
  });
});
