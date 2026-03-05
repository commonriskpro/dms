/**
 * Unit test: calculateAccruedInterestCents is deterministic.
 * Simple daily interest: principal * (bps/10000) * days/365 => cents (rounded).
 */
import { calculateAccruedInterestCents } from "./floorplan-loans";

describe("calculateAccruedInterestCents", () => {
  it("returns 0 when interestBps is 0", () => {
    expect(
      calculateAccruedInterestCents(
        100_00_00, // $10000
        0,
        new Date("2024-01-01"),
        new Date("2024-06-01")
      )
    ).toBe(0);
  });

  it("returns 0 when asOfDate is before startDate", () => {
    expect(
      calculateAccruedInterestCents(
        100_00_00,
        995, // 9.95%
        new Date("2024-06-01"),
        new Date("2024-01-01")
      )
    ).toBe(0);
  });

  it("computes simple daily interest deterministically", () => {
    // $10,000 at 9.95% for 365 days => 10000 * 0.0995 * (365/365) = $995 => 99500 cents
    const principalCents = 1_000_000; // $10,000 = 1_000_000 cents
    const interestBps = 995; // 9.95%
    const start = new Date("2023-01-01");
    const end = new Date("2024-01-01"); // 365 days (non-leap to non-leap)
    const cents = calculateAccruedInterestCents(principalCents, interestBps, start, end);
    expect(cents).toBe(99500); // $995.00 in cents
  });

  it("computes ~182 days interest deterministically", () => {
    // $10,000 at 10% for 182 days => 10000 * 0.10 * (182/365) ≈ 498.63 => 49863 cents
    const principalCents = 1_000_000;
    const interestBps = 1000; // 10%
    const start = new Date("2024-01-01");
    const end = new Date("2024-07-02"); // 182 days (floor of ms diff)
    const cents = calculateAccruedInterestCents(principalCents, interestBps, start, end);
    expect(cents).toBe(49863); // rounded
  });

  it("is deterministic for same inputs", () => {
    const a = calculateAccruedInterestCents(
      50_00_00,
      750,
      new Date("2024-03-01"),
      new Date("2024-09-01")
    );
    const b = calculateAccruedInterestCents(
      50_00_00,
      750,
      new Date("2024-03-01"),
      new Date("2024-09-01")
    );
    expect(a).toBe(b);
  });
});
