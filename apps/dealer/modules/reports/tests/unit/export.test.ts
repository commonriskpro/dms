/**
 * Unit tests: CSV export escaping and safety.
 */
import { escapeCsvCell } from "../../service/export";

describe("Reports: export CSV escape", () => {
  it("quotes value containing comma", () => {
    expect(escapeCsvCell("Smith, John")).toBe('"Smith, John"');
  });

  it("doubles internal quotes", () => {
    expect(escapeCsvCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("quotes value containing newline", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns plain value when no special chars", () => {
    expect(escapeCsvCell("Smith")).toBe("Smith");
    expect(escapeCsvCell(123)).toBe("123");
  });

  it("returns empty string for null/undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});
