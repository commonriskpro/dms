import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  getRequestMeta,
  handleApiError,
  parseUuidParam,
} from "@/lib/api/handler";
import * as platformPendingService from "@/modules/platform-admin/service/pending-users";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const userId = parseUuidParam((await params).userId);
    const meta = getRequestMeta(request);

    await platformPendingService.rejectPendingUser(userId, user.userId, meta);

    return new Response(null, { status: 204 });
  } catch (e) {
    return handleApiError(e);
  }
}
