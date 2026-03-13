import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as accountsService from "@/modules/accounting-core/service/accounts";
import { listAccountsQuerySchema, createAccountBodySchema } from "@/modules/accounting-core/schemas";
import type { AccountingAccountType } from "@prisma/client";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

function serializeAccount(account: {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listAccountsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await accountsService.listAccounts(ctx.dealershipId, {
      type: query.type as AccountingAccountType | undefined,
      activeOnly: query.activeOnly,
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse(
      listPayload(data.map(serializeAccount), total, query.limit, query.offset)
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
    const body = createAccountBodySchema.parse(await readSanitizedJson(request));
    const account = await accountsService.createAccount(
      ctx.dealershipId,
      ctx.userId,
      { code: body.code, name: body.name, type: body.type },
      { userAgent: request.headers.get("user-agent") ?? undefined }
    );
    return jsonResponse(serializeAccount(account));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
