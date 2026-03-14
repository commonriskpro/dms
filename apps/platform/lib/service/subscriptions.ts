import type { SubscriptionPlan, BillingStatus } from "../../../node_modules/.prisma/platform-client";
import * as subscriptionsDb from "@/lib/db/subscriptions";
import { platformAuditLog } from "@/lib/audit";

const PLAN_KEY_TO_SUBSCRIPTION_PLAN: Record<string, SubscriptionPlan> = {
  starter: "STARTER",
  standard: "STARTER",
  pro: "PRO",
  enterprise: "ENTERPRISE",
};

/**
 * Ensure a subscription exists for the platform dealership (e.g. after provision).
 * Creates one with default plan from planKey if missing. Idempotent.
 */
export async function ensureSubscriptionForDealership(
  actorPlatformUserId: string,
  platformDealershipId: string,
  planKey: string
) {
  const existing = await subscriptionsDb.getSubscriptionByDealershipId(platformDealershipId);
  if (existing) return existing;
  const plan = PLAN_KEY_TO_SUBSCRIPTION_PLAN[planKey.toLowerCase()] ?? "STARTER";
  return createSubscription(actorPlatformUserId, {
    dealershipId: platformDealershipId,
    plan,
    billingStatus: "ACTIVE",
  });
}

export async function createSubscription(
  actorPlatformUserId: string,
  data: {
    dealershipId: string;
    plan: SubscriptionPlan;
    billingStatus?: BillingStatus;
    billingProvider?: string | null;
    billingCustomerId?: string | null;
    billingSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }
) {
  const sub = await subscriptionsDb.createSubscription({
    dealershipId: data.dealershipId,
    plan: data.plan,
    billingStatus: data.billingStatus ?? "ACTIVE",
    billingProvider: data.billingProvider,
    billingCustomerId: data.billingCustomerId,
    billingSubscriptionId: data.billingSubscriptionId,
    currentPeriodEnd: data.currentPeriodEnd,
  });
  await platformAuditLog({
    actorPlatformUserId,
    action: "platform.subscription_created",
    targetType: "subscription",
    targetId: sub.id,
    afterState: { dealershipId: data.dealershipId, plan: data.plan, billingStatus: sub.billingStatus },
  });
  return sub;
}

export async function updateSubscriptionStatus(
  actorPlatformUserId: string,
  id: string,
  data: {
    plan?: SubscriptionPlan;
    billingStatus?: BillingStatus;
    currentPeriodEnd?: Date | null;
    billingProvider?: string | null;
    billingCustomerId?: string | null;
    billingSubscriptionId?: string | null;
    maxSeats?: number | null;
    entitlements?: Record<string, unknown> | null;
  }
) {
  const before = await subscriptionsDb.getSubscriptionById(id);
  if (!before) return null;
  const updated = await subscriptionsDb.updateSubscription(id, data);
  await platformAuditLog({
    actorPlatformUserId,
    action: "platform.subscription_changed",
    targetType: "subscription",
    targetId: id,
    beforeState: { plan: before.plan, billingStatus: before.billingStatus, maxSeats: before.maxSeats },
    afterState: { plan: updated.plan, billingStatus: updated.billingStatus, maxSeats: updated.maxSeats },
  });
  return updated;
}

export async function getPlatformStats() {
  const { prisma } = await import("@/lib/db");
  const [
    totalDealerships,
    activeDealerships,
    totalSubscriptions,
    activeSubscriptions,
    trialSubscriptions,
  ] = await Promise.all([
    prisma.platformDealership.count(),
    prisma.platformDealership.count({
      where: { status: { in: ["ACTIVE", "PROVISIONED"] } },
    }),
    prisma.platformSubscription.count(),
    prisma.platformSubscription.count({ where: { billingStatus: "ACTIVE" } }),
    prisma.platformSubscription.count({ where: { billingStatus: "TRIAL" } }),
  ]);
  const planPrices: Record<string, number> = { STARTER: 99, PRO: 299, ENTERPRISE: 799 };
  const revenueResult = await prisma.platformSubscription.aggregate({
    where: { billingStatus: "ACTIVE" },
    _count: true,
  });
  const activeWithPlan = await prisma.platformSubscription.groupBy({
    by: ["plan"],
    where: { billingStatus: "ACTIVE" },
    _count: true,
  });
  let monthlyRevenueEstimate = 0;
  for (const g of activeWithPlan) {
    monthlyRevenueEstimate += (planPrices[g.plan] ?? 0) * g._count;
  }
  return {
    totalDealerships,
    activeDealerships,
    totalSubscriptions,
    activeSubscriptions,
    trialSubscriptions,
    monthlyRevenueEstimate,
  };
}
