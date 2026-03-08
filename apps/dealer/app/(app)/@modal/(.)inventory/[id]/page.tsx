import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import { toVehicleResponse } from "@/modules/inventory/api-response";
import { VehicleDetailModalClient } from "./VehicleDetailModalClient";
import type { VehicleDetailResponse } from "@/modules/inventory/ui/types";
import { ApiError } from "@/lib/auth";

const idSchema = z.string().uuid();

/** Slugs that are static page routes, not vehicle IDs — skip the modal for these. */
const RESERVED_SLUGS = new Set(["list", "aging", "new", "acquisition", "dashboard"]);

export default async function VehicleDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;

  // Let static routes render normally — do not intercept them as a modal.
  if (RESERVED_SLUGS.has(id)) return null;

  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("inventory.read"));

  const uuidResult = idSchema.safeParse(id);
  if (!uuidResult.success) {
    return (
      <VehicleDetailModalClient
        vehicleId={id}
        initialData={null}
        errorKind="invalid_id"
      />
    );
  }

  if (!hasRead || !dealershipId) {
    return (
      <VehicleDetailModalClient
        vehicleId={id}
        initialData={null}
        errorKind="forbidden"
      />
    );
  }

  let initialData: VehicleDetailResponse | null = null;
  let errorKind: "not_found" | null = null;

  try {
    const vehicle = await inventoryService.getVehicle(dealershipId, id);
    const photos = await inventoryService.listVehiclePhotos(dealershipId, id);
    const vehicleResponse = toVehicleResponse(vehicle) as Record<string, unknown>;
    initialData = {
      ...vehicleResponse,
      photos: photos.map((p) => ({
        id: p.id,
        filename: p.filename,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      })),
    } as VehicleDetailResponse;
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      errorKind = "not_found";
    } else {
      throw e;
    }
  }

  return (
    <VehicleDetailModalClient
      vehicleId={id}
      initialData={initialData}
      errorKind={errorKind ?? undefined}
    />
  );
}
