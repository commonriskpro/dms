import { NextRequest } from "next/server";
import pLimit from "p-limit";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { runSignalEngine } from "@/modules/intelligence/service/signal-engine";

export const dynamic = "force-dynamic";

const INTELLIGENCE_RUN_PERMISSIONS = [
  "inventory.read",
  "inventory.acquisition.read",
  "crm.read",
  "customers.read",
  "deals.read",
] as const;
const INTELLIGENCE_CRON_CONCURRENCY = 3;

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, [...INTELLIGENCE_RUN_PERMISSIONS]);
    const data = await runSignalEngine(ctx.dealershipId);
    return jsonResponse({ data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  const dealerships = await prisma.dealership.findMany({ select: { id: true } });
  const limit = pLimit(INTELLIGENCE_CRON_CONCURRENCY);
  const data = await Promise.all(
    dealerships.map((dealership) =>
      limit(() =>
        runSignalEngine(dealership.id)
      )
    )
  );

  return jsonResponse({ data });
}
