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
  /** Server-loaded vehicle data; undefined when error. */
  initialData: VehicleDetailResponse | null;
  /** When "forbidden" | "not_found" | "invalid_id", show error in modal. */
  errorKind?: "forbidden" | "not_found" | "invalid_id" | null;
};

/**
 * Client wrapper for vehicle detail modal. Uses server-loaded initialData; only fetches photo signed URLs client-side.
 * Modal error pages: pass only error to ModalShell and omit children (per §7 ModalShell pattern).
 */
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
    if (initialData?.photos?.length) fetchPhotoUrls(initialData.photos);
  }, [initialData?.photos, fetchPhotoUrls]);

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
        mode="modal"
        canWrite={canWrite}
      />
    </ModalShell>
  );
}
