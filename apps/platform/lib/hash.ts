import { createHash } from "crypto";

/**
 * SHA-256 hash of lowercased, trimmed email for dedupe/audit.
 * Never store raw email in platform logs or audit.
 */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
