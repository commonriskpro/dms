import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { listPlatformUsers } from "@/lib/platform-users-service";
import { getSupabaseUsersEnrichment } from "@/lib/supabase-user-enrichment";
import { platformListUsersQuerySchema, platformCreateUserRequestSchema } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const parsed = platformListUsersQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      role: searchParams.get("role") ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid query", 422, parsed.error.flatten());
    }

    const { data, total } = await listPlatformUsers({
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      q: parsed.data.q,
      role: parsed.data.role,
    });

    const enrichment = await getSupabaseUsersEnrichment(data.map((u) => u.id));

    return jsonResponse({
      data: data.map((u) => {
        const e = enrichment.get(u.id);
        return {
          id: u.id,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          disabledAt: u.disabledAt?.toISOString() ?? null,
          email: e?.email ?? null,
          displayName: e?.displayName ?? null,
          lastSignInAt: e?.lastSignInAt ?? null,
        };
      }),
      meta: { total, limit: parsed.data.limit, offset: parsed.data.offset },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
    }

    const parsed = platformCreateUserRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const requestId = request.headers.get("x-request-id")?.trim() ?? undefined;
    const data = await import("@/lib/platform-users-service").then((m) =>
      m.upsertPlatformUser(user, { id: parsed.data.id, role: parsed.data.role }, { requestId: requestId || null })
    );

    return jsonResponse({ data }, 201);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
