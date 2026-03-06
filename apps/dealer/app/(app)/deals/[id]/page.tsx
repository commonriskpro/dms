import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";

import { getSessionContextOrNull } from "@/lib/api/handler";
import * as dealService from "@/modules/deals/service/deal";
import { toDealDetail } from "@/app/api/deals/serialize";
import { DealDetailPage } from "@/modules/deals/ui/DetailPage";
import type { DealDetail } from "@/modules/deals/ui/types";
import { ApiError } from "@/lib/auth";

const idSchema = z.string().uuid();

/**
 * Direct URL deal detail. Server-first: load deal (and related fees, trades, finance with products) in RSC
 * and pass initialData so client does not fetch on mount.
 */
export default async function DealDetailDirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;

  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("deals.read"));

  const uuidResult = idSchema.safeParse(id);
  if (!uuidResult.success) {
    return (
      <DealDetailPage id={id} initialData={null} />
    );
  }

  if (!hasRead || !dealershipId) {
    return (
      <DealDetailPage id={id} initialData={null} />
    );
  }

  let initialData: DealDetail | null = null;

  try {
    const deal = await dealService.getDeal(dealershipId, id);
    initialData = toDealDetail(deal);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      initialData = null;
    } else {
      throw e;
    }
  }

  return <DealDetailPage id={id} initialData={initialData} />;
}
