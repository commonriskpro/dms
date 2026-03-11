import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const SALT_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const secret = process.env.COOKIE_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("COOKIE_ENCRYPTION_KEY must be set and at least 16 characters");
  }
  return scryptSync(secret, "dms-active-dealership", KEY_LEN);
}

/**
 * Encrypt a string for use in a cookie. Uses AES-256-GCM.
 * Cookie security: use with HttpOnly, Secure, SameSite=Strict, short maxAge.
 */
export function encryptCookieValue(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64url");
}

/**
 * Decrypt a cookie value. Returns null if invalid or tampered.
 */
export function decryptCookieValue(cipherText: string): string | null {
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

export const ACTIVE_DEALERSHIP_COOKIE = "dms_active_dealership";
export const ACTIVE_DEALERSHIP_MAX_AGE = 60 * 60 * 24; // 24 hours

/** Support session (platform staff viewing as dealer). Payload encrypted. */
export const SUPPORT_SESSION_COOKIE = "dms_support_session";
export const SUPPORT_SESSION_MAX_AGE = 60 * 60 * 2; // 2 hours

const SUPPORT_SESSION_KEY_SALT = "dms-support-session";

function getSupportSessionKey(): Buffer {
  const secret = process.env.COOKIE_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("COOKIE_ENCRYPTION_KEY must be set for support session");
  }
  return scryptSync(secret, SUPPORT_SESSION_KEY_SALT, KEY_LEN);
}

type SupportSessionPayload = {
  dealershipId: string;
  platformUserId: string;
  expiresAt: string; // ISO
};

export function encryptSupportSessionPayload(payload: SupportSessionPayload): string {
  const key = getSupportSessionKey();
  const iv = randomBytes(IV_LEN);
  const plain = JSON.stringify(payload);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString("base64url");
}

export function decryptSupportSessionPayload(cipherText: string): SupportSessionPayload | null {
  try {
    const key = getSupportSessionKey();
    const buf = Buffer.from(cipherText, "base64url");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const plain = decipher.update(enc) + decipher.final("utf8");
    const parsed = JSON.parse(plain) as SupportSessionPayload;
    if (
      typeof parsed.dealershipId !== "string" ||
      typeof parsed.platformUserId !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
