import { prisma } from "@/lib/db";
import type { FloorplanLoanStatus } from "@prisma/client";

export type FloorplanLoanCreateInput = {
  dealershipId: string;
  vehicleId: string;
  lender: string;
  principalCents: number;
  interestBps?: number | null;
  startDate: Date;
  curtailmentDate?: Date | null;
  status?: FloorplanLoanStatus;
  notes?: string | null;
};

export type FloorplanLoanUpdateInput = {
  lender?: string;
  principalCents?: number;
  interestBps?: number | null;
  startDate?: Date;
  curtailmentDate?: Date | null;
  status?: FloorplanLoanStatus;
  notes?: string | null;
};

export async function listByVehicleId(
  dealershipId: string,
  vehicleId: string,
  options?: { includeHistory?: boolean }
) {
  const where: { dealershipId: string; vehicleId: string; status?: FloorplanLoanStatus } = {
    dealershipId,
    vehicleId,
  };
  if (options?.includeHistory !== true) {
    where.status = "ACTIVE";
  }
  return prisma.floorplanLoan.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getById(dealershipId: string, id: string) {
  return prisma.floorplanLoan.findFirst({
    where: { id, dealershipId },
  });
}

export async function createFloorplanLoan(data: FloorplanLoanCreateInput) {
  return prisma.floorplanLoan.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      lender: data.lender,
      principalCents: data.principalCents,
      interestBps: data.interestBps ?? undefined,
      startDate: data.startDate,
      curtailmentDate: data.curtailmentDate ?? undefined,
      status: data.status ?? "ACTIVE",
      notes: data.notes ?? undefined,
    },
  });
}

export async function updateFloorplanLoan(
  dealershipId: string,
  id: string,
  data: FloorplanLoanUpdateInput
) {
  const existing = await prisma.floorplanLoan.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Partial<{
    lender: string;
    principalCents: number;
    interestBps: number | null;
    startDate: Date;
    curtailmentDate: Date | null;
    status: FloorplanLoanStatus;
    notes: string | null;
  }> = { ...data };
  if (data.status === "PAID_OFF" || data.status === "SOLD") {
    payload.curtailmentDate = data.curtailmentDate ?? new Date();
  }
  return prisma.floorplanLoan.update({
    where: { id },
    data: payload,
  });
}

export async function getActiveByVehicleId(
  dealershipId: string,
  vehicleId: string
) {
  return prisma.floorplanLoan.findFirst({
    where: { dealershipId, vehicleId, status: "ACTIVE" },
  });
}

/** Count vehicles with ACTIVE floor plan loan and curtailmentDate before today (overdue). */
export async function countOverdue(dealershipId: string): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return prisma.floorplanLoan.count({
    where: {
      dealershipId,
      status: "ACTIVE",
      curtailmentDate: { lt: startOfToday },
    },
  });
}
