export interface DealershipResponse {
  id: string;
  name: string;
  slug?: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LocationResponse {
  id: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  dealershipId?: string;
}

export interface GetDealershipResponse {
  dealership: DealershipResponse;
  locations: LocationResponse[];
}

export interface LocationsListResponse {
  data: LocationResponse[];
  meta: { total: number; limit: number; offset: number };
}

export interface LocationCreateBody {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  isPrimary?: boolean;
}

export interface LocationUpdateBody {
  name?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isPrimary?: boolean;
}
