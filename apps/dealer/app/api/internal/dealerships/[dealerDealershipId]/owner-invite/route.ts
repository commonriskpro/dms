import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { prisma } from "@/lib/db";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import * as roleDb from "@/modules/core-platform/db/role";
import { auditLog } from "@/lib/audit";
import {
  dealerOwnerInviteRequestSchema,
  type DealerOwnerInviteResponse,
} from "@dms/contracts";

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
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError) return err(e.code, e.message, e.status);
    throw e;
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) {
    return err("VALIDATION_ERROR", "Idempotency-Key header required (1-255 chars)", 422);
  }

  const { dealerDealershipId } = await params;
  if (!dealerDealershipId) {
    return err("VALIDATION_ERROR", "Missing dealerDealershipId", 422);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("VALIDATION_ERROR", "Invalid JSON body", 422);
  }

  const parsed = dealerOwnerInviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 }
    );
  }

  const { email, platformDealershipId, platformActorId } = parsed.data;
  const baseUrl = getDealerAppBaseUrl(request);

  const existingIdempotency = await prisma.ownerInviteIdempotency.findUnique({
    where: { idempotencyKey },
    include: { dealership: { select: { id: true } } },
  });
  if (existingIdempotency) {
    if (existingIdempotency.dealerDealershipId !== dealerDealershipId) {
      return err("CONFLICT", "Idempotency key already used for another dealership", 409);
    }
    const invite = await inviteDb.getInviteById(existingIdempotency.inviteId);
    if (!invite) return err("INTERNAL", "Stale idempotency", 500);
    const response: DealerOwnerInviteResponse = {
      inviteId: invite.id,
      invitedEmail: invite.email,
      createdAt: invite.createdAt.toISOString(),
      acceptUrl: buildAcceptUrl(baseUrl, invite.token),
    };
    return Response.json(response, { status: 200 });
  }

  const ownerRole = await roleDb.getRoleByName(dealerDealershipId, "Owner");
  if (!ownerRole) {
    return err("NOT_FOUND", "Owner role not found for this dealership", 404);
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
    return Response.json(response, { status: 201 });
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
  return Response.json(response, { status: 201 });
}
