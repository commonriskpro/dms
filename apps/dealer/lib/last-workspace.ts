/**
 * Last-workspace memory: persist and resolve the user's most recent top-level workspace
 * for smarter landing (mixed-role and returning users). Used only for landing at "/";
 * permission is always validated before redirecting.
 */

const STORAGE_KEY_PREFIX = "dms:last-workspace:v1";

/** Valid workspace keys we persist. Must match navigation / workspace roots. */
export const WORKSPACE_KEYS = [
  "sales",
  "inventory",
  "manager",
  "admin",
  "customers",
  "crm",
  "deals",
  "operations",
  "websites",
  "reports",
] as const;

export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

const WORKSPACE_KEY_SET = new Set<string>(WORKSPACE_KEYS);

/** Path for each workspace (landing destination). */
export const WORKSPACE_PATHS: Record<WorkspaceKey, string> = {
  sales: "/sales",
  inventory: "/inventory",
  manager: "/dashboard",
  admin: "/admin/dealership",
  customers: "/customers",
  crm: "/crm",
  deals: "/deals",
  operations: "/deals/operations",
  websites: "/websites",
  reports: "/reports",
};

/** Permissions required to access each workspace (any one grants access). */
const WORKSPACE_PERMISSIONS: Record<WorkspaceKey, string[]> = {
  sales: ["crm.read", "deals.read", "customers.read"],
  inventory: ["inventory.read"],
  manager: ["dashboard.read", "reports.read"],
  admin: [
    "admin.dealership.read",
    "admin.memberships.read",
    "admin.roles.read",
    "admin.audit.read",
    "admin.settings.manage",
    "admin.users.read",
  ],
  customers: ["customers.read"],
  crm: ["crm.read"],
  deals: ["deals.read"],
  operations: ["deals.read", "crm.read"],
  websites: ["websites.read"],
  reports: ["reports.read"],
};

function storageKey(dealershipId: string): string {
  return `${STORAGE_KEY_PREFIX}:${dealershipId}`;
}

/**
 * Get the path for a workspace key. Use for redirect.
 */
export function pathForWorkspace(key: WorkspaceKey): string {
  return WORKSPACE_PATHS[key];
}

/**
 * Check whether the user has permission to access the given workspace.
 */
export function canAccessWorkspace(key: WorkspaceKey, permissions: string[]): boolean {
  const perms = WORKSPACE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some((p) => permissions.includes(p));
}

/**
 * Get valid workspace keys the user can access (for landing fallback).
 */
export function getAccessibleWorkspaceKeys(permissions: string[]): WorkspaceKey[] {
  return WORKSPACE_KEYS.filter((k) => canAccessWorkspace(k, permissions));
}

/**
 * Read last workspace for this dealership. Returns null if missing or invalid.
 */
export function getLastWorkspace(dealershipId: string): WorkspaceKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(dealershipId));
    if (!raw) return null;
    const key = raw.trim();
    return WORKSPACE_KEY_SET.has(key) ? (key as WorkspaceKey) : null;
  } catch {
    return null;
  }
}

/**
 * Persist last workspace for this dealership. Only call with valid workspace key.
 */
export function setLastWorkspace(dealershipId: string, key: WorkspaceKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(dealershipId), key);
  } catch {
    // ignore storage errors
  }
}

/**
 * Map current pathname to a workspace key when user is inside a workspace.
 * Returns null for non-workspace or deep routes we don't treat as "primary" workspace.
 */
export function workspaceKeyForPath(pathname: string | null): WorkspaceKey | null {
  if (!pathname || typeof pathname !== "string") return null;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/sales") return "sales";
  if (path === "/inventory" || path.startsWith("/inventory/")) return "inventory";
  if (path === "/dashboard") return "manager";
  if (path.startsWith("/admin")) return "admin";
  if (path === "/customers" || path.startsWith("/customers/")) return "customers";
  if (path === "/crm" || path.startsWith("/crm/")) return "crm";
  if (path === "/deals/operations" || path.startsWith("/deals/operations")) return "operations";
  if (path === "/deals" || path.startsWith("/deals/")) return "deals";
  if (path === "/websites" || path.startsWith("/websites/")) return "websites";
  if (path === "/reports" || path.startsWith("/reports/")) return "reports";
  return null;
}
