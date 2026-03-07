/**
 * Tax calculation from TaxProfile. Sales tax on price, doc fee, fees, products per profile flags.
 */
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { ApiError } from "@/lib/auth";
import * as taxProfileDb from "../db/tax-profile";

export type TaxableAmounts = {
  salePriceCents: bigint;
  docFeeCents: bigint;
  /** Additional fees (e.g. dealer fees) - applied if docFeeTaxable or similar logic */
  otherFeesCents: bigint;
  /** Product amounts with taxable flag */
  productAmounts: { amountCents: bigint; taxable: boolean }[];
};

/**
 * Calculate sales tax in cents using profile's taxRateBps.
 * Taxable base: salePrice + (docFee if docFeeTaxable) + (otherFees) + sum(products where taxable).
 */
export async function calculateSalesTax(
  dealershipId: string,
  taxProfileId: string,
  amounts: TaxableAmounts
): Promise<bigint> {
  await requireTenantActiveForRead(dealershipId);
  const profile = await taxProfileDb.getTaxProfileById(dealershipId, taxProfileId);
  if (!profile) throw new ApiError("NOT_FOUND", "Tax profile not found");
  let taxableCents = amounts.salePriceCents;
  if (profile.docFeeTaxable) {
    taxableCents += amounts.docFeeCents;
    taxableCents += amounts.otherFeesCents;
  }
  for (const p of amounts.productAmounts) {
    if (p.taxable && profile.warrantyTaxable) taxableCents += p.amountCents;
  }
  const bps = BigInt(profile.taxRateBps);
  const taxCents = (taxableCents * bps) / BigInt(10000);
  return taxCents;
}

export async function listTaxProfiles(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  return taxProfileDb.listTaxProfiles(dealershipId);
}
