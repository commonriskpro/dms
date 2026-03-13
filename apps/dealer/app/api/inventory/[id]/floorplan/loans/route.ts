import { NextRequest } from "next/server";
import { z } from "zod";
import * as floorplanLoansService from "@/modules/inventory/service/floorplan-loans";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { idParamSchema, floorplanLoanBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function rateLimitKey(ctx: { dealershipId: string; userId: string }) {
  return `inventory:${ctx.dealershipId}:${ctx.userId}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const includeHistory = request.nextUrl.searchParams.get("includeHistory") === "true";
    const loans = await floorplanLoansService.getFloorplanLoan(
      ctx.dealershipId,
      id,
      { includeHistory }
    );
    return jsonResponse({
      data: loans.map((l) => ({
        id: l.id,
        vehicleId: l.vehicleId,
        lender: l.lender,
        principalCents: l.principalCents,
        interestBps: l.interestBps,
        startDate: l.startDate,
        curtailmentDate: l.curtailmentDate,
        status: l.status,
        notes: l.notes,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "inventory_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = floorplanLoanBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const startDate = typeof data.startDate === "string" ? new Date(data.startDate) : data.startDate;
    const curtailmentDate =
      data.curtailmentDate != null
        ? typeof data.curtailmentDate === "string"
          ? new Date(data.curtailmentDate)
          : data.curtailmentDate
        : undefined;
    const loan = await floorplanLoansService.createOrUpdateFloorplanLoan(
      ctx.dealershipId,
      id,
      {
        lender: data.lender,
        principalCents: data.principalCents,
        interestBps: data.interestBps ?? null,
        startDate,
        curtailmentDate: curtailmentDate ?? null,
        notes: data.notes ?? null,
      },
      ctx.userId,
      meta
    );
    incrementRateLimit(rlKey, "inventory_mutation");
    return jsonResponse({
      data: {
        id: loan.id,
        vehicleId: loan.vehicleId,
        lender: loan.lender,
        principalCents: loan.principalCents,
        interestBps: loan.interestBps,
        startDate: loan.startDate,
        curtailmentDate: loan.curtailmentDate,
        status: loan.status,
        notes: loan.notes,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
