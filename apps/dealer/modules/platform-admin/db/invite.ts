import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { DealershipInviteStatus } from "@prisma/client";

export type InviteFilters = {
  status?: DealershipInviteStatus;
};

export type Pagination = {
  limit: number;
  offset: number;
};

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getInviteByToken(token: string) {
  return prisma.dealershipInvite.findUnique({
    where: { token },
    include: {
      dealership: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function getInviteById(id: string) {
  return prisma.dealershipInvite.findUnique({
    where: { id },
    include: {
      dealership: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
    },
  });
}

export async function listInvitesByDealership(
  dealershipId: string,
  filters: InviteFilters,
  pagination: Pagination
) {
  const where = {
    dealershipId,
    ...(filters.status && { status: filters.status }),
  };
  const [data, total] = await Promise.all([
    prisma.dealershipInvite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pagination.limit,
      skip: pagination.offset,
      include: {
        role: { select: { id: true, name: true } },
      },
    }),
    prisma.dealershipInvite.count({ where }),
  ]);
  return { data, total };
}

export type CreateInviteData = {
  dealershipId: string;
  email: string;
  roleId: string;
  status?: DealershipInviteStatus;
  expiresAt?: Date | null;
  createdBy?: string | null;
  token: string;
  dealerApplicationId?: string | null;
};

export async function createInvite(data: CreateInviteData) {
  return prisma.dealershipInvite.create({
    data: {
      dealershipId: data.dealershipId,
      email: data.email,
      roleId: data.roleId,
      status: data.status ?? "PENDING",
      expiresAt: data.expiresAt ?? null,
      createdBy: data.createdBy ?? null,
      token: data.token,
      dealerApplicationId: data.dealerApplicationId ?? null,
    },
    include: {
      role: { select: { id: true, name: true } },
    },
  });
}

export async function updateInviteStatus(
  id: string,
  status: DealershipInviteStatus,
  acceptedAt?: Date | null,
  acceptedByUserId?: string | null
) {
  return prisma.dealershipInvite.update({
    where: { id },
    data: {
      status,
      ...(acceptedAt !== undefined && { acceptedAt }),
      ...(acceptedByUserId !== undefined && { acceptedByUserId }),
    },
    include: {
      role: { select: { id: true, name: true } },
    },
  });
}

export async function updateInviteTokenAndExpiry(
  id: string,
  token: string,
  expiresAt?: Date | null
) {
  return prisma.dealershipInvite.update({
    where: { id },
    data: { token, ...(expiresAt !== undefined && { expiresAt }) },
    include: {
      role: { select: { id: true, name: true } },
    },
  });
}

/** Find a pending invite for the same dealership + email (for idempotent create). */
export async function findPendingInviteByDealershipAndEmail(
  dealershipId: string,
  email: string
) {
  return prisma.dealershipInvite.findFirst({
    where: {
      dealershipId,
      email: email.toLowerCase(),
      status: "PENDING",
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      role: { select: { id: true, name: true } },
    },
  });
}

/** Check if user has any PENDING invite by email (for get-started "check inbox" CTA). No token exposure. */
export async function hasPendingInviteByEmail(email: string): Promise<boolean> {
  if (!email?.trim()) return false;
  const count = await prisma.dealershipInvite.count({
    where: {
      email: email.toLowerCase().trim(),
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return count > 0;
}

/** Get latest owner invite for dealership + email (for status display). Owner = role.name === "Owner". */
export async function getLatestOwnerInviteByDealershipAndEmail(
  dealershipId: string,
  email: string
) {
  const ownerRole = await prisma.role.findFirst({
    where: { dealershipId, name: "Owner", deletedAt: null },
    select: { id: true },
  });
  if (!ownerRole) return null;
  return prisma.dealershipInvite.findFirst({
    where: {
      dealershipId,
      email: email.toLowerCase(),
      roleId: ownerRole.id,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
    },
  });
}
