import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
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
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { listCustomersQuerySchema, createCustomerBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";
import { toCustomerDetail } from "@/lib/serialization/customers";

export const dynamic = "force-dynamic";

/** Max JSON body size for POST (100KB). */
const POST_BODY_MAX_BYTES = 100 * 1024;

function toCustomerListItem(c: {
  id: string;
  name: string;
  isDraft: boolean;
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
    isDraft: c.isDraft,
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

function toCustomerResponse(c: Awaited<ReturnType<typeof customerService.getCustomer>>) {
  return toCustomerDetail(c);
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
    const query = listCustomersQuerySchema.parse(getQueryObject(request));
    const { data, total } = await customerService.listCustomers(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: {
        status: query.status,
        draft: query.draft,
        leadSource: query.leadSource,
        assignedTo: query.assignedTo,
        search: query.search,
      },
      sort: { sortBy: query.sortBy, sortOrder: query.sortOrder },
    });
    return jsonResponse(
      listPayload(data.map(toCustomerListItem), total, query.limit, query.offset)
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
    const body = await readSanitizedJson(request);
    const data = createCustomerBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await customerService.createCustomer(ctx.dealershipId, ctx.userId, {
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
    revalidatePath("/customers");
    return jsonResponse({ data: toCustomerResponse(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
