"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { VehicleForm } from "./VehicleForm";
import type { VehicleResponse, LocationOption } from "./types";

export function EditVehiclePage({ id }: { id: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("inventory.write");
  const canRead = hasPermission("inventory.read");

  const [vehicle, setVehicle] = React.useState<VehicleResponse | null>(null);
  const [locations, setLocations] = React.useState<LocationOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [vinDecodeLoading, setVinDecodeLoading] = React.useState(false);
  const [vinDecodeError, setVinDecodeError] = React.useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = React.useState(false);

  const fetchVehicle = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: VehicleResponse }>(`/api/inventory/${id}`);
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
  }, [id, canRead]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchVehicle();
  }, [canRead, id, fetchVehicle]);

  React.useEffect(() => {
    apiFetch<{ data: LocationOption[] }>("/api/admin/dealership/locations?limit=100")
      .then((res) => setLocations(res.data ?? []))
      .catch(() => setLocations([]));
  }, []);

  const handleVinDecode = React.useCallback(async (vin: string) => {
    setVinDecodeError(null);
    setVinDecodeLoading(true);
    try {
      const res = await apiFetch<{ data: { year?: number; make?: string; model?: string; trim?: string } }>(
        "/api/inventory/vin-decode",
        { method: "POST", body: JSON.stringify({ vin }) }
      );
      addToast("success", "VIN decoded");
      return res.data ?? null;
    } catch (e) {
      setVinDecodeError(e instanceof Error ? e.message : "VIN decode failed");
      return null;
    } finally {
      setVinDecodeLoading(false);
    }
  }, [addToast]);

  const handleSubmit = React.useCallback(
    async (body: Record<string, unknown>) => {
      if (!canWrite) return;
      setSubmitLoading(true);
      try {
        await apiFetch(`/api/inventory/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        addToast("success", "Vehicle updated");
        router.push(`/inventory/${id}`);
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to update vehicle");
      } finally {
        setSubmitLoading(false);
      }
    },
    [canWrite, id, router, addToast]
  );

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (notFound || error) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <ErrorState
          message={notFound ? "Vehicle not found." : error ?? undefined}
          onRetry={() => { setLoading(true); fetchVehicle(); }}
        />
      </div>
    );
  }

  if (!vehicle) return null;

  if (!canWrite) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have permission to edit this vehicle.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/inventory/${id}`} className="text-sm text-[var(--accent)] hover:underline">
          ← Back to vehicle
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--text)]">Edit vehicle</h1>
      <VehicleForm
        vehicle={vehicle}
        locations={locations}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
        isLoading={submitLoading}
        onVinDecode={handleVinDecode}
        vinDecodeLoading={vinDecodeLoading}
        vinDecodeError={vinDecodeError}
      />
    </div>
  );
}
