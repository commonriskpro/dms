/**
 * Shared guard for CRM UI: only allow data fetches when user has crm.read.
 * Used by all CRM pages so effects and fetch callbacks do not run without permission.
 */
export function shouldFetchCrm(canRead: boolean): boolean {
  return !!canRead;
}
