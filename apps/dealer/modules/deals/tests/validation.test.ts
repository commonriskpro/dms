/**
 * Validation: invalid params (e.g. non-UUID deal id) and invalid bodies are rejected.
 * Non-UUID id throws ZodError (route returns 400). Negative cents throw in schema transform
 * (Error; route may return 400/500). Error shape from route: { error: { code, message, details? } }.
 */
import { z } from "zod";
import {
  dealIdParamSchema,
  updateDealBodySchema,
  updateDealStatusBodySchema,
  createDealFeeBodySchema,
  createDealTradeBodySchema,
  putFinanceBodySchema,
  createFinanceProductBodySchema,
  updateDealFeeBodySchema,
  updateDealTradeBodySchema,
  updateFinanceProductBodySchema,
} from "@/app/api/deals/schemas";

describe("Deals API validation", () => {
  describe("dealIdParamSchema", () => {
    it("rejects non-UUID id with ZodError", () => {
      expect(() => dealIdParamSchema.parse({ id: "not-a-uuid" })).toThrow(z.ZodError);
      expect(() => dealIdParamSchema.parse({ id: "" })).toThrow(z.ZodError);
      expect(() => dealIdParamSchema.parse({ id: "x".repeat(37) })).toThrow(z.ZodError);
    });

    it("accepts valid UUID", () => {
      const out = dealIdParamSchema.parse({
        id: "f6000000-0000-0000-0000-000000000006",
      });
      expect(out.id).toBe("f6000000-0000-0000-0000-000000000006");
    });
  });

  describe("updateDealBodySchema", () => {
    it("rejects negative salePriceCents", () => {
      expect(() =>
        updateDealBodySchema.parse({ salePriceCents: -1 })
      ).toThrow();
      expect(() =>
        updateDealBodySchema.parse({ salePriceCents: "-100" })
      ).toThrow();
    });

    it("rejects taxRateBps out of range", () => {
      expect(() =>
        updateDealBodySchema.parse({ taxRateBps: -1 })
      ).toThrow(z.ZodError);
      expect(() =>
        updateDealBodySchema.parse({ taxRateBps: 10001 })
      ).toThrow(z.ZodError);
    });

    it("accepts notes-only (no structural change)", () => {
      const out = updateDealBodySchema.parse({ notes: "OK" });
      expect(out.notes).toBe("OK");
    });
  });

  describe("updateDealStatusBodySchema", () => {
    it("rejects invalid status", () => {
      expect(() =>
        updateDealStatusBodySchema.parse({ status: "INVALID" })
      ).toThrow(z.ZodError);
    });

    it("accepts valid status", () => {
      const out = updateDealStatusBodySchema.parse({ status: "CONTRACTED" });
      expect(out.status).toBe("CONTRACTED");
    });
  });

  describe("createDealFeeBodySchema", () => {
    it("rejects negative amountCents", () => {
      expect(() =>
        createDealFeeBodySchema.parse({
          label: "Fee",
          amountCents: -1,
        })
      ).toThrow();
    });

    it("accepts valid fee", () => {
      const out = createDealFeeBodySchema.parse({
        label: "Doc",
        amountCents: 500,
      });
      expect(out.label).toBe("Doc");
      expect(out.amountCents).toBe(BigInt(500));
    });
  });

  describe("updateDealFeeBodySchema", () => {
    it("rejects negative amountCents", () => {
      expect(() =>
        updateDealFeeBodySchema.parse({ amountCents: -100 })
      ).toThrow();
    });
  });

  describe("createDealTradeBodySchema", () => {
    it("rejects negative allowanceCents", () => {
      expect(() =>
        createDealTradeBodySchema.parse({
          vehicleDescription: "Car",
          allowanceCents: -1,
        })
      ).toThrow();
    });
  });

  describe("updateDealTradeBodySchema", () => {
    it("rejects negative allowanceCents", () => {
      expect(() =>
        updateDealTradeBodySchema.parse({ allowanceCents: -1 })
      ).toThrow();
    });
  });

  describe("putFinanceBodySchema", () => {
    it("rejects termMonths out of range", () => {
      expect(() =>
        putFinanceBodySchema.parse({
          financingMode: "FINANCE",
          termMonths: 0,
        })
      ).toThrow(z.ZodError);
      expect(() =>
        putFinanceBodySchema.parse({
          financingMode: "FINANCE",
          termMonths: 85,
        })
      ).toThrow(z.ZodError);
    });

    it("rejects negative aprBps", () => {
      expect(() =>
        putFinanceBodySchema.parse({
          financingMode: "FINANCE",
          aprBps: -1,
        })
      ).toThrow(z.ZodError);
    });

    it("accepts valid finance payload", () => {
      const out = putFinanceBodySchema.parse({
        financingMode: "CASH",
      });
      expect(out.financingMode).toBe("CASH");
    });
  });

  describe("createFinanceProductBodySchema", () => {
    it("rejects negative priceCents", () => {
      expect(() =>
        createFinanceProductBodySchema.parse({
          productType: "GAP",
          name: "GAP",
          priceCents: -1,
          includedInAmountFinanced: true,
        })
      ).toThrow();
    });

    it("accepts valid product", () => {
      const out = createFinanceProductBodySchema.parse({
        productType: "VSC",
        name: "VSC",
        priceCents: 1000,
        includedInAmountFinanced: false,
      });
      expect(out.productType).toBe("VSC");
      expect(out.priceCents).toBe(BigInt(1000));
    });
  });

  describe("updateFinanceProductBodySchema", () => {
    it("rejects negative priceCents", () => {
      expect(() =>
        updateFinanceProductBodySchema.parse({ priceCents: -1 })
      ).toThrow();
    });
  });
});
