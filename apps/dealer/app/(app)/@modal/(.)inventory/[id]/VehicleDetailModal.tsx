"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { AppModal } from "@/components/ui/app-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { VehicleDetailContent } from "@/modules/inventory/ui/VehicleDetailContent";
import type { VehicleDetailResponse } from "@/modules/inventory/ui/types";
import { mainGrid } from "@/lib/ui/recipes/layout";

export type VehicleDetailModalProps = {
  vehicleId: string;
};

export function VehicleDetailModal({ vehicleId }: VehicleDetailModalProps) {
  const router = useRouter();
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");

  const [vehicle, setVehicle] = React.useState<VehicleDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});

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

  const fetchPhotoUrls = React.useCallback(
    async (photos: VehicleDetailResponse["photos"]) => {
      if (!canReadDocs || !photos?.length) return;
      const urls: Record<string, string> = {};
      await Promise.all(
        photos.map(async (p) => {
          try {
            const r = await apiFetch<{ url: string }>(
              `/api/files/signed-url?fileId=${encodeURIComponent(p.id)}`
            );
            urls[p.id] = r.url;
          } catch {
            // skip
          }
        })
      );
      setPhotoUrls((prev) => ({ ...prev, ...urls }));
    },
    [canReadDocs]
  );

  React.useEffect(() => {
    if (vehicle?.photos?.length) fetchPhotoUrls(vehicle.photos);
  }, [vehicle?.photos, fetchPhotoUrls]);

  const handleRequestClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/inventory");
    }
  };

  const titleText = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"
    : "Vehicle";

  const body =
    !canRead ? (
      <p className="text-sm text-[var(--muted-text)]">You don&apos;t have access to inventory.</p>
    ) : loading ? (
      <div className={mainGrid}>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    ) : notFound ? (
      <ErrorState
        title="Vehicle not found"
        message="It may have been deleted."
        onRetry={() => router.push("/inventory")}
      />
    ) : error || !vehicle ? (
      <ErrorState message={error ?? "Vehicle not found"} onRetry={fetchVehicle} />
    ) : (
      <VehicleDetailContent
        vehicle={vehicle}
        photoUrls={photoUrls}
        vehicleId={vehicleId}
        mode="modal"
        canWrite={canWrite}
      />
    );

  return (
    <AppModal
      open
      onOpenChange={() => {}}
      title={titleText}
      closeBehavior="back"
      onRequestClose={handleRequestClose}
      size="xl"
    >
      {body}
    </AppModal>
  );
}
