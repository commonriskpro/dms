import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as customerService from "@/modules/customers/service/customer";
import * as timelineService from "@/modules/customers/service/timeline";
import * as callbacksService from "@/modules/customers/service/callbacks";
import * as lastVisitService from "@/modules/customers/service/last-visit";
import { toCustomerDetail, toTimelineListResponse, toCallbacksListResponse } from "@/lib/serialization/customers";
import { CustomerDetailPage } from "@/modules/customers/ui/DetailPage";
import { ApiError } from "@/lib/auth";
import type { CustomerDetail, TimelineListResponse, CallbacksListResponse } from "@/lib/types/customers";

const TIMELINE_PAGE_SIZE = 25;
const CALLBACKS_PAGE_SIZE = 25;

export default async function CustomerDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("customers.read"));

  let initialCustomer: CustomerDetail | null = null;
  let initialTimeline: TimelineListResponse | null = null;
  let initialCallbacks: CallbacksListResponse | null = null;

  if (session && hasRead && dealershipId) {
    try {
      const customer = await customerService.getCustomer(dealershipId, id);
      initialCustomer = toCustomerDetail(customer);
      await lastVisitService.updateLastVisit(dealershipId, session.userId, id);
      const [timelineRes, callbacksRes] = await Promise.all([
        timelineService.listTimeline(dealershipId, id, { limit: TIMELINE_PAGE_SIZE, offset: 0 }),
        callbacksService.listCallbacks(dealershipId, id, { limit: CALLBACKS_PAGE_SIZE, offset: 0 }),
      ]);
      initialTimeline = toTimelineListResponse(timelineRes, TIMELINE_PAGE_SIZE, 0);
      initialCallbacks = toCallbacksListResponse(callbacksRes, CALLBACKS_PAGE_SIZE, 0);
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "NOT_FOUND")) throw e;
    }
  }

  return (
    <CustomerDetailPage
      id={id}
      initialCustomer={initialCustomer ?? undefined}
      initialTimeline={initialTimeline ?? undefined}
      initialCallbacks={initialCallbacks ?? undefined}
    />
  );
}
