export function toBigIntOrUndefined(
  value: string | number | bigint | null | undefined
): bigint | undefined {
  return value == null ? undefined : BigInt(value);
}

export function toBigIntOrNull(
  value: string | number | bigint | null | undefined
): bigint | null {
  return value == null ? null : BigInt(value);
}
