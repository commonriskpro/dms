import {
  formatCentsToDollars,
  parseDollarsToCents,
  clampTaxRateBps,
} from "../utils";

describe("deals utils", () => {
  describe("formatCentsToDollars", () => {
    it("formats cents to dollar string", () => {
      expect(formatCentsToDollars(12345)).toBe("123.45");
      expect(formatCentsToDollars(0)).toBe("0.00");
      expect(formatCentsToDollars("99900")).toBe("999.00");
    });
    it("returns empty for invalid or empty", () => {
      expect(formatCentsToDollars(undefined)).toBe("");
      expect(formatCentsToDollars(null)).toBe("");
      expect(formatCentsToDollars("")).toBe("");
    });
  });

  describe("parseDollarsToCents", () => {
    it("parses dollar string to cents", () => {
      expect(parseDollarsToCents("123.45")).toBe(12345);
      expect(parseDollarsToCents("0")).toBe(0);
      expect(parseDollarsToCents("999.99")).toBe(99999);
    });
    it("returns 0 for invalid or empty", () => {
      expect(parseDollarsToCents("")).toBe(0);
      expect(parseDollarsToCents("abc")).toBe(0);
      expect(parseDollarsToCents("-10")).toBe(0);
      expect(parseDollarsToCents(undefined)).toBe(0);
      expect(parseDollarsToCents(null)).toBe(0);
    });
    it("strips commas", () => {
      expect(parseDollarsToCents("1,234.56")).toBe(123456);
    });
  });

  describe("clampTaxRateBps", () => {
    it("clamps to 0-10000", () => {
      expect(clampTaxRateBps(0)).toBe(0);
      expect(clampTaxRateBps(10000)).toBe(10000);
      expect(clampTaxRateBps(-100)).toBe(0);
      expect(clampTaxRateBps(15000)).toBe(10000);
      expect(clampTaxRateBps(5000)).toBe(5000);
    });
    it("rounds to integer", () => {
      expect(clampTaxRateBps(100.4)).toBe(100);
      expect(clampTaxRateBps(100.6)).toBe(101);
    });
  });
});
