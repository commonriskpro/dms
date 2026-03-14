/**
 * Next.js instrumentation hook.
 * Runs once per Node.js worker process on startup.
 * Initializes: Sentry, Prometheus metrics registry, event bus listeners.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Initialize Prometheus registry (registers metrics and default process metrics)
    await import("@/lib/infrastructure/metrics/prometheus");

    // Register cache invalidation listeners
    const { registerCacheInvalidationListeners } = await import(
      "@/lib/infrastructure/cache/cacheInvalidation"
    );
    registerCacheInvalidationListeners();

    // Wire event bus → job producers (analytics pipeline)
    const { registerListener } = await import("@/lib/infrastructure/events/eventBus");
    const { enqueueAnalytics } = await import("@/lib/infrastructure/jobs/enqueueAnalytics");

    registerListener("vehicle.created", ({ dealershipId, vehicleId }) => {
      void enqueueAnalytics({ dealershipId, type: "inventory_dashboard", context: { vehicleId } });
      void enqueueAnalytics({
        dealershipId,
        type: "inventory_valuation_snapshot",
        context: { vehicleIds: [vehicleId] },
      });
    });

    registerListener("vehicle.updated", ({ dealershipId, vehicleId }) => {
      void enqueueAnalytics({
        dealershipId,
        type: "inventory_valuation_snapshot",
        context: { vehicleIds: [vehicleId] },
      });
    });

    registerListener("vehicle.vin_decoded", ({ dealershipId, vin }) => {
      void enqueueAnalytics({ dealershipId, type: "vin_stats", context: { vin } });
    });

    registerListener("deal.sold", ({ dealershipId, dealId, amount }) => {
      void enqueueAnalytics({ dealershipId, type: "sales_metrics", context: { dealId, amount } });
    });

    registerListener("analytics.requested", ({ dealershipId, type, context }) => {
      void enqueueAnalytics({ dealershipId, type, context: context as Record<string, unknown> | undefined });
    });

    // Register CRM automation engine (customer.created, opportunity.*, etc.)
    const { ensureAutomationHandlersRegistered } = await import(
      "@/modules/crm-pipeline-automation/service/automation-engine"
    );
    ensureAutomationHandlersRegistered();

    // Register in-app notifications listeners (dealer web + mobile API consumers)
    const notificationsService = await import("@/modules/notifications/service/notifications");

    registerListener("deal.sold", ({ dealershipId, dealId }) => {
      void notificationsService.createForActiveMembers(dealershipId, {
        kind: "deal.sold",
        title: "Deal sold",
        body: "A deal was moved to sold.",
        entityType: "Deal",
        entityId: dealId,
      });
    });

    registerListener("vehicle.created", ({ dealershipId, vehicleId }) => {
      void notificationsService.createForActiveMembers(dealershipId, {
        kind: "vehicle.created",
        title: "New vehicle added",
        body: "A vehicle was added to inventory.",
        entityType: "Vehicle",
        entityId: vehicleId,
      });
    });

    registerListener("vehicle.vin_decoded", ({ dealershipId, vehicleId, vin, source }) => {
      void notificationsService.createForActiveMembers(dealershipId, {
        kind: "vehicle.vin_decoded",
        title: "VIN decoded",
        body: `VIN ${vin} was decoded.`,
        entityType: "Vehicle",
        entityId: vehicleId,
        metadata: { source },
      });
    });

    registerListener("customer.created", ({ dealershipId, customerId }) => {
      void notificationsService.createForActiveMembers(dealershipId, {
        kind: "customer.created",
        title: "New customer created",
        body: "A new customer record was created.",
        entityType: "Customer",
        entityId: customerId,
      });
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
