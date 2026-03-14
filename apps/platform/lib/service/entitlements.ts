import type { EntitlementsResponse } from "@dms/contracts";
import { prisma } from "@/lib/db";
import * as subscriptionsDb from "@/lib/db/subscriptions";

/** Default modules per plan (can be overridden by subscription.entitlements JSON). */
const DEFAULT_MODULES_BY_PLAN: Record<string, string[]> = {
  STARTER: ["dashboard", "inventory", "customers", "crm", "deals", "reports", "documents"],
  PRO: ["dashboard", "inventory", "customers", "crm", "deals", "reports", "documents", "finance", "accounting", "websites", "settings"],
  ENTERPRISE: ["dashboard", "inventory", "customers", "crm", "deals", "reports", "documents", "finance", "accounting", "websites", "settings", "admin"],
};

/**
 * Resolve entitlements for a platform dealership (subscription plan + entitlements JSON).
 * Returns modules array, maxSeats (null = unlimited), and optional features map.
 */
export async function getEntitlementsForPlatformDealership(
  platformDealershipId: string
): Promise<EntitlementsResponse> {
  const sub = await subscriptionsDb.getSubscriptionByDealershipId(platformDealershipId);
  const plan = sub?.plan ?? "STARTER";
  const defaultModules = DEFAULT_MODULES_BY_PLAN[plan] ?? DEFAULT_MODULES_BY_PLAN.STARTER;
  const entitlementsJson = (sub?.entitlements as { modules?: string[]; features?: Record<string, boolean> } | null) ?? {};
  const modules = Array.isArray(entitlementsJson.modules) ? entitlementsJson.modules : defaultModules;
  const features =
    typeof entitlementsJson.features === "object" && entitlementsJson.features !== null
      ? entitlementsJson.features
      : {};
  return {
    modules,
    maxSeats: sub?.maxSeats ?? null,
    features,
  };
}

/**
 * Resolve entitlements for a dealer dealership ID (used by dealer app calling platform internal API).
 * Looks up DealershipMapping to get platformDealershipId, then returns entitlements.
 */
export async function getEntitlementsForDealerDealershipId(
  dealerDealershipId: string
): Promise<EntitlementsResponse | null> {
  const mapping = await prisma.dealershipMapping.findUnique({
    where: { dealerDealershipId },
  });
  if (!mapping) return null;
  return getEntitlementsForPlatformDealership(mapping.platformDealershipId);
}
