/**
 * Queue name constants — shared between dealer producers and worker consumers.
 * Import from here to ensure naming consistency.
 */

export const QUEUE_VIN_DECODE = "vinDecode";
export const QUEUE_BULK_IMPORT = "bulkImport";
export const QUEUE_ANALYTICS = "analytics";
export const QUEUE_ALERTS = "alerts";

export type VinDecodeJobData = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
};

export type BulkImportJobData = {
  dealershipId: string;
  importId: string;
  rowCount: number;
  rows: Record<string, unknown>[];
};

export type AnalyticsJobData = {
  dealershipId: string;
  type: string;
  context?: Record<string, unknown>;
};

export type AlertJobData = {
  dealershipId: string;
  ruleId: string;
  triggeredAt: string;
};
