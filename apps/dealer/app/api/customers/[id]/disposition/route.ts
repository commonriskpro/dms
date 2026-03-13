import { NextRequest } from "next/server";
import { z } from "zod";
import * as customerService from "@/modules/customers/service/customer";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { customerIdParamSchema, dispositionBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

function toCustomerResponse(c: {
  id: string;
  dealershipId: string;
  name: string;
  leadSource: string | null;
  status: string;
  assignedTo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  phones: { id: string; kind: string | null; value: string; isPrimary: boolean }[];
  emails: { id: string; kind: string | null; value: string; isPrimary: boolean }[];
  assignedToProfile: { id: string; fullName: string | null; email: string } | null;
}) {
  return {
    id: c.id,
    dealershipId: c.dealershipId,
    name: c.name,
    leadSource: c.leadSource,
    status: c.status,
    assignedTo: c.assignedTo,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    country: c.country,
    tags: c.tags,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    phones: c.phones,
    emails: c.emails,
    assignedToProfile: c.assignedToProfile,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id: customerId } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = dispositionBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const result = await customerService.setDisposition(
      ctx.dealershipId,
      ctx.userId,
      customerId,
      {
        status: data.status,
        followUpTask: data.followUpTask
          ? {
              title: data.followUpTask.title,
              dueAt: data.followUpTask.dueAt ? new Date(data.followUpTask.dueAt) : null,
            }
          : undefined,
      },
      meta
    );
    return jsonResponse(
      {
        data: { customer: toCustomerResponse(result.customer), taskId: result.taskId },
      },
      result.taskId ? 201 : 200
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
