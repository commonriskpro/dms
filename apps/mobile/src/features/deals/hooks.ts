import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import type {
  DealDetail,
  DealListItem,
  CreateDealBody,
  UpdateDealBody,
  UpdateDealStatusBody,
  DealHistoryEntry,
} from "@/features/deals/types";

export const dealKeys = {
  all: ["deals"] as const,
  list: (params?: { limit?: number; offset?: number; status?: string; customerId?: string; vehicleId?: string }) =>
    ["deals", params ?? {}] as const,
  detail: (id: string) => ["deals", id] as const,
  history: (id: string, params?: { limit?: number; offset?: number }) =>
    ["deals", id, "history", params ?? {}] as const,
};

export function useDealsList(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  customerId?: string;
  vehicleId?: string;
  sortBy?: "createdAt" | "frontGrossCents" | "status" | "updatedAt";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["deals", { limit: params?.limit ?? 50, offset: params?.offset ?? 0, status: params?.status, customerId: params?.customerId, vehicleId: params?.vehicleId, sortBy: params?.sortBy, sortOrder: params?.sortOrder }],
    queryFn: (): Promise<{ data: DealListItem[]; meta: { total: number; limit: number; offset: number } }> =>
      api.listDeals({
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
        status: params?.status,
        customerId: params?.customerId,
        vehicleId: params?.vehicleId,
        sortBy: params?.sortBy,
        sortOrder: params?.sortOrder,
      }),
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: dealKeys.detail(id!),
    queryFn: (): Promise<{ data: DealDetail }> => api.getDealById(id!),
    enabled: Boolean(id),
  });
}

export function useDealHistory(id: string | undefined, params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: dealKeys.history(id!, params),
    queryFn: (): Promise<{ data: DealHistoryEntry[]; meta: { total: number; limit: number; offset: number } }> =>
      api.getDealHistory(id!, { limit: params?.limit ?? 50, offset: params?.offset ?? 0 }),
    enabled: Boolean(id),
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDealBody): Promise<{ data: DealDetail }> => api.createDeal(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useUpdateDeal(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDealBody): Promise<{ data: DealDetail }> => api.updateDeal(id!, body),
    onSuccess: (_, __, ___) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      if (id) queryClient.invalidateQueries({ queryKey: ["deals", id] });
    },
  });
}

export function useUpdateDealStatus(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDealStatusBody): Promise<{ data: DealDetail }> => api.updateDealStatus(id!, body),
    onSuccess: (_, __, ___) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      if (id) queryClient.invalidateQueries({ queryKey: ["deals", id] });
    },
  });
}
