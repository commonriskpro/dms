import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import * as fileService from "@/modules/core-platform/service/file";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { idParamSchema } from "../../schemas";
import { vehicleCostDocumentKindSchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

const COST_DOC_BUCKET = "vehicle-cost-docs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    await guardPermission(ctx, "documents.read");
    const { id } = idParamSchema.parse(await context.params);
    await inventoryService.getVehicle(ctx.dealershipId, id);
    const docs = await costLedger.listCostDocuments(ctx.dealershipId, id);
    return jsonResponse({
      data: docs.map((d) => ({
        id: d.id,
        vehicleId: d.vehicleId,
        costEntryId: d.costEntryId,
        fileObjectId: d.fileObjectId,
        kind: d.kind,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        createdByUserId: d.createdByUserId,
        file: d.fileObject
          ? {
              id: d.fileObject.id,
              filename: d.fileObject.filename,
              mimeType: d.fileObject.mimeType,
              sizeBytes: d.fileObject.sizeBytes,
            }
          : undefined,
        costEntry: d.costEntry
          ? {
              id: d.costEntry.id,
              category: d.costEntry.category,
              amountCents: d.costEntry.amountCents.toString(),
              occurredAt: d.costEntry.occurredAt instanceof Date ? d.costEntry.occurredAt.toISOString() : d.costEntry.occurredAt,
            }
          : undefined,
      })),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "upload")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many uploads" } },
        { status: 429 }
      );
    }
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    await guardPermission(ctx, "documents.write");
    const { id } = idParamSchema.parse(await context.params);
    await inventoryService.getVehicle(ctx.dealershipId, id);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing file" } },
        { status: 400 }
      );
    }
    const kindRaw = formData.get("kind")?.toString();
    const costEntryIdRaw = formData.get("costEntryId")?.toString();
    const kind = vehicleCostDocumentKindSchema.parse(kindRaw ?? "");
    let costEntryId: string | undefined;
    if (costEntryIdRaw?.trim()) {
      const entryId = z.string().uuid().parse(costEntryIdRaw.trim());
      const entry = await costLedger.getCostEntry(ctx.dealershipId, entryId);
      if (entry.vehicleId !== id) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Cost entry must belong to this vehicle" } },
          { status: 400 }
        );
      }
      costEntryId = entryId;
    }

    const meta = getRequestMeta(request);
    const fileObject = await fileService.uploadFile(
      ctx.dealershipId,
      ctx.userId,
      {
        bucket: COST_DOC_BUCKET,
        pathPrefix: `vehicle/${id}`,
        entityType: "VehicleCostDocument",
        entityId: id,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        },
      },
      meta
    );

    const doc = await costLedger.createCostDocument(
      ctx.dealershipId,
      id,
      {
        fileObjectId: fileObject.id,
        kind,
        costEntryId: costEntryId ?? null,
        createdByUserId: ctx.userId,
      },
      meta
    );

    return jsonResponse(
      {
        data: {
          id: doc.id,
          vehicleId: doc.vehicleId,
          costEntryId: doc.costEntryId,
          fileObjectId: doc.fileObjectId,
          kind: doc.kind,
          createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
          createdByUserId: doc.createdByUserId,
        },
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
