import { invalidatePrefix } from "@/lib/infrastructure/cache/cacheHelpers";
import {
  crmPrefix,
  dashboardPrefix,
  inventoryPrefix,
  pipelinePrefix,
  reportsPrefix,
} from "@/lib/infrastructure/cache/cacheKeys";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";
import {
  generateAcquisitionSignals,
  generateCrmSignals,
  generateDealSignals,
  generateInventorySignals,
  generateOperationSignals,
  runSignalEngine,
} from "./signal-engine";

export type AnalyticsJobResult = {
  dealershipId: string;
  type: string;
  invalidatedPrefixes: string[];
  signalRuns: Record<string, unknown>;
  skippedReason?: string | null;
};

async function invalidate(prefixes: string[]): Promise<void> {
  await Promise.all(prefixes.map((prefix) => invalidatePrefix(prefix)));
}

export async function runAnalyticsJob(
  dealershipId: string,
  type: string,
  _context?: Record<string, unknown>
): Promise<AnalyticsJobResult> {
  await requireTenantActiveForWrite(dealershipId);

  switch (type) {
    case "inventory_dashboard":
    case "vin_stats": {
      const invalidatedPrefixes = [inventoryPrefix(dealershipId), dashboardPrefix(dealershipId)];
      await invalidate(invalidatedPrefixes);
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: {
          inventory: await generateInventorySignals(dealershipId),
          acquisition: await generateAcquisitionSignals(dealershipId),
        },
      };
    }
    case "sales_metrics": {
      const invalidatedPrefixes = [
        dashboardPrefix(dealershipId),
        pipelinePrefix(dealershipId),
        reportsPrefix(dealershipId),
      ];
      await invalidate(invalidatedPrefixes);
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: {
          deals: await generateDealSignals(dealershipId),
          operations: await generateOperationSignals(dealershipId),
        },
      };
    }
    case "customer_stats": {
      const invalidatedPrefixes = [dashboardPrefix(dealershipId), crmPrefix(dealershipId)];
      await invalidate(invalidatedPrefixes);
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: {
          crm: await generateCrmSignals(dealershipId),
        },
      };
    }
    case "alert_check": {
      const invalidatedPrefixes = [
        dashboardPrefix(dealershipId),
        inventoryPrefix(dealershipId),
        crmPrefix(dealershipId),
        pipelinePrefix(dealershipId),
        reportsPrefix(dealershipId),
      ];
      await invalidate(invalidatedPrefixes);
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: await runSignalEngine(dealershipId),
      };
    }
    default:
      return {
        dealershipId,
        type,
        invalidatedPrefixes: [],
        signalRuns: {},
        skippedReason: "unknown_type",
      };
  }
}

export async function runAlertJob(
  dealershipId: string,
  ruleId: string,
  triggeredAt: string
): Promise<AnalyticsJobResult> {
  const result = await runAnalyticsJob(dealershipId, "alert_check", {
    ruleId,
    triggeredAt,
  });
  return {
    ...result,
    type: "alert_check",
  };
}
