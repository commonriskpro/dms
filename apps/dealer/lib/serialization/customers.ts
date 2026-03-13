import type { CustomerDetail, TimelineListResponse, CustomerCallbackItem, CallbacksListResponse } from "@/lib/types/customers";
import type * as customerService from "@/modules/customers/service/customer";
import type * as timelineService from "@/modules/customers/service/timeline";
import type * as callbacksService from "@/modules/customers/service/callbacks";
import { decryptField, maskSsn } from "@/lib/field-encryption";

type CustomerFromService = Awaited<ReturnType<typeof customerService.getCustomer>>;
type TimelineResult = Awaited<ReturnType<typeof timelineService.listTimeline>>;
type CallbacksResult = Awaited<ReturnType<typeof callbacksService.listCallbacks>>;

export function toCustomerDetail(c: CustomerFromService): CustomerDetail {
  const cAny = c as CustomerFromService & {
    dob?: Date | string | null;
    idIssuedDate?: Date | string | null;
    idExpirationDate?: Date | string | null;
    cashDownCents?: bigint | string | null;
    lastVisitAt?: Date | null;
    lastVisitByUserId?: string | null;
  };
  return {
    id: c.id,
    dealershipId: c.dealershipId,
    name: c.name,
    customerClass: c.customerClass ?? null,
    firstName: c.firstName ?? null,
    middleName: c.middleName ?? null,
    lastName: c.lastName ?? null,
    nameSuffix: c.nameSuffix ?? null,
    county: c.county ?? null,
    isActiveMilitary: c.isActiveMilitary ?? false,
    isDraft: c.isDraft,
    gender: c.gender ?? null,
    dob: cAny.dob instanceof Date ? cAny.dob.toISOString().slice(0, 10) : (cAny.dob ?? null),
    ssnMasked: c.ssnEncrypted ? maskSsn(decryptField(c.ssnEncrypted)) : null,
    leadSource: c.leadSource,
    leadType: c.leadType ?? null,
    status: c.status,
    assignedTo: c.assignedTo,
    bdcRepId: c.bdcRepId ?? null,
    idType: c.idType ?? null,
    idState: c.idState ?? null,
    idNumber: c.idNumber ?? null,
    idIssuedDate: cAny.idIssuedDate instanceof Date ? cAny.idIssuedDate.toISOString().slice(0, 10) : (cAny.idIssuedDate ?? null),
    idExpirationDate: cAny.idExpirationDate instanceof Date ? cAny.idExpirationDate.toISOString().slice(0, 10) : (cAny.idExpirationDate ?? null),
    cashDownCents: cAny.cashDownCents != null ? String(cAny.cashDownCents) : null,
    isInShowroom: c.isInShowroom ?? false,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    country: c.country,
    tags: c.tags,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt as string),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : (c.updatedAt as string),
    lastVisitAt: cAny.lastVisitAt instanceof Date ? cAny.lastVisitAt.toISOString() : (cAny.lastVisitAt ?? null),
    lastVisitByUserId: cAny.lastVisitByUserId ?? null,
    phones: c.phones,
    emails: c.emails,
    assignedToProfile: c.assignedToProfile,
    bdcRepProfile: c.bdcRepProfile ?? null,
  };
}

export function toTimelineListResponse(
  result: TimelineResult,
  limit: number,
  offset: number
): TimelineListResponse {
  return {
    data: result.data.map((e) => ({
      type: e.type,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : (e.createdAt as string),
      createdByUserId: e.createdByUserId,
      payloadJson: e.payloadJson,
      sourceId: e.sourceId,
    })),
    meta: { total: result.total, limit, offset },
  };
}

function serializeCallback(
  row: CallbacksResult["data"][number]
): CustomerCallbackItem {
  return {
    id: row.id,
    callbackAt: row.callbackAt instanceof Date ? row.callbackAt.toISOString() : (row.callbackAt as string),
    status: row.status,
    reason: row.reason,
    assignedToUserId: row.assignedToUserId,
    snoozedUntil: row.snoozedUntil instanceof Date ? row.snoozedUntil.toISOString() : (row.snoozedUntil ?? null),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt as string),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt as string),
    assignedTo: row.assignedTo ?? null,
  };
}

export function toCallbacksListResponse(
  result: CallbacksResult,
  limit: number,
  offset: number
): CallbacksListResponse {
  return {
    data: result.data.map(serializeCallback),
    meta: { total: result.total, limit, offset },
  };
}
