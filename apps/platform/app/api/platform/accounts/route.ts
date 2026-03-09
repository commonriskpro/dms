import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import * as accountsService from "@/lib/service/accounts";

export const dynamic = "force-dynamic";

const createAccountBodySchema = z.object({
  name: z.string().min(1).max(256),
  email: z.string().email(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

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
    const parsed = createAccountBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const account = await accountsService.createPlatformAccount(user.userId, {
      name: parsed.data.name,
      email: parsed.data.email,
      status: parsed.data.status,
    });

    return jsonResponse(
      {
        id: account.id,
        name: account.name,
        email: account.email,
        status: account.status,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
      201
    );
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      status: searchParams.get("status") ?? undefined,
    });

    const { data, total } = await accountsService.listAccounts({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });

    return jsonResponse({
      data: data.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
