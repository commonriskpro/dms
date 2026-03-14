/**
 * DNS / domain verification provider abstraction.
 * Stub implementation when no provider is configured; real implementation can be added later.
 */

export type VerificationResult =
  | { status: "verified" }
  | { status: "pending" }
  | { status: "failed"; error?: string };

/**
 * Check domain verification (e.g. TXT or CNAME). Stub returns pending.
 */
export async function checkDomainVerification(
  _hostname: string,
  _expectedTxt?: string
): Promise<VerificationResult> {
  return { status: "pending" };
}
