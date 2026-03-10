/**
 * DMS Worker — Background job processor.
 * Starts all BullMQ workers. Requires REDIS_URL environment variable.
 *
 * Usage:
 *   REDIS_URL=redis://localhost:6379 npm run dev  (development)
 *   REDIS_URL=redis://... npm start               (production)
 */

import { createVinDecodeWorker } from "./workers/vinDecode.worker";
import { createBulkImportWorker } from "./workers/bulkImport.worker";
import { createAnalyticsWorker } from "./workers/analytics.worker";
import { createAlertsWorker } from "./workers/alerts.worker";
import { createCrmExecutionWorker } from "./workers/crmExecution.worker";

console.log("[worker] Starting DMS worker process...");

const workers = [
  createVinDecodeWorker(),
  createBulkImportWorker(),
  createAnalyticsWorker(),
  createAlertsWorker(),
  createCrmExecutionWorker(),
];

console.log(`[worker] ${workers.length} workers started`);
console.log("[worker] Listening for jobs... (Ctrl+C to stop)");

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[worker] Received ${signal}, shutting down gracefully...`);
  await Promise.all(workers.map((w) => w.close()));
  console.log("[worker] All workers closed. Goodbye.");
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
