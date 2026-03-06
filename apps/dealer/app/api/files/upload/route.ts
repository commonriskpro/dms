import { NextRequest } from "next/server";
import { z } from "zod";
import * as fileService from "@/modules/core-platform/service/file";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";

const BUCKETS = ["deal-documents", "inventory-photos"] as const;

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
    const bucketRaw = formData.get("bucket")?.toString() ?? "deal-documents";
    const pathPrefix = formData.get("pathPrefix")?.toString() ?? "";
    const bucketSchema = z.enum(BUCKETS);
    const bucket = bucketSchema.parse(bucketRaw);
    const meta = getRequestMeta(request);
    const fileObject = await fileService.uploadFile(
      ctx.dealershipId,
      ctx.userId,
      {
        bucket,
        pathPrefix,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        },
      },
      meta
    );
    return jsonResponse({
      id: fileObject.id,
      bucket: fileObject.bucket,
      path: fileObject.path,
      filename: fileObject.filename,
      mimeType: fileObject.mimeType,
      sizeBytes: fileObject.sizeBytes,
      createdAt: fileObject.createdAt,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid bucket" } },
        { status: 400 }
      );
    }
    return handleApiError(e);
  }
}
