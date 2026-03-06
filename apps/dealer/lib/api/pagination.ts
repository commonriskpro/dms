import { z } from "zod";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function parsePagination(query: unknown): PaginationQuery {
  return paginationQuerySchema.parse(query);
}

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};
