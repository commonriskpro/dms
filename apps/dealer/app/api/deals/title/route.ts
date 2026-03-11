import { NextRequest } from "next/server";
import { z } from "zod";
import * as titleService from "@/modules/deals/service/title";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/pagination";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDeal } from "../serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const query = parsePagination(getQueryObject(request));
    const { data, total } = await titleService.listTitleQueue(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse(
      listPayload(
        data.map((d) => {
          const withTitle = d as typeof d & {
            dealTitle?: {
              id: string;
            titleStatus: string;
            titleNumber: string | null;
            lienholderName: string | null;
            sentToDmvAt: Date | null;
            receivedFromDmvAt: Date | null;
          } | null;
        };
        return {
          ...serializeDeal(withTitle as Parameters<typeof serializeDeal>[0]),
          dealTitle: withTitle.dealTitle
            ? {
                id: withTitle.dealTitle.id,
                titleStatus: withTitle.dealTitle.titleStatus,
                titleNumber: withTitle.dealTitle.titleNumber,
                lienholderName: withTitle.dealTitle.lienholderName,
                sentToDmvAt: withTitle.dealTitle.sentToDmvAt?.toISOString() ?? null,
                receivedFromDmvAt: withTitle.dealTitle.receivedFromDmvAt?.toISOString() ?? null,
              }
            : null,
        };
        }),
        total,
        query.limit,
        query.offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
