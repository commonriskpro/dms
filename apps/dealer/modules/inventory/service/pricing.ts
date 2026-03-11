/**
 * Pricing rules and apply/preview. Age-based first; never negative; preview before apply; audit on apply.
 */
import * as pricingRuleDb from "../db/pricing-rule";
import * as vehicleDb from "../db/vehicle";
import * as vehicleMarketValuationDb from "../db/vehicle-market-valuation";
import { computeDaysInStock } from "./price-to-market";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type PricingRuleCreateInput = pricingRuleDb.PricingRuleCreateInput;
export type PricingRuleUpdateInput = pricingRuleDb.PricingRuleUpdateInput;

export async function listPricingRules(dealershipId: string, enabledOnly?: boolean) {
  await requireTenantActiveForRead(dealershipId);
  return pricingRuleDb.listPricingRules(dealershipId, enabledOnly);
}

export async function createPricingRule(dealershipId: string, data: pricingRuleDb.PricingRuleCreateInput) {
  await requireTenantActiveForWrite(dealershipId);
  return pricingRuleDb.createPricingRule(dealershipId, data);
}

export async function updatePricingRule(dealershipId: string, id: string, data: pricingRuleDb.PricingRuleUpdateInput) {
  await requireTenantActiveForWrite(dealershipId);
  const updated = await pricingRuleDb.updatePricingRule(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Pricing rule not found");
  return updated;
}

/** Preview price adjustment for a vehicle (rules applied in order: age-based first). Does not persist. */
export async function previewVehiclePriceAdjustment(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const rules = await pricingRuleDb.listPricingRules(dealershipId, true);
  const daysInStock = computeDaysInStock(vehicle.createdAt);
  let currentCents = Number(vehicle.salePriceCents);
  const steps: { ruleName: string; ruleType: string; adjustmentCents: number; newPriceCents: number }[] = [];

  const sortedRules = [...rules].sort((a, b) => {
    if (a.ruleType === "AGE_BASED" && b.ruleType !== "AGE_BASED") return -1;
    if (a.ruleType !== "AGE_BASED" && b.ruleType === "AGE_BASED") return 1;
    return (a.daysInStock ?? 0) - (b.daysInStock ?? 0);
  });

  for (const rule of sortedRules) {
    if (!rule.enabled) continue;
    let applies = false;
    if (rule.ruleType === "AGE_BASED" && rule.daysInStock != null && daysInStock != null) {
      applies = daysInStock >= rule.daysInStock;
    } else if (rule.ruleType === "MARKET_BASED" || rule.ruleType === "CLEARANCE") {
      applies = true;
    }
    if (!applies) continue;

    let delta = 0;
    if (rule.adjustmentPercent != null) delta += Math.round(currentCents * (rule.adjustmentPercent / 100));
    if (rule.adjustmentCents != null) delta += rule.adjustmentCents;
    const newPriceCents = Math.max(0, currentCents + delta);
    steps.push({
      ruleName: rule.name,
      ruleType: rule.ruleType,
      adjustmentCents: delta,
      newPriceCents,
    });
    currentCents = newPriceCents;
  }

  return {
    vehicleId,
    currentPriceCents: Number(vehicle.salePriceCents),
    suggestedPriceCents: currentCents,
    steps,
  };
}

/** Apply suggested price from preview (same logic), persist and audit. */
export async function applyVehiclePriceAdjustment(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const preview = await previewVehiclePriceAdjustment(dealershipId, vehicleId);
  const newPriceCents = BigInt(preview.suggestedPriceCents);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const previousCents = vehicle.salePriceCents;
  if (newPriceCents === previousCents) return { vehicle, preview };

  await vehicleDb.updateVehicle(dealershipId, vehicleId, { salePriceCents: newPriceCents });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle.pricing_applied",
    entity: "Vehicle",
    entityId: vehicleId,
    metadata: {
      vehicleId,
      previousPriceCents: previousCents.toString(),
      newPriceCents: newPriceCents.toString(),
      steps: preview.steps.length,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  const updated = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  return { vehicle: updated, preview };
}
