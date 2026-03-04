/**
 * Unit tests for finance-shell calculations. Deterministic; no DB.
 */
import {
  computeAmountFinancedCents,
  roundHalfUpToCents,
  computeMonthlyPaymentCents,
  computeFinanceTotals,
} from "./calculations";

describe("computeAmountFinancedCents", () => {
  it("returns base + products - cashDown when positive", () => {
    expect(
      computeAmountFinancedCents(1000000n, 50000n, 100000n)
    ).toBe(950000n);
  });

  it("returns 0 when result would be negative", () => {
    expect(
      computeAmountFinancedCents(100000n, 0n, 200000n)
    ).toBe(0n);
  });

  it("product inclusion: financed products increase amount financed", () => {
    const base = 500000n;
    const cash = 0n;
    expect(computeAmountFinancedCents(base, 0n, cash)).toBe(500000n);
    expect(computeAmountFinancedCents(base, 100000n, cash)).toBe(600000n);
  });
});

describe("roundHalfUpToCents", () => {
  it("rounds half up: 2.5 -> 3", () => {
    expect(roundHalfUpToCents(25n, 10n)).toBe(3n);
  });

  it("rounds half down: 2.4 -> 2", () => {
    expect(roundHalfUpToCents(24n, 10n)).toBe(2n);
  });

  it("exact integers unchanged", () => {
    expect(roundHalfUpToCents(100n, 1n)).toBe(100n);
  });

  it("HALF_UP edge: 0.5 rounds up", () => {
    expect(roundHalfUpToCents(5n, 10n)).toBe(1n);
  });
});

describe("computeMonthlyPaymentCents", () => {
  it("P=1000000 cents, APR=12% (1200 bps), 60 months -> known monthly ~22244 cents", () => {
    const monthly = computeMonthlyPaymentCents(1000000n, 1200, 60);
    expect(monthly).toBe(22244n);
  });

  it("P=500000 cents, APR=0%, 60 months -> payment = 500000/60 rounded", () => {
    const monthly = computeMonthlyPaymentCents(500000n, 0, 60);
    expect(monthly).toBe(8333n); // 500000/60 = 8333.33 -> 8333 HALF_UP
  });

  it("P=10000 cents, APR=600 bps (6%), 12 months -> reasonable monthly", () => {
    const monthly = computeMonthlyPaymentCents(10000n, 600, 12);
    expect(monthly).toBeGreaterThan(850n);
    expect(monthly).toBeLessThan(870n);
  });

  it("zero principal returns 0", () => {
    expect(computeMonthlyPaymentCents(0n, 1200, 60)).toBe(0n);
  });

  it("zero term returns 0", () => {
    expect(computeMonthlyPaymentCents(1000000n, 1200, 0)).toBe(0n);
  });

  it("APR 0.01% (1 bps), 60 months: deterministic payment", () => {
    const monthly = computeMonthlyPaymentCents(1000000n, 1, 60);
    expect(monthly).toBe(16671n); // deterministic BigInt result
    expect(monthly * 60n).toBe(1000260n); // totalOfPayments = payment * term
  });

  it("APR 99.99% (9999 bps), 12 months: high rate deterministic", () => {
    const monthly = computeMonthlyPaymentCents(100000n, 9999, 12);
    expect(monthly).toBeGreaterThan(0n);
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 100000n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 12,
      aprBps: 9999,
    });
    expect(totals.totalOfPaymentsCents).toBe(
      totals.monthlyPaymentCents * 12n
    );
    expect(totals.financeChargeCents).toBe(
      totals.totalOfPaymentsCents - 100000n
    );
  });

  it("term 1 month: payment = principal * (1 + monthly rate)", () => {
    const monthly = computeMonthlyPaymentCents(1000000n, 1200, 1);
    expect(monthly).toBe(1010000n); // 1% monthly → 1010000 cents
  });

  it("term 84 months: totalOfPayments = payment * term", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 2000000n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 84,
      aprBps: 599, // 5.99%
    });
    expect(totals.totalOfPaymentsCents).toBe(
      totals.monthlyPaymentCents * 84n
    );
    expect(totals.financeChargeCents).toBe(
      totals.totalOfPaymentsCents - totals.amountFinancedCents
    );
  });

  it("principal $1.00 (100 cents): deterministic", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 100n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 12,
      aprBps: 1200,
    });
    expect(totals.amountFinancedCents).toBe(100n);
    expect(totals.totalOfPaymentsCents).toBe(
      totals.monthlyPaymentCents * 12n
    );
    expect(totals.financeChargeCents).toBe(
      totals.totalOfPaymentsCents - 100n
    );
  });
});

