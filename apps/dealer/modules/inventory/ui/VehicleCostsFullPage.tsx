"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { VehiclePageHeader } from "./components/VehiclePageHeader";
import { VehicleDetailContent } from "./VehicleDetailContent";
import type { VehicleDetailResponse } from "./types";
import type { VehicleDetailTabId } from "./components/VehicleDetailTabs";

export type VehicleCostsFullPageProps = {
  vehicleId: string;
};

/**
 * Full-page Costs tab: header (back, thumbnail, name, VIN, status, Print, Edit, Edit Vehicle),
 * tab row with Costs active, then Acquisition Summary + Cost Totals + Cost Ledger + Documents
 * with margins and font sizes matching the design mock.
 */
export function VehicleCostsFullPage({ vehicleId }: VehicleCostsFullPageProps) {
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");

  const [vehicle, setVehicle] = React.useState<VehicleDetailResponse | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<VehicleDetailTabId>("costs");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const fetchVehicle = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: VehicleDetailResponse }>(
        `/api/inventory/${vehicleId}`
      );
      setVehicle(res.data);
      setError(null);
      setNotFound(false);
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 404) {
        setNotFound(true);
        setVehicle(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load vehicle");
      }
    } finally {
      setLoading(false);
    }
  }, [vehicleId, canRead]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchVehicle();
  }, [canRead, vehicleId, fetchVehicle]);

  const fetchThumbnail = React.useCallback(
    async (photoId: string) => {
      if (!canReadDocs) return;
      try {
        const r = await apiFetch<{ url: string }>(
          `/api/files/signed-url?fileId=${encodeURIComponent(photoId)}`
        );
        setThumbnailUrl(r.url);
      } catch {
        // ignore
      }
    },
    [canReadDocs]
  );

  React.useEffect(() => {
    const firstPhotoId = vehicle?.photos?.[0]?.id ?? vehicle?.photos?.find((p) => p.isPrimary)?.id;
    if (firstPhotoId) fetchThumbnail(firstPhotoId);
    else setThumbnailUrl(null);
  }, [vehicle?.photos, fetchThumbnail]);

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
        <div className="grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </div>
            <Skeleton className="h-72" />
          </div>
          <Skeleton className="min-h-[300px]" />
        </div>
      </PageShell>
    );
  }

  if (notFound) {
    return (
      <PageShell>
        <Link
          href="/inventory"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          ← Back to inventory
        </Link>
        <ErrorState
          title="Vehicle not found"
          message="It may have been deleted."
          onRetry={() => window.location.assign("/inventory")}
        />
      </PageShell>
    );
  }

  if (error || !vehicle) {
    return (
      <PageShell>
        <Link
          href="/inventory"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          ← Back to inventory
        </Link>
        <ErrorState message={error ?? "Vehicle not found"} onRetry={fetchVehicle} />
      </PageShell>
    );
  }

  const vehicleTitle =
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    vehicle.stockNumber ||
    "Vehicle";

  return (
    <PageShell className="flex flex-col gap-6">
      <VehiclePageHeader
        vehicleId={vehicleId}
        title={vehicleTitle}
        vin={vehicle.vin ?? null}
        status={vehicle.status ?? null}
        thumbnailUrl={thumbnailUrl}
        canWrite={canWrite}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <VehicleDetailContent
        vehicle={vehicle}
        photoUrls={{}}
        vehicleId={vehicleId}
        activeTab={activeTab}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
