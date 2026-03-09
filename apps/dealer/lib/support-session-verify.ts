/**
 * Verify platform-issued support-session JWT. Server-only.
 */

import { createSecretKey } from "node:crypto";
import { jwtVerify } from "jose";
import { INTERNAL_API_ISS } from "@dms/contracts";

// Keep local until the workspace contracts package export refresh is guaranteed.
const SUPPORT_SESSION_AUD = "support_session";

export type SupportSessionTokenPayload = {
  purpose: string;
  dealershipId: string;
  platformUserId: string;
};

/**
 * Verifies support-session JWT. Throws on invalid/expired.
 */
export async function verifySupportSessionToken(
  token: string
): Promise<SupportSessionTokenPayload> {
  const secret = process.env.INTERNAL_API_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("INTERNAL_API_JWT_SECRET not configured");
  }
  const key = createSecretKey(Buffer.from(secret, "utf8"));
  const { payload } = await jwtVerify(token, key, {
    audience: SUPPORT_SESSION_AUD,
    issuer: INTERNAL_API_ISS,
    clockTolerance: 10,
  });
  const p = payload as Record<string, unknown>;
  if (p.purpose !== "support_session" || typeof p.dealershipId !== "string" || typeof p.platformUserId !== "string") {
    throw new Error("Invalid support session token payload");
  }
  return {
    purpose: p.purpose as string,
    dealershipId: p.dealershipId,
    platformUserId: p.platformUserId,
  };
}
