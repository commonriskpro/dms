import { dealerFetch, dealerFetchPublic, dealerFetchFormData } from "@/api/client";

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

// Vehicle detail (GET /api/inventory/[id]) — includes photos, optional intelligence
export type VehiclePhoto = {
  id: string;
  fileObjectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
};
export type VehicleIntelligence = {
  priceToMarket?: { marketStatus?: string; marketDeltaCents?: number; marketDeltaPercent?: number; sourceLabel?: string };
  daysToTurn?: { daysInStock: number; agingBucket?: string; targetDays?: number; turnRiskStatus?: string };
};
export type VehicleDetail = InventoryItem & {
  photos?: VehiclePhoto[];
  intelligence?: VehicleIntelligence;
};
export type CreateVehicleBody = {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  stockNumber: string;
  mileage?: number;
  color?: string;
  status?: string;
  salePriceCents?: string | number;
};
export type UpdateVehicleBody = Partial<CreateVehicleBody>;

// VIN decode
export type VinDecodeVehicle = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  bodyStyle?: string;
  engine?: string;
  fuelType?: string;
  driveType?: string;
  transmission?: string;
};
export type VinDecodeResponse = {
  data: {
    vin: string;
    decoded: boolean;
    vehicle: VinDecodeVehicle;
    source?: string;
    cached?: boolean;
  };
};

// Recon
export type ReconLineItem = { id: string; description: string; costCents: number; category?: string | null; sortOrder?: number };
export type VehicleReconResponse = {
  data: {
    id: string;
    vehicleId: string;
    status: string;
    dueDate: string | null;
    totalCents: number;
    lineItems: ReconLineItem[];
  } | null;
};

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

// Customer detail (GET /api/customers/[id]) — backend returns phones[], emails[], assignedToProfile
export type CustomerPhone = { id?: string; kind?: string | null; value: string; isPrimary?: boolean };
export type CustomerEmail = { id?: string; kind?: string | null; value: string; isPrimary?: boolean };
export type AssignedToProfile = { id: string; fullName: string | null; email: string } | null;

