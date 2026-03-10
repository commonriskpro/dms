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
  timingsMs?: {
    tenantCheck: number;
    invalidate: number;
    signals: number;
    total: number;
    signalByKey?: Record<string, number>;
  };
};

async function invalidate(prefixes: string[]): Promise<void> {
  await Promise.all(prefixes.map((prefix) => invalidatePrefix(prefix)));
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const startedAt = Date.now();
  const value = await fn();
  return {
    value,
    durationMs: Date.now() - startedAt,
  };
}

export async function runAnalyticsJob(
  dealershipId: string,
  type: string,
  _context?: Record<string, unknown>
): Promise<AnalyticsJobResult> {
  const totalStartedAt = Date.now();
  const tenantCheck = await timed(() => requireTenantActiveForWrite(dealershipId));

  switch (type) {
    case "inventory_dashboard":
    case "vin_stats": {
      const invalidatedPrefixes = [inventoryPrefix(dealershipId), dashboardPrefix(dealershipId)];
      const invalidateTimed = await timed(() => invalidate(invalidatedPrefixes));
      const signalsTimed = await timed(async () => {
        const [inventoryTimed, acquisitionTimed] = await Promise.all([
          timed(() => generateInventorySignals(dealershipId)),
          timed(() => generateAcquisitionSignals(dealershipId)),
        ]);
        return { inventoryTimed, acquisitionTimed };
      });
      const { inventoryTimed, acquisitionTimed } = signalsTimed.value;
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: {
          inventory: inventoryTimed.value,
          acquisition: acquisitionTimed.value,
        },
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: invalidateTimed.durationMs,
          signals: signalsTimed.durationMs,
          total: Date.now() - totalStartedAt,
          signalByKey: {
            inventory: inventoryTimed.durationMs,
            acquisition: acquisitionTimed.durationMs,
            ...(inventoryTimed.value.timingsMs
              ? {
                  "inventory.queryCounts": inventoryTimed.value.timingsMs.queryCounts,
                  "inventory.reconcile": inventoryTimed.value.timingsMs.reconcile,
                  "inventory.total": inventoryTimed.value.timingsMs.total,
                  ...(inventoryTimed.value.timingsMs.details ?? {}),
                }
              : {}),
            ...(acquisitionTimed.value.timingsMs
              ? {
                  "acquisition.queryCounts": acquisitionTimed.value.timingsMs.queryCounts,
                  "acquisition.reconcile": acquisitionTimed.value.timingsMs.reconcile,
                  "acquisition.total": acquisitionTimed.value.timingsMs.total,
                  ...(acquisitionTimed.value.timingsMs.details ?? {}),
                }
              : {}),
          },
        },
      };
    }
    case "sales_metrics": {
      const invalidatedPrefixes = [
        dashboardPrefix(dealershipId),
        pipelinePrefix(dealershipId),
        reportsPrefix(dealershipId),
      ];
      const invalidateTimed = await timed(() => invalidate(invalidatedPrefixes));
      const dealsTimed = await timed(() => generateDealSignals(dealershipId));
      const operationsTimed = await timed(() => generateOperationSignals(dealershipId));
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: {
          deals: dealsTimed.value,
          operations: operationsTimed.value,
        },
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: invalidateTimed.durationMs,
          signals: dealsTimed.durationMs + operationsTimed.durationMs,
          total: Date.now() - totalStartedAt,
          signalByKey: {
            deals: dealsTimed.durationMs,
            operations: operationsTimed.durationMs,
            ...(dealsTimed.value.timingsMs
              ? {
                  "deals.queryCounts": dealsTimed.value.timingsMs.queryCounts,
                  "deals.reconcile": dealsTimed.value.timingsMs.reconcile,
                  "deals.total": dealsTimed.value.timingsMs.total,
                  ...(dealsTimed.value.timingsMs.details ?? {}),
                }
              : {}),
            ...(operationsTimed.value.timingsMs
              ? {
                  "operations.queryCounts": operationsTimed.value.timingsMs.queryCounts,
                  "operations.reconcile": operationsTimed.value.timingsMs.reconcile,
                  "operations.total": operationsTimed.value.timingsMs.total,
                  ...(operationsTimed.value.timingsMs.details ?? {}),
                }
              : {}),
          },
        },
      };
    }
    case "customer_stats": {
      const invalidatedPrefixes = [dashboardPrefix(dealershipId), crmPrefix(dealershipId)];
      const invalidateTimed = await timed(() => invalidate(invalidatedPrefixes));
      const crmTimed = await timed(() => generateCrmSignals(dealershipId));
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: {
          crm: crmTimed.value,
        },
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: invalidateTimed.durationMs,
          signals: crmTimed.durationMs,
          total: Date.now() - totalStartedAt,
          signalByKey: {
            crm: crmTimed.durationMs,
            ...(crmTimed.value.timingsMs
              ? {
                  "crm.queryCounts": crmTimed.value.timingsMs.queryCounts,
                  "crm.reconcile": crmTimed.value.timingsMs.reconcile,
                  "crm.total": crmTimed.value.timingsMs.total,
                }
              : {}),
          },
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
      const invalidateTimed = await timed(() => invalidate(invalidatedPrefixes));
      const runSignalEngineTimed = await timed(() => runSignalEngine(dealershipId));
      return {
        dealershipId,
        type,
        invalidatedPrefixes,
        signalRuns: runSignalEngineTimed.value,
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: invalidateTimed.durationMs,
          signals: runSignalEngineTimed.durationMs,
          total: Date.now() - totalStartedAt,
          signalByKey: {
            all: runSignalEngineTimed.durationMs,
          },
        },
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
          timingsMs: {
            tenantCheck: tenantCheck.durationMs,
            invalidate: 0,
            signals: 0,
            total: Date.now() - totalStartedAt,
          },
        };
      }
      const refreshTimed = await timed(() =>
        refreshVehicleValuationSnapshots(dealershipId, vehicleIds, 50)
      );
      return {
        dealershipId,
        type,
        invalidatedPrefixes: [],
        signalRuns: {
          valuationSnapshot: refreshTimed.value,
        },
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: 0,
          signals: refreshTimed.durationMs,
          total: Date.now() - totalStartedAt,
          signalByKey: {
            valuationSnapshot: refreshTimed.durationMs,
          },
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
          timingsMs: {
            tenantCheck: tenantCheck.durationMs,
            invalidate: 0,
            signals: 0,
            total: Date.now() - totalStartedAt,
          },
        };
      }
      if (scope === "overview") {
        const hasPipeline = Boolean(_context?.hasPipeline);
        const refreshTimed = await timed(() =>
          refreshInventoryOverviewSummarySnapshot({
            dealershipId,
            userId,
            hasPipeline,
          })
        );
        return {
          dealershipId,
          type,
          invalidatedPrefixes: [],
          signalRuns: {
            summarySnapshot: { scope: "overview", userId, hasPipeline, refreshed: true },
          },
          timingsMs: {
            tenantCheck: tenantCheck.durationMs,
            invalidate: 0,
            signals: refreshTimed.durationMs,
            total: Date.now() - totalStartedAt,
            signalByKey: {
              summarySnapshot: refreshTimed.durationMs,
            },
          },
        };
      }
      if (scope === "intelligence") {
        const refreshTimed = await timed(() =>
          refreshInventoryIntelligenceSummarySnapshot({
            dealershipId,
            userId,
          })
        );
        return {
          dealershipId,
          type,
          invalidatedPrefixes: [],
          signalRuns: {
            summarySnapshot: { scope: "intelligence", userId, refreshed: true },
          },
          timingsMs: {
            tenantCheck: tenantCheck.durationMs,
            invalidate: 0,
            signals: refreshTimed.durationMs,
            total: Date.now() - totalStartedAt,
            signalByKey: {
              summarySnapshot: refreshTimed.durationMs,
            },
          },
        };
      }
      return {
        dealershipId,
        type,
        invalidatedPrefixes: [],
        signalRuns: {},
        skippedReason: "invalid_scope",
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: 0,
          signals: 0,
          total: Date.now() - totalStartedAt,
        },
      };
    }
    default:
      return {
        dealershipId,
        type,
        invalidatedPrefixes: [],
        signalRuns: {},
        skippedReason: "unknown_type",
        timingsMs: {
          tenantCheck: tenantCheck.durationMs,
          invalidate: 0,
          signals: 0,
          total: Date.now() - totalStartedAt,
        },
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
