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

export type DashboardV3Data = {
  dashboardGeneratedAt: string;
  metrics: DashboardV3Metrics;
  customerTasks: WidgetRow[];
  inventoryAlerts: WidgetRow[];
  floorplan: DashboardV3FloorplanLine[];
  dealPipeline: WidgetRow[];
  dealStageCounts?: DealStageCounts;
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
  appointments: [],
  financeNotices: [],
};
