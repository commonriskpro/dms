import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { handleApiError, jsonResponse, parseUuidParam } from "@/lib/api/handler";
import * as platformPendingService from "@/modules/platform-admin/service/pending-users";
import { approvePendingBodySchema } from "@/app/api/platform/schemas";
import { getRequestMeta } from "@/lib/api/handler";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const userId = parseUuidParam((await params).userId);
    const body = await _request.json();
    const { dealershipId, roleId } = approvePendingBodySchema.parse(body);
    const meta = getRequestMeta(_request);

    const result = await platformPendingService.approvePendingUser(
      {
        userId,
        dealershipId,
        roleId,
        actorUserId: user.userId,
      },
      meta
    );

    return jsonResponse(
      {
        data: {
          membershipId: result.membershipId,
          dealershipId: result.dealershipId,
        },
      },
      201
    );
  } catch (e) {
    return handleApiError(e);
  }
}
