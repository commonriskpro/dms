"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { WriteGuard } from "@/components/write-guard";
import { mainGrid, sectionStack } from "@/lib/ui/recipes/layout";
import { VehicleDetailContent } from "./VehicleDetailContent";
import type { VehicleDetailResponse } from "./types";

export type VehicleDetailPageProps = {
  vehicleId: string;
};

export function VehicleDetailPage({ vehicleId }: VehicleDetailPageProps) {
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
      <PageShell className={sectionStack}>
        <Skeleton className="h-8 w-48" />
        <div className={mainGrid}>
        <Skeleton className="h-64" />
          <Skeleton className="h-48" />
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
          onRetry={() => router.push("/inventory")}
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

  return (
    <PageShell className={sectionStack}>
      <PageHeader
        title={
          <div className="min-w-0">
            <Link
              href="/inventory"
              className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              ← Back to inventory
            </Link>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <WriteGuard>
                <Link href={`/inventory/${vehicleId}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <Link href={`/inventory/${vehicleId}/edit`}>
                  <Button variant="secondary">Upload Photos</Button>
                </Link>
                <Link href={`/deals/new?vehicleId=${vehicleId}`}>
                  <Button>Create Deal</Button>
                </Link>
              </WriteGuard>
            )}
          </div>
        }
      />

      <VehicleDetailContent
        vehicle={vehicle}
        photoUrls={photoUrls}
        vehicleId={vehicleId}
        mode="page"
        canWrite={canWrite}
      />
    </PageShell>
  );
}
