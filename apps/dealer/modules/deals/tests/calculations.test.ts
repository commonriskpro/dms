/**
 * Money math: tax HALF_UP rounding, totalDue, frontGross (tax excluded), totals deterministic.
 */
import { computeTaxCents, computeDealTotals } from "../service/calculations";

describe("Deals calculations", () => {
  describe("computeTaxCents (HALF_UP)", () => {
    it("computes tax with HALF_UP rounding", () => {
      // taxableBase 10000 cents, 7% = 700 bps -> (10000*700+5000)/10000 = 700
      expect(computeTaxCents(BigInt(10000), 700)).toBe(BigInt(700));
      // 10001: (10001*700+5000)/10000 = 700
      expect(computeTaxCents(BigInt(10001), 700)).toBe(BigInt(700));
      // 10005: (10005*700+5000)/10000 = 7008500/10000 = 700
      expect(computeTaxCents(BigInt(10005), 700)).toBe(BigInt(700));
      // 10007: (10007*700+5000)/10000 = 7009900/10000 = 700
      expect(computeTaxCents(BigInt(10007), 700)).toBe(BigInt(700));
    });

    it("taxable base 10500 cents, 7% = 735 cents", () => {
      const base = BigInt(10000) + BigInt(500);
      const tax = computeTaxCents(base, 700);
      expect(tax).toBe(BigInt(735));
    });

    it("HALF_UP: 1 cent taxableBase rounds with +5000n threshold", () => {
      expect(computeTaxCents(BigInt(1), 700)).toBe(BigInt(0));
      expect(computeTaxCents(BigInt(1), 500000)).toBe(BigInt(50));
    });

    it("HALF_UP: taxableBase at .5 cent equivalent rounds up at threshold", () => {
      // 714 cents at 7%: (714*700+5000)/10000 = 504800/10000 = 50
      expect(computeTaxCents(BigInt(714), 700)).toBe(BigInt(50));
      // 707 cents at 7%: (707*700+5000)/10000 = 499900/10000 = 49
      expect(computeTaxCents(BigInt(707), 700)).toBe(BigInt(49));
    });
  });

  describe("computeDealTotals", () => {
    it("totalDue = salePrice + tax + totalFees - downPayment; frontGross excludes tax", () => {
      const sale = BigInt(20000);   // 200.00
      const purchase = BigInt(15000);
      const docFee = BigInt(500);
      const down = BigInt(2000);
      const taxBps = 700;
      const customFees = BigInt(100);
      const taxableCustom = BigInt(100);
      const r = computeDealTotals({
        salePriceCents: sale,
        purchasePriceCents: purchase,
        docFeeCents: docFee,
        downPaymentCents: down,
        taxRateBps: taxBps,
        customFeesCents: customFees,
        taxableCustomFeesCents: taxableCustom,
      });
      // totalFees = 500 + 100 = 600
      expect(r.totalFeesCents).toBe(BigInt(600));
      // taxableBase = 20000 + 100 = 20100, tax = (20100*700+5000)/10000 = 14070000+5000 = 14075
      // taxableBase 20100, tax = (20100*700+5000)/10000 = 14075
      expect(r.taxCents).toBe(BigInt(1407));
      // totalDue = 20000 + 1407 + 600 - 2000 = 20007
      expect(r.totalDueCents).toBe(BigInt(20007));
      // frontGross = 20000 - 15000 - 600 = 4400 (tax not subtracted)
      expect(r.frontGrossCents).toBe(BigInt(4400));
    });

    it("gross excludes tax (tax is pass-through)", () => {
      const r = computeDealTotals({
        salePriceCents: BigInt(10000),
        purchasePriceCents: BigInt(8000),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        taxRateBps: 1000, // 10%
        customFeesCents: BigInt(0),
        taxableCustomFeesCents: BigInt(0),
      });
      expect(r.taxCents).toBe(BigInt(1000)); // 10% of 10000
      expect(r.totalFeesCents).toBe(BigInt(0));
      expect(r.frontGrossCents).toBe(BigInt(2000)); // 10000 - 8000 - 0, no tax subtraction
    });

    it("frontGross unchanged when only taxRateBps changes (gross excludes tax)", () => {
      const base = {
        salePriceCents: BigInt(10000),
        purchasePriceCents: BigInt(8000),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        customFeesCents: BigInt(0),
        taxableCustomFeesCents: BigInt(0),
      };
      const r7 = computeDealTotals({ ...base, taxRateBps: 700 });
      const r10 = computeDealTotals({ ...base, taxRateBps: 1000 });
      expect(r7.frontGrossCents).toBe(BigInt(2000));
      expect(r10.frontGrossCents).toBe(BigInt(2000));
      expect(r7.taxCents).not.toBe(r10.taxCents);
    });

    it("taxable vs non-taxable fees: only taxable affects taxCents", () => {
      const base = {
        salePriceCents: BigInt(10000),
        purchasePriceCents: BigInt(8000),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        taxRateBps: 1000,
        customFeesCents: BigInt(1000),
      };
      const taxableIncluded = computeDealTotals({ ...base, taxableCustomFeesCents: BigInt(1000) });
      const taxableExcluded = computeDealTotals({ ...base, taxableCustomFeesCents: BigInt(0) });
      expect(taxableIncluded.taxCents).toBe(BigInt(1100));
      expect(taxableExcluded.taxCents).toBe(BigInt(1000));
      expect(taxableIncluded.totalFeesCents).toBe(taxableExcluded.totalFeesCents);
    });

    it("totalDue = sale + tax + fees - downPayment", () => {
      const r = computeDealTotals({
        salePriceCents: BigInt(15000),
        purchasePriceCents: BigInt(12000),
        docFeeCents: BigInt(500),
        downPaymentCents: BigInt(2000),
        taxRateBps: 700,
        customFeesCents: BigInt(0),
        taxableCustomFeesCents: BigInt(0),
      });
      expect(r.totalDueCents).toBe(BigInt(15000) + r.taxCents + BigInt(500) - BigInt(2000));
    });

    it("spec formulas: totalFeesCents = docFeeCents + customFeesCents; totalDueCents = salePriceCents + taxCents + totalFeesCents - downPaymentCents; frontGrossCents = salePriceCents - purchasePriceCents - totalFeesCents", () => {
      const r = computeDealTotals({
        salePriceCents: BigInt(10000),
        purchasePriceCents: BigInt(8000),
        docFeeCents: BigInt(100),
        downPaymentCents: BigInt(500),
        taxRateBps: 800,
        customFeesCents: BigInt(50),
        taxableCustomFeesCents: BigInt(50),
      });
      expect(r.totalFeesCents).toBe(BigInt(150));
      expect(r.taxableBaseCents).toBe(BigInt(10050));
      expect(r.taxCents).toBe(BigInt(804)); // (10050*800+5000)/10000
      expect(r.totalDueCents).toBe(BigInt(10000) + r.taxCents + BigInt(150) - BigInt(500));
      expect(r.frontGrossCents).toBe(BigInt(10000) - BigInt(8000) - BigInt(150));
    });
  });
});
