/**
 * Types aligned with backend GET/POST /api/me/dealerships and /api/me/current-dealership.
 * See apps/dealer/lib/types/me.ts for source of truth.
 */

export type MeDealershipItem = {
  dealershipId: string;
  dealershipName: string;
  roleKey: string | null;
  roleName: string;
  isActive: boolean;
};

export type MeDealershipsResponse = {
  data: { dealerships: MeDealershipItem[] };
};

export type MeCurrentDealershipPayload = {
  dealershipId: string;
  dealershipName: string;
  roleKey: string | null;
  roleName: string;
};

export type MeCurrentDealershipGetResponse = {
  data: MeCurrentDealershipPayload | null;
  availableCount?: number;
};

export type MeCurrentDealershipPostResponse = {
  data: MeCurrentDealershipPayload;
};
