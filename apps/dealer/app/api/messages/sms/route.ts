import { NextRequest } from "next/server";
import { z } from "zod";
import * as smsService from "@/modules/integrations/service/sms";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

const bodySchema = z.object({
  customerId: z.string().uuid(),
  phone: z.string().min(1).max(20),
  message: z.string().min(1).max(1600),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const body = bodySchema.parse(await readSanitizedJson(request));
    const result = await smsService.sendSmsMessage(
      ctx.dealershipId,
      body.customerId,
      body.phone,
      body.message,
      ctx.userId
    );
    return jsonResponse({ data: { activityId: result.activityId, success: true } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
