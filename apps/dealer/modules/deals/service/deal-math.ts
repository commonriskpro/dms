/**
 * Deal desk math: totals and payment estimate.
 * All values in cents (BigInt). Reuses deals/calculations and finance-shell for consistency.
 */

import { computeDealTotals } from "./calculations";
import { computeMonthlyPaymentCents } from "@/modules/finance-shell/service/calculations";

export type CalculateDealTotalsInput = {
  vehiclePriceCents: bigint;
  purchasePriceCents: bigint;
  docFeeCents: bigint;
  downPaymentCents: bigint;
  taxRateBps: number;
  customFeesCents: bigint;
  taxableCustomFeesCents: bigint;
};

export type CalculateDealTotalsOutput = {
  totalFeesCents: bigint;
  taxableBaseCents: bigint;
  taxCents: bigint;
  totalDueCents: bigint;
  frontGrossCents: bigint;
};

/**
 * Canonical front-end deal totals. Wraps computeDealTotals from calculations.
 */
export function calculateDealTotals(input: CalculateDealTotalsInput): CalculateDealTotalsOutput {
  return computeDealTotals({
    salePriceCents: input.vehiclePriceCents,
    purchasePriceCents: input.purchasePriceCents,
    docFeeCents: input.docFeeCents,
    downPaymentCents: input.downPaymentCents,
    taxRateBps: input.taxRateBps,
    customFeesCents: input.customFeesCents,
    taxableCustomFeesCents: input.taxableCustomFeesCents,
  });
}

/**
 * Trade equity (allowance - payoff) for one trade. Can be negative (negative equity).
 */
export function tradeEquityCents(allowanceCents: bigint, payoffCents: bigint): bigint {
  return allowanceCents - payoffCents;
}

/**
 * Balance after trade: totalDueCents - tradeEquity (positive equity reduces amount owed).
 */
export function balanceAfterTradeCents(totalDueCents: bigint, tradeEquityCents: bigint): bigint {
  const balance = totalDueCents - tradeEquityCents;
  return balance > BigInt(0) ? balance : BigInt(0);
}

/**
 * Amount financed: balanceAfterTrade - cashDown + productsIncludedCents; floor at 0.
 */
export function amountFinancedCents(
  balanceAfterTradeCents: bigint,
  cashDownCents: bigint,
  productsIncludedCents: bigint
): bigint {
  const sum = balanceAfterTradeCents - cashDownCents + productsIncludedCents;
  return sum > BigInt(0) ? sum : BigInt(0);
}

/**
 * Estimated monthly payment in cents. Reuses finance-shell computeMonthlyPaymentCents.
 * Handles zero APR (payment = principal / termMonths rounded), zero term, zero principal.
 */
export function paymentEstimate(
  amountFinancedCents: bigint,
  aprBps: number,
  termMonths: number
): bigint {
  if (termMonths <= 0 || amountFinancedCents <= BigInt(0)) return BigInt(0);
  if (aprBps < 0) return BigInt(0);
  return computeMonthlyPaymentCents(amountFinancedCents, aprBps, termMonths);
}
