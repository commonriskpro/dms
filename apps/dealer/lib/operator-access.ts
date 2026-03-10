import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SUPPORT_SESSION_COOKIE, decryptSupportSessionPayload } from "@/lib/cookie";

export async function hasDealerOperatorAccess(request: NextRequest): Promise<boolean> {
  const secret = process.env.METRICS_SECRET;
  const authHeader = request.headers.get("Authorization");
  if (secret && authHeader === `Bearer ${secret}`) {
    return true;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(SUPPORT_SESSION_COOKIE)?.value;
  if (!raw) return false;

  const payload = decryptSupportSessionPayload(raw);
  return !!payload && new Date(payload.expiresAt) > new Date();
}
