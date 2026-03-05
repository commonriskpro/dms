import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as dealService from "@/modules/deals/service/deal";
import { serializeDeal } from "@/app/api/deals/serialize";
import { DealDetailModalClient } from "./DealDetailModalClient";
import type { DealDetail } from "@/modules/deals/ui/types";
import { ApiError } from "@/lib/auth";

const idSchema = z.string().uuid();

/** Normalize serialized deal for client (dates as string). */
function toDealDetail(deal: Awaited<ReturnType<typeof dealService.getDeal>>): DealDetail {
  const s = serializeDeal(deal);
  return {
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : (s.createdAt as string),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : (s.updatedAt as string),
    deletedAt: s.deletedAt instanceof Date ? s.deletedAt.toISOString() : (s.deletedAt as string | null),
    fees: s.fees?.map((f) => ({
      ...f,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : (f.createdAt as string),
    })),
    trades: s.trades?.map((t) => ({
      ...t,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.createdAt as string),
    })),
  } as DealDetail;
}

export default async function DealDetailModalPage({
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
      <DealDetailModalClient dealId={id} initialData={null} errorKind="invalid_id" />
    );
  }

  if (!hasRead || !dealershipId) {
    return (
      <DealDetailModalClient dealId={id} initialData={null} errorKind="forbidden" />
    );
  }

  let initialData: DealDetail | null = null;
  let errorKind: "not_found" | null = null;

  try {
    const deal = await dealService.getDeal(dealershipId, id);
    initialData = toDealDetail(deal);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      errorKind = "not_found";
    } else {
      throw e;
    }
  }

  return (
    <DealDetailModalClient
      dealId={id}
      initialData={initialData}
      errorKind={errorKind ?? undefined}
    />
  );
}
