/**
 * Last-workspace: keys, paths, permission checks, get/set, path mapping.
 */
import {
  WORKSPACE_KEYS,
  pathForWorkspace,
  canAccessWorkspace,
  getAccessibleWorkspaceKeys,
  getLastWorkspace,
  setLastWorkspace,
  workspaceKeyForPath,
} from "./last-workspace";

const STORAGE_KEY_PREFIX = "dms:last-workspace:v1";

describe("last-workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("pathForWorkspace", () => {
    it("returns correct path for each workspace key", () => {
      expect(pathForWorkspace("sales")).toBe("/sales");
      expect(pathForWorkspace("inventory")).toBe("/inventory");
      expect(pathForWorkspace("manager")).toBe("/dashboard");
      expect(pathForWorkspace("admin")).toBe("/admin/dealership");
      expect(pathForWorkspace("customers")).toBe("/customers");
      expect(pathForWorkspace("crm")).toBe("/crm");
      expect(pathForWorkspace("deals")).toBe("/deals");
      expect(pathForWorkspace("operations")).toBe("/deals/operations");
      expect(pathForWorkspace("websites")).toBe("/websites");
      expect(pathForWorkspace("reports")).toBe("/reports");
    });
  });

  describe("canAccessWorkspace", () => {
    it("returns true when user has any required permission", () => {
      expect(canAccessWorkspace("sales", ["crm.read"])).toBe(true);
      expect(canAccessWorkspace("sales", ["deals.read"])).toBe(true);
      expect(canAccessWorkspace("sales", ["customers.read"])).toBe(true);
      expect(canAccessWorkspace("inventory", ["inventory.read"])).toBe(true);
      expect(canAccessWorkspace("manager", ["dashboard.read"])).toBe(true);
      expect(canAccessWorkspace("manager", ["reports.read"])).toBe(true);
      expect(canAccessWorkspace("admin", ["admin.dealership.read"])).toBe(true);
    });

    it("returns false when user has no required permission", () => {
      expect(canAccessWorkspace("sales", [])).toBe(false);
      expect(canAccessWorkspace("sales", ["inventory.read"])).toBe(false);
      expect(canAccessWorkspace("inventory", ["crm.read"])).toBe(false);
      expect(canAccessWorkspace("admin", ["crm.read"])).toBe(false);
    });
  });

  describe("getAccessibleWorkspaceKeys", () => {
    it("returns only keys user can access", () => {
      const keys = getAccessibleWorkspaceKeys(["crm.read", "inventory.read"]);
      expect(keys).toContain("sales");
      expect(keys).toContain("crm");
      expect(keys).toContain("inventory");
      expect(keys).not.toContain("admin");
    });
  });

  describe("getLastWorkspace / setLastWorkspace", () => {
    it("returns null when nothing stored", () => {
      expect(getLastWorkspace("dealer-1")).toBe(null);
    });

    it("persists and returns valid key per dealership", () => {
      setLastWorkspace("dealer-1", "sales");
      expect(getLastWorkspace("dealer-1")).toBe("sales");
      setLastWorkspace("dealer-2", "inventory");
      expect(getLastWorkspace("dealer-2")).toBe("inventory");
      expect(getLastWorkspace("dealer-1")).toBe("sales");
    });

    it("returns null for invalid or unknown key in storage", () => {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:dealer-1`, "invalid");
      expect(getLastWorkspace("dealer-1")).toBe(null);
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:dealer-2`, "sales");
      expect(getLastWorkspace("dealer-2")).toBe("sales");
    });
  });

  describe("workspaceKeyForPath", () => {
    it("maps top-level workspace paths to keys", () => {
      expect(workspaceKeyForPath("/sales")).toBe("sales");
      expect(workspaceKeyForPath("/inventory")).toBe("inventory");
      expect(workspaceKeyForPath("/dashboard")).toBe("manager");
      expect(workspaceKeyForPath("/admin/dealership")).toBe("admin");
      expect(workspaceKeyForPath("/customers")).toBe("customers");
      expect(workspaceKeyForPath("/crm")).toBe("crm");
      expect(workspaceKeyForPath("/deals")).toBe("deals");
      expect(workspaceKeyForPath("/deals/operations")).toBe("operations");
      expect(workspaceKeyForPath("/websites")).toBe("websites");
      expect(workspaceKeyForPath("/reports")).toBe("reports");
    });

    it("maps nested paths to parent workspace", () => {
      expect(workspaceKeyForPath("/inventory/list")).toBe("inventory");
      expect(workspaceKeyForPath("/crm/opportunities")).toBe("crm");
      expect(workspaceKeyForPath("/admin/users")).toBe("admin");
      expect(workspaceKeyForPath("/deals/123")).toBe("deals");
      expect(workspaceKeyForPath("/deals/operations/foo")).toBe("operations");
    });

    it("strips query and trailing slash", () => {
      expect(workspaceKeyForPath("/sales?foo=1")).toBe("sales");
      expect(workspaceKeyForPath("/sales/")).toBe("sales");
    });

    it("returns null for non-workspace paths", () => {
      expect(workspaceKeyForPath("/")).toBe(null);
      expect(workspaceKeyForPath("/login")).toBe(null);
      expect(workspaceKeyForPath("/get-started")).toBe(null);
      expect(workspaceKeyForPath(null)).toBe(null);
    });
  });
});
