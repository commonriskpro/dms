/**
 * Shared pagination helper for the dealer app db layer.
 * Eliminates the 12-copy Promise.all([findMany, count]) pattern.
 */

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/**
 * Run a findMany + count query concurrently and return { data, total }.
 * Both queries must use the same `where` clause for correctness.
 *
 * Usage:
 *   return paginatedQuery(
 *     () => prisma.vehicle.findMany({ where, orderBy, take: limit, skip: offset }),
 *     () => prisma.vehicle.count({ where })
 *   );
 */
export async function paginatedQuery<T>(
  findMany: () => Promise<T[]>,
  count: () => Promise<number>
): Promise<PaginatedResult<T>> {
  const [data, total] = await Promise.all([findMany(), count()]);
  return { data, total };
}
