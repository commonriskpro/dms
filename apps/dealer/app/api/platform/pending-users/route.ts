import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as platformPendingService from "@/modules/platform-admin/service/pending-users";
import { listPendingQuerySchema } from "@/app/api/platform/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);

    const { searchParams } = new URL(request.url);
    const { limit, offset, search } = listPendingQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    const { data, total } = await platformPendingService.listPendingUsers({
      limit,
      offset,
      search,
    });

    return jsonResponse({
      data,
      meta: { total, limit, offset },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
