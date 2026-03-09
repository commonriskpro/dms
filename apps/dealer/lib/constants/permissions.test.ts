/** @jest-environment node */

import {
  ALL_REMOVED_DEALER_PERMISSION_KEYS,
  DEALER_PERMISSION_KEYS,
  DEALERCENTER_ROLE_TEMPLATES,
  DEFAULT_SYSTEM_ROLE_KEYS,
  LEGACY_PERMISSION_RENAMES,
} from "./permissions";

describe("dealer permission catalog", () => {
  it("contains only canonical dealer permissions", () => {
    expect(DEALER_PERMISSION_KEYS).toContain("dashboard.read");
    expect(DEALER_PERMISSION_KEYS).toContain("inventory.read");
    expect(DEALER_PERMISSION_KEYS).toContain("inventory.write");
    expect(DEALER_PERMISSION_KEYS).toContain("inventory.publish.write");
    expect(DEALER_PERMISSION_KEYS).toContain("finance.submissions.read");
    expect(DEALER_PERMISSION_KEYS).toContain("finance.submissions.write");
    expect(DEALER_PERMISSION_KEYS).toContain("reports.export");
    expect(DEALER_PERMISSION_KEYS).toContain("admin.settings.manage");

    expect(DEALER_PERMISSION_KEYS).not.toContain("inventory.publish.read");
    expect(DEALER_PERMISSION_KEYS).not.toContain("inventory.create");
    expect(DEALER_PERMISSION_KEYS).not.toContain("customers.delete");
    expect(DEALER_PERMISSION_KEYS).not.toContain("deals.approve");
    expect(DEALER_PERMISSION_KEYS).not.toContain("finance.update");
    expect(DEALER_PERMISSION_KEYS).not.toContain("platform.read");
    expect(DEALER_PERMISSION_KEYS).not.toContain("appointments.read");
    expect(DEALER_PERMISSION_KEYS).not.toContain("integrations.read");
  });

  it("tracks only the explicit old-to-new permission aliases that still need migration", () => {
    expect(LEGACY_PERMISSION_RENAMES).toEqual({
      "audit.read": "admin.audit.read",
      "inventory.publish.read": "inventory.read",
    });
  });

  it("keeps removed dealer permission keys out of default roles and templates", () => {
    const activeRoleKeys = [
      ...Object.values(DEFAULT_SYSTEM_ROLE_KEYS).flat(),
      ...DEALERCENTER_ROLE_TEMPLATES.flatMap((template) => template.permissionKeys),
    ];

    for (const removedKey of ALL_REMOVED_DEALER_PERMISSION_KEYS) {
      expect(activeRoleKeys).not.toContain(removedKey);
    }
  });

  it("uses only canonical permission keys in every seeded role set", () => {
    const canonicalKeys = new Set(DEALER_PERMISSION_KEYS);

    for (const [roleName, permissionKeys] of Object.entries(DEFAULT_SYSTEM_ROLE_KEYS)) {
      for (const permissionKey of permissionKeys) {
        expect(canonicalKeys.has(permissionKey)).toBe(true);
      }
      expect(permissionKeys.length).toBeGreaterThan(0);
      expect(roleName.length).toBeGreaterThan(0);
    }

    for (const template of DEALERCENTER_ROLE_TEMPLATES) {
      for (const permissionKey of template.permissionKeys) {
        expect(canonicalKeys.has(permissionKey)).toBe(true);
      }
      expect(template.permissionKeys.length).toBeGreaterThan(0);
    }
  });
});
