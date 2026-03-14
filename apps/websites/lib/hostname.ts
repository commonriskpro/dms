import { headers } from "next/headers";

/**
 * Extracts the effective hostname from the incoming request.
 * In production, reads the `host` header. In local dev, falls back to WEBSITE_HOSTNAME env var for testing.
 */
export async function getRequestHostname(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? headersList.get("x-forwarded-host") ?? "";
  // Strip port for local dev
  const hostname = host.split(":")[0] ?? "";
  // Fallback for local development overrides
  if (!hostname || hostname === "localhost") {
    return process.env.WEBSITE_HOSTNAME ?? "localhost";
  }
  return hostname;
}
