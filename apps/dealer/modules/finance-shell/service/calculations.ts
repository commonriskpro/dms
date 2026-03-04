/**
 * Finance shell calculations. All money in cents (BigInt). No floats.
 * BigInt-safe amortization with SCALE=10^12; HALF_UP rounding to cents.
 */

const SCALE = BigInt(10) ** BigInt(12);
const BPS_PER_YEAR = 120000; // 12 * 10000 (months * bps per percent)

/** max(0, baseAmountCents + financedProductsCents - cashDownCents) */
export function computeAmountFinancedCents(
  baseAmountCents: bigint,
  financedProductsCents: bigint,
  cashDownCents: bigint
): bigint {
  const sum = baseAmountCents + financedProductsCents - cashDownCents;
  return sum > BigInt(0) ? sum : BigInt(0);
}

/**
 * Round numerator/denominator to integer cents using HALF_UP.
 * cents = floor((numerator + denominator/2) / denominator).
 */
export function roundHalfUpToCents(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) return BigInt(0);
  const half = denominator / BigInt(2);
  const sign = numerator < BigInt(0) ? BigInt(-1) : BigInt(1);
  const abs = numerator < BigInt(0) ? -numerator : numerator;
  return sign * (abs + half) / denominator;
}

/**
 * Monthly payment (cents) for principal at monthly rate r = aprBps/120000, termMonths.
 * Formula: P * r / (1 - (1+r)^(-n)). BigInt-safe: work in scaled space (SCALE = 10^12).
 */
export function computeMonthlyPaymentCents(
  principalCents: bigint,
  aprBps: number,
  termMonths: number
): bigint {
  if (termMonths <= 0 || principalCents <= BigInt(0)) return BigInt(0);
  if (aprBps < 0) return BigInt(0);

  if (aprBps === 0) {
    return roundHalfUpToCents(principalCents, BigInt(termMonths));
  }

  const rScaled = (BigInt(aprBps) * SCALE) / BigInt(BPS_PER_YEAR);
  const base = SCALE + rScaled;
  const n = BigInt(termMonths);
  const baseN = base ** n;
  const scaleN = SCALE ** n;
  const denom = baseN - scaleN;
  if (denom <= BigInt(0)) return BigInt(0);
  const numerator = principalCents * rScaled * baseN;
  const denominator = denom * SCALE;
  return roundHalfUpToCents(numerator, denominator);
}

export type FinancingMode = "CASH" | "FINANCE";

export type ComputeFinanceTotalsParams = {
  financingMode: FinancingMode;
  baseAmountCents: bigint;
  financedProductsCents: bigint;
  cashDownCents: bigint;
  termMonths: number;
  aprBps: number;
};

export type FinanceTotals = {
  amountFinancedCents: bigint;
  monthlyPaymentCents: bigint;
  totalOfPaymentsCents: bigint;
  financeChargeCents: bigint;
};

export function computeFinanceTotals(params: ComputeFinanceTotalsParams): FinanceTotals {
  if (params.financingMode === "CASH") {
    return {
      amountFinancedCents: BigInt(0),
      monthlyPaymentCents: BigInt(0),
      totalOfPaymentsCents: BigInt(0),
      financeChargeCents: BigInt(0),
    };
  }
  const amountFinancedCents = computeAmountFinancedCents(
    params.baseAmountCents,
    params.financedProductsCents,
    params.cashDownCents
  );
  const monthlyPaymentCents = computeMonthlyPaymentCents(
    amountFinancedCents,
    params.aprBps,
    params.termMonths
  );
  const totalOfPaymentsCents = monthlyPaymentCents * BigInt(params.termMonths);
  const financeChargeCents = totalOfPaymentsCents - amountFinancedCents;
  return {
    amountFinancedCents,
    monthlyPaymentCents,
    totalOfPaymentsCents,
    financeChargeCents,
  };
}
