/**
 * Financial calculations for deals. All money in cents (BigInt).
 * Tax: HALF_UP rounding. Gross: salePrice - purchasePrice - totalFees (tax not subtracted).
 */

/** taxableBaseCents = salePriceCents + taxableFeesCents. taxCents = (taxableBase * taxRateBps + 5000) / 10000 (HALF_UP). */
export function computeTaxCents(taxableBaseCents: bigint, taxRateBps: number): bigint {
  const bps = BigInt(taxRateBps);
  return (taxableBaseCents * bps + BigInt(5000)) / BigInt(10000);
}

/**
 * totalFeesCents = docFeeCents + sum(DealFee.amountCents).
 * totalDueCents = salePriceCents + taxCents + totalFeesCents - downPaymentCents.
 * frontGrossCents = salePriceCents - purchasePriceCents - totalFeesCents (tax excluded from gross).
 */
export function computeDealTotals(params: {
  salePriceCents: bigint;
  purchasePriceCents: bigint;
  docFeeCents: bigint;
  downPaymentCents: bigint;
  taxRateBps: number;
  customFeesCents: bigint;
  taxableCustomFeesCents: bigint;
}): {
  totalFeesCents: bigint;
  taxableBaseCents: bigint;
  taxCents: bigint;
  totalDueCents: bigint;
  frontGrossCents: bigint;
} {
  const totalFeesCents = params.docFeeCents + params.customFeesCents;
  const taxableBaseCents = params.salePriceCents + params.taxableCustomFeesCents;
  const taxCents = computeTaxCents(taxableBaseCents, params.taxRateBps);
  const totalDueCents =
    params.salePriceCents + taxCents + totalFeesCents - params.downPaymentCents;
  const frontGrossCents = params.salePriceCents - params.purchasePriceCents - totalFeesCents;
  return {
    totalFeesCents,
    taxableBaseCents,
    taxCents,
    totalDueCents,
    frontGrossCents,
  };
}
