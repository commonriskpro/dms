/** @jest-environment node */
/**
 * Accounting export: CSV escape and format.
 */
import { escapeCsvCell } from "../service/accounting-export";

describe("Accounting export format", () => {
  it("escapeCsvCell leaves simple values unchanged", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell("100")).toBe("100");
    expect(escapeCsvCell("")).toBe("");
  });

  it("escapeCsvCell quotes value with comma", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("escapeCsvCell doubles internal quotes", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("escapeCsvCell handles null and undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});
