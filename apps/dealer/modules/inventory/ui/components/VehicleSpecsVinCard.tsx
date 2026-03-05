"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
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

function formatDecodedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function VehicleSpecsVinCard({
  vehicleId,
  vin: vehicleVin,
  className,
}: VehicleSpecsVinCardProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canDecode = hasPermission("inventory.write");

  const [state, setState] = React.useState<{
    loading: boolean;
    data: VinLatestResponse["data"] | null;
    error: string | null;
  }>({ loading: true, data: null, error: null });
  const [decoding, setDecoding] = React.useState(false);

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

  const handleDecode = async () => {
    if (!canDecode) return;
    setDecoding(true);
    try {
      await apiFetch<{ data: { decodeId: string; status: string } }>(
        `/api/inventory/${vehicleId}/vin/decode`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
      addToast("success", "VIN decode started. Data will update shortly.");
      await fetchVin();
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      const msg = getApiErrorMessage(e);
      if (status === 429) {
        addToast("warning", "Too many VIN decode requests. Please try again later.");
      } else {
        addToast("error", msg);
      }
    } finally {
      setDecoding(false);
    }
  };

  const vin = state.data?.vin ?? vehicleVin ?? null;
  const decoded = state.data?.decoded ?? null;

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DMSCardTitle className={typography.cardTitle}>Specs / VIN</DMSCardTitle>
          {canDecode && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDecode}
              disabled={decoding || !vin}
              aria-label="Decode VIN"
            >
              {decoding ? "Decoding…" : "Decode"}
            </Button>
          )}
        </div>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {state.loading ? (
          <Skeleton className="h-24 w-full" aria-hidden />
        ) : state.error ? (
          <p className="text-sm text-[var(--danger)]">{state.error}</p>
        ) : (
          <>
            {vin && (
              <p className="text-sm text-[var(--muted-text)] mb-2">
                <span className="font-medium text-[var(--text)]">VIN</span> {vin}
              </p>
            )}
            {decoded ? (
              <>
                {decoded.decodedAt && (
                  <p className="text-xs text-[var(--text-soft)] mb-3">
                    Last decoded at {formatDecodedAt(decoded.decodedAt)}
                  </p>
                )}
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
