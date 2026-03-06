"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { VehicleForm } from "./VehicleForm";
import type { LocationOption } from "./types";
import type { VinDecodeResponse } from "./types";

export function CreateVehiclePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");

  const [locations, setLocations] = React.useState<LocationOption[]>([]);
  const [vinDecodeLoading, setVinDecodeLoading] = React.useState(false);
  const [vinDecodeError, setVinDecodeError] = React.useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ data: LocationOption[] }>("/api/admin/dealership/locations?limit=100")
      .then((res) => setLocations(res.data ?? []))
      .catch(() => setLocations([]));
  }, []);

  const handleVinDecode = React.useCallback(async (vin: string) => {
    setVinDecodeError(null);
    setVinDecodeLoading(true);
    try {
      const res = await apiFetch<VinDecodeResponse>("/api/inventory/vin-decode", {
        method: "POST",
        body: JSON.stringify({ vin }),
      });
      const d = res.data;
      if (d && (d.year != null || d.make || d.model || d.trim)) {
        addToast("success", "VIN decoded — year, make, model, trim filled in");
        return {
          year: d.year,
          make: d.make,
          model: d.model,
          trim: d.trim,
        };
      }
      return null;
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
        const res = await apiFetch<{ data: { id: string } }>("/api/inventory", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "Vehicle created");
        router.push(`/inventory/${res.data.id}`);
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to create vehicle");
      } finally {
        setSubmitLoading(false);
      }
    },
    [canWrite, router, addToast]
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

  if (!canWrite) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have permission to add vehicles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--text)]">Add vehicle</h1>
      <VehicleForm
        locations={locations}
        onSubmit={handleSubmit}
        submitLabel="Create vehicle"
        isLoading={submitLoading}
        onVinDecode={handleVinDecode}
        vinDecodeLoading={vinDecodeLoading}
        vinDecodeError={vinDecodeError}
      />
    </div>
  );
}
