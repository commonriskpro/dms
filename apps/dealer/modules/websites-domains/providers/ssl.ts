/**
 * SSL provisioning provider abstraction.
 * Stub implementation when no provider is configured; real implementation can be added later.
 */

export type SslResult =
  | { status: "provisioned" }
  | { status: "pending" }
  | { status: "failed"; error?: string }
  | { status: "not_applicable" };

/**
 * Check or provision SSL for the hostname. Stub returns pending.
 */
export async function checkSslStatus(_hostname: string): Promise<SslResult> {
  return { status: "pending" };
}
