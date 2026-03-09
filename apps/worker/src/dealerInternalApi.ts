import { randomUUID } from "node:crypto";
import * as jose from "jose";
import { INTERNAL_API_AUD, INTERNAL_API_ISS } from "@dms/contracts";

const JWT_TTL_SEC = 90;

function getBaseUrl(): string {
  const url = process.env.DEALER_INTERNAL_API_URL;
  if (!url?.startsWith("http")) {
    throw new Error("DEALER_INTERNAL_API_URL not set or invalid");
  }
  return url.replace(/\/$/, "");
}

function getSecret(): Uint8Array {
  const secret = process.env.INTERNAL_API_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("INTERNAL_API_JWT_SECRET not set or too short");
  }
  return new TextEncoder().encode(secret);
}

async function createToken(jti: string): Promise<string> {
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(INTERNAL_API_AUD)
    .setIssuer(INTERNAL_API_ISS)
    .setJti(jti)
    .setExpirationTime(`${JWT_TTL_SEC}s`)
    .sign(getSecret());
}

export async function postDealerInternalJob<TResponse>(
  path: string,
  body: unknown
): Promise<TResponse> {
  const jti = `worker-${path.replace(/[^a-z0-9]+/gi, "-")}-${randomUUID()}`;
  const token = await createToken(jti);
  const requestId = randomUUID();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => ({}))) as {
    data?: TResponse;
    error?: { message?: string; code?: string };
  };

  if (!response.ok) {
    throw new Error(
      `[worker/internal] ${path} failed with ${response.status}: ${json.error?.message ?? response.statusText}`
    );
  }

  if (json.data === undefined) {
    throw new Error(`[worker/internal] ${path} returned no data payload`);
  }

  return json.data;
}
