/**
 * Unit tests: aging bucket logic.
 */
import { computeAgingBuckets } from "../../service/inventory-aging";

describe("Reports: aging buckets", () => {
  it("computes bucket counts correctly", () => {
    const days = [0, 10, 15, 16, 20, 30, 31, 45, 60, 61, 90, 91, 120];
    const out = computeAgingBuckets(days);
    expect(out.bucket0_15).toBe(3);
    expect(out.bucket16_30).toBe(3);
    expect(out.bucket31_60).toBe(3);
    expect(out.bucket61_90).toBe(2);
    expect(out.bucket90Plus).toBe(2);
  });

  it("returns zeros for empty list", () => {
    const out = computeAgingBuckets([]);
    expect(out.bucket0_15).toBe(0);
    expect(out.bucket16_30).toBe(0);
    expect(out.bucket31_60).toBe(0);
    expect(out.bucket61_90).toBe(0);
    expect(out.bucket90Plus).toBe(0);
  });
});
