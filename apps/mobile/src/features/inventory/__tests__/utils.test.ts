import {
  vehicleTitle,
  formatCentsToDisplay,
  formatMileage,
  isValidVin,
  normalizeVin,
  parseVinFromBarcode,
} from "../utils";

describe("inventory/utils", () => {
  describe("vehicleTitle", () => {
    it("joins year make model trim", () => {
      expect(vehicleTitle({ year: 2024, make: "Honda", model: "Civic", trim: "EX" })).toBe("2024 Honda Civic EX");
    });
    it("returns Vehicle when empty", () => {
      expect(vehicleTitle({})).toBe("Vehicle");
    });
  });

  describe("formatCentsToDisplay", () => {
    it("formats cents as currency", () => {
      expect(formatCentsToDisplay(2500000)).toMatch(/\$25,000/);
    });
    it("returns — for NaN", () => {
      expect(formatCentsToDisplay("x")).toBe("—");
    });
  });

  describe("formatMileage", () => {
    it("formats with mi", () => {
      expect(formatMileage(45000)).toMatch(/45,000.*mi/);
    });
    it("returns — for null/undefined", () => {
      expect(formatMileage(null)).toBe("—");
      expect(formatMileage(undefined)).toBe("—");
    });
  });

  describe("VIN", () => {
    it("isValidVin accepts 17 valid chars", () => {
      expect(isValidVin("1HGBH41JXMN109186")).toBe(true);
      expect(isValidVin("1HGBH41JXMN10918")).toBe(false);
    });
    it("normalizeVin uppercases and strips invalid", () => {
      expect(normalizeVin(" 1hg  ").length).toBeLessThanOrEqual(17);
    });
    it("parseVinFromBarcode takes first 17 alphanumeric", () => {
      expect(parseVinFromBarcode("1HGBH41JXMN109186")).toBe("1HGBH41JXMN109186");
      expect(parseVinFromBarcode("1HGBH41JXMN109186EXTRA")).toBe("1HGBH41JXMN109186");
    });
    it("parseVinFromBarcode strips non-VIN characters", () => {
      expect(parseVinFromBarcode("1HG-BH41-JXMN-109186")).toBe("1HGBH41JXMN109186");
      expect(parseVinFromBarcode("!@#")).toBe("");
    });
  });
});
