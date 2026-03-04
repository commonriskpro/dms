import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import { jsonResponse } from "@/lib/api/handler";

const MAX_EMAIL_LENGTH = 320;

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealerDealershipId: string }> }
) {
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError) return err(e.code, e.message, e.status);
    throw e;
  }

  const { dealerDealershipId } = await params;
  const email = request.nextUrl.searchParams.get("email");
  if (!dealerDealershipId || !email || email.length > MAX_EMAIL_LENGTH) {
    return err("VALIDATION_ERROR", "dealershipId and email (max 320 chars) required", 422);
  }

  const invite = await inviteDb.getLatestOwnerInviteByDealershipAndEmail(
    dealerDealershipId,
    email
  );
  if (!invite) {
    return jsonResponse({
      status: "PENDING" as const,
      expiresAt: null,
      acceptedAt: null,
    });
  }

  return jsonResponse({
    status: invite.status,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
  });
}
