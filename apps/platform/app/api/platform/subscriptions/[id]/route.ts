import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import * as subscriptionsService from "@/lib/service/subscriptions";

export const dynamic = "force-dynamic";

const patchSubscriptionBodySchema = z.object({
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]).optional(),
  billingStatus: z.enum(["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"]).optional(),
  currentPeriodEnd: z.string().optional().nullable(),
  billingProvider: z.string().max(64).optional().nullable(),
  billingCustomerId: z.string().max(255).optional().nullable(),
  billingSubscriptionId: z.string().max(255).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }
    const parsed = patchSubscriptionBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const payload: {
      plan?: "STARTER" | "PRO" | "ENTERPRISE";
      billingStatus?: "ACTIVE" | "TRIAL" | "PAST_DUE" | "CANCELLED";
      currentPeriodEnd?: Date | null;
      billingProvider?: string | null;
      billingCustomerId?: string | null;
      billingSubscriptionId?: string | null;
    } = {};
    if (parsed.data.plan !== undefined) payload.plan = parsed.data.plan;
    if (parsed.data.billingStatus !== undefined) payload.billingStatus = parsed.data.billingStatus;
    if (parsed.data.currentPeriodEnd !== undefined) {
      payload.currentPeriodEnd = parsed.data.currentPeriodEnd ? new Date(parsed.data.currentPeriodEnd) : null;
    }
    if (parsed.data.billingProvider !== undefined) payload.billingProvider = parsed.data.billingProvider;
    if (parsed.data.billingCustomerId !== undefined) payload.billingCustomerId = parsed.data.billingCustomerId;
    if (parsed.data.billingSubscriptionId !== undefined) payload.billingSubscriptionId = parsed.data.billingSubscriptionId;

    const updated = await subscriptionsService.updateSubscriptionStatus(user.userId, id, payload);
    if (!updated) {
      return errorResponse("NOT_FOUND", "Subscription not found", 404);
    }

    return jsonResponse({
      id: updated.id,
      dealershipId: updated.dealershipId,
      plan: updated.plan,
      billingStatus: updated.billingStatus,
      billingProvider: updated.billingProvider,
      billingCustomerId: updated.billingCustomerId,
      billingSubscriptionId: updated.billingSubscriptionId,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
