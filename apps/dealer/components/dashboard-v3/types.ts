/**
 * Dashboard V3 data contract (server → client). Safe for serialization.
 */
export type DashboardV3Metrics = {
  inventoryCount: number;
  leadsCount: number;
  dealsCount: number;
  bhphCount: number;
  deltas?: {
    inventory?: number;
    leads?: number;
    deals?: number;
    bhph?: number;
  };
};

export type DashboardV3CustomerTasks = {
  appointments: number;
  newProspects: number;
  inbox: number;
  followUps: number;
  creditApps: number;
};

export type DashboardV3InventoryAlerts = {
  carsInRecon: number;
  pendingTasks: number;
  notPostedOnline: number;
  missingDocs: number;
  lowStock: number;
};

export type DashboardV3FloorplanLine = {
  name: string;
  utilizedCents: number;
  limitCents: number;
  statusLabel: string;
};

export type DashboardV3DealPipeline = {
  pendingDeals: number;
  submittedDeals: number;
  contractsToReview: number;
  fundingIssues: number;
};

export type DashboardV3Appointment = {
  id: string;
  name: string;
  meta: string;
  timeLabel: string;
};

export type DashboardV3FinanceNotice = {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  severity: "info" | "warning" | "error";
};

export type DashboardV3Data = {
  metrics: DashboardV3Metrics;
  customerTasks: DashboardV3CustomerTasks;
  inventoryAlerts: DashboardV3InventoryAlerts;
  floorplan: DashboardV3FloorplanLine[];
  dealPipeline: DashboardV3DealPipeline;
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

export const EMPTY_DASHBOARD_V3_DATA: DashboardV3Data = {
  metrics: { inventoryCount: 0, leadsCount: 0, dealsCount: 0, bhphCount: 0 },
  customerTasks: { appointments: 0, newProspects: 0, inbox: 0, followUps: 0, creditApps: 0 },
  inventoryAlerts: { carsInRecon: 0, pendingTasks: 0, notPostedOnline: 0, missingDocs: 0, lowStock: 0 },
  floorplan: [],
  dealPipeline: { pendingDeals: 0, submittedDeals: 0, contractsToReview: 0, fundingIssues: 0 },
  appointments: [],
  financeNotices: [],
};
