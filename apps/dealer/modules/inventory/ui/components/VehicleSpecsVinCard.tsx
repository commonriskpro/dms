"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Skeleton } from "@/components/ui/skeleton";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { VinLatestResponse } from "../types";

export type VehicleSpecsVinCardProps = {
  vehicleId: string;
  /** VIN from vehicle (may be null). */
  vin: string | null;
  className?: string;
};

export function VehicleSpecsVinCard({
  vehicleId,
  vin: vehicleVin,
  className,
}: VehicleSpecsVinCardProps) {
  const [state, setState] = React.useState<{
    loading: boolean;
    data: VinLatestResponse["data"] | null;
    error: string | null;
  }>({ loading: true, data: null, error: null });

  const fetchVin = React.useCallback(async () => {
    try {
      const res = await apiFetch<VinLatestResponse>(
        `/api/inventory/${vehicleId}/vin?latestOnly=true`
      );
      setState({ loading: false, data: res.data, error: null });
    } catch (e) {
      setState({
        loading: false,
        data: null,
        error: getApiErrorMessage(e),
      });
    }
  }, [vehicleId]);

  React.useEffect(() => {
    fetchVin();
  }, [fetchVin]);

  const vin = state.data?.vin ?? vehicleVin ?? null;
  const decoded = state.data?.decoded ?? null;

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>Specs / VIN</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {state.loading ? (
          <Skeleton className="h-24 w-full" aria-hidden />
        ) : state.error ? (
          <p className="text-sm text-[var(--danger)]">{state.error}</p>
        ) : (
          <>
            {decoded ? (
              <>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    ["Year", decoded.year],
                    ["Make", decoded.make],
                    ["Model", decoded.model],
                    ["Trim", decoded.trim],
                    ["Body style", decoded.bodyStyle],
                    ["Engine", decoded.engine],
                    ["Drivetrain", decoded.drivetrain],
                    ["Transmission", decoded.transmission],
                    ["Fuel type", decoded.fuelType],
                    ["Manufactured in", decoded.manufacturedIn],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className={typography.muted}>{label}</dt>
                      <dd className="text-sm text-[var(--text)]">
                        {value != null && value !== "" ? String(value) : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm text-[var(--text-soft)]">
                {vin
                  ? "No decode data yet. Use Decode to fetch specs from VIN."
                  : "No VIN on file. Add a VIN in Edit vehicle to decode."}
              </p>
            )}
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