describe("computeFinanceTotals", () => {
  it("CASH mode returns all zeros for payment-related", () => {
    const totals = computeFinanceTotals({
      financingMode: "CASH",
      baseAmountCents: 1000000n,
      financedProductsCents: 50000n,
      cashDownCents: 0n,
      termMonths: 60,
      aprBps: 1200,
    });
    expect(totals.amountFinancedCents).toBe(0n);
    expect(totals.monthlyPaymentCents).toBe(0n);
    expect(totals.totalOfPaymentsCents).toBe(0n);
    expect(totals.financeChargeCents).toBe(0n);
  });

  it("FINANCE: amount financed and totals match known vector (P=1000000, 12%, 60)", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 1000000n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 60,
      aprBps: 1200,
    });
    expect(totals.amountFinancedCents).toBe(1000000n);
    expect(totals.monthlyPaymentCents).toBe(22244n);
    expect(totals.totalOfPaymentsCents).toBe(22244n * 60n);
    expect(totals.financeChargeCents).toBe(totals.totalOfPaymentsCents - 1000000n);
  });

  it("FINANCE with products included: products increase amount financed and payment", () => {
    const without = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 1000000n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 60,
      aprBps: 1200,
    });
    const withProducts = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 1000000n,
      financedProductsCents: 100000n,
      cashDownCents: 0n,
      termMonths: 60,
      aprBps: 1200,
    });
    expect(withProducts.amountFinancedCents).toBe(1100000n);
    expect(withProducts.monthlyPaymentCents).toBeGreaterThan(without.monthlyPaymentCents);
    expect(withProducts.totalOfPaymentsCents).toBe(withProducts.monthlyPaymentCents * 60n);
    expect(withProducts.financeChargeCents).toBe(
      withProducts.totalOfPaymentsCents - withProducts.amountFinancedCents
    );
  });

  it("FINANCE with cash down reduces amount financed", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 1000000n,
      financedProductsCents: 0n,
      cashDownCents: 200000n,
      termMonths: 60,
      aprBps: 1200,
    });
    expect(totals.amountFinancedCents).toBe(800000n);
    expect(totals.monthlyPaymentCents).toBeLessThan(22244n);
    expect(totals.totalOfPaymentsCents).toBe(totals.monthlyPaymentCents * 60n);
    expect(totals.financeChargeCents).toBe(totals.totalOfPaymentsCents - 800000n);
  });
});

/** Canonical calculation vectors for regression (BigInt, HALF_UP). */
describe("calculation vector tests (deterministic regression)", () => {
  it("vector 1: P=$10k, 12% APR, 60 mo → payment 22244¢, total = payment*60, charge = total - P", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 1000000n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 60,
      aprBps: 1200,
    });
    expect(totals.amountFinancedCents).toBe(1000000n);
    expect(totals.monthlyPaymentCents).toBe(22244n);
    expect(totals.totalOfPaymentsCents).toBe(22244n * 60n);
    expect(totals.financeChargeCents).toBe(totals.totalOfPaymentsCents - 1000000n);
  });

  it("vector 2: P=$10k (1000000¢), 0% APR, 60 mo → monthly = 1000000/60 HALF_UP = 16667¢", () => {
    const monthly = computeMonthlyPaymentCents(1000000n, 0, 60);
    expect(monthly).toBe(16667n); // 1000000/60 = 16666.66… → HALF_UP 16667
  });

  it("vector 3: P=$20k, 5.99% APR, 84 mo → totalOfPayments = payment*84, financeCharge = total - amountFinanced", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 2000000n,
      financedProductsCents: 0n,
      cashDownCents: 0n,
      termMonths: 84,
      aprBps: 599,
    });
    expect(totals.totalOfPaymentsCents).toBe(totals.monthlyPaymentCents * 84n);
    expect(totals.financeChargeCents).toBe(
      totals.totalOfPaymentsCents - totals.amountFinancedCents
    );
  });

  it("vector 4: product inclusion — base 1M + 100k products → amountFinanced 1.1M", () => {
    const totals = computeFinanceTotals({
      financingMode: "FINANCE",
      baseAmountCents: 1000000n,
      financedProductsCents: 100000n,
      cashDownCents: 0n,
      termMonths: 60,
      aprBps: 1200,
    });
    expect(totals.amountFinancedCents).toBe(1100000n);
    expect(totals.totalOfPaymentsCents).toBe(totals.monthlyPaymentCents * 60n);
    expect(totals.financeChargeCents).toBe(
      totals.totalOfPaymentsCents - 1100000n
    );
  });

  it("vector 5: HALF_UP 2.5 → 3, 2.4 → 2", () => {
    expect(roundHalfUpToCents(25n, 10n)).toBe(3n);
    expect(roundHalfUpToCents(24n, 10n)).toBe(2n);
  });
});
