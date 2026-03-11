"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { PageShell } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  ActivityTimeline,
  SignalContextBlock,
  SignalHeaderBadgeGroup,
  TimelineItem,
  type SignalSurfaceItem,
} from "@/components/ui-system";
import { VehiclePageHeader } from "./components/VehiclePageHeader";
import { VehicleDetailContent } from "./VehicleDetailContent";
import type { VehicleDetailResponse } from "./types";
import type { VehicleDetailTabId } from "./components/VehicleDetailTabs";
import {
  fetchSignalsByDomains,
  toContextSignals,
  toHeaderSignals,
  toSignalKeys,
} from "@/modules/intelligence/ui/surface-adapters";
import { toTimelineSignalEvents } from "@/modules/intelligence/ui/timeline-adapters";

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
  const [activeTab, setActiveTab] = React.useState<VehicleDetailTabId>("overview");
  const [surfaceSignals, setSurfaceSignals] = React.useState<SignalSurfaceItem[]>([]);

  const fetchVehicle = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: VehicleDetailResponse }>(`/api/inventory/${vehicleId}`);
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
            const r = await apiFetch<{ url: string }>(`/api/files/signed-url?fileId=${encodeURIComponent(p.id)}`);
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

  React.useEffect(() => {
    let mounted = true;
    fetchSignalsByDomains(["inventory", "acquisition"], {
      includeResolved: true,
      limit: 40,
    })
      .then((signals) => {
        if (!mounted) return;
        setSurfaceSignals(signals);
      })
      .catch(() => {
        if (!mounted) return;
        setSurfaceSignals([]);
      });
    return () => {
      mounted = false;
    };
  }, [vehicleId]);

  const entityScope = React.useMemo(() => ({ entityType: "Vehicle", entityId: vehicleId }), [vehicleId]);
  const headerSignals = React.useMemo(
    () => toHeaderSignals(surfaceSignals, { maxVisible: 3, entity: entityScope }),
    [surfaceSignals, entityScope]
  );
  const contextSignals = React.useMemo(
    () =>
      toContextSignals(surfaceSignals, {
        maxVisible: 5,
        entity: entityScope,
        suppressKeys: toSignalKeys(headerSignals),
      }),
    [surfaceSignals, entityScope, headerSignals]
  );
  const timelineSignalEvents = React.useMemo(
    () => toTimelineSignalEvents(surfaceSignals, { maxVisible: 8, entity: entityScope }),
    [surfaceSignals, entityScope]
  );

  if (!canRead) {
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14" className="flex flex-col gap-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--text-soft)]">You don&apos;t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14" className="flex flex-col gap-4 min-[1800px]:gap-5">
        <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.82fr)]">
          <Skeleton className="h-96 rounded-[var(--radius-card)]" />
          <Skeleton className="h-80 rounded-[var(--radius-card)]" />
        </div>
      </PageShell>
    );
  }

  if (notFound) {
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14" className="flex flex-col gap-4">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          ← Back to inventory
        </Link>
        <ErrorState title="Vehicle not found" message="It may have been deleted." onRetry={() => router.push("/inventory")} />
      </PageShell>
    );
  }

  if (error || !vehicle) {
    return (
      <PageShell fullWidth contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14" className="flex flex-col gap-4">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          ← Back to inventory
        </Link>
        <ErrorState message={error ?? "Vehicle not found"} onRetry={fetchVehicle} />
      </PageShell>
    );
  }

  const vehicleTitle = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.stockNumber || "Vehicle";
  const thumbnailUrl = vehicle.photos?.[0]?.id ? photoUrls[vehicle.photos[0].id] ?? null : null;

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
      className="flex flex-col gap-4 min-[1800px]:gap-5"
    >
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

      <SignalHeaderBadgeGroup items={headerSignals} />

      <VehicleDetailContent
        vehicle={vehicle}
        photoUrls={photoUrls}
        vehicleId={vehicleId}
        activeTab={activeTab}
        canWrite={canWrite}
        onPhotosChange={fetchVehicle}
        signalRailTop={<SignalContextBlock title="Vehicle intelligence" items={contextSignals} />}
        signalTimeline={
          <ActivityTimeline
            title="Intelligence timeline"
            emptyTitle="No intelligence events"
            emptyDescription="Signal lifecycle events for this vehicle appear here."
          >
            {timelineSignalEvents.map((event) => (
              <TimelineItem
                key={event.id}
                title={event.title}
                timestamp={event.timestamp}
                detail={event.detail}
              />
            ))}
          </ActivityTimeline>
        }
      />
    </PageShell>
  );
}
