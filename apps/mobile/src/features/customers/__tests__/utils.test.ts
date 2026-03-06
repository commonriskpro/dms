import {
  getPrimaryPhone,
  getPrimaryEmail,
  formatCentsToDisplay,
  formatDateShort,
  formatDateTime,
} from "../utils";
import type { CustomerDetail } from "@/api/endpoints";

describe("customers/utils", () => {
  describe("getPrimaryPhone", () => {
    it("returns primary phone when set", () => {
      const c = { phones: [{ value: "111", isPrimary: false }, { value: "222", isPrimary: true }] } as CustomerDetail;
      expect(getPrimaryPhone(c)).toBe("222");
    });
    it("returns first phone when no primary", () => {
      const c = { phones: [{ value: "111" }, { value: "222" }] } as CustomerDetail;
      expect(getPrimaryPhone(c)).toBe("111");
    });
    it("returns null when no phones", () => {
      const c = { phones: [] } as CustomerDetail;
      expect(getPrimaryPhone(c)).toBe(null);
    });
    it("returns null when phones undefined", () => {
      const c = {} as CustomerDetail;
      expect(getPrimaryPhone(c)).toBe(null);
    });
  });

  describe("getPrimaryEmail", () => {
    it("returns primary email when set", () => {
      const c = { emails: [{ value: "a@b.com", isPrimary: false }, { value: "b@b.com", isPrimary: true }] } as CustomerDetail;
      expect(getPrimaryEmail(c)).toBe("b@b.com");
    });
    it("returns first email when no primary", () => {
      const c = { emails: [{ value: "a@b.com" }] } as CustomerDetail;
      expect(getPrimaryEmail(c)).toBe("a@b.com");
    });
    it("returns null when no emails", () => {
      const c = { emails: [] } as CustomerDetail;
      expect(getPrimaryEmail(c)).toBe(null);
    });
  });

  describe("formatCentsToDisplay", () => {
    it("formats cents as currency", () => {
      expect(formatCentsToDisplay(19999)).toMatch(/\$200/);
      expect(formatCentsToDisplay("25000")).toMatch(/\$250/);
    });
    it("returns — for NaN", () => {
      expect(formatCentsToDisplay("x")).toBe("—");
    });
  });

  describe("formatDateShort", () => {
    it("formats ISO date", () => {
      const out = formatDateShort("2025-03-01T12:00:00Z");
      expect(out).toMatch(/Mar/);
      expect(out).toMatch(/1/);
      expect(out).toMatch(/2025/);
    });
  });

  describe("formatDateTime", () => {
    it("formats ISO datetime", () => {
      const out = formatDateTime("2025-03-01T14:30:00Z");
      expect(out).toMatch(/Mar/);
      expect(out).toMatch(/2025/);
    });
  });
});
