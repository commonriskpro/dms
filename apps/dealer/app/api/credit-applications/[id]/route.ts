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
import { updateCreditApplicationBodySchema } from "@/modules/finance-core/schemas";
import { serializeCreditApplication } from "@/modules/finance-core/serialize";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = idParamSchema.parse(await context.params);
    const app = await creditApplicationService.getCreditApplication(
      ctx.dealershipId,
      id
    );
    return jsonResponse({ data: serializeCreditApplication(app) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const parsed = updateCreditApplicationBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await creditApplicationService.updateCreditApplication(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        dealId: parsed.dealId,
        status: parsed.status,
        applicantFirstName: parsed.applicantFirstName,
        applicantLastName: parsed.applicantLastName,
        dob: parsed.dob ? new Date(parsed.dob) : undefined,
        phone: parsed.phone,
        email: parsed.email,
        addressLine1: parsed.addressLine1,
        addressLine2: parsed.addressLine2,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        housingStatus: parsed.housingStatus,
        housingPaymentCents:
          parsed.housingPaymentCents != null
            ? BigInt(parsed.housingPaymentCents)
            : undefined,
        yearsAtResidence: parsed.yearsAtResidence,
        employerName: parsed.employerName,
        jobTitle: parsed.jobTitle,
        employmentYears: parsed.employmentYears,
        monthlyIncomeCents:
          parsed.monthlyIncomeCents != null
            ? BigInt(parsed.monthlyIncomeCents)
            : undefined,
        otherIncomeCents:
          parsed.otherIncomeCents != null
            ? BigInt(parsed.otherIncomeCents)
            : undefined,
        notes: parsed.notes,
      },
      meta
    );
    return jsonResponse({ data: serializeCreditApplication(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
