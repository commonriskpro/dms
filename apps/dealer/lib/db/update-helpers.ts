/**
 * Shared helpers for update operations in the dealer app db layer.
 */

/**
 * Standard soft-delete payload. Pass to Prisma `update({ data: softDeleteData(userId) })`.
 * Eliminates the 5-copy `{ deletedAt: new Date(), deletedBy }` pattern.
 */
export function softDeleteData(deletedBy: string): { deletedAt: Date; deletedBy: string } {
  return { deletedAt: new Date(), deletedBy };
}
