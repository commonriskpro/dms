import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as vaultService from "@/modules/finance-core/service/documents";
import { listDealDocumentsQuerySchema } from "@/modules/finance-core/schemas-deal-documents";
import { serializeDealDocument } from "@/modules/finance-core/serialize";
import type { DealDocumentCategory } from "@prisma/client";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listDealDocumentsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await vaultService.listDealDocuments(
      ctx.dealershipId,
      {
        dealId: query.dealId,
        category: query.category as DealDocumentCategory | undefined,
        limit: query.limit,
        offset: query.offset,
      }
    );
    return jsonResponse(
      listPayload(
        data.map((d) => serializeDealDocument(d)),
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

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing file" } },
        { status: 400 }
      );
    }
    const dealId = z.string().uuid().parse(formData.get("dealId")?.toString() ?? "");
    const category = z.enum(["CONTRACT", "ID", "INSURANCE", "STIPULATION", "CREDIT", "COMPLIANCE", "OTHER"]).parse(formData.get("category")?.toString() ?? "");
    const title = z.string().min(1).max(255).parse(formData.get("title")?.toString()?.trim() || "Untitled");
    const creditApplicationId = formData.get("creditApplicationId")?.toString() || null;
    const lenderApplicationId = formData.get("lenderApplicationId")?.toString() || null;

    const meta = getRequestMeta(request);
    const created = await vaultService.uploadDealDocument(
      ctx.dealershipId,
      ctx.userId,
      {
        dealId,
        creditApplicationId: creditApplicationId ? z.string().uuid().parse(creditApplicationId) : null,
        lenderApplicationId: lenderApplicationId ? z.string().uuid().parse(lenderApplicationId) : null,
        category: category as DealDocumentCategory,
        title,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        },
      },
      meta
    );
    return jsonResponse({ data: serializeDealDocument(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
