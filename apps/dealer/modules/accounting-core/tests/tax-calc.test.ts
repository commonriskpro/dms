/** @jest-environment node */
/**
 * Tax calculation: taxable base * rate (bps). No DB.
 */
function calculateSalesTaxCents(
  taxableCents: bigint,
  taxRateBps: number
): bigint {
  return (taxableCents * BigInt(taxRateBps)) / BigInt(10000);
}

describe("Tax calculation", () => {
  it("computes tax from taxable amount and bps", () => {
    const tax = calculateSalesTaxCents(BigInt(10000), 700);
    expect(tax).toBe(BigInt(700));
  });

  it("rounds down for fractional cents", () => {
    const tax = calculateSalesTaxCents(BigInt(10001), 700);
    expect(tax).toBe(BigInt(700));
  });

  it("zero rate yields zero tax", () => {
    const tax = calculateSalesTaxCents(BigInt(10000), 0);
    expect(tax).toBe(BigInt(0));
  });
});
