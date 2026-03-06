import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { idParamSchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    await guardPermission(ctx, "documents.read");
    const { id } = idParamSchema.parse(await context.params);
    const photos = await inventoryService.listVehiclePhotos(ctx.dealershipId, id);
    return jsonResponse({
      data: photos.map((p) => ({
        id: p.id,
        fileObjectId: p.fileObjectId,
        filename: p.filename,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        sortOrder: p.sortOrder,
        isPrimary: p.isPrimary,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
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
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing file" } },
        { status: 400 }
      );
    }
    const meta = getRequestMeta(request);
    const fileObject = await inventoryService.uploadVehiclePhoto(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        name: file.name,
        type: file.type,
        size: file.size,
        arrayBuffer: () => file.arrayBuffer(),
      },
      meta
    );
    return jsonResponse(
      {
        data: {
          id: fileObject.id,
          fileObjectId: fileObject.id,
          filename: fileObject.filename,
          mimeType: fileObject.mimeType,
          sizeBytes: fileObject.sizeBytes,
          sortOrder: fileObject.sortOrder,
          isPrimary: fileObject.isPrimary,
          createdAt: fileObject.createdAt instanceof Date ? fileObject.createdAt.toISOString() : fileObject.createdAt,
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
