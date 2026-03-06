import { prisma } from "@/lib/db";

export type AuditFilters = {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
};

export async function listAuditLogs(
  dealershipId: string,
  limit: number,
  offset: number,
  filters?: AuditFilters
) {
  const where = {
    dealershipId,
    ...(filters?.entity && { entity: filters.entity }),
    ...(filters?.entityId && { entityId: filters.entityId }),
    ...(filters?.actorId && { actorId: filters.actorId }),
    ...(filters?.action && { action: filters.action }),
    ...(filters?.from || filters?.to
      ? {
          createdAt: {
            ...(filters.from && { gte: filters.from }),
            ...(filters.to && { lte: filters.to }),
          },
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { data, total };
}
