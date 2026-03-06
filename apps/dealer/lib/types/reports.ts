/**
 * Types aligned to Reports API responses. Do not change without backend contract approval.
 * Money fields are string cents from API.
 */

export type SalesSummaryResponse = {
  data: {
    totalDealsCount: number;
    totalSaleVolumeCents: string;
    totalFrontGrossCents: string;
    averageFrontGrossCents: string;
    averageDaysToClose: number | null;
    breakdown?: {
      bySalesperson?: Array<{
        userId: string | null;
        displayName: string | null;
        dealCount: number;
        saleVolumeCents: string;
        frontGrossCents: string;
      }>;
      byLocation?: Array<{
        locationId: string | null;
        locationName: string | null;
        dealCount: number;
        saleVolumeCents: string;
        frontGrossCents: string;
      }>;
      byLeadSource?: Array<{
        leadSource: string | null;
        dealCount: number;
        saleVolumeCents: string;
        frontGrossCents: string;
      }>;
    };
  };
};

export type SalesByUserRow = {
  userId: string | null;
  displayName: string | null;
  dealCount: number;
  saleVolumeCents: string;
  frontGrossCents: string;
};

export type SalesByUserResponse = {
  data: SalesByUserRow[];
  meta: { total: number; limit: number; offset: number };
};

export type InventoryAgingResponse = {
  data: {
    byStatus: Array<{ status: string; count: number }>;
    averageDaysInInventory: number;
    agingBuckets: {
      bucket0_15: number;
      bucket16_30: number;
      bucket31_60: number;
      bucket61_90: number;
      bucket90Plus: number;
    };
    totalInventoryValueCents: string;
    totalListPriceCents?: string;
  };
};

export type FinancePenetrationResponse = {
  data: {
    contractedCount: number;
    financedCount: number;
    financePenetrationPercent: number;
    averageAprBps: number | null;
    averageTermMonths: number | null;
    totalProductsSoldCents: string;
    totalBackendGrossCents: string;
    productsPenetrationPercent: number;
  };
};

export type MixMode = "CASH" | "FINANCE" | "UNKNOWN";

export type MixResponse = {
  data: {
    byMode: Array<{
      financingMode: MixMode;
      dealCount: number;
      saleVolumeCents: string;
      frontGrossCents: string;
      averageGrossCents: string;
    }>;
  };
};

export type PipelineResponse = {
  data: {
    byStatus: Array<{ status: string; count: number }>;
    trend?: Array<{ period: string; contractedCount: number }>;
  };
};
