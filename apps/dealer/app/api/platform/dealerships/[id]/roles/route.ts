import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { handleApiError, jsonResponse, parseUuidParam } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user.userId);
    const dealershipId = parseUuidParam((await params).id);
    const dealership = await prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: { id: true },
    });
    if (!dealership) throw new ApiError("NOT_FOUND", "Dealership not found");
    const roles = await prisma.role.findMany({
      where: { dealershipId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return jsonResponse({ data: roles });
  } catch (e) {
    return handleApiError(e);
  }
}
