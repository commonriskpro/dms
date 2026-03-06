import { NextRequest } from "next/server";
import { z } from "zod";
import * as documentService from "@/modules/documents/service/documents";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { documentTypeSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "upload")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many uploads" } },
        { status: 429 }
      );
    }
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "documents.write");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing file" } },
        { status: 400 }
      );
    }
    const entityTypeRaw = formData.get("entityType")?.toString();
    const entityIdRaw = formData.get("entityId")?.toString();
    const docTypeRaw = formData.get("docType")?.toString();
    const titleRaw = formData.get("title")?.toString();

    const entityType = z.enum(["DEAL", "CUSTOMER", "VEHICLE"]).parse(entityTypeRaw ?? "");
    const entityId = z.string().uuid().parse(entityIdRaw ?? "");
    const docType = documentTypeSchema.parse(docTypeRaw ?? "");
    const title = titleRaw != null ? z.string().max(255).optional().parse(titleRaw) : undefined;

    const meta = getRequestMeta(request);
    const item = await documentService.uploadDocument(
      ctx.dealershipId,
      ctx.userId,
      {
        entityType,
        entityId,
        docType,
        title: title ?? null,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        },
      },
      meta
    );
    return jsonResponse(item, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
