import { prisma } from "@/lib/db";
import type { PricingRuleType } from "@prisma/client";

export async function listPricingRules(dealershipId: string, enabledOnly?: boolean) {
  const where = enabledOnly
    ? { dealershipId, enabled: true }
    : { dealershipId };
  return prisma.pricingRule.findMany({
    where,
    orderBy: [{ ruleType: "asc" }, { daysInStock: "asc" }],
  });
}

export type PricingRuleCreateInput = {
  name: string;
  ruleType: PricingRuleType;
  daysInStock?: number | null;
  adjustmentPercent?: number | null;
  adjustmentCents?: number | null;
  enabled?: boolean;
};

export async function createPricingRule(dealershipId: string, data: PricingRuleCreateInput) {
  return prisma.pricingRule.create({
    data: {
      dealershipId,
      name: data.name,
      ruleType: data.ruleType,
      daysInStock: data.daysInStock ?? null,
      adjustmentPercent: data.adjustmentPercent ?? null,
      adjustmentCents: data.adjustmentCents ?? null,
      enabled: data.enabled ?? true,
    },
  });
}

export type PricingRuleUpdateInput = Partial<
  Omit<PricingRuleCreateInput, "name" | "ruleType">
>;

export async function updatePricingRule(dealershipId: string, id: string, data: PricingRuleUpdateInput) {
  const existing = await prisma.pricingRule.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.pricingRule.update({
    where: { id },
    data: {
      ...(data.daysInStock !== undefined && { daysInStock: data.daysInStock }),
      ...(data.adjustmentPercent !== undefined && { adjustmentPercent: data.adjustmentPercent }),
      ...(data.adjustmentCents !== undefined && { adjustmentCents: data.adjustmentCents }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}
