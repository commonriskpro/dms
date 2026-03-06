import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { invitePlatformUserByEmail } from "@/lib/platform-invite-service";
import {
  platformInviteUserRequestSchema,
  type PlatformInviteUserResponse,
} from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }

    const parsed = platformInviteUserRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const email = parsed.data.email; // already trim/lowercase from schema
    const role = parsed.data.role ?? "PLATFORM_SUPPORT";
    const requestId = request.headers.get("x-request-id")?.trim() ?? undefined;

    const result: PlatformInviteUserResponse = await invitePlatformUserByEmail(user, email, role, {
      requestId: requestId ?? null,
    });

    return jsonResponse(result, 201);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
