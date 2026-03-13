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
import { updateCustomerBodySchema, customerIdParamSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { toCustomerDetail } from "@/lib/serialization/customers";

export const dynamic = "force-dynamic";

function toCustomerResponse(c: Awaited<ReturnType<typeof customerService.getCustomer>>) {
  return toCustomerDetail(c);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const { id } = customerIdParamSchema.parse(await context.params);
    const customer = await customerService.getCustomer(ctx.dealershipId, id);
    return jsonResponse({ data: toCustomerResponse(customer) });
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
    await guardPermission(ctx, "customers.write");
    const { id } = customerIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = updateCustomerBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await customerService.updateCustomer(ctx.dealershipId, ctx.userId, id, {
      name: data.name,
      customerClass: data.customerClass,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      nameSuffix: data.nameSuffix,
      county: data.county,
      isActiveMilitary: data.isActiveMilitary,
      isDraft: data.isDraft,
      gender: data.gender,
      dob: data.dob ?? undefined,
      ssn: data.ssn,
      leadSource: data.leadSource,
      leadType: data.leadType,
      leadCampaign: data.leadCampaign,
      leadMedium: data.leadMedium,
      status: data.status,
      assignedTo: data.assignedTo,
      bdcRepId: data.bdcRepId,
      idType: data.idType,
      idState: data.idState,
      idNumber: data.idNumber,
      idIssuedDate: data.idIssuedDate ?? undefined,
      idExpirationDate: data.idExpirationDate ?? undefined,
      cashDownCents: data.cashDownCents ?? undefined,
      isInShowroom: data.isInShowroom,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country,
      tags: data.tags,
      phones: data.phones,
      emails: data.emails,
    }, meta);
    return jsonResponse({ data: toCustomerResponse(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.write");
    const { id } = customerIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await customerService.deleteCustomer(ctx.dealershipId, ctx.userId, id, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
