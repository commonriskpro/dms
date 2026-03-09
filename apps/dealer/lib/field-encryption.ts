/**
 * Field-level encryption for sensitive values (e.g. SSN). AES-256-GCM.
 * Use SSN_ENCRYPTION_KEY or FIELD_ENCRYPTION_KEY (min 16 chars). Never log or return raw values.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;
const SALT = "dms-field-encryption-v1";

function getKey(): Buffer {
  const secret =
    process.env.SSN_ENCRYPTION_KEY ?? process.env.FIELD_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SSN_ENCRYPTION_KEY or FIELD_ENCRYPTION_KEY must be set and at least 16 characters"
    );
  }
  return scryptSync(secret, SALT, KEY_LEN);
}

/**
 * Encrypt a plain string. Returns base64url ciphertext. Never log the result with PII context.
 */
export function encryptField(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64url");
}

/**
 * Decrypt a value. Returns null if invalid or tampered.
 */
export function decryptField(cipherText: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(cipherText, "base64url");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(enc) + decipher.final("utf8");
  } catch {
    return null;
  }
}

/** Mask SSN for display: only last 4 visible, e.g. ***-**-1234. Input may be 9 digits or already masked. */
export function maskSsn(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***-**-****";
  const last4 = digits.slice(-4);
  return `***-**-${last4}`;
}
