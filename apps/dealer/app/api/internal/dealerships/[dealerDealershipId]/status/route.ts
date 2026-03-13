import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { setDealershipStatusRequestSchema } from "@dms/contracts";
import { readSanitizedJson } from "@/lib/api/handler";

function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    { error: { code, message } },
    { status }
  );
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ dealerDealershipId: string }> }
) {
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authHeader = request.headers.get("authorization");
  try {
    await verifyInternalApiJwt(authHeader);
  } catch (e) {
    if (e instanceof InternalApiError) {
      return errorResponse(e.code, e.message, e.status);
    }
    throw e;
  }

  const { dealerDealershipId } = await ctx.params;
  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
  }
  const parsed = setDealershipStatusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten() } },
      { status: 422 }
    );
  }
  const { status, reason, platformActorId } = parsed.data;

  const dealership = await prisma.dealership.findUnique({
    where: { id: dealerDealershipId },
    select: { id: true, lifecycleStatus: true },
  });
  if (!dealership) {
    return errorResponse("NOT_FOUND", "Dealership not found", 404);
  }

  const beforeStatus = dealership.lifecycleStatus;
  await prisma.dealership.update({
    where: { id: dealerDealershipId },
    data: { lifecycleStatus: status, updatedAt: new Date() },
  });

  await auditLog({
    dealershipId: dealerDealershipId,
    actorUserId: null,
    action: "platform.status.set",
    entity: "Dealership",
    entityId: dealerDealershipId,
    metadata: { beforeStatus, afterStatus: status, reason: reason ?? undefined, platformActorId: platformActorId ?? undefined },
  });

  return Response.json({ ok: true as const }, { status: 200 });
}
