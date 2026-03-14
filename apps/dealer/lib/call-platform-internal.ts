import * as jose from "jose";
import { INTERNAL_API_AUD, INTERNAL_API_ISS, type DealerApplicationSyncPayload } from "@dms/contracts";

function getBaseUrl(): string {
  const url =
    process.env.PLATFORM_INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_PLATFORM_ORIGIN ??
    "http://localhost:3001";
  if (!url.startsWith("http")) {
    throw new Error("PLATFORM_INTERNAL_API_URL not set or invalid");
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
    .setExpirationTime("90s")
    .sign(getSecret());
}

export async function syncPlatformDealerApplication(
  payload: DealerApplicationSyncPayload
): Promise<
  | { ok: true; data: { id: string; dealerApplicationId: string; status: string; updatedAt: string } }
  | { ok: false; error: { status: number; code: string; message: string } }
> {
  const base = getBaseUrl();
  const token = await createToken(`dealer-app-sync-${payload.dealerApplicationId}-${Date.now()}`);
  const response = await fetch(`${base}/api/internal/dealer-applications/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: {
        status: response.status,
        code: (json.error as { code?: string })?.code ?? "UNKNOWN",
        message: (json.error as { message?: string })?.message ?? response.statusText,
      },
    };
  }
  return {
    ok: true,
    data: json as { id: string; dealerApplicationId: string; status: string; updatedAt: string },
  };
}
