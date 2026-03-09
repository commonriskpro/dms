import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import * as subscriptionsService from "@/lib/service/subscriptions";
import * as subscriptionsDb from "@/lib/db/subscriptions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSubscriptionBodySchema = z.object({
  dealershipId: z.string().uuid(),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  billingStatus: z.enum(["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"]).optional(),
  billingProvider: z.string().max(64).optional().nullable(),
  billingCustomerId: z.string().max(255).optional().nullable(),
  billingSubscriptionId: z.string().max(255).optional().nullable(),
  currentPeriodEnd: z.string().optional().nullable(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  billingStatus: z.enum(["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }
    const parsed = createSubscriptionBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const existing = await prisma.platformSubscription.findUnique({
      where: { dealershipId: parsed.data.dealershipId },
    });
    if (existing) {
      return errorResponse("CONFLICT", "Dealership already has a subscription", 409);
    }

    const sub = await subscriptionsService.createSubscription(user.userId, {
      dealershipId: parsed.data.dealershipId,
      plan: parsed.data.plan,
      billingStatus: parsed.data.billingStatus,
      billingProvider: parsed.data.billingProvider,
      billingCustomerId: parsed.data.billingCustomerId,
      billingSubscriptionId: parsed.data.billingSubscriptionId,
      currentPeriodEnd: parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null,
    });

    return jsonResponse(
      {
        id: sub.id,
        dealershipId: sub.dealershipId,
        plan: sub.plan,
        billingStatus: sub.billingStatus,
        billingProvider: sub.billingProvider,
        billingCustomerId: sub.billingCustomerId,
        billingSubscriptionId: sub.billingSubscriptionId,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
      },
      201
    );
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      billingStatus: searchParams.get("billingStatus") ?? undefined,
    });

    const { data, total } = await subscriptionsDb.listSubscriptions({
      limit: query.limit,
      offset: query.offset,
      billingStatus: query.billingStatus,
    });

    return jsonResponse({
      data: data.map((s) => ({
        id: s.id,
        dealershipId: s.dealershipId,
        dealershipName: s.dealership.displayName,
        plan: s.plan,
        billingStatus: s.billingStatus,
        billingProvider: s.billingProvider,
        currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
