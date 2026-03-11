import { NextRequest } from "next/server";
import { z } from "zod";
import * as permissionDb from "@/modules/core-platform/db/permission";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  module: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.permissions.read");
    const query = querySchema.parse(getQueryObject(request));
    const { data, total } = await permissionDb.listPermissionsPaginated(
      query.module ? { module: query.module } : undefined,
      { limit: query.limit, offset: query.offset }
    );
    return jsonResponse(
      listPayload(
        data.map((p) => ({
          id: p.id,
          key: p.key,
          description: p.description,
          module: p.module,
        })),
        total,
        query.limit,
        query.offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
