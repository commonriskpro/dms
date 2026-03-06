/**
 * Builds URL query params for platform audit list API.
 * Only includes non-empty values. Used for shareable audit URLs.
 */
export type AuditQueryFilters = {
  action?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: string;
  dateTo?: string;
  actor?: string;
  limit?: number;
  offset?: number;
};

export function buildAuditQueryParams(filters: AuditQueryFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.action?.trim()) params.action = filters.action.trim();
  if (filters.targetType?.trim()) params.targetType = filters.targetType.trim();
  if (filters.targetId?.trim()) params.targetId = filters.targetId.trim();
  if (filters.dateFrom?.trim()) params.dateFrom = filters.dateFrom.trim();
  if (filters.dateTo?.trim()) params.dateTo = filters.dateTo.trim();
  if (filters.actor?.trim()) params.actor = filters.actor.trim();
  params.limit = String(filters.limit ?? 20);
  params.offset = String(filters.offset ?? 0);
  return params;
}

/**
 * Returns query string for audit list (e.g. for fetch or URL).
 */
export function buildAuditQueryString(filters: AuditQueryFilters): string {
  return new URLSearchParams(buildAuditQueryParams(filters)).toString();
}
