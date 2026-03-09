/**
 * Platform-issued support-session JWT for dealer app consume.
 * Short-lived; signed with INTERNAL_API_JWT_SECRET. Server-only.
 */

import * as jose from "jose";
import { INTERNAL_API_ISS, SUPPORT_SESSION_AUD } from "@dms/contracts";

const SUPPORT_SESSION_TTL_SEC = 2 * 60 * 60; // 2 hours

function getSecret(): Uint8Array {
  const secret = process.env.INTERNAL_API_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("INTERNAL_API_JWT_SECRET not set or too short");
  }
  return new TextEncoder().encode(secret);
}

export type SupportSessionPayload = {
  purpose: "support_session";
  dealershipId: string; // dealer Dealership.id
  platformUserId: string;
};

/**
 * Create a signed support-session JWT for the dealer app to consume.
 * dealershipId must be the dealer's Dealership.id (not platform dealership id).
 */
export async function createSupportSessionToken(
  payload: SupportSessionPayload
): Promise<string> {
  const secret = getSecret();
  return await new jose.SignJWT({
    purpose: payload.purpose,
    dealershipId: payload.dealershipId,
    platformUserId: payload.platformUserId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(SUPPORT_SESSION_AUD)
    .setIssuer(INTERNAL_API_ISS)
    .setExpirationTime(`${SUPPORT_SESSION_TTL_SEC}s`)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .sign(secret);
}
