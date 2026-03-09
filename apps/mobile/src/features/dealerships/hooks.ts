import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import type { MeDealershipsResponse, MeCurrentDealershipGetResponse, MeCurrentDealershipPostResponse } from "@/features/dealerships/types";

export const dealershipKeys = {
  list: ["me", "dealerships"] as const,
  current: ["me", "current-dealership"] as const,
};

/**
 * List of dealerships the current user is a member of, with role and isActive.
 */
export function useDealerships() {
  return useQuery({
    queryKey: dealershipKeys.list,
    queryFn: (): Promise<MeDealershipsResponse> => api.getDealerships(),
  });
}

/**
 * Current active dealership and membership metadata, or null.
 */
export function useCurrentDealership() {
  return useQuery({
    queryKey: dealershipKeys.current,
    queryFn: (): Promise<MeCurrentDealershipGetResponse> => api.getCurrentDealership(),
  });
}

/** Invalidate all dealership-scoped queries after switching. */
function invalidateDealershipScopedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["customers"] });
  queryClient.invalidateQueries({ queryKey: ["inventory"] });
  queryClient.invalidateQueries({ queryKey: ["deals"] });
  queryClient.invalidateQueries({ queryKey: ["crm"] });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
  queryClient.invalidateQueries({ queryKey: ["me"] });
  queryClient.invalidateQueries({ queryKey: dealershipKeys.list });
  queryClient.invalidateQueries({ queryKey: dealershipKeys.current });
}

/**
 * Switch active dealership. On success invalidates dashboard, customers, inventory, deals, crm, reports, and me.
 */
export function useSwitchDealership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dealershipId: string): Promise<MeCurrentDealershipPostResponse> =>
      api.switchDealership(dealershipId),
    onSuccess: () => {
      invalidateDealershipScopedQueries(queryClient);
    },
  });
}
