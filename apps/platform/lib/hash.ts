import { createHash } from "crypto";

/**
 * SHA-256 hash of lowercased, trimmed email for dedupe/audit.
 * Never store raw email in platform logs or audit.
 */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Safe mask for display: first char + *** + @ + domain. No raw email.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "***";
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const first = local[0] ?? "";
  return `${first}***@${domain}`;
}
