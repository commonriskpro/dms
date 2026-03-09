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
import type { DealDocumentCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

function serializeDealDocument(doc: {
  id: string;
  dealId: string;
  creditApplicationId: string | null;
  lenderApplicationId: string | null;
  category: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    dealId: doc.dealId,
    creditApplicationId: doc.creditApplicationId,
    lenderApplicationId: doc.lenderApplicationId,
    category: doc.category,
    title: doc.title,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedByUserId: doc.uploadedByUserId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listDealDocumentsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const { data, total } = await vaultService.listDealDocuments(
      ctx.dealershipId,
      {
        dealId: query.dealId,
        category: query.category as DealDocumentCategory | undefined,
        limit: query.limit,
        offset: query.offset,
      }
    );
    return jsonResponse({
      data: data.map((d) => serializeDealDocument(d)),
      meta: { total, limit: query.limit, offset: query.offset },
    });
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
