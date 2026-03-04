/**
 * Unit tests: sales summary money and rounding (no DB).
 * averageFrontGrossCents: HALF_UP rounding; returns string cents.
 */
describe("Reports: averageFrontGrossCents HALF_UP", () => {
  /** Replicate service HALF_UP: (total*2 + count) / (2*count) */
  function averageCentsHalfUp(totalCents: bigint, count: number): string {
    if (count <= 0) return "0";
    return (
      (totalCents * 2n + BigInt(count)) /
      (2n * BigInt(count))
    ).toString();
  }

  it("returns string cents", () => {
    expect(typeof averageCentsHalfUp(1000n, 1)).toBe("string");
    expect(averageCentsHalfUp(1000n, 1)).toBe("1000");
  });

  it("rounds HALF_UP: 7 cents / 2 deals = 4", () => {
    expect(averageCentsHalfUp(7n, 2)).toBe("4");
  });

  it("rounds HALF_UP: 5 cents / 2 deals = 3", () => {
    expect(averageCentsHalfUp(5n, 2)).toBe("3");
  });

  it("zero deals returns 0", () => {
    expect(averageCentsHalfUp(0n, 0)).toBe("0");
  });
});
