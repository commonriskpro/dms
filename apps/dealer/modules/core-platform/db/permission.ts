import { prisma } from "@/lib/db";

const defaultOrderBy = [{ module: "asc" as const }, { key: "asc" as const }];

function buildWhere(module?: string) {
  return module ? { module } : undefined;
}

export async function listPermissions(filters?: { module?: string }) {
  return prisma.permission.findMany({
    where: buildWhere(filters?.module),
    orderBy: defaultOrderBy,
  });
}

export async function listPermissionsPaginated(
  filters: { module?: string } | undefined,
  pagination: { limit: number; offset: number }
): Promise<{ data: Awaited<ReturnType<typeof prisma.permission.findMany>>; total: number }> {
  const where = buildWhere(filters?.module);
  const [data, total] = await Promise.all([
    prisma.permission.findMany({
      where,
      orderBy: defaultOrderBy,
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.permission.count({ where }),
  ]);
  return { data, total };
}

export async function getPermissionByKey(key: string) {
  return prisma.permission.findUnique({ where: { key } });
}

export async function getPermissionIdsByKeys(keys: string[]): Promise<string[]> {
  const rows = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
