import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as creditApplicationService from "@/modules/finance-core/service/credit-application";
import {
  createCreditApplicationBodySchema,
  listCreditApplicationsQuerySchema,
} from "@/modules/finance-core/schemas";
import {
  serializeCreditApplication,
  serializeCreditApplicationListItem,
} from "@/modules/finance-core/serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listCreditApplicationsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await creditApplicationService.listCreditApplications(
      ctx.dealershipId,
      {
        dealId: query.dealId,
        customerId: query.customerId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      }
    );
    return jsonResponse(
      listPayload(
        data.map(serializeCreditApplicationListItem),
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
    const body = await readSanitizedJson(request);
    const parsed = createCreditApplicationBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await creditApplicationService.createCreditApplication(
      ctx.dealershipId,
      ctx.userId,
      {
        dealId: parsed.dealId,
        customerId: parsed.customerId,
        applicantFirstName: parsed.applicantFirstName,
        applicantLastName: parsed.applicantLastName,
        dob: parsed.dob ?? null,
        ssn: parsed.ssn,
        phone: parsed.phone ?? null,
        email: parsed.email ?? null,
        addressLine1: parsed.addressLine1 ?? null,
        addressLine2: parsed.addressLine2 ?? null,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        postalCode: parsed.postalCode ?? null,
        housingStatus: parsed.housingStatus ?? null,
        housingPaymentCents: parsed.housingPaymentCents ?? null,
        yearsAtResidence: parsed.yearsAtResidence ?? null,
        employerName: parsed.employerName ?? null,
        jobTitle: parsed.jobTitle ?? null,
        employmentYears: parsed.employmentYears ?? null,
        monthlyIncomeCents: parsed.monthlyIncomeCents ?? null,
        otherIncomeCents: parsed.otherIncomeCents ?? null,
        notes: parsed.notes ?? null,
      },
      meta
    );
    return jsonResponse({
      data: serializeCreditApplication(created),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
