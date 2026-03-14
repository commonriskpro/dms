import { prisma } from "@/lib/db";
import type { Prisma } from "../../../node_modules/.prisma/platform-client";
import type { SubscriptionPlan, BillingStatus } from "../../../node_modules/.prisma/platform-client";

export async function createSubscription(data: {
  dealershipId: string;
  plan: SubscriptionPlan;
  billingStatus?: BillingStatus;
  billingProvider?: string | null;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  maxSeats?: number | null;
  entitlements?: Record<string, unknown> | null;
}) {
  return prisma.platformSubscription.create({
    data: {
      dealershipId: data.dealershipId,
      plan: data.plan,
      billingStatus: data.billingStatus ?? "ACTIVE",
      billingProvider: data.billingProvider ?? undefined,
      billingCustomerId: data.billingCustomerId ?? undefined,
      billingSubscriptionId: data.billingSubscriptionId ?? undefined,
      currentPeriodEnd: data.currentPeriodEnd ?? undefined,
      maxSeats: data.maxSeats ?? undefined,
      entitlements: (data.entitlements ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    include: { dealership: { select: { id: true, displayName: true } } },
  });
}

export async function getSubscriptionById(id: string) {
  return prisma.platformSubscription.findUnique({
    where: { id },
    include: { dealership: true },
  });
}

export async function getSubscriptionByDealershipId(platformDealershipId: string) {
  return prisma.platformSubscription.findUnique({
    where: { dealershipId: platformDealershipId },
    include: { dealership: { select: { id: true, displayName: true } } },
  });
}

export async function updateSubscription(
  id: string,
  data: {
    plan?: SubscriptionPlan;
    billingStatus?: BillingStatus;
    billingProvider?: string | null;
    billingCustomerId?: string | null;
    billingSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
    maxSeats?: number | null;
    entitlements?: Record<string, unknown> | null;
  }
) {
  const { entitlements, ...rest } = data;
  return prisma.platformSubscription.update({
    where: { id },
    data: {
      ...rest,
      ...(entitlements !== undefined && { entitlements: entitlements as Prisma.InputJsonValue }),
    },
    include: { dealership: { select: { id: true, displayName: true } } },
  });
}

export async function listSubscriptions(options: {
  limit: number;
  offset: number;
  billingStatus?: BillingStatus;
}) {
  const { limit, offset, billingStatus } = options;
  const where = billingStatus ? { billingStatus } : {};
  const [data, total] = await Promise.all([
    prisma.platformSubscription.findMany({
      where,
      include: { dealership: { select: { id: true, displayName: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.platformSubscription.count({ where }),
  ]);
  return { data, total };
}
