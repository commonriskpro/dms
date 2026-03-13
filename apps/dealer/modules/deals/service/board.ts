import * as boardDb from "../db/board";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";

const BOARD_CACHE_KEY = (id: string) => `deals:${id}:board`;
const BOARD_TTL = 15;

export type BoardDealCard = {
  id: string;
  status: string;
  financingMode: "CASH" | "FINANCE" | null;
  customerName: string;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  stockNumber: string;
  salePriceCents: string;
  totalDueCents: string;
  frontGrossCents: string;
  lenderName: string | null;
  financeStatus: string | null;
  fundingStatus: string | null;
  titleStatus: string | null;
  deliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BoardColumn = {
  id: string;
  label: string;
  count: number;
  totalCents: string;
  deals: BoardDealCard[];
};

export type BoardKpi = {
  activeDeals: number;
  approved: number;
  contractsReady: number;
  totalFrontGrossCents: string;
};

export type DealBoardData = {
  kpi: BoardKpi;
  columns: BoardColumn[];
};

function serializeBoardDeal(deal: {
  id: string;
  status: string;
  salePriceCents: bigint;
  totalDueCents: bigint;
  frontGrossCents: bigint;
  deliveryStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: { id: string; name: string } | null;
  vehicle?: { id: string; vin: string | null; year: number | null; make: string | null; model: string | null; stockNumber: string } | null;
  dealFinance?: { financingMode: "CASH" | "FINANCE"; lenderName: string | null; status: string; monthlyPaymentCents: bigint; amountFinancedCents: bigint } | null;
  dealFundings?: Array<{ fundingStatus: string; fundingAmountCents: bigint; lenderApplication?: { lenderName: string } | null }>;
  dealTitle?: { titleStatus: string } | null;
}): BoardDealCard {
  const funding = deal.dealFundings?.[0];
  const lender = deal.dealFinance?.lenderName ?? funding?.lenderApplication?.lenderName ?? null;

  return {
    id: deal.id,
    status: deal.status,
    financingMode: deal.dealFinance?.financingMode ?? null,
    customerName: deal.customer?.name ?? "Unknown",
    vehicleYear: deal.vehicle?.year ?? null,
    vehicleMake: deal.vehicle?.make ?? null,
    vehicleModel: deal.vehicle?.model ?? null,
    stockNumber: deal.vehicle?.stockNumber ?? "",
    salePriceCents: String(deal.salePriceCents),
    totalDueCents: String(deal.totalDueCents),
    frontGrossCents: String(deal.frontGrossCents),
    lenderName: lender,
    financeStatus: deal.dealFinance?.status ?? null,
    fundingStatus: funding?.fundingStatus ?? null,
    titleStatus: deal.dealTitle?.titleStatus ?? null,
    deliveryStatus: deal.deliveryStatus ?? null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

function sumColumn(deals: Array<{ totalDueCents: bigint }>): string {
  let sum = BigInt(0);
  for (const d of deals) sum += d.totalDueCents;
  return String(sum);
}

export async function getDealBoard(dealershipId: string): Promise<DealBoardData> {
  await requireTenantActiveForRead(dealershipId);

  return withCache(BOARD_CACHE_KEY(dealershipId), BOARD_TTL, async () => {
    const [kpi, desk, delivery, funding, title] = await Promise.all([
      boardDb.boardKpiCounts(dealershipId),
      boardDb.listDeskQueue(dealershipId),
      boardDb.listDeliveryQueueBoard(dealershipId),
      boardDb.listFundingQueueBoard(dealershipId),
      boardDb.listTitleQueueBoard(dealershipId),
    ]);

    const columns: BoardColumn[] = [
      {
        id: "desk",
        label: "Desk Queue",
        count: desk.total,
        totalCents: sumColumn(desk.data),
        deals: desk.data.map(serializeBoardDeal),
      },
      {
        id: "delivery",
        label: "Delivery Queue",
        count: delivery.total,
        totalCents: sumColumn(delivery.data),
        deals: delivery.data.map(serializeBoardDeal),
      },
      {
        id: "funding",
        label: "Funding Queue",
        count: funding.total,
        totalCents: sumColumn(funding.data),
        deals: funding.data.map(serializeBoardDeal),
      },
      {
        id: "title",
        label: "Title Queue",
        count: title.total,
        totalCents: sumColumn(title.data),
        deals: title.data.map(serializeBoardDeal),
      },
    ];

    return {
      kpi: {
        activeDeals: kpi.active,
        approved: kpi.approved,
        contractsReady: kpi.contracted,
        totalFrontGrossCents: kpi.totalFrontGrossCents,
      },
      columns,
    };
  });
}
