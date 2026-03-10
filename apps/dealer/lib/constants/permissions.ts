export type PermissionCatalogEntry = {
  key: string;
  description: string;
  module: string;
};

export type DealerRoleTemplate = {
  key: string;
  name: string;
  permissionKeys: string[];
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export const DEALER_PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { key: "admin.dealership.read", description: "View dealership and location settings", module: "admin" },
  { key: "admin.dealership.write", description: "Update dealership and locations", module: "admin" },
  { key: "admin.memberships.read", description: "List members and membership details", module: "admin" },
  { key: "admin.memberships.write", description: "Invite members and update membership state", module: "admin" },
  { key: "admin.roles.read", description: "List roles and their permissions", module: "admin" },
  { key: "admin.roles.write", description: "Create, update, and delete roles", module: "admin" },
  { key: "admin.roles.assign", description: "Assign roles to users", module: "admin" },
  { key: "admin.permissions.read", description: "List the dealer permission catalog", module: "admin" },
  { key: "admin.permissions.manage", description: "Manage per-user permission overrides", module: "admin" },
  { key: "admin.users.read", description: "List and view users", module: "admin" },
  { key: "admin.users.invite", description: "Invite users", module: "admin" },
  { key: "admin.users.update", description: "Update user profile and role assignments", module: "admin" },
  { key: "admin.users.disable", description: "Disable users", module: "admin" },
  { key: "admin.audit.read", description: "List and filter audit logs", module: "admin" },
  { key: "admin.settings.manage", description: "Manage dealership-wide shared settings", module: "admin" },
  { key: "dashboard.read", description: "Access the dealer dashboard shell and dashboard APIs", module: "dashboard" },
  { key: "inventory.read", description: "View vehicles and inventory data", module: "inventory" },
  { key: "inventory.write", description: "Create, update, and delete vehicles and inventory data", module: "inventory" },
  { key: "inventory.acquisition.read", description: "View the acquisition pipeline", module: "inventory" },
  { key: "inventory.acquisition.write", description: "Create and update acquisition leads and stages", module: "inventory" },
  { key: "inventory.appraisals.read", description: "View appraisals", module: "inventory" },
  { key: "inventory.appraisals.write", description: "Create, update, approve, reject, and convert appraisals", module: "inventory" },
  { key: "inventory.auctions.read", description: "Search and view auction listings", module: "inventory" },
  { key: "inventory.pricing.read", description: "View pricing rules and pricing previews", module: "inventory" },
  { key: "inventory.pricing.write", description: "Create pricing rules and apply pricing actions", module: "inventory" },
  { key: "inventory.publish.write", description: "Publish and unpublish vehicle listings", module: "inventory" },
  { key: "customers.read", description: "View customer profiles and activity", module: "customers" },
  { key: "customers.write", description: "Create and update customers, notes, tasks, and outreach", module: "customers" },
  { key: "crm.read", description: "View pipelines, opportunities, inbox, automations, and sequences", module: "crm" },
  { key: "crm.write", description: "Create and update pipelines, opportunities, inbox actions, automations, and sequences", module: "crm" },
  { key: "deals.read", description: "View deals and deal structure", module: "deals" },
  { key: "deals.write", description: "Create and update deals, fees, delivery, and title workflows", module: "deals" },
  { key: "documents.read", description: "List file metadata and get signed URLs", module: "documents" },
  { key: "documents.write", description: "Upload, delete, and manage file metadata", module: "documents" },
  { key: "finance.read", description: "View finance shell data and floorplan status", module: "finance" },
  { key: "finance.write", description: "Create and update finance shell data and lender submissions", module: "finance" },
  { key: "finance.submissions.read", description: "View applications, submissions, decisions, stipulations, and funding", module: "finance" },
  { key: "finance.submissions.write", description: "Create and update applications, submissions, decisions, stipulations, and funding", module: "finance" },
  { key: "lenders.read", description: "View lender directory and submission metadata", module: "lenders" },
  { key: "lenders.write", description: "Create, update, and disable lenders", module: "lenders" },
  { key: "reports.read", description: "View reports", module: "reports" },
  { key: "reports.export", description: "Export reports", module: "reports" },
];

export const DEALER_PERMISSION_KEYS = DEALER_PERMISSION_CATALOG.map((entry) => entry.key);

export const LEGACY_PERMISSION_RENAMES: Record<string, string> = {
  "audit.read": "admin.audit.read",
  "inventory.publish.read": "inventory.read",
};

