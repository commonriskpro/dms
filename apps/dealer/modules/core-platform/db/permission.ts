import { prisma } from "@/lib/db";

export async function listPermissionsCatalog() {
  return prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { key: "asc" }],
    select: { id: true, key: true, description: true, module: true },
  });
}

export async function listPermissionsPaginated(
  where?: { module?: string },
  options: { limit: number; offset: number } = { limit: 100, offset: 0 }
) {
  const [data, total] = await Promise.all([
    prisma.permission.findMany({
      where: where ?? undefined,
      orderBy: [{ module: "asc" }, { key: "asc" }],
      take: options.limit,
      skip: options.offset,
      select: { id: true, key: true, description: true, module: true },
    }),
    prisma.permission.count({ where: where ?? undefined }),
  ]);
  return { data, total };
}
