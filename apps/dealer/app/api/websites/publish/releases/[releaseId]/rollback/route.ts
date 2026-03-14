import { NextRequest } from "next/server";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import * as publishService from "@/modules/websites-publishing/service";
import { serializeRelease } from "@/modules/websites-publishing/serializer";

export const dynamic = "force-dynamic";

/**
 * POST /api/websites/publish/releases/[releaseId]/rollback
 * Promote the given release as the current live release (rollback).
 * Permission: websites.write. Audit: website.rollback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const { releaseId } = await params;
    const meta = getRequestMeta(request);

    const { release, previousReleaseId } = await publishService.rollbackToRelease(
      ctx.dealershipId,
      ctx.userId,
      releaseId,
      meta
    );

    const site = await publishService.getReleaseDetail(ctx.dealershipId, release.id);
    const dto = serializeRelease(release, site.activeSiteReleaseId);

    return jsonResponse({
      data: dto,
      previousReleaseId: previousReleaseId ?? null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
