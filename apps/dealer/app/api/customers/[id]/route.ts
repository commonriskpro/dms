import { NextRequest } from "next/server";
import { z } from "zod";
import * as customerService from "@/modules/customers/service/customer";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { updateCustomerBodySchema, customerIdParamSchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

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
    const body = await request.json();
    const data = updateCustomerBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await customerService.updateCustomer(ctx.dealershipId, ctx.userId, id, {
      name: data.name,
      leadSource: data.leadSource,
      status: data.status,
      assignedTo: data.assignedTo,
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
