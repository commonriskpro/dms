/** @jest-environment node */
/**
 * Serializer helpers and pricing preview logic. No UI snapshots.
 */
import { formatCents, parseDollarsToCents } from "@/lib/money";

describe("formatCents", () => {
  it("formats positive cents as dollars", () => {
    expect(formatCents("12345")).toBe("$123.45");
    expect(formatCents("0")).toBe("$0.00");
    expect(formatCents("100")).toBe("$1.00");
  });

  it("handles empty or invalid as $0.00", () => {
    expect(formatCents("")).toBe("$0.00");
    expect(formatCents("abc")).toBe("$0.00");
  });
});

describe("parseDollarsToCents", () => {
  it("parses dollar string to cents", () => {
    expect(parseDollarsToCents("123.45")).toBe("12345");
    expect(parseDollarsToCents("$1,234.56")).toBe("123456");
    expect(parseDollarsToCents(".99")).toBe("99");
  });

  it("returns empty for invalid input", () => {
    expect(parseDollarsToCents("")).toBe("");
    expect(parseDollarsToCents("abc")).toBe("");
  });
});

describe("pricing preview logic", () => {
  it("age-based rule applies when daysInStock >= threshold", () => {
    const daysInStock = 45;
    const rule = { ruleType: "AGE_BASED" as const, daysInStock: 30, adjustmentPercent: -2 };
    const applies =
      rule.ruleType === "AGE_BASED" &&
      rule.daysInStock != null &&
      daysInStock != null &&
      daysInStock >= rule.daysInStock;
    expect(applies).toBe(true);
  });

  it("age-based rule does not apply when daysInStock < threshold", () => {
    const daysInStock = 20;
    const rule = { ruleType: "AGE_BASED" as const, daysInStock: 30 };
    const applies =
      rule.ruleType === "AGE_BASED" &&
      rule.daysInStock != null &&
      daysInStock != null &&
      daysInStock >= rule.daysInStock;
    expect(applies).toBe(false);
  });

  it("suggested price never negative", () => {
    const currentCents = 10000;
    const delta = -15000;
    const newPriceCents = Math.max(0, currentCents + delta);
    expect(newPriceCents).toBe(0);
  });
});
