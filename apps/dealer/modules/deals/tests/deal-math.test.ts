/**
 * Deal desk math: calculateDealTotals, paymentEstimate, trade/amount helpers.
 */
import {
  calculateDealTotals,
  tradeEquityCents,
  balanceAfterTradeCents,
  amountFinancedCents,
  paymentEstimate,
} from "../service/deal-math";

describe("deal-math", () => {
  describe("calculateDealTotals", () => {
    it("matches computeDealTotals: totalFees, tax, totalDue, frontGross", () => {
      const r = calculateDealTotals({
        vehiclePriceCents: BigInt(20000),
        purchasePriceCents: BigInt(15000),
        docFeeCents: BigInt(500),
        downPaymentCents: BigInt(2000),
        taxRateBps: 700,
        customFeesCents: BigInt(100),
        taxableCustomFeesCents: BigInt(100),
      });
      expect(r.totalFeesCents).toBe(BigInt(600));
      expect(r.taxCents).toBe(BigInt(1407));
      expect(r.totalDueCents).toBe(BigInt(20007));
      expect(r.frontGrossCents).toBe(BigInt(4400));
    });

    it("zero tax when taxRateBps is 0", () => {
      const r = calculateDealTotals({
        vehiclePriceCents: BigInt(10000),
        purchasePriceCents: BigInt(8000),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        taxRateBps: 0,
        customFeesCents: BigInt(0),
        taxableCustomFeesCents: BigInt(0),
      });
      expect(r.taxCents).toBe(BigInt(0));
      expect(r.totalDueCents).toBe(BigInt(10000));
    });
  });

  describe("tradeEquityCents", () => {
    it("positive equity: allowance > payoff", () => {
      expect(tradeEquityCents(BigInt(10000), BigInt(6000))).toBe(BigInt(4000));
    });
    it("negative equity: allowance < payoff", () => {
      expect(tradeEquityCents(BigInt(5000), BigInt(8000))).toBe(BigInt(-3000));
    });
    it("zero when equal", () => {
      expect(tradeEquityCents(BigInt(5000), BigInt(5000))).toBe(BigInt(0));
    });
  });

  describe("balanceAfterTradeCents", () => {
    it("reduces balance by positive equity", () => {
      expect(balanceAfterTradeCents(BigInt(20000), BigInt(3000))).toBe(BigInt(17000));
    });
    it("increases balance by negative equity", () => {
      expect(balanceAfterTradeCents(BigInt(20000), BigInt(-2000))).toBe(BigInt(22000));
    });
    it("floors at 0", () => {
      expect(balanceAfterTradeCents(BigInt(5000), BigInt(10000))).toBe(BigInt(0));
    });
  });

  describe("amountFinancedCents", () => {
    it("balance - cashDown + productsIncluded", () => {
      expect(
        amountFinancedCents(BigInt(20000), BigInt(3000), BigInt(1000))
      ).toBe(BigInt(18000));
    });
    it("floors at 0", () => {
      expect(amountFinancedCents(BigInt(1000), BigInt(2000), BigInt(0))).toBe(BigInt(0));
    });
  });

  describe("paymentEstimate", () => {
    it("zero APR: payment = principal / termMonths (rounded)", () => {
      expect(paymentEstimate(BigInt(120000), 0, 60)).toBe(BigInt(2000));
    });
    it("zero term returns 0", () => {
      expect(paymentEstimate(BigInt(10000), 600, 0)).toBe(BigInt(0));
    });
    it("zero principal returns 0", () => {
      expect(paymentEstimate(BigInt(0), 600, 60)).toBe(BigInt(0));
    });
    it("negative APR returns 0", () => {
      expect(paymentEstimate(BigInt(100000), -100, 60)).toBe(BigInt(0));
    });
    it("positive APR produces positive payment", () => {
      const payment = paymentEstimate(BigInt(1000000), 599, 60);
      expect(payment).toBeGreaterThan(BigInt(0));
      expect(payment).toBeLessThan(BigInt(25000));
    });
  });
});
