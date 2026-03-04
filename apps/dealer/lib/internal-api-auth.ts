import { createSecretKey } from "node:crypto";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { INTERNAL_API_AUD, INTERNAL_API_ISS } from "@dms/contracts";

const JTI_TTL_MS = 120_000;

export class InternalApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 401
  ) {
    super(message);
    this.name = "InternalApiError";
  }
}

/**
 * Verifies service-to-service JWT and replay protection.
 * Throws InternalApiError on invalid/expired token or reused jti.
 */
export async function verifyInternalApiJwt(authorization: string | null): Promise<void> {
  const secret = process.env.INTERNAL_API_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new InternalApiError("CONFIG", "Internal API auth not configured", 500);
  }
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!bearer) {
    throw new InternalApiError("UNAUTHORIZED", "Missing or invalid Authorization", 401);
  }
  const key = createSecretKey(Buffer.from(secret, "utf8"));
  let payload: { aud?: string; iss?: string; jti?: string; exp?: number };
  try {
    const { payload: p } = await jwtVerify(bearer, key, {
      audience: INTERNAL_API_AUD,
      issuer: INTERNAL_API_ISS,
      clockTolerance: 10,
    });
    payload = p as typeof payload;
  } catch {
    throw new InternalApiError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
  const jti = payload.jti;
  if (!jti || typeof jti !== "string") {
    throw new InternalApiError("UNAUTHORIZED", "Missing jti", 401);
  }
  const expiresAt = new Date(Date.now() + JTI_TTL_MS);
  const existing = await prisma.internalApiJti.findUnique({ where: { jti } });
  if (existing) {
    if (existing.expiresAt > new Date()) {
      throw new InternalApiError("UNAUTHORIZED", "Replayed token", 401);
    }
    await prisma.internalApiJti.delete({ where: { jti } });
  }
  await prisma.internalApiJti.create({
    data: { jti, expiresAt },
  });
}
