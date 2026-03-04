import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import {
  getPlatformUserById,
  updatePlatformUser,
  deletePlatformUser,
} from "@/lib/platform-users-service";
import { platformUpdateUserRequestSchema } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { id } = await params;
    const row = await getPlatformUserById(id);
    if (!row) {
      return errorResponse("NOT_FOUND", "Platform user not found", 404);
    }
    return jsonResponse({
      id: row.id,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      disabledAt: row.disabledAt?.toISOString() ?? null,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }

    const parsed = platformUpdateUserRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }
    if (!parsed.data.role && parsed.data.disabled === undefined) {
      return errorResponse("VALIDATION_ERROR", "At least one of role or disabled is required", 422);
    }

    const requestId = request.headers.get("x-request-id")?.trim() ?? undefined;
    const data = await updatePlatformUser(
      user,
      id,
      { role: parsed.data.role, disabled: parsed.data.disabled },
      { requestId: requestId || null }
    );

    return jsonResponse({ data });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const { id } = await params;
    const requestId = request.headers.get("x-request-id")?.trim() ?? undefined;

    await deletePlatformUser(user, id, { requestId: requestId || null });
    return new Response(null, { status: 204 });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
