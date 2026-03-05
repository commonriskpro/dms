import { NextRequest } from "next/server";
import { z } from "zod";
import * as bulkService from "@/modules/inventory/service/bulk";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing file" } },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "File too large (max 1MB)" } },
        { status: 400 }
      );
    }
    const text = await file.text();
    const result = await bulkService.previewBulkImport(ctx.dealershipId, text);
    return jsonResponse({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
