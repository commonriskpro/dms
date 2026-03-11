import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import { toVehicleResponse } from "@/modules/inventory/api-response";
import type { VehicleDetailResponse } from "@/modules/inventory/ui/types";
import { ApiError } from "@/lib/auth";
import { VehicleDetailModalClient } from "./VehicleDetailModalClient";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

export default async function VehicleDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;

  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("inventory.read"));

  const uuidResult = idSchema.safeParse(id);
  if (!uuidResult.success) {
    return <VehicleDetailModalClient vehicleId={id} initialData={null} errorKind="invalid_id" />;
  }

  if (!hasRead || !dealershipId) {
    return <VehicleDetailModalClient vehicleId={id} initialData={null} errorKind="forbidden" />;
  }

  let initialData: VehicleDetailResponse | null = null;
  let errorKind: "not_found" | null = null;

  try {
    const vehicle = await inventoryService.getVehicle(dealershipId, id);
    const photos = await inventoryService.listVehiclePhotos(dealershipId, id);
    const vehicleResponse = toVehicleResponse(vehicle) as Record<string, unknown>;
    initialData = {
      ...vehicleResponse,
      photos: photos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        createdAt: photo.createdAt instanceof Date ? photo.createdAt.toISOString() : photo.createdAt,
      })),
    } as VehicleDetailResponse;
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      errorKind = "not_found";
    } else {
      throw error;
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

