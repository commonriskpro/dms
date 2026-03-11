"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { ModalShell } from "@/components/modal/ModalShell";
import { VehicleDetailContent } from "@/modules/inventory/ui/VehicleDetailContent";
import type { VehicleDetailResponse } from "@/modules/inventory/ui/types";

export type VehicleDetailModalClientProps = {
  vehicleId: string;
  initialData: VehicleDetailResponse | null;
  errorKind?: "forbidden" | "not_found" | "invalid_id" | null;
};

export function VehicleDetailModalClient({
  vehicleId,
  initialData,
  errorKind = null,
}: VehicleDetailModalClientProps) {
  const router = useRouter();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});

  const fetchPhotoUrls = React.useCallback(
    async (photos: VehicleDetailResponse["photos"]) => {
      if (!canReadDocs || !photos?.length) return;
      const urls: Record<string, string> = {};
      await Promise.all(
        photos.map(async (photo) => {
          try {
            const response = await apiFetch<{ url: string }>(
              `/api/files/signed-url?fileId=${encodeURIComponent(photo.id)}`
            );
            urls[photo.id] = response.url;
          } catch {
            // Keep modal usable even when photo preview loading fails.
          }
        })
      );
      setPhotoUrls((prev) => ({ ...prev, ...urls }));
    },
    [canReadDocs]
  );

  React.useEffect(() => {
    if (initialData?.photos?.length) {
      fetchPhotoUrls(initialData.photos);
    }
  }, [fetchPhotoUrls, initialData?.photos]);

  const title =
    initialData &&
    [initialData.year, initialData.make, initialData.model].filter(Boolean).join(" ");
  const titleText = (title && title.trim()) || "Vehicle";

  if (errorKind === "forbidden") {
    return (
      <ModalShell
        title="Vehicle"
        error={{
          title: "Access denied",
          message: "You don't have access to inventory.",
        }}
      />
    );
  }

  if (errorKind === "not_found" || errorKind === "invalid_id") {
    return (
      <ModalShell
        title="Vehicle"
        error={{
          title: "Vehicle not found",
          message: errorKind === "invalid_id" ? "Invalid vehicle ID." : "It may have been deleted.",
          onRetry: () => router.push("/inventory"),
        }}
      />
    );
  }

  if (!initialData) {
    return <ModalShell title="Vehicle" loading />;
  }

  return (
    <ModalShell title={titleText}>
      <VehicleDetailContent
        vehicle={initialData}
        photoUrls={photoUrls}
        vehicleId={vehicleId}
        activeTab="overview"
        canWrite={canWrite}
      />
    </ModalShell>
  );
}

