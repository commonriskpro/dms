import { prisma } from "@/lib/db";

export type UpsertFloorplanInput = {
  lenderId: string;
  principalCents: number;
  aprBps?: number | null;
  startDate: Date;
  nextCurtailmentDueDate?: Date | null;
};

export async function getByVehicleId(dealershipId: string, vehicleId: string) {
  return prisma.vehicleFloorplan.findFirst({
    where: { dealershipId, vehicleId },
    include: {
      lender: { select: { id: true, name: true } },
      curtailments: { orderBy: { paidAt: "desc" } },
    },
  });
}

export async function upsertFloorplan(
  dealershipId: string,
  vehicleId: string,
  data: UpsertFloorplanInput
) {
  return prisma.vehicleFloorplan.upsert({
    where: { vehicleId },
    create: {
      dealershipId,
      vehicleId,
      lenderId: data.lenderId,
      principalCents: data.principalCents,
      aprBps: data.aprBps ?? null,
      startDate: data.startDate,
      nextCurtailmentDueDate: data.nextCurtailmentDueDate ?? null,
    },
    update: {
      lenderId: data.lenderId,
      principalCents: data.principalCents,
      aprBps: data.aprBps ?? null,
      startDate: data.startDate,
      nextCurtailmentDueDate: data.nextCurtailmentDueDate ?? null,
    },
    include: {
      lender: { select: { id: true, name: true } },
      curtailments: { orderBy: { paidAt: "desc" } },
    },
  });
}

export async function addCurtailment(
  dealershipId: string,
  floorplanId: string,
  amountCents: number,
  paidAt: Date
) {
  return prisma.vehicleFloorplanCurtailment.create({
    data: {
      dealershipId,
      floorplanId,
      amountCents,
      paidAt,
    },
  });
}

export async function updatePayoffQuote(
  dealershipId: string,
  vehicleId: string,
  payoffQuoteCents: number,
  payoffQuoteExpiresAt: Date
) {
  return prisma.vehicleFloorplan.updateMany({
    where: { dealershipId, vehicleId },
    data: { payoffQuoteCents, payoffQuoteExpiresAt },
  });
}