export const REMOVED_DEALER_PERMISSION_KEYS = [
  "audit.read",
  "inventory.publish.read",
  "platform.admin.read",
  "platform.admin.write",
  "platform.read",
  "platform.write",
  "platform.impersonate",
  "inventory.create",
  "inventory.update",
  "inventory.delete",
  "inventory.export",
  "customers.create",
  "customers.update",
  "customers.delete",
  "customers.export",
  "crm.create",
  "crm.update",
  "crm.delete",
  "crm.export",
  "deals.create",
  "deals.update",
  "deals.delete",
  "deals.export",
  "deals.approve",
  "appointments.read",
  "appointments.create",
  "appointments.update",
  "appointments.cancel",
  "finance.update",
  "finance.approve",
  "bhph.read",
  "bhph.write",
  "integrations.read",
  "integrations.manage",
  "integrations.quickbooks.read",
  "integrations.quickbooks.write",
];

export const DEFAULT_SYSTEM_ROLE_KEYS: Record<"Owner" | "Admin" | "Sales" | "Finance", string[]> = {
  Owner: [...DEALER_PERMISSION_KEYS],
  Admin: DEALER_PERMISSION_CATALOG.filter((entry) => entry.key !== "admin.roles.write").map((entry) => entry.key),
  Sales: [
    "inventory.read",
    "inventory.write",
    "customers.read",
    "customers.write",
    "deals.read",
    "deals.write",
    "documents.read",
    "documents.write",
    "finance.read",
    "lenders.read",
    "finance.submissions.read",
    "reports.read",
    "dashboard.read",
    "crm.read",
    "crm.write",
  ],
  Finance: [
    "inventory.read",
    "customers.read",
    "deals.read",
    "deals.write",
    "documents.read",
    "documents.write",
    "finance.read",
    "finance.write",
    "lenders.read",
    "lenders.write",
    "finance.submissions.read",
    "finance.submissions.write",
    "reports.read",
    "reports.export",
    "dashboard.read",
    "crm.read",
    "crm.write",
  ],
};

export const ALL_PROVISION_PERMISSION_KEYS = unique(
  Object.values(DEFAULT_SYSTEM_ROLE_KEYS).flat()
);

export const DEALERCENTER_ROLE_TEMPLATES: DealerRoleTemplate[] = [
  {
    key: "SALES_ASSOCIATE",
    name: "Sales Associate",
    permissionKeys: [
      "dashboard.read",
      "customers.read",
      "customers.write",
      "crm.read",
      "crm.write",
      "deals.read",
      "deals.write",
    ],
  },
  {
    key: "SALES_MANAGER",
    name: "Sales Manager",
    permissionKeys: unique([
      ...DEFAULT_SYSTEM_ROLE_KEYS.Sales,
      "reports.export",
    ]),
  },
  {
    key: "ACCOUNTING",
    name: "Accounting",
    permissionKeys: [
      "dashboard.read",
      "deals.read",
      "deals.write",
      "documents.read",
      "documents.write",
      "finance.read",
      "finance.write",
      "lenders.read",
      "lenders.write",
      "finance.submissions.read",
      "finance.submissions.write",
      "reports.read",
      "reports.export",
      "admin.audit.read",
    ],
  },
  {
    key: "ADMIN_ASSISTANT",
    name: "Admin Assistant",
    permissionKeys: [
      "dashboard.read",
      "customers.read",
      "customers.write",
      "crm.read",
      "crm.write",
      "deals.read",
    ],
  },
  {
    key: "INVENTORY_MANAGER",
    name: "Inventory Manager",
    permissionKeys: [
      "inventory.read",
      "inventory.write",
      "inventory.acquisition.read",
      "inventory.acquisition.write",
      "inventory.appraisals.read",
      "inventory.appraisals.write",
      "inventory.auctions.read",
      "inventory.pricing.read",
      "inventory.pricing.write",
      "inventory.publish.write",
      "documents.read",
      "documents.write",
      "deals.read",
      "reports.read",
    ],
  },
  {
    key: "DEALER_ADMIN",
    name: "Dealer Admin",
    permissionKeys: [...DEALER_PERMISSION_KEYS],
  },
  {
    key: "OWNER",
    name: "Owner",
    permissionKeys: [...DEALER_PERMISSION_KEYS],
  },
];

export const ALL_REMOVED_DEALER_PERMISSION_KEYS = unique([
  ...Object.keys(LEGACY_PERMISSION_RENAMES),
  ...REMOVED_DEALER_PERMISSION_KEYS,
]);
