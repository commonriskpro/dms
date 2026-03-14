import type { LucideIcon } from "@/lib/ui/icons";
import {
  LayoutDashboard,
  Car,
  Users,
  Handshake,
  Megaphone,
  FileText,
  BarChart3,
  CheckCircle,
  ScanLine,
  PlusCircle,
  Workflow,
  TrendingUp,
  Globe,
  Settings,
} from "@/lib/ui/icons";

export type NavSubItemConfig = {
  label: string;
  href: string;
  permissions?: string[];
};

export type NavItemConfig = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
  showChevron?: boolean;
  /** Optional sub-menu items rendered as an expandable list below the parent. */
  children?: NavSubItemConfig[];
};

export type NavGroupConfig = {
  label: string;
  items: NavItemConfig[];
};

/**
 * Sidebar navigation grouped by workspaces and daily work.
 * Workspaces: Sales, Inventory, Manager (dashboard), Admin/Setup.
 * Daily work: queues, reports, intelligence, websites, integrations.
 */
export const APP_NAV_GROUPS: NavGroupConfig[] = [
  {
    label: "Workspaces",
    items: [
      { label: "Sales", href: "/sales", icon: TrendingUp, permissions: ["crm.read", "deals.read", "customers.read"] },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Car,
        permissions: ["inventory.read"],
        children: [
          { label: "Inventory List", href: "/inventory/list" },
          {
            label: "Acquisition",
            href: "/inventory/acquisition",
            permissions: ["inventory.acquisition.read"],
          },
          {
            label: "Appraisals",
            href: "/inventory/appraisals",
            permissions: ["inventory.appraisals.read"],
          },
        ],
      },
      { label: "Manager", href: "/dashboard", icon: LayoutDashboard, permissions: ["dashboard.read"] },
      {
        label: "Admin",
        href: "/admin/dealership",
        icon: Settings,
        permissions: ["admin.dealership.read", "admin.memberships.read", "admin.roles.read", "admin.audit.read", "admin.settings.manage", "admin.users.read"],
        children: [
          { label: "Dealership", href: "/admin/dealership", permissions: ["admin.dealership.read"] },
          { label: "Users & Roles", href: "/admin/users", permissions: ["admin.memberships.read", "admin.roles.read", "admin.users.read"] },
          { label: "Audit", href: "/admin/audit", permissions: ["admin.audit.read"] },
          { label: "Settings", href: "/settings", permissions: ["admin.settings.manage"] },
        ],
      },
    ],
  },
  {
    label: "Daily work",
    items: [
      {
        label: "CRM",
        href: "/crm",
        icon: Megaphone,
        permissions: ["crm.read"],
        children: [
          { label: "Command Center", href: "/crm" },
          { label: "Pipeline", href: "/crm/opportunities?view=board" },
          { label: "Inbox", href: "/crm/inbox" },
          { label: "Automation", href: "/crm/automations" },
          { label: "Jobs", href: "/crm/jobs" },
        ],
      },
      { label: "Customers", href: "/customers", icon: Users, permissions: ["customers.read"], children: [{ label: "Customer List", href: "/customers/list" }] },
      { label: "Deals", href: "/deals", icon: Handshake, permissions: ["deals.read"] },
      {
        label: "Operations",
        href: "/deals/operations",
        icon: Workflow,
        permissions: ["deals.read", "crm.read"],
        children: [
          { label: "Overview", href: "/deals/operations" },
          { label: "Title & DMV", href: "/deals/title", permissions: ["deals.read"] },
          { label: "Delivery & Funding", href: "/deals/delivery", permissions: ["deals.read"] },
          { label: "Tasks", href: "/crm/jobs", permissions: ["crm.read"] },
        ],
      },
      { label: "Reports", href: "/reports", icon: BarChart3, permissions: ["reports.read"] },
      {
        label: "Intelligence",
        href: "/inventory/dashboard",
        icon: ScanLine,
        permissions: ["inventory.read"],
      },
      {
        label: "Websites",
        href: "/websites",
        icon: Globe,
        permissions: ["websites.read"],
        children: [
          { label: "Overview", href: "/websites" },
          { label: "Theme & Branding", href: "/websites/theme" },
          { label: "Page configuration", href: "/websites/pages" },
          { label: "Publish", href: "/websites/publish" },
          { label: "Domains", href: "/websites/domains" },
          { label: "Analytics", href: "/websites/analytics" },
        ],
      },
      { label: "Integrations", href: "/lenders", icon: PlusCircle, permissions: ["finance.read", "finance.submissions.read"] },
    ],
  },
];
