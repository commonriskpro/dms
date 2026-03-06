export function serializeOpportunity<T extends { estimatedValueCents?: bigint | null }>(o: T): Omit<T, "estimatedValueCents"> & { estimatedValueCents: string | null } {
  const { estimatedValueCents, ...rest } = o;
  return {
    ...rest,
    estimatedValueCents: estimatedValueCents != null ? String(estimatedValueCents) : null,
  } as Omit<T, "estimatedValueCents"> & { estimatedValueCents: string | null };
}