export type CustomerDetail = {
  id: string;
  dealershipId: string;
  name: string;
  leadSource: string | null;
  status: string;
  assignedTo: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  tags?: string[];
  phones: CustomerPhone[];
  emails: CustomerEmail[];
  assignedToProfile: AssignedToProfile;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerBody = {
  name: string;
  leadSource?: string;
  status?: string;
  assignedTo?: string;
  phones?: { value: string; kind?: string | null; isPrimary?: boolean }[];
  emails?: { value: string; kind?: string | null; isPrimary?: boolean }[];
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  tags?: string[];
};

export type UpdateCustomerBody = Partial<CreateCustomerBody>;

// Notes
export type CustomerNote = {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  createdByProfile?: { id: string; fullName: string | null; email: string };
};
export type CustomerNotesListResponse = { data: CustomerNote[]; meta: ListMeta };

// Timeline
export type TimelineEventType = "NOTE" | "CALL" | "CALLBACK" | "APPOINTMENT" | "SYSTEM";
export type TimelineEvent = {
  type: TimelineEventType;
  createdAt: string;
  createdByUserId: string | null;
  payloadJson: Record<string, unknown>;
  sourceId: string;
};
export type TimelineListResponse = { data: TimelineEvent[]; meta: ListMeta };

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

// Invite (public and authenticated)
export type InviteResolveData = {
  inviteId: string;
  dealershipName: string;
  roleName: string;
  expiresAt?: string;
  emailMasked: string;
};
export type InviteResolveResponse = { data: InviteResolveData };

export type InviteAcceptData = {
  membershipId: string;
  dealershipId: string;
  alreadyHadMembership?: boolean;
};
export type InviteAcceptResponse = { data: InviteAcceptData };

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

  getInventoryById(id: string): Promise<{ data: VehicleDetail }> {
    return dealerFetch<{ data: VehicleDetail }>(`/api/inventory/${id}`);
  },

  createVehicle(body: CreateVehicleBody): Promise<{ data: VehicleDetail }> {
    const payload = {
      ...body,
      salePriceCents: body.salePriceCents != null ? String(body.salePriceCents) : undefined,
    };
    return dealerFetch<{ data: VehicleDetail }>("/api/inventory", { method: "POST", body: payload });
  },

  updateVehicle(id: string, body: UpdateVehicleBody): Promise<{ data: VehicleDetail }> {
    const payload = {
      ...body,
      salePriceCents: body.salePriceCents != null ? String(body.salePriceCents) : undefined,
    };
    return dealerFetch<{ data: VehicleDetail }>(`/api/inventory/${id}`, { method: "PATCH", body: payload });
  },

  decodeVin(vin: string): Promise<VinDecodeResponse> {
    return dealerFetch<VinDecodeResponse>("/api/inventory/vin-decode", { method: "POST", body: { vin } });
  },

  uploadVehiclePhoto(vehicleId: string, formData: FormData): Promise<{ data: VehiclePhoto }> {
    return dealerFetchFormData<{ data: VehiclePhoto }>(`/api/inventory/${vehicleId}/photos`, {
      method: "POST",
      body: formData,
    });
  },

  deleteVehiclePhoto(vehicleId: string, fileId: string): Promise<void> {
    return dealerFetch(`/api/inventory/${vehicleId}/photos/${fileId}`, { method: "DELETE" }) as Promise<void>;
  },

  getVehicleRecon(vehicleId: string): Promise<VehicleReconResponse> {
    return dealerFetch<VehicleReconResponse>(`/api/inventory/${vehicleId}/recon`);
  },

  getFileSignedUrl(fileId: string): Promise<{ url: string; expiresAt: string }> {
    return dealerFetch<{ url: string; expiresAt: string }>(`/api/files/signed-url?fileId=${encodeURIComponent(fileId)}`);
  },

  listCustomers(params?: { limit?: number; offset?: number; search?: string }): Promise<CustomerListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    if (params?.search) searchParams.set("search", params.search);
    const q = searchParams.toString();
    return dealerFetch<CustomerListResponse>(`/api/customers${q ? `?${q}` : ""}`);
  },

  getCustomerById(id: string): Promise<{ data: CustomerDetail }> {
    return dealerFetch<{ data: CustomerDetail }>(`/api/customers/${id}`);
  },

  createCustomer(body: CreateCustomerBody): Promise<{ data: CustomerDetail }> {
    return dealerFetch<{ data: CustomerDetail }>("/api/customers", { method: "POST", body });
  },

  updateCustomer(id: string, body: UpdateCustomerBody): Promise<{ data: CustomerDetail }> {
    return dealerFetch<{ data: CustomerDetail }>(`/api/customers/${id}`, { method: "PATCH", body });
  },

  listCustomerNotes(
    customerId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<CustomerNotesListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    const q = searchParams.toString();
    return dealerFetch<CustomerNotesListResponse>(`/api/customers/${customerId}/notes${q ? `?${q}` : ""}`);
  },

  createCustomerNote(customerId: string, body: { body: string }): Promise<{ data: CustomerNote }> {
    return dealerFetch<{ data: CustomerNote }>(`/api/customers/${customerId}/notes`, {
      method: "POST",
      body,
    });
  },

  listCustomerTimeline(
    customerId: string,
    params?: { limit?: number; offset?: number; type?: TimelineEventType }
  ): Promise<TimelineListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    if (params?.type) searchParams.set("type", params.type);
    const q = searchParams.toString();
    return dealerFetch<TimelineListResponse>(`/api/customers/${customerId}/timeline${q ? `?${q}` : ""}`);
  },

  listDeals(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    customerId?: string;
  }): Promise<DealListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    if (params?.offset != null) searchParams.set("offset", String(params.offset));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    const q = searchParams.toString();
    return dealerFetch<DealListResponse>(`/api/deals${q ? `?${q}` : ""}`);
  },

  getDealById(id: string): Promise<{ data: DealItem & Record<string, unknown> }> {
    return dealerFetch(`/api/deals/${id}`);
  },

  /** Public. Resolve invite by token (no auth). */
  inviteResolve(token: string): Promise<InviteResolveResponse> {
    const q = new URLSearchParams({ token }).toString();
    return dealerFetchPublic<InviteResolveResponse>(`/api/invite/resolve?${q}`);
  },

  /** Authenticated. Accept invite with current user. */
  inviteAccept(token: string): Promise<InviteAcceptResponse> {
    return dealerFetch<InviteAcceptResponse>("/api/invite/accept", {
      method: "POST",
      body: { token },
    });
  },

  /** Public. Accept invite with signup (token + email + password). */
  inviteAcceptSignup(body: {
    token: string;
    email: string;
    password: string;
    confirmPassword?: string;
    fullName?: string | null;
  }): Promise<InviteAcceptResponse> {
    return dealerFetchPublic<InviteAcceptResponse>("/api/invite/accept", {
      method: "POST",
      body,
    });
  },
};
