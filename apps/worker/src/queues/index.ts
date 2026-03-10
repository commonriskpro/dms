/**
 * Queue name constants — shared between dealer producers and worker consumers.
 * Import from here to ensure naming consistency.
 */

export const QUEUE_VIN_DECODE = "vinDecode";
export const QUEUE_BULK_IMPORT = "bulkImport";
export const QUEUE_ANALYTICS = "analytics";
export const QUEUE_ALERTS = "alerts";
export const QUEUE_CRM_EXECUTION = "crmExecution";

export type VinDecodeJobData = {
  dealershipId: string;
  vehicleId: string;
  vin: string;
};

export type BulkImportJobData = {
  dealershipId: string;
  importId: string;
  requestedByUserId: string;
  rowCount: number;
  rows: Array<{
    rowNumber: number;
    stockNumber: string;
    vin?: string;
    status?: string;
    salePriceCents?: number;
  }>;
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

export type CrmExecutionJobData = {
  dealershipId: string;
  source?: "manual" | "cron";
  triggeredByUserId?: string | null;
};
