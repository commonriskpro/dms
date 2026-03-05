import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as customerService from "@/modules/customers/service/customer";
import * as timelineService from "@/modules/customers/service/timeline";
import * as callbacksService from "@/modules/customers/service/callbacks";
import * as lastVisitService from "@/modules/customers/service/last-visit";
import { CustomerDetailModalClient } from "./CustomerDetailModalClient";
import type { CustomerDetail } from "@/lib/types/customers";
import type { TimelineListResponse, CallbacksListResponse } from "@/lib/types/customers";
import { ApiError } from "@/lib/auth";
import { toCustomerDetail, toTimelineListResponse, toCallbacksListResponse } from "@/lib/serialization/customers";

const idSchema = z.string().uuid();
const TIMELINE_PAGE_SIZE = 25;
const CALLBACKS_PAGE_SIZE = 25;

export default async function CustomerDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;

  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("customers.read"));

  const uuidResult = idSchema.safeParse(id);
  if (!uuidResult.success) {
    return (
      <CustomerDetailModalClient
        customerId={id}
        initialData={null}
        errorKind="invalid_id"
      />
    );
  }

  if (!hasRead || !dealershipId) {
    return (
      <CustomerDetailModalClient
        customerId={id}
        initialData={null}
        errorKind="forbidden"
      />
    );
  }

  let initialData: CustomerDetail | null = null;
  let initialTimeline: TimelineListResponse | null = null;
  let initialCallbacks: CallbacksListResponse | null = null;
  let errorKind: "not_found" | null = null;

  try {
    const customer = await customerService.getCustomer(dealershipId, id);
    initialData = toCustomerDetail(customer);
    if (session) {
      await lastVisitService.updateLastVisit(dealershipId, session.userId, id);
    }
    const [timelineRes, callbacksRes] = await Promise.all([
      timelineService.listTimeline(dealershipId, id, { limit: TIMELINE_PAGE_SIZE, offset: 0 }),
      callbacksService.listCallbacks(dealershipId, id, { limit: CALLBACKS_PAGE_SIZE, offset: 0 }),
    ]);
    initialTimeline = toTimelineListResponse(timelineRes, TIMELINE_PAGE_SIZE, 0);
    initialCallbacks = toCallbacksListResponse(callbacksRes, CALLBACKS_PAGE_SIZE, 0);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      errorKind = "not_found";
    } else {
      throw e;
    }
  }

  return (
    <CustomerDetailModalClient
      customerId={id}
      initialData={initialData}
      initialTimeline={initialTimeline}
      initialCallbacks={initialCallbacks}
      errorKind={errorKind ?? undefined}
    />
  );
}
