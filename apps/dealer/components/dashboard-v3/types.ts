/**
 * Dashboard V3 data contract (server → client). Safe for serialization.
 */

/** Per-widget layout item (serializable, passed from server). */
export type DashboardLayoutItem = {
  widgetId: string;
  zone: "topRow" | "main";
  order: number;
  visible: boolean;
  title: string;
  description?: string;
  hideable?: boolean;
  fixed?: boolean;
};

export type WidgetRow = {
  key: string;
  label: string;
  count: number;
  severity?: "info" | "success" | "warning" | "danger";
  href?: string;
};

type DashboardV3Metrics = {
  inventoryCount: number;
  inventoryDelta7d: number | null;
  inventoryDelta30d: number | null;
  inventoryTrend: number[];
  leadsCount: number;
  leadsDelta7d: number | null;
  leadsDelta30d: number | null;
  leadsTrend: number[];
  dealsCount: number;
  dealsDelta7d: number | null;
  dealsDelta30d: number | null;
  dealsTrend: number[];
  grossProfitCents: number;
  grossProfitDelta7dCents: number | null;
  grossProfitDelta30dCents: number | null;
  grossProfitTrend: number[];
  frontGrossProfitCents: number;
  frontGrossProfitDelta7dCents: number | null;
  frontGrossProfitTrend: number[];
  backGrossProfitCents: number;
  backGrossProfitDelta7dCents: number | null;
  backGrossProfitTrend: number[];
  bhphCount: number;
  bhphDelta7d: number | null;
  bhphDelta30d: number | null;
  bhphTrend: number[];
  opsTrend: number[];
};

export type DashboardV3FloorplanLine = {
  name: string;
  utilizedCents: number;
  limitCents: number;
  statusLabel?: string;
};

export type DashboardV3Appointment = {
  id: string;
  name: string;
  meta?: string;
  timeLabel?: string;
};

export type DashboardV3FinanceNotice = {
  id: string;
  title: string;
  subtitle?: string;
  dateLabel?: string;
  severity: "info" | "success" | "warning" | "danger";
};

export type DealStageCounts = {
  draft: number;
  structured: number;
  approved: number;
  contracted: number;
  funded: number;
};

export type DashboardV3OpsQueues = {
  titleQueueCount: number;
  titleQueueOldestAgeDays: number | null;
  deliveryQueueCount: number;
  deliveryQueueOldestAgeDays: number | null;
  fundingQueueCount: number;
  fundingQueueOldestAgeDays: number | null;
};

export type DashboardV3MaterialChange = {
  id: string;
  domain: "inventory" | "deals" | "customers";
  title: string;
  detail: string;
  severity: "info" | "success" | "warning" | "danger";
  actorLabel?: string;
  timestamp: string;
  href: string;
};

export type DashboardV3SalesManager = {
  topCloserName: string | null;
  topCloserDealsClosed: number;
  topGrossRepName: string | null;
  topGrossRepCents: number;
  averageGrossPerDealCents: number;
  rankedRepCount: number;
  staleLeadCount: number;
  oldestStaleLeadAgeDays: number | null;
  overdueFollowUpCount: number;
  appointmentsSetToday: number;
  callbacksScheduledToday: number;
  rangeLabel: string;
};

export type DashboardV3Data = {
  dashboardGeneratedAt: string;
  metrics: DashboardV3Metrics;
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  floorplan: DashboardV3FloorplanLine[];
  dealPipeline: WidgetRow[];
  dealStageCounts?: DealStageCounts;
  opsQueues: DashboardV3OpsQueues;
  materialChanges: DashboardV3MaterialChange[];
  salesManager: DashboardV3SalesManager;
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

const emptyMetrics: DashboardV3Metrics = {
  inventoryCount: 0,
  inventoryDelta7d: null,
  inventoryDelta30d: null,
  inventoryTrend: [],
  leadsCount: 0,
  leadsDelta7d: null,
  leadsDelta30d: null,
  leadsTrend: [],
  dealsCount: 0,
  dealsDelta7d: null,
  dealsDelta30d: null,
  dealsTrend: [],
  grossProfitCents: 0,
  grossProfitDelta7dCents: null,
  grossProfitDelta30dCents: null,
  grossProfitTrend: [],
  frontGrossProfitCents: 0,
  frontGrossProfitDelta7dCents: null,
  frontGrossProfitTrend: [],
  backGrossProfitCents: 0,
  backGrossProfitDelta7dCents: null,
  backGrossProfitTrend: [],
  bhphCount: 0,
  bhphDelta7d: null,
  bhphDelta30d: null,
  bhphTrend: [],
  opsTrend: [],
};

export const EMPTY_DASHBOARD_V3_DATA: DashboardV3Data = {
  dashboardGeneratedAt: new Date().toISOString(),
  metrics: emptyMetrics,
  customerTasks: [],
  inventoryAlerts: [],
  floorplan: [],
  dealPipeline: [],
  opsQueues: {
    titleQueueCount: 0,
    titleQueueOldestAgeDays: null,
    deliveryQueueCount: 0,
    deliveryQueueOldestAgeDays: null,
    fundingQueueCount: 0,
    fundingQueueOldestAgeDays: null,
  },
  materialChanges: [],
  salesManager: {
    topCloserName: null,
    topCloserDealsClosed: 0,
    topGrossRepName: null,
    topGrossRepCents: 0,
    averageGrossPerDealCents: 0,
    rankedRepCount: 0,
    staleLeadCount: 0,
    oldestStaleLeadAgeDays: null,
    overdueFollowUpCount: 0,
    appointmentsSetToday: 0,
    callbacksScheduledToday: 0,
    rangeLabel: "Last 30 days",
  },
  appointments: [],
  financeNotices: [],
};
