import { dealerFetch } from "@/api/client";

export type MeResponse = {
  user: { id: string; email: string };
  dealership: { id: string; name?: string };
  permissions?: string[];
};

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
