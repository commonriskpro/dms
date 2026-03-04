/**
 * Unit tests for money utilities: parseDollarsToCents, formatCents, percentToBps, bpsToPercent.
 */
import {
  parseDollarsToCents,
  formatCents,
  percentToBps,
  bpsToPercent,
  centsToDollarInput,
  isValidDollarInput,
} from "./money";

describe("parseDollarsToCents", () => {
  it("parses dollar string with optional $ and commas", () => {
    expect(parseDollarsToCents("$1,234.56")).toBe("123456");
    expect(parseDollarsToCents("1234.56")).toBe("123456");
    expect(parseDollarsToCents("$100")).toBe("10000");
  });

  it("parses one decimal place as tens of cents", () => {
    expect(parseDollarsToCents("1234.5")).toBe("123450");
  });

  it("parses cents-only input .99 and .5", () => {
    expect(parseDollarsToCents(".99")).toBe("99");
    expect(parseDollarsToCents(".5")).toBe("50");
    expect(parseDollarsToCents(".09")).toBe("9");
  });

  it("returns empty string for empty or invalid input", () => {
    expect(parseDollarsToCents("")).toBe("");
    expect(parseDollarsToCents("   ")).toBe("");
    expect(parseDollarsToCents("-")).toBe("");
    expect(parseDollarsToCents("abc")).toBe("");
    expect(parseDollarsToCents("12.345")).toBe(""); // > 2 decimal places
    expect(parseDollarsToCents("1.2.3")).toBe("");
  });

  it("handles zero", () => {
    expect(parseDollarsToCents("0")).toBe("0");
    expect(parseDollarsToCents("0.00")).toBe("0");
  });
});

describe("formatCents", () => {
  it("formats cents string as dollar display", () => {
    expect(formatCents("12345")).toBe("$123.45");
    expect(formatCents("0")).toBe("$0.00");
    expect(formatCents("100")).toBe("$1.00");
  });

  it("handles negative", () => {
    expect(formatCents("-500")).toBe("-$5.00");
  });

  it("returns $0.00 for invalid or empty", () => {
    expect(formatCents("")).toBe("$0.00");
    expect(formatCents("abc")).toBe("$0.00");
  });
});

describe("percentToBps and bpsToPercent", () => {
  it("converts percent to basis points", () => {
    expect(percentToBps("7.25")).toBe(725);
    expect(percentToBps("10")).toBe(1000);
    expect(percentToBps("0")).toBe(0);
  });

  it("converts basis points to percent string", () => {
    expect(bpsToPercent(725)).toBe("7.25");
    expect(bpsToPercent(1000)).toBe("10");
    expect(bpsToPercent(0)).toBe("0");
  });

  it("round-trip preserves value", () => {
    expect(percentToBps(bpsToPercent(725))).toBe(725);
    expect(percentToBps(bpsToPercent(700))).toBe(700);
  });
});

describe("centsToDollarInput", () => {
  it("converts cents string to dollar input format", () => {
    expect(centsToDollarInput("123456")).toBe("1234.56");
    expect(centsToDollarInput("0")).toBe("0.00");
  });
});

describe("isValidDollarInput", () => {
  it("accepts valid dollar input", () => {
    expect(isValidDollarInput("1234.56")).toBe(true);
    expect(isValidDollarInput("0")).toBe(true);
    expect(isValidDollarInput("")).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(isValidDollarInput("abc")).toBe(false);
    expect(isValidDollarInput("12.345")).toBe(false);
  });
});
