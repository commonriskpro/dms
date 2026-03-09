/**
 * Price-to-market and days-to-turn helpers (pure functions only).
 * Mock db to avoid Prisma load when importing the service.
 */
jest.mock("../db/vehicle", () => ({}));
jest.mock("../db/book-values", () => ({}));

import {
  computeDaysInStock,
  agingBucketFromDays,
  turnRiskStatus,
  DAYS_TO_TURN_TARGET,
} from "../service/price-to-market";

describe("price-to-market days-to-turn helpers", () => {
  describe("computeDaysInStock", () => {
    it("returns null for null createdAt", () => {
      expect(computeDaysInStock(null)).toBeNull();
    });

    it("returns 0 for today", () => {
      const today = new Date();
      expect(computeDaysInStock(today)).toBe(0);
    });

    it("returns positive days for past date", () => {
      const past = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      expect(computeDaysInStock(past)).toBe(45);
    });
  });

  describe("agingBucketFromDays", () => {
    it("returns null for null", () => {
      expect(agingBucketFromDays(null)).toBeNull();
    });
    it("returns <30 for 0–29", () => {
      expect(agingBucketFromDays(0)).toBe("<30");
      expect(agingBucketFromDays(29)).toBe("<30");
    });
    it("returns 30-60 for 30–59", () => {
      expect(agingBucketFromDays(30)).toBe("30-60");
      expect(agingBucketFromDays(59)).toBe("30-60");
    });
    it("returns 60-90 for 60–89", () => {
      expect(agingBucketFromDays(60)).toBe("60-90");
      expect(agingBucketFromDays(89)).toBe("60-90");
    });
    it("returns >90 for 90+", () => {
      expect(agingBucketFromDays(90)).toBe(">90");
      expect(agingBucketFromDays(120)).toBe(">90");
    });
  });

  describe("turnRiskStatus", () => {
    it("returns na for null", () => {
      expect(turnRiskStatus(null)).toBe("na");
    });
    it("returns good when days <= target", () => {
      expect(turnRiskStatus(0)).toBe("good");
      expect(turnRiskStatus(DAYS_TO_TURN_TARGET)).toBe("good");
    });
    it("returns warn when days <= target * 1.5", () => {
      expect(turnRiskStatus(46)).toBe("warn");
      expect(turnRiskStatus(67)).toBe("warn");
    });
    it("returns bad when days > target * 1.5", () => {
      expect(turnRiskStatus(68)).toBe("bad");
      expect(turnRiskStatus(100)).toBe("bad");
    });
  });
});
