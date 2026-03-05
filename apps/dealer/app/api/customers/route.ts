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
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { listCustomersQuerySchema, createCustomerBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

/** Max JSON body size for POST (100KB). */
const POST_BODY_MAX_BYTES = 100 * 1024;

function toCustomerListItem(c: {
  id: string;
  name: string;
  status: string;
  leadSource: string | null;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  phones: { value: string; isPrimary: boolean }[];
  emails: { value: string; isPrimary: boolean }[];
  assignedToProfile: { id: string; fullName: string | null; email: string } | null;
}) {
  const primaryPhone = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
  const primaryEmail = c.emails.find((e) => e.isPrimary) ?? c.emails[0];
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    leadSource: c.leadSource,
    assignedTo: c.assignedTo,
    assignedToProfile: c.assignedToProfile,
    primaryPhone: primaryPhone?.value ?? null,
    primaryEmail: primaryEmail?.value ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

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

function rateLimitKey(ctx: { dealershipId: string; userId: string }): string {
  return `customers:${ctx.dealershipId}:${ctx.userId}`;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "customers_list")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    incrementRateLimit(rlKey, "customers_list");
    const query = listCustomersQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await customerService.listCustomers(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: {
        status: query.status,
        leadSource: query.leadSource,
        assignedTo: query.assignedTo,
        search: query.search,
      },
      sort: { sortBy: query.sortBy, sortOrder: query.sortOrder },
    });
    return jsonResponse({
      data: data.map(toCustomerListItem),
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
    await guardPermission(ctx, "customers.write");
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const n = parseInt(contentLength, 10);
      if (!Number.isNaN(n) && n > POST_BODY_MAX_BYTES) {
        return Response.json(
          { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } },
          { status: 413 }
        );
      }
    }
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "customers_create")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    incrementRateLimit(rlKey, "customers_create");
    const body = await request.json();
    const data = createCustomerBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await customerService.createCustomer(ctx.dealershipId, ctx.userId, {
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
    return jsonResponse({ data: toCustomerResponse(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
