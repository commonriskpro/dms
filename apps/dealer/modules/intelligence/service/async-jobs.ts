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
import { refreshVehicleValuationSnapshots } from "@/modules/inventory/service/valuation-engine";
import { refreshInventoryOverviewSummarySnapshot } from "@/modules/inventory/service/inventory-page";
import { refreshInventoryIntelligenceSummarySnapshot } from "@/modules/inventory/service/inventory-intelligence-dashboard";

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
    case "inventory_valuation_snapshot": {
      const rawVehicleIds = Array.isArray(_context?.vehicleIds)
        ? _context.vehicleIds
        : _context?.vehicleId
          ? [_context.vehicleId]
          : [];
      const vehicleIds = rawVehicleIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0
      );
      if (vehicleIds.length === 0) {
        return {
          dealershipId,
          type,
          invalidatedPrefixes: [],
          signalRuns: {},
          skippedReason: "missing_vehicle_ids",
        };
      }
      const refresh = await refreshVehicleValuationSnapshots(dealershipId, vehicleIds, 50);
      return {
        dealershipId,
        type,
        invalidatedPrefixes: [],
        signalRuns: {
          valuationSnapshot: refresh,
        },
      };
    }
    case "inventory_summary_snapshot": {
      const scope = String(_context?.scope ?? "").toLowerCase();
      const userId = typeof _context?.userId === "string" ? _context.userId : null;
      if (!userId) {
        return {
          dealershipId,
          type,
          invalidatedPrefixes: [],
          signalRuns: {},
          skippedReason: "missing_user_id",
        };
      }
      if (scope === "overview") {
        const hasPipeline = Boolean(_context?.hasPipeline);
        await refreshInventoryOverviewSummarySnapshot({
          dealershipId,
          userId,
          hasPipeline,
        });
        return {
          dealershipId,
          type,
          invalidatedPrefixes: [],
          signalRuns: {
            summarySnapshot: { scope: "overview", userId, hasPipeline, refreshed: true },
          },
        };
      }
      if (scope === "intelligence") {
        await refreshInventoryIntelligenceSummarySnapshot({
          dealershipId,
          userId,
        });
        return {
          dealershipId,
          type,
          invalidatedPrefixes: [],
          signalRuns: {
            summarySnapshot: { scope: "intelligence", userId, refreshed: true },
          },
        };
      }
      return {
        dealershipId,
        type,
        invalidatedPrefixes: [],
        signalRuns: {},
        skippedReason: "invalid_scope",
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
