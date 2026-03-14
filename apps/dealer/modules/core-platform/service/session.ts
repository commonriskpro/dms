import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { getActiveDealershipId, setActiveDealershipForUser } from "@/lib/tenant";
import { loadUserPermissions } from "@/lib/rbac";

type RequestMeta = { ip?: string; userAgent?: string };

export type CurrentDealershipSummary = {
  data: {
    dealershipId: string;
    dealershipName: string;
    roleKey: string | null;
    roleName: string;
  } | null;
  availableCount: number;
};

export type UserDealershipListItem = {
  dealershipId: string;
  dealershipName: string;
  roleKey: string | null;
  roleName: string;
  isActive: boolean;
};

export async function getCurrentDealershipSummary(
  userId: string,
  request?: NextRequest
): Promise<CurrentDealershipSummary> {
  const activeId = await getActiveDealershipId(userId, request);
  if (!activeId) {
    const count = await prisma.membership.count({
      where: { userId, disabledAt: null },
    });
    return {
      data: null,
      availableCount: count,
    };
  }

  const [dealership, membership, availableCount] = await Promise.all([
    prisma.dealership.findUnique({
      where: { id: activeId },
      select: { id: true, name: true },
    }),
    prisma.membership.findFirst({
      where: { userId, dealershipId: activeId, disabledAt: null },
      select: { role: { select: { key: true, name: true } } },
    }),
    prisma.membership.count({
      where: { userId, disabledAt: null },
    }),
  ]);

  if (!dealership) {
    return {
      data: null,
      availableCount: 0,
    };
  }

  return {
    data: {
      dealershipId: dealership.id,
      dealershipName: dealership.name,
      roleKey: membership?.role.key ?? null,
      roleName: membership?.role.name ?? "—",
    },
    availableCount,
  };
}

export async function listUserDealerships(
  userId: string,
  options?: { activeDealershipId?: string | null }
): Promise<UserDealershipListItem[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, disabledAt: null },
    select: {
      dealershipId: true,
      dealership: { select: { id: true, name: true } },
      role: { select: { key: true, name: true } },
    },
  });

  return memberships.map((membership) => ({
    dealershipId: membership.dealership.id,
    dealershipName: membership.dealership.name,
    roleKey: membership.role.key ?? null,
    roleName: membership.role.name,
    isActive: membership.dealershipId === options?.activeDealershipId,
  }));
}

export async function getCurrentUserContextSummary(input: {
  dealershipId: string;
  userId: string;
  email: string;
  permissions: string[];
}) {
  const dealership = await prisma.dealership.findUnique({
    where: { id: input.dealershipId },
    select: { id: true, name: true },
  });

  return {
    user: { id: input.userId, email: input.email },
    dealership: dealership
      ? { id: dealership.id, name: dealership.name }
      : { id: input.dealershipId, name: undefined },
    permissions: input.permissions,
  };
}

export type SwitchActiveDealershipInput = {
  userId: string;
  email: string;
  dealershipId: string;
  meta?: RequestMeta;
  includeSessionEnvelope?: boolean;
};

export type SwitchActiveDealershipResult = {
  dealership: { id: string; name: string };
  role: { key: string | null; name: string } | null;
  permissions?: string[];
  user?:
    | {
        id: string;
        email: string;
        fullName?: string;
        avatarUrl?: string;
      }
    | undefined;
};

export async function switchActiveDealership(
  input: SwitchActiveDealershipInput
): Promise<SwitchActiveDealershipResult> {
  const [membership, dealership, previousRow] = await Promise.all([
    prisma.membership.findFirst({
      where: {
        userId: input.userId,
        dealershipId: input.dealershipId,
        disabledAt: null,
      },
      select: {
        role: { select: { key: true, name: true } },
      },
    }),
    prisma.dealership.findUnique({
      where: { id: input.dealershipId },
      select: { id: true, name: true, lifecycleStatus: true, isActive: true },
    }),
    prisma.userActiveDealership.findUnique({
      where: { userId: input.userId },
      select: { activeDealershipId: true },
    }),
  ]);

  if (!membership) {
    throw new ApiError("FORBIDDEN", "Not a member of this dealership");
  }

  if (!dealership || dealership.lifecycleStatus === "CLOSED") {
    throw new ApiError("FORBIDDEN", "Dealership not available");
  }

  if (!dealership.isActive) {
    throw new ApiError("FORBIDDEN", "Dealership not active");
  }

  await setActiveDealershipForUser(input.userId, input.dealershipId);

  await auditLog({
    dealershipId: input.dealershipId,
    actorUserId: input.userId,
    action: "auth.dealership_switched",
    entity: "UserActiveDealership",
    metadata: {
      previousDealershipId: previousRow?.activeDealershipId ?? undefined,
      newDealershipId: input.dealershipId,
    },
    ip: input.meta?.ip,
    userAgent: input.meta?.userAgent,
  });

  if (!input.includeSessionEnvelope) {
    return {
      dealership: { id: dealership.id, name: dealership.name },
      role: membership.role ?? null,
    };
  }

  const [permissions, profile] = await Promise.all([
    loadUserPermissions(input.userId, input.dealershipId),
    prisma.profile.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
    }),
  ]);

  return {
    dealership: { id: dealership.id, name: dealership.name },
    role: membership.role ?? null,
    permissions,
    user: profile
      ? {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName ?? undefined,
          avatarUrl: profile.avatarUrl ?? undefined,
        }
      : {
          id: input.userId,
          email: input.email,
        },
  };
}
