/**
 * Deal form validation: required fields for create, numeric bounds.
 * Actual validation is inline in DealForm; these tests cover the shared utils and constraints.
 */
import { parseDollarsToCents, clampTaxRateBps } from "../utils";
import { DEAL_STATUS_LABELS } from "../types";

describe("deal form validation", () => {
  it("parseDollarsToCents rejects negative", () => {
    expect(parseDollarsToCents("-1.00")).toBe(0);
  });

  it("tax rate bps must be 0-10000", () => {
    expect(clampTaxRateBps(-1)).toBe(0);
    expect(clampTaxRateBps(10001)).toBe(10000);
    expect(clampTaxRateBps(5000)).toBe(5000);
  });

  it("DEAL_STATUS_LABELS has all statuses", () => {
    const statuses = ["DRAFT", "STRUCTURED", "APPROVED", "CONTRACTED", "CANCELED"];
    statuses.forEach((s) => {
      expect(DEAL_STATUS_LABELS[s as keyof typeof DEAL_STATUS_LABELS]).toBeDefined();
      expect(typeof DEAL_STATUS_LABELS[s as keyof typeof DEAL_STATUS_LABELS]).toBe("string");
    });
  });
});
