type ListMeta = {
  total: number;
  limit: number;
  offset: number;
};

export type ListPayload<T> = {
  data: T[];
  meta: ListMeta;
};

export function listPayload<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): ListPayload<T> {
  return {
    data,
    meta: { total, limit, offset },
  };
}

