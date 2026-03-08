import type { LucideIcon } from "@/lib/ui/icons";
import {
  LayoutDashboard,
  Car,
  Users,
  Handshake,
  Megaphone,
  Banknote,
  BarChart3,
  Settings,
  Workflow,
} from "@/lib/ui/icons";

export type NavSubItemConfig = {
  label: string;
  href: string;
};

export type NavItemConfig = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
  /** Optional sub-menu items rendered as an expandable list below the parent. */
  children?: NavSubItemConfig[];
};

export type NavGroupConfig = {
  label: string;
  items: NavItemConfig[];
};

export const APP_NAV_GROUPS: NavGroupConfig[] = [
  {
    label: "Dashboard",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory",
    items: [
      {
        label: "Vehicles",
        href: "/inventory",
        icon: Car,
        permissions: ["inventory.read"],
        children: [
          { label: "List",  href: "/inventory?view=list" },
          { label: "Aging", href: "/inventory/aging" },
        ],
      },
      { label: "Acquisition", href: "/inventory/acquisition", icon: Workflow, permissions: ["inventory.acquisition.read", "inventory.read"] },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Opportunities", href: "/crm/opportunities", icon: Megaphone, permissions: ["crm.read"] },
      { label: "Customers", href: "/customers", icon: Users, permissions: ["customers.read"] },
      { label: "Inbox", href: "/crm/inbox", icon: Megaphone, permissions: ["crm.read", "customers.read"] },
    ],
  },
  {
    label: "Deals",
    items: [
      { label: "Deal Desk", href: "/deals", icon: Handshake, permissions: ["deals.read"] },
      { label: "Delivery Queue", href: "/deals/delivery", icon: Workflow, permissions: ["deals.read"] },
      { label: "Funding Queue", href: "/deals/funding", icon: Banknote, permissions: ["deals.read"] },
    ],
  },
  {
    label: "Operations",
    items: [{ label: "Title Queue", href: "/deals/title", icon: Workflow, permissions: ["deals.read"] }],
  },
  {
    label: "Finance",
    items: [{ label: "Accounting", href: "/accounting", icon: Banknote, permissions: ["finance.submissions.read"] }],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3, permissions: ["reports.read", "reports.export"] }],
  },
  {
    label: "Admin",
    items: [{ label: "Admin", href: "/admin/dealership", icon: Settings, permissions: ["admin.dealership.read", "admin.roles.read"] }],
  },
];
