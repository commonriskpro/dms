/**
 * Client-safe entitlement helpers (no server-only imports).
 * Use in "use client" components for nav gating and module guards.
 */
import type { EntitlementsResponse } from "@dms/contracts";

/** Map module key (from entitlements) to permission key(s) that grant access. At least one required. */
const MODULE_TO_PERMISSIONS: Record<string, string[]> = {
  dashboard: ["dashboard.read"],
  inventory: ["inventory.read", "inventory.write"],
  customers: ["customers.read", "customers.write"],
  crm: ["crm.read", "crm.write"],
  deals: ["deals.read", "deals.write"],
  reports: ["reports.read", "reports.export"],
  documents: ["documents.read", "documents.write"],
  finance: ["finance.read", "finance.write"],
  accounting: ["finance.submissions.read", "finance.submissions.write", "finance.read", "finance.write"],
  websites: ["websites.read", "websites.write"],
  settings: ["settings.read", "settings.write", "admin.dealership.read", "admin.dealership.write"],
  admin: ["admin.read", "admin.write", "admin.users.read", "admin.users.write", "admin.roles.read", "admin.roles.write"],
};

/**
 * Returns true only if the module is enabled in entitlements AND the user has at least one of the required permissions.
 * Use for entitlement-aware UI/API gating: entitlement enabled && permission granted.
 */
export function canAccessModule(
  entitlements: EntitlementsResponse | null,
  userPermissions: string[],
  moduleKey: string
): boolean {
  if (!entitlements || !entitlements.modules.includes(moduleKey)) return false;
  const required = MODULE_TO_PERMISSIONS[moduleKey];
  if (!required?.length) return true;
  return required.some((p) => userPermissions.includes(p));
}

/**
 * For nav only: show item when no moduleKey (permission-only), or when entitlements absent (fail open), or when canAccessModule.
 */
export function canShowModuleInNav(
  entitlements: EntitlementsResponse | null,
  userPermissions: string[],
  moduleKey: string | undefined
): boolean {
  if (!moduleKey) return true;
  if (!entitlements) return true;
  return canAccessModule(entitlements, userPermissions, moduleKey);
}
