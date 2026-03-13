import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { prisma } from "@/lib/db";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import * as roleDb from "@/modules/core-platform/db/role";
import { auditLog } from "@/lib/audit";
import { readSanitizedJson } from "@/lib/api/handler";
import {
  dealerOwnerInviteRequestSchema,
  type DealerOwnerInviteRequest,
  type DealerOwnerInviteResponse,
} from "@dms/contracts";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";

const REQUEST_ID_HEADER = "x-request-id";
const paramsSchema = z.object({ dealerDealershipId: z.string().uuid() });

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

function getDealerAppBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function buildAcceptUrl(baseUrl: string, token: string | null): string | undefined {
  return token ? `${baseUrl}/accept-invite?token=${token}` : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealerDealershipId: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return addRequestIdToResponse(rateLimitRes, requestId);

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError)
      return addRequestIdToResponse(err(e.code, e.message, e.status), requestId);
    throw e;
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Idempotency-Key header required (1-255 chars)", 422),
      requestId
    );
  }

  const paramsResult = paramsSchema.safeParse(await params);
  if (!paramsResult.success) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Invalid dealerDealershipId (must be UUID)", 422),
      requestId
    );
  }
  const { dealerDealershipId } = paramsResult.data;

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return addRequestIdToResponse(err("VALIDATION_ERROR", "Invalid JSON body", 422), requestId);
  }

  const parsed = dealerOwnerInviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return addRequestIdToResponse(
      Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parsed.error.flatten(),
          },
        },
        { status: 422 }
      ),
      requestId
    );
  }

  const { email, platformDealershipId, platformActorId, dealerApplicationId } =
    parsed.data as DealerOwnerInviteRequest;
  const baseUrl = getDealerAppBaseUrl(request);

  const existingIdempotency = await prisma.ownerInviteIdempotency.findUnique({
    where: { idempotencyKey },
    include: { dealership: { select: { id: true } } },
  });
  if (existingIdempotency) {
    if (existingIdempotency.dealerDealershipId !== dealerDealershipId) {
      return addRequestIdToResponse(
        err("CONFLICT", "Idempotency key already used for another dealership", 409),
        requestId
      );
    }
    const invite = await inviteDb.getInviteById(existingIdempotency.inviteId);
    if (!invite)
      return addRequestIdToResponse(err("INTERNAL", "Stale idempotency", 500), requestId);
    const response: DealerOwnerInviteResponse = {
      inviteId: invite.id,
      invitedEmail: invite.email,
      createdAt: invite.createdAt.toISOString(),
      acceptUrl: buildAcceptUrl(baseUrl, invite.token),
    };
    return addRequestIdToResponse(Response.json(response, { status: 200 }), requestId);
  }

  const ownerRole = await roleDb.getRoleByName(dealerDealershipId, "Owner");
  if (!ownerRole) {
    return addRequestIdToResponse(
      err("NOT_FOUND", "Owner role not found for this dealership", 404),
      requestId
    );
  }

  const existingPending = await inviteDb.findPendingInviteByDealershipAndEmail(
    dealerDealershipId,
    email
  );
  if (existingPending) {
    await prisma.ownerInviteIdempotency.create({
      data: {
        idempotencyKey,
        dealerDealershipId,
        inviteId: existingPending.id,
      },
    });
    const response: DealerOwnerInviteResponse = {
      inviteId: existingPending.id,
      invitedEmail: existingPending.email,
      createdAt: existingPending.createdAt.toISOString(),
      acceptUrl: buildAcceptUrl(baseUrl, existingPending.token),
    };
    await auditLog({
      dealershipId: dealerDealershipId,
      actorUserId: null,
      action: "platform.owner_invite.created",
      entity: "DealershipInvite",
      entityId: existingPending.id,
      metadata: {
        inviteId: existingPending.id,
        platformDealershipId,
        platformActorId,
        idempotencyKey,
      },
    });
    return addRequestIdToResponse(Response.json(response, { status: 201 }), requestId);
  }

  const token = inviteDb.generateInviteToken();
  const invite = await inviteDb.createInvite({
    dealershipId: dealerDealershipId,
    email: email.toLowerCase(),
    roleId: ownerRole.id,
    status: "PENDING",
    expiresAt: null,
    createdBy: null,
    token,
    dealerApplicationId: dealerApplicationId ?? null,
  });

  await prisma.ownerInviteIdempotency.create({
    data: {
      idempotencyKey,
      dealerDealershipId,
      inviteId: invite.id,
    },
  });

  await auditLog({
    dealershipId: dealerDealershipId,
    actorUserId: null,
    action: "platform.owner_invite.created",
    entity: "DealershipInvite",
    entityId: invite.id,
    metadata: {
      inviteId: invite.id,
      platformDealershipId,
      platformActorId,
      idempotencyKey,
    },
  });

  const response: DealerOwnerInviteResponse = {
    inviteId: invite.id,
    invitedEmail: invite.email,
    createdAt: invite.createdAt.toISOString(),
    acceptUrl: buildAcceptUrl(baseUrl, invite.token),
  };
  return addRequestIdToResponse(Response.json(response, { status: 201 }), requestId);
}
