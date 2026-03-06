import { dealerFetch } from "@/api/client";

export type MeResponse = {
  user: { id: string; email: string };
  dealership: { id: string; name?: string };
  permissions?: string[];
};

// Dashboard V3 Types
export type DashboardV3Metrics = {
  inventoryCount: number;
  inventoryDelta7d: number | null;
  inventoryDelta30d: number | null;
  leadsCount: number;
  leadsDelta7d: number | null;
  leadsDelta30d: number | null;
  dealsCount: number;
  dealsDelta7d: number | null;
  dealsDelta30d: number | null;
  bhphCount: number;
  bhphDelta7d: number | null;
  bhphDelta30d: number | null;
};

export type DashboardWidgetRow = {
  key: string;
  label: string;
  count: number;
  severity?: "info" | "success" | "warning" | "danger";
  href?: string;
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

export type DashboardV3Data = {
  dashboardGeneratedAt: string;
  metrics: DashboardV3Metrics;
  customerTasks: DashboardWidgetRow[];
  inventoryAlerts: DashboardWidgetRow[];
  dealPipeline: DashboardWidgetRow[];
  floorplan: Array<{
    name: string;
    utilizedCents: number;
    limitCents: number;
    statusLabel?: string;
  }>;
  appointments: DashboardV3Appointment[];
  financeNotices: DashboardV3FinanceNotice[];
};

export type DashboardV3Response = { data: DashboardV3Data };

export type ListMeta = { total: number; limit: number; offset: number };

export type InventoryItem = {
  id: string;
  dealershipId: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string;
  mileage: number | null;
  color: string | null;
  status: string;
  salePriceCents: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type InventoryListResponse = { data: InventoryItem[]; meta: ListMeta };

export type CustomerItem = {
  id: string;
  name: string;
  status: string;
  leadSource: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type CustomerListResponse = { data: CustomerItem[]; meta: ListMeta };

export type DealItem = {
  id: string;
  dealershipId: string;
  customerId: string;
  vehicleId: string;
  status: string;
  salePriceCents: string;
  totalDueCents: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type DealListResponse = { data: DealItem[]; meta: ListMeta };

export const api = {
  getMe(): Promise<MeResponse> {
    return dealerFetch<MeResponse>("/api/me");
  },

  getDashboardV3(): Promise<DashboardV3Response> {
    return dealerFetch<DashboardV3Response>("/api/dashboard/v3");
  },

  listInventory(params?: { limit?: number; offset?: number; search?: string; status?: string }): Promise<InventoryListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    const q = searchParams.toString();
    return dealerFetch<InventoryListResponse>(`/api/inventory${q ? `?${q}` : ""}`);
  },

  getInventoryById(id: string): Promise<{ data: InventoryItem & { photos?: { id: string; filename: string }[] } }> {
    return dealerFetch(`/api/inventory/${id}`);
  },

  listCustomers(params?: { limit?: number; offset?: number; search?: string }): Promise<CustomerListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    if (params?.search) searchParams.set("search", params.search);
    const q = searchParams.toString();
    return dealerFetch<CustomerListResponse>(`/api/customers${q ? `?${q}` : ""}`);
  },

  getCustomerById(id: string): Promise<{ data: CustomerItem & Record<string, unknown> }> {
    return dealerFetch(`/api/customers/${id}`);
  },

  listDeals(params?: { limit?: number; offset?: number; status?: string }): Promise<DealListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    if (params?.status) searchParams.set("status", params.status);
    const q = searchParams.toString();
    return dealerFetch<DealListResponse>(`/api/deals${q ? `?${q}` : ""}`);
  },

  getDealById(id: string): Promise<{ data: DealItem & Record<string, unknown> }> {
    return dealerFetch(`/api/deals/${id}`);
  },
};
